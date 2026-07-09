/**
 * Index project job handler
 * 
 * Handles code indexing using the codegraph core engine
 */

import * as path from 'path';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db } from '../db.js';
import { projects, indexJobs, syncJobs } from '@codegraph-cloud/db-schema';
import { CodeGraphEngine } from '@codegraph-cloud/core';
import type { Job } from 'pg-boss';
import { queryHandler } from '../query/handler.js';
import { uploadIndexIfConfigured } from '../storage/index.js';

const GIT_WORKSPACE_DIR = process.env.GIT_WORKSPACE_DIR || './data/git-workspace';

interface IndexProjectData {
  projectId: string;
  syncJobId?: string;
  changedFiles?: string[];
}

export async function handleIndexProject(job: Job<IndexProjectData>): Promise<void> {
  const { projectId, syncJobId, changedFiles } = job.data;

  console.log(`[IndexWorker] Starting index for project ${projectId}`);

  // Create index job record
  const indexJobId = `ij_${nanoid(24)}`;
  await db.insert(indexJobs).values({
    id: indexJobId,
    projectId,
    syncJobId: syncJobId || null,
    status: 'running',
    startedAt: new Date(),
  });

  try {
    // Get project info
    const projectResult = await db.select().from(projects).where(eq(projects.id, projectId));
    const project = projectResult[0];
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const workDir = path.join(GIT_WORKSPACE_DIR, projectId);
    const indexConfig = project.indexConfig as { exclude?: string[]; include?: string[]; extensions?: string[] };

    // Open the codegraph engine
    const engine = await CodeGraphEngine.open({
      projectRoot: workDir,
      indexConfig,
    });

    let result;
    if (changedFiles && changedFiles.length > 0 && project.lastIndexedAt) {
      // Incremental sync
      console.log(`[IndexWorker] Incremental sync: ${changedFiles.length} files`);
      result = await engine.sync({ changedFiles });
    } else {
      // Full index
      console.log(`[IndexWorker] Full index`);
      result = await engine.indexAll();
    }

    // Update index job
    await db
      .update(indexJobs)
      .set({
        status: 'completed',
        filesTotal: result.filesIndexed,
        filesIndexed: result.filesIndexed,
        finishedAt: new Date(),
      })
      .where(eq(indexJobs.id, indexJobId));

    // Update project
    await db
      .update(projects)
      .set({
        lastIndexedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    // Re-read project for latest synced commit (updated by sync job)
    const updatedResult = await db.select().from(projects).where(eq(projects.id, projectId));
    const updatedProject = updatedResult[0];

    engine.setIndexMetadata({
      commitSha: updatedProject?.lastSyncedCommit ?? project.lastSyncedCommit,
      indexedAt: Date.now(),
    });

    await uploadIndexIfConfigured(projectId, workDir);

    engine.close();
    queryHandler.invalidate(projectId);
    await notifyMcpInvalidate(projectId);

    console.log(`[IndexWorker] Index completed for ${projectId}: ${result.filesIndexed} files indexed`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[IndexWorker] Index failed for ${projectId}:`, errorMessage);

    await db
      .update(indexJobs)
      .set({
        status: 'failed',
        error: errorMessage,
        finishedAt: new Date(),
      })
      .where(eq(indexJobs.id, indexJobId));

    throw error;
  }
}

async function notifyMcpInvalidate(projectId: string): Promise<void> {
  const mcpUrl = process.env.MCP_INTERNAL_URL || 'http://localhost:3002';
  try {
    await fetch(`${mcpUrl}/internal/invalidate/${projectId}`, { method: 'POST' });
  } catch {
    // MCP may not be running in all environments
  }
}

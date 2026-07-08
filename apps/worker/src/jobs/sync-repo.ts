/**
 * Sync repo job handler
 * 
 * Handles git fetch/checkout operations when a sync job is triggered
 */

import * as path from 'path';
import * as fs from 'fs';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db } from '../db.js';
import { projects, syncJobs } from '@codegraph-cloud/db-schema';
import { getGitProvider } from '../git/index.js';
import { getBoss } from '../queue.js';
import { JOB_QUEUES } from '@codegraph-cloud/shared';
import type { Job } from 'pg-boss';

const GIT_MIRROR_DIR = process.env.GIT_MIRROR_DIR || './data/git-mirrors';
const GIT_WORKSPACE_DIR = process.env.GIT_WORKSPACE_DIR || './data/git-workspace';

interface SyncRepoData {
  projectId: string;
  commitSha: string | null;
  trigger: string;
}

export async function handleSyncRepo(job: Job<SyncRepoData>): Promise<void> {
  const { projectId, commitSha, trigger } = job.data;

  console.log(`[SyncWorker] Starting sync for project ${projectId}, trigger: ${trigger}`);

  // Create sync job record
  const syncJobId = `sj_${nanoid(24)}`;
  await db.insert(syncJobs).values({
    id: syncJobId,
    projectId,
    trigger: trigger as any,
    status: 'running',
    commitSha,
    startedAt: new Date(),
  });

  try {
    // Get project info
    const projectResult = await db.select().from(projects).where(eq(projects.id, projectId));
    const project = projectResult[0];
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const gitProvider = getGitProvider(project.gitProvider as any);
    const mirrorDir = path.join(GIT_MIRROR_DIR, projectId);
    const workDir = path.join(GIT_WORKSPACE_DIR, projectId);

    // Ensure directories exist
    fs.mkdirSync(mirrorDir, { recursive: true });
    fs.mkdirSync(workDir, { recursive: true });

    // Check if mirror exists, if not clone
    const isBareRepo = fs.existsSync(path.join(mirrorDir, 'HEAD'));
    if (!isBareRepo) {
      console.log(`[SyncWorker] Cloning ${project.repoUrl} to mirror`);
      await gitProvider.clone({
        repoUrl: project.repoUrl,
        targetDir: mirrorDir,
        branch: project.defaultBranch,
      });
    } else {
      // Fetch updates
      console.log(`[SyncWorker] Fetching updates for ${projectId}`);
      await gitProvider.fetch(mirrorDir);
    }

    // Determine target commit
    let targetSha = commitSha;
    if (!targetSha) {
      targetSha = await gitProvider.getRemoteHead(project.repoUrl, project.defaultBranch);
    }

    // Get changed files (if we have a previous commit)
    let changedFiles: string[] = [];
    if (project.lastSyncedCommit && project.lastSyncedCommit !== targetSha) {
      changedFiles = await gitProvider.getDiff({
        mirrorDir,
        fromSha: project.lastSyncedCommit,
        toSha: targetSha,
      });
    }

    // Remove existing worktree if exists
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true, force: true });
    }

    // Checkout target commit
    console.log(`[SyncWorker] Checking out ${targetSha}`);
    await gitProvider.checkout({
      mirrorDir,
      commitSha: targetSha,
      workDir,
    });

    // Update sync job
    await db
      .update(syncJobs)
      .set({
        status: 'completed',
        commitSha: targetSha,
        changedFiles: changedFiles.length,
        finishedAt: new Date(),
      })
      .where(eq(syncJobs.id, syncJobId));

    // Update project
    await db
      .update(projects)
      .set({
        lastSyncedCommit: targetSha,
        lastSyncedAt: new Date(),
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    console.log(`[SyncWorker] Sync completed for ${projectId}, ${changedFiles.length} files changed`);

    // Trigger index job after successful sync
    const boss = await getBoss();
    await boss.send(JOB_QUEUES.INDEX_PROJECT, {
      projectId,
      syncJobId,
      changedFiles,
    });
    console.log(`[SyncWorker] Index job scheduled for ${projectId}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SyncWorker] Sync failed for ${projectId}:`, errorMessage);

    await db
      .update(syncJobs)
      .set({
        status: 'failed',
        error: errorMessage,
        finishedAt: new Date(),
      })
      .where(eq(syncJobs.id, syncJobId));

    await db
      .update(projects)
      .set({
        status: 'error',
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    throw error;
  }
}

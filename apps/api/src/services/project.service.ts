/**
 * Project service - CRUD operations
 */

import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db.js';
import { projects, type ProjectRow, type NewProject } from '@codegraph-cloud/db-schema';
import type { IndexConfig, GitProvider, ProjectStatus } from '@codegraph-cloud/shared';

export interface CreateProjectInput {
  orgId: string;
  name: string;
  repoUrl: string;
  defaultBranch?: string;
  gitProvider?: GitProvider;
  indexConfig?: IndexConfig;
  pollIntervalSec?: number;
  pollEnabled?: boolean;
}

export interface UpdateProjectInput {
  name?: string;
  defaultBranch?: string;
  gitProvider?: GitProvider;
  indexConfig?: IndexConfig;
  pollIntervalSec?: number;
  pollEnabled?: boolean;
  status?: ProjectStatus;
  lastSyncedCommit?: string;
  lastSyncedAt?: Date;
  lastIndexedAt?: Date;
  webhookSecret?: string;
  webhookUrl?: string;
  credentialsRef?: string;
}

export class ProjectService {
  async list(orgId?: string): Promise<ProjectRow[]> {
    if (orgId) {
      return db.select().from(projects).where(eq(projects.orgId, orgId));
    }
    return db.select().from(projects);
  }

  async getById(id: string): Promise<ProjectRow | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id));
    return result[0];
  }

  async getByRepoUrl(repoUrl: string): Promise<ProjectRow | undefined> {
    const result = await db.select().from(projects).where(eq(projects.repoUrl, repoUrl));
    return result[0];
  }

  async create(input: CreateProjectInput): Promise<ProjectRow> {
    const id = `proj_${nanoid(24)}`;
    const newProject: NewProject = {
      id,
      orgId: input.orgId,
      name: input.name,
      repoUrl: input.repoUrl,
      defaultBranch: input.defaultBranch || 'main',
      gitProvider: input.gitProvider || 'gitlab',
      indexConfig: input.indexConfig || {},
      pollIntervalSec: input.pollIntervalSec || 300,
      pollEnabled: input.pollEnabled || false,
      status: 'initializing',
    };

    const result = await db.insert(projects).values(newProject).returning();
    return result[0];
  }

  async update(id: string, input: UpdateProjectInput): Promise<ProjectRow | undefined> {
    const result = await db
      .update(projects)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return result[0];
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }
}

export const projectService = new ProjectService();

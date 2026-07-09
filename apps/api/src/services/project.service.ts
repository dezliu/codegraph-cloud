/**
 * Project service - CRUD operations
 */

import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db.js';
import { projects, type ProjectRow, type NewProject } from '@codegraph-cloud/db-schema';
import {
  encryptGitCredentials,
  repoPathsMatch,
  webhookUrlForProvider,
  WEBHOOK_SECRET_LENGTH,
  type IndexConfig,
  type GitProvider,
  type ProjectStatus,
} from '@codegraph-cloud/shared';

export interface CreateProjectInput {
  orgId: string;
  name: string;
  repoUrl: string;
  defaultBranch?: string;
  gitProvider?: GitProvider;
  gitToken?: string;
  indexConfig?: IndexConfig;
  pollIntervalSec?: number;
  pollEnabled?: boolean;
}

export interface UpdateProjectInput {
  name?: string;
  defaultBranch?: string;
  gitProvider?: GitProvider;
  gitToken?: string;
  indexConfig?: IndexConfig;
  pollIntervalSec?: number;
  pollEnabled?: boolean;
  status?: ProjectStatus;
  lastSyncedCommit?: string;
  lastSyncedAt?: Date;
  lastIndexedAt?: Date;
  webhookSecret?: string;
  webhookUrl?: string;
  credentialsRef?: string | null;
}

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY is required to store Git credentials');
  }
  return key;
}

function encryptToken(gitToken: string): string {
  return encryptGitCredentials({ type: 'token', token: gitToken }, getEncryptionKey());
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

  async findByRepoPath(repoPath: string, gitProvider?: GitProvider): Promise<ProjectRow | undefined> {
    const allProjects = await this.list();
    return allProjects.find((p) => {
      if (gitProvider && p.gitProvider !== gitProvider) return false;
      return repoPathsMatch(p.repoUrl, repoPath);
    });
  }

  async create(input: CreateProjectInput): Promise<ProjectRow> {
    const id = `proj_${nanoid(24)}`;
    const gitProvider = input.gitProvider || 'gitlab';
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:3000';
    const webhookSecret = crypto.randomBytes(WEBHOOK_SECRET_LENGTH).toString('hex');

    const newProject: NewProject = {
      id,
      orgId: input.orgId,
      name: input.name,
      repoUrl: input.repoUrl,
      defaultBranch: input.defaultBranch || 'main',
      gitProvider,
      credentialsRef: input.gitToken ? encryptToken(input.gitToken) : null,
      webhookSecret,
      webhookUrl: webhookUrlForProvider(webhookBaseUrl, gitProvider),
      indexConfig: input.indexConfig || {},
      pollIntervalSec: input.pollIntervalSec ?? 300,
      pollEnabled: input.pollEnabled ?? false,
      status: 'initializing',
    };

    const result = await db.insert(projects).values(newProject).returning();
    return result[0];
  }

  async update(id: string, input: UpdateProjectInput): Promise<ProjectRow | undefined> {
    const { gitToken, ...rest } = input;
    const updates: UpdateProjectInput = { ...rest };

    if (gitToken !== undefined) {
      updates.credentialsRef = gitToken ? encryptToken(gitToken) : null;
    }

    const result = await db
      .update(projects)
      .set({ ...updates, updatedAt: new Date() })
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

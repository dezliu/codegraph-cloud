/**
 * Shared types for CodeGraph Cloud
 */

// =============================================================================
// Organization & Project
// =============================================================================

export interface Organization {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  repoUrl: string;
  defaultBranch: string;
  gitProvider: GitProvider;
  credentialsRef: string | null;
  webhookSecret: string | null;
  webhookUrl: string | null;
  pollIntervalSec: number;
  pollEnabled: boolean;
  indexConfig: IndexConfig;
  status: ProjectStatus;
  lastSyncedCommit: string | null;
  lastSyncedAt: Date | null;
  lastIndexedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type GitProvider = 'gitlab' | 'github';

export type ProjectStatus = 'active' | 'paused' | 'error' | 'initializing';

export interface IndexConfig {
  exclude?: string[];
  include?: string[];
  extensions?: string[];
}

// =============================================================================
// API Keys
// =============================================================================

export interface ApiKey {
  id: string;
  orgId: string;
  projectId: string | null; // null = org-level key
  keyHash: string;
  name: string;
  scopes: ApiKeyScope[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export type ApiKeyScope = 'read' | 'write' | 'admin';

// =============================================================================
// Sync & Index Jobs
// =============================================================================

export interface SyncJob {
  id: string;
  projectId: string;
  trigger: SyncTrigger;
  status: JobStatus;
  commitSha: string | null;
  changedFiles: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  error: string | null;
}

export type SyncTrigger = 'webhook' | 'poll' | 'manual';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface IndexJob {
  id: string;
  projectId: string;
  syncJobId: string | null;
  status: JobStatus;
  filesTotal: number | null;
  filesIndexed: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  error: string | null;
}

// =============================================================================
// Webhook Events
// =============================================================================

export interface WebhookEvent {
  id: string;
  projectId: string;
  deliveryId: string;
  eventType: WebhookEventType;
  payloadHash: string;
  processedAt: Date | null;
}

export type WebhookEventType = 'push' | 'tag_push' | 'merge_request';

// =============================================================================
// Worker
// =============================================================================

export interface WorkerInstance {
  id: string;
  host: string;
  port: number;
  assignedProjects: string[];
  lastHeartbeatAt: Date;
}

// =============================================================================
// Git
// =============================================================================

export interface GitCredentials {
  type: 'token' | 'ssh_key';
  token?: string;
  sshKey?: string;
  passphrase?: string;
}

export interface WebhookPayload {
  eventType: WebhookEventType;
  projectPath: string;
  commitSha: string;
  branch: string;
  changedFiles?: string[];
}

// =============================================================================
// MCP Query
// =============================================================================

export interface McpQueryRequest {
  projectId: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface McpQueryResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  indexedCommit?: string;
  indexedAt?: Date;
}

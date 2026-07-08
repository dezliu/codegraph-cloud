/**
 * PostgreSQL Schema for CodeGraph Cloud
 * Using Drizzle ORM
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  varchar,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// =============================================================================
// Organizations
// =============================================================================

export const organizations = pgTable('organizations', {
  id: varchar('id', { length: 32 }).primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// =============================================================================
// Projects
// =============================================================================

export const projects = pgTable(
  'projects',
  {
    id: varchar('id', { length: 32 }).primaryKey(),
    orgId: varchar('org_id', { length: 32 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    repoUrl: text('repo_url').notNull(),
    defaultBranch: varchar('default_branch', { length: 255 }).default('main').notNull(),
    gitProvider: varchar('git_provider', { length: 20 }).default('gitlab').notNull(), // 'gitlab' | 'github'
    credentialsRef: text('credentials_ref'), // encrypted credential reference
    webhookSecret: text('webhook_secret'),
    webhookUrl: text('webhook_url'),
    pollIntervalSec: integer('poll_interval_sec').default(300).notNull(),
    pollEnabled: boolean('poll_enabled').default(false).notNull(),
    indexConfig: jsonb('index_config').default({}).notNull(), // { exclude, include, extensions }
    status: varchar('status', { length: 20 }).default('initializing').notNull(), // 'active' | 'paused' | 'error' | 'initializing'
    lastSyncedCommit: text('last_synced_commit'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    lastIndexedAt: timestamp('last_indexed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_projects_org_id').on(table.orgId),
    index('idx_projects_status').on(table.status),
    uniqueIndex('idx_projects_repo_url').on(table.repoUrl),
  ]
);

// =============================================================================
// API Keys
// =============================================================================

export const apiKeys = pgTable(
  'api_keys',
  {
    id: varchar('id', { length: 32 }).primaryKey(),
    orgId: varchar('org_id', { length: 32 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: varchar('project_id', { length: 32 }).references(() => projects.id, { onDelete: 'cascade' }), // null = org-level
    keyHash: text('key_hash').notNull(),
    name: text('name').notNull(),
    scopes: jsonb('scopes').default(['read']).notNull(), // ['read', 'write', 'admin']
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_api_keys_org_id').on(table.orgId),
    index('idx_api_keys_project_id').on(table.projectId),
    index('idx_api_keys_key_hash').on(table.keyHash),
  ]
);

// =============================================================================
// Sync Jobs
// =============================================================================

export const syncJobs = pgTable(
  'sync_jobs',
  {
    id: varchar('id', { length: 32 }).primaryKey(),
    projectId: varchar('project_id', { length: 32 })
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    trigger: varchar('trigger', { length: 20 }).notNull(), // 'webhook' | 'poll' | 'manual'
    status: varchar('status', { length: 20 }).default('pending').notNull(), // 'pending' | 'running' | 'completed' | 'failed'
    commitSha: text('commit_sha'),
    changedFiles: integer('changed_files'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    error: text('error'),
  },
  (table) => [
    index('idx_sync_jobs_project_id').on(table.projectId),
    index('idx_sync_jobs_status').on(table.status),
  ]
);

// =============================================================================
// Index Jobs
// =============================================================================

export const indexJobs = pgTable(
  'index_jobs',
  {
    id: varchar('id', { length: 32 }).primaryKey(),
    projectId: varchar('project_id', { length: 32 })
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    syncJobId: varchar('sync_job_id', { length: 32 }).references(() => syncJobs.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    filesTotal: integer('files_total'),
    filesIndexed: integer('files_indexed'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    error: text('error'),
  },
  (table) => [
    index('idx_index_jobs_project_id').on(table.projectId),
    index('idx_index_jobs_status').on(table.status),
  ]
);

// =============================================================================
// Webhook Events (dedup)
// =============================================================================

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: varchar('id', { length: 32 }).primaryKey(),
    projectId: varchar('project_id', { length: 32 })
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    deliveryId: text('delivery_id').notNull(),
    eventType: varchar('event_type', { length: 30 }).notNull(), // 'push' | 'tag_push' | 'merge_request'
    payloadHash: text('payload_hash').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_webhook_events_project_id').on(table.projectId),
    uniqueIndex('idx_webhook_events_delivery').on(table.projectId, table.deliveryId),
  ]
);

// =============================================================================
// Worker Instances (for query routing)
// =============================================================================

export const workerInstances = pgTable(
  'worker_instances',
  {
    id: varchar('id', { length: 32 }).primaryKey(),
    host: text('host').notNull(),
    port: integer('port').notNull(),
    assignedProjects: jsonb('assigned_projects').default([]).notNull(), // string[] of project IDs
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_worker_heartbeat').on(table.lastHeartbeatAt),
  ]
);

// =============================================================================
// Type exports
// =============================================================================

export type OrganizationRow = typeof organizations.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type SyncJobRow = typeof syncJobs.$inferSelect;
export type IndexJobRow = typeof indexJobs.$inferSelect;
export type WebhookEventRow = typeof webhookEvents.$inferSelect;
export type WorkerInstanceRow = typeof workerInstances.$inferSelect;

export type NewProject = typeof projects.$inferInsert;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type NewSyncJob = typeof syncJobs.$inferInsert;
export type NewIndexJob = typeof indexJobs.$inferInsert;

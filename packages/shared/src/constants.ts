/**
 * Shared constants for CodeGraph Cloud
 */

export const DEFAULT_POLL_INTERVAL_SEC = 300; // 5 minutes
export const MIN_POLL_INTERVAL_SEC = 60; // 1 minute
export const MAX_POLL_INTERVAL_SEC = 86400; // 24 hours

export const WEBHOOK_SECRET_LENGTH = 32;
export const API_KEY_PREFIX = 'cgk_';

export const JOB_QUEUES = {
  SYNC_REPO: 'sync-repo',
  INDEX_PROJECT: 'index-project',
  INCREMENTAL_SYNC: 'incremental-sync',
} as const;

export const GIT_PROVIDERS = ['gitlab', 'github'] as const;
export const PROJECT_STATUSES = ['active', 'paused', 'error', 'initializing'] as const;
export const JOB_STATUSES = ['pending', 'running', 'completed', 'failed'] as const;
export const SYNC_TRIGGERS = ['webhook', 'poll', 'manual'] as const;
export const API_KEY_SCOPES = ['read', 'write', 'admin'] as const;

/**
 * Worker entry point
 * 
 * Starts pg-boss workers for sync and index jobs
 */

import PgBoss from 'pg-boss';
import { JOB_QUEUES } from '@codegraph-cloud/shared';
import { handleSyncRepo } from './jobs/sync-repo.js';
import { handleIndexProject } from './jobs/index-project.js';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://codegraph:codegraph_dev@localhost:5432/codegraph_cloud';

let boss: PgBoss | null = null;

async function main() {
  console.log('[Worker] Starting worker...');

  // Initialize pg-boss
  boss = new PgBoss({
    connectionString: DATABASE_URL,
    noSupervisor: false,
    noMigrations: false,
  });

  await boss.start();
  console.log('[Worker] Job queue initialized');

  // Create queues
  await boss.createQueue(JOB_QUEUES.SYNC_REPO);
  await boss.createQueue(JOB_QUEUES.INDEX_PROJECT);
  await boss.createQueue(JOB_QUEUES.INCREMENTAL_SYNC);

  // Register workers
  await boss.work(JOB_QUEUES.SYNC_REPO, { teamSize: 3, teamConcurrency: 1 }, handleSyncRepo);
  await boss.work(JOB_QUEUES.INDEX_PROJECT, { teamSize: 2, teamConcurrency: 1 }, handleIndexProject);

  console.log('[Worker] Workers registered:');
  console.log(`  - ${JOB_QUEUES.SYNC_REPO} (teamSize: 3)`);
  console.log(`  - ${JOB_QUEUES.INDEX_PROJECT} (teamSize: 2)`);
  console.log('[Worker] Ready and waiting for jobs...');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] Shutting down...');
  if (boss) {
    await boss.stop();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] Shutting down...');
  if (boss) {
    await boss.stop();
  }
  process.exit(0);
});

main().catch((err) => {
  console.error('[Worker] Failed to start:', err);
  process.exit(1);
});

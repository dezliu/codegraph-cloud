/**
 * Worker entry point
 * 
 * Starts pg-boss workers for sync and index jobs,
 * plus an HTTP query endpoint for the MCP server to proxy queries.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { JOB_QUEUES } from '@codegraph-cloud/shared';
import { handleSyncRepo } from './jobs/sync-repo.js';
import { handleIndexProject } from './jobs/index-project.js';
import { queryHandler } from './query/handler.js';
import { getBoss, stopBoss } from './queue.js';

const WORKER_PORT = parseInt(process.env.WORKER_PORT || '3001');

// HTTP query server for MCP server proxy
const app = new Hono();
app.use('*', cors());

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'worker' }));

// Query endpoint - called by MCP server
app.post('/query', async (c) => {
  const body = await c.req.json();
  const { projectId, tool, args } = body;

  if (!projectId || !tool) {
    return c.json({ error: 'projectId and tool are required' }, 400);
  }

  try {
    const result = await queryHandler.executeQuery(projectId, tool, args || {});
    return c.json({ success: true, data: result });
  } catch (err) {
    return c.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// Status endpoint
app.get('/status/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  try {
    const result = await queryHandler.executeQuery(projectId, 'codegraph_status', {});
    return c.json({ success: true, data: result });
  } catch (err) {
    return c.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

async function main() {
  console.log('[Worker] Starting worker...');

  // Initialize pg-boss
  const boss = await getBoss();
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

  // Start HTTP query server
  serve({
    fetch: app.fetch,
    port: WORKER_PORT,
  });
  console.log(`[Worker] Query endpoint running at http://0.0.0.0:${WORKER_PORT}`);
  console.log('[Worker] Ready and waiting for jobs...');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] Shutting down...');
  queryHandler.closeAll();
  await stopBoss();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] Shutting down...');
  queryHandler.closeAll();
  await stopBoss();
  process.exit(0);
});

main().catch((err) => {
  console.error('[Worker] Failed to start:', err);
  process.exit(1);
});

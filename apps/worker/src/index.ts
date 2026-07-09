/**
 * Worker entry point
 * 
 * Starts pg-boss workers for sync and index jobs,
 * plus an HTTP query endpoint for the MCP server to proxy queries.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  attachHttpServerErrorHandler,
  bindHttpServer,
  releaseHttpServer,
  JOB_QUEUES,
} from '@codegraph-cloud/shared';
import { handleSyncRepo } from './jobs/sync-repo.js';
import { handleIndexProject } from './jobs/index-project.js';
import { queryHandler } from './query/handler.js';
import { getBoss, stopBoss } from './queue.js';

const WORKER_PORT = parseInt(process.env.WORKER_PORT || '3001');
const HTTP_SERVER_KEY = '__codegraph_worker_http_server__';

let shuttingDown = false;

const app = new Hono();
app.use('*', cors());

app.get('/health', (c) => c.json({ status: 'ok', service: 'worker' }));

app.get('/', (c) =>
  c.json({
    service: 'worker',
    status: 'ok',
    endpoints: {
      health: 'GET /health',
      query: 'POST /query',
      projectStatus: 'GET /status/:projectId',
    },
  }),
);

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

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Worker] Shutting down (${signal})...`);
  await releaseHttpServer(HTTP_SERVER_KEY);
  queryHandler.closeAll();
  await stopBoss();
  process.exit(0);
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch((err) => {
    console.error('[Worker] Shutdown error:', err);
    process.exit(1);
  });
});

process.on('SIGINT', () => {
  shutdown('SIGINT').catch((err) => {
    console.error('[Worker] Shutdown error:', err);
    process.exit(1);
  });
});

async function main() {
  console.log('[Worker] Starting worker...');

  const boss = await getBoss();
  console.log('[Worker] Job queue initialized');

  await boss.createQueue(JOB_QUEUES.SYNC_REPO);
  await boss.createQueue(JOB_QUEUES.INCREMENTAL_SYNC);
  await boss.createQueue(JOB_QUEUES.INDEX_PROJECT);

  await boss.work(JOB_QUEUES.SYNC_REPO, { teamSize: 3, teamConcurrency: 1 }, handleSyncRepo);
  await boss.work(JOB_QUEUES.INDEX_PROJECT, { teamSize: 2, teamConcurrency: 1 }, handleIndexProject);

  console.log('[Worker] Workers registered:');
  console.log(`  - ${JOB_QUEUES.SYNC_REPO} (teamSize: 3)`);
  console.log(`  - ${JOB_QUEUES.INDEX_PROJECT} (teamSize: 2)`);

  const server = await bindHttpServer(HTTP_SERVER_KEY, {
    fetch: app.fetch,
    port: WORKER_PORT,
  });
  attachHttpServerErrorHandler(server, 'Worker', WORKER_PORT);
  console.log(`[Worker] Query endpoint running at http://0.0.0.0:${WORKER_PORT}`);
  console.log('[Worker] Ready and waiting for jobs...');
}

main().catch((err) => {
  console.error('[Worker] Failed to start:', err);
  process.exit(1);
});

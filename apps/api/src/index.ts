/**
 * CodeGraph Cloud API Server
 * 
 * REST API + Webhook receiver + Job scheduler
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import {
  attachHttpServerErrorHandler,
  bindHttpServer,
  releaseHttpServer,
} from '@codegraph-cloud/shared';
import { projectsRouter } from './routes/projects.js';
import { apiKeysRouter } from './routes/api-keys.js';
import { webhooksRouter } from './routes/webhooks.js';
import { jobsRouter } from './routes/jobs.js';
import { authMiddleware } from './middleware/auth.js';
import { getBoss, stopBoss } from './queue.js';

const app = new Hono();

app.use('*', cors());
app.use('*', logger());

app.get('/health', (c) => c.json({ status: 'ok', service: 'api' }));
app.route('/webhooks', webhooksRouter);
app.use('/api/*', authMiddleware);
app.route('/api/projects', projectsRouter);
app.route('/api/api-keys', apiKeysRouter);
app.route('/api/jobs', jobsRouter);

const port = parseInt(process.env.API_PORT || '3000');
const host = process.env.API_HOST || '0.0.0.0';
const HTTP_SERVER_KEY = '__codegraph_api_http_server__';

let shuttingDown = false;

async function main() {
  await getBoss();
  console.log('[API] Job queue initialized');

  const server = await bindHttpServer(HTTP_SERVER_KEY, {
    fetch: app.fetch,
    port,
    hostname: host,
  });
  attachHttpServerErrorHandler(server, 'API', port);
  console.log(`[API] Server running at http://${host}:${port}`);
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[API] Shutting down (${signal})...`);
  await releaseHttpServer(HTTP_SERVER_KEY);
  await stopBoss();
  process.exit(0);
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch((err) => {
    console.error('[API] Shutdown error:', err);
    process.exit(1);
  });
});

process.on('SIGINT', () => {
  shutdown('SIGINT').catch((err) => {
    console.error('[API] Shutdown error:', err);
    process.exit(1);
  });
});

main().catch((err) => {
  console.error('[API] Failed to start:', err);
  process.exit(1);
});

export default app;

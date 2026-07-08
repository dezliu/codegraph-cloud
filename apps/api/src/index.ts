/**
 * CodeGraph Cloud API Server
 * 
 * REST API + Webhook receiver + Job scheduler
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { projectsRouter } from './routes/projects.js';
import { apiKeysRouter } from './routes/api-keys.js';
import { webhooksRouter } from './routes/webhooks.js';
import { jobsRouter } from './routes/jobs.js';
import { authMiddleware } from './middleware/auth.js';
import { getBoss, stopBoss } from './queue.js';

const app = new Hono();

// Global middleware
app.use('*', cors());
app.use('*', logger());

// Health check (no auth)
app.get('/health', (c) => c.json({ status: 'ok', service: 'api' }));

// Webhook routes (no auth - verified by webhook secret)
app.route('/webhooks', webhooksRouter);

// Protected routes (require API key)
app.use('/api/*', authMiddleware);

// API routes
app.route('/api/projects', projectsRouter);
app.route('/api/api-keys', apiKeysRouter);
app.route('/api/jobs', jobsRouter);

// Start server
const port = parseInt(process.env.API_PORT || '3000');
const host = process.env.API_HOST || '0.0.0.0';

async function main() {
  // Initialize pg-boss
  await getBoss();
  console.log('[API] Job queue initialized');

  // Start HTTP server
  serve({
    fetch: app.fetch,
    port,
    hostname: host,
  });

  console.log(`[API] Server running at http://${host}:${port}`);
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[API] Shutting down...');
  await stopBoss();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[API] Shutting down...');
  await stopBoss();
  process.exit(0);
});

main().catch((err) => {
  console.error('[API] Failed to start:', err);
  process.exit(1);
});

export default app;

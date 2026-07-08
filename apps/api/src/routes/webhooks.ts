/**
 * Webhook routes - receives Git webhooks (GitLab/GitHub)
 */

import { Hono } from 'hono';
import crypto from 'node:crypto';
import { projectService } from '../services/project.service.js';
import { schedulerService } from '../services/scheduler.service.js';
import { db } from '../db.js';
import { webhookEvents } from '@codegraph-cloud/db-schema';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

export const webhooksRouter = new Hono();

// GitLab webhook endpoint
webhooksRouter.post('/gitlab', async (c) => {
  const body = await c.req.json();
  const event = c.req.header('X-Gitlab-Event');
  const token = c.req.header('X-Gitlab-Token');

  // Determine event type
  let eventType: 'push' | 'tag_push' | 'merge_request';
  if (event === 'Push Hook') eventType = 'push';
  else if (event === 'Tag Push Hook') eventType = 'tag_push';
  else if (event === 'Merge Request Hook') eventType = 'merge_request';
  else {
    return c.json({ error: 'Unsupported event type' }, 400);
  }

  // Only process push events for now
  if (eventType !== 'push') {
    return c.json({ message: 'Event ignored (only push events processed)' });
  }

  // Extract project path from payload
  const projectPath = body.project?.path_with_namespace;
  if (!projectPath) {
    return c.json({ error: 'Missing project path in payload' }, 400);
  }

  // Find matching project by repo URL
  const allProjects = await projectService.list();
  const project = allProjects.find((p) => {
    const url = new URL(p.repoUrl);
    return url.pathname.replace(/^\//, '').replace(/\.git$/, '') === projectPath.replace(/\.git$/, '');
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Verify webhook secret
  if (project.webhookSecret && token !== project.webhookSecret) {
    return c.json({ error: 'Invalid webhook token' }, 401);
  }

  // Dedup by delivery ID (GitLab doesn't provide one, use commit SHA)
  const commitSha = body.after || body.checkout_sha;
  const deliveryId = `gitlab-${commitSha}-${Date.now()}`;
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');

  // Check for duplicate
  const existing = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.deliveryId, deliveryId));

  if (existing.length > 0) {
    return c.json({ message: 'Duplicate event ignored' });
  }

  // Record webhook event
  await db.insert(webhookEvents).values({
    id: `evt_${nanoid(24)}`,
    projectId: project.id,
    deliveryId,
    eventType,
    payloadHash,
    processedAt: new Date(),
  });

  // Schedule sync job
  const jobId = await schedulerService.scheduleSyncJob(project.id, commitSha, 'webhook');

  return c.json({ data: { jobId, message: 'Sync job scheduled' } });
});

// GitHub webhook endpoint (placeholder)
webhooksRouter.post('/github', async (c) => {
  // TODO: Implement GitHub webhook handling
  return c.json({ message: 'GitHub webhook not yet implemented' }, 501);
});

// Health check
webhooksRouter.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

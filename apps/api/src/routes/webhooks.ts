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
import { eq, and } from 'drizzle-orm';

export const webhooksRouter = new Hono();

function verifyGitHubSignature(rawBody: Buffer, secret: string, signatureHeader: string): boolean {
  if (!signatureHeader.startsWith('sha256=')) return false;
  const hmac = crypto.createHmac('sha256', secret);
  const expected = `sha256=${hmac.update(rawBody).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function recordAndScheduleSync(options: {
  projectId: string;
  deliveryId: string;
  eventType: 'push' | 'tag_push' | 'merge_request';
  payloadHash: string;
  commitSha: string;
}): Promise<string> {
  const existing = await db
    .select()
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.projectId, options.projectId),
        eq(webhookEvents.deliveryId, options.deliveryId),
      ),
    );

  if (existing.length > 0) {
    return '';
  }

  await db.insert(webhookEvents).values({
    id: `evt_${nanoid(24)}`,
    projectId: options.projectId,
    deliveryId: options.deliveryId,
    eventType: options.eventType,
    payloadHash: options.payloadHash,
    processedAt: new Date(),
  });

  return schedulerService.scheduleSyncJob(options.projectId, options.commitSha, 'webhook');
}

// GitLab webhook endpoint
webhooksRouter.post('/gitlab', async (c) => {
  const body = await c.req.json();
  const event = c.req.header('X-Gitlab-Event');
  const token = c.req.header('X-Gitlab-Token');

  let eventType: 'push' | 'tag_push' | 'merge_request';
  if (event === 'Push Hook') eventType = 'push';
  else if (event === 'Tag Push Hook') eventType = 'tag_push';
  else if (event === 'Merge Request Hook') eventType = 'merge_request';
  else {
    return c.json({ error: 'Unsupported event type' }, 400);
  }

  if (eventType !== 'push') {
    return c.json({ message: 'Event ignored (only push events processed)' });
  }

  const projectPath = body.project?.path_with_namespace;
  if (!projectPath) {
    return c.json({ error: 'Missing project path in payload' }, 400);
  }

  const project = await projectService.findByRepoPath(projectPath, 'gitlab');
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  if (project.webhookSecret && token !== project.webhookSecret) {
    return c.json({ error: 'Invalid webhook token' }, 401);
  }

  const commitSha = body.after || body.checkout_sha;
  if (!commitSha || commitSha === '0000000000000000000000000000000000000000') {
    return c.json({ message: 'Branch delete event ignored' });
  }

  const deliveryId = c.req.header('X-Gitlab-Event-UUID') || `gitlab-${commitSha}`;
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');

  const jobId = await recordAndScheduleSync({
    projectId: project.id,
    deliveryId,
    eventType,
    payloadHash,
    commitSha,
  });

  if (!jobId) {
    return c.json({ message: 'Duplicate event ignored' });
  }

  return c.json({ data: { jobId, message: 'Sync job scheduled' } });
});

// GitHub webhook endpoint
webhooksRouter.post('/github', async (c) => {
  const rawBody = await c.req.text();
  const body = JSON.parse(rawBody);
  const event = c.req.header('X-GitHub-Event');
  const deliveryId = c.req.header('X-GitHub-Delivery') || `github-${Date.now()}`;

  if (event !== 'push') {
    return c.json({ message: 'Event ignored (only push events processed)' });
  }

  const projectPath = body.repository?.full_name;
  if (!projectPath) {
    return c.json({ error: 'Missing repository in payload' }, 400);
  }

  const project = await projectService.findByRepoPath(projectPath, 'github');
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  if (project.webhookSecret) {
    const signature = c.req.header('X-Hub-Signature-256') || '';
    const valid = verifyGitHubSignature(Buffer.from(rawBody), project.webhookSecret, signature);
    if (!valid) {
      return c.json({ error: 'Invalid webhook signature' }, 401);
    }
  }

  const commitSha = body.after || body.head_commit?.id;
  if (!commitSha || commitSha === '0000000000000000000000000000000000000000') {
    return c.json({ message: 'Branch delete event ignored' });
  }

  const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');

  const jobId = await recordAndScheduleSync({
    projectId: project.id,
    deliveryId,
    eventType: 'push',
    payloadHash,
    commitSha,
  });

  if (!jobId) {
    return c.json({ message: 'Duplicate event ignored' });
  }

  return c.json({ data: { jobId, message: 'Sync job scheduled' } });
});

webhooksRouter.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

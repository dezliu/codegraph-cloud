/**
 * Sync/Index job history routes
 */

import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db.js';
import { syncJobs, indexJobs } from '@codegraph-cloud/db-schema';
import { requireScope } from '../middleware/auth.js';

export const jobsRouter = new Hono();

jobsRouter.use('*', requireScope('read'));

// List sync jobs for a project
jobsRouter.get('/sync/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await db
    .select()
    .from(syncJobs)
    .where(eq(syncJobs.projectId, projectId))
    .orderBy(desc(syncJobs.startedAt))
    .limit(50);
  return c.json({ data: result });
});

// List index jobs for a project
jobsRouter.get('/index/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await db
    .select()
    .from(indexJobs)
    .where(eq(indexJobs.projectId, projectId))
    .orderBy(desc(indexJobs.startedAt))
    .limit(50);
  return c.json({ data: result });
});

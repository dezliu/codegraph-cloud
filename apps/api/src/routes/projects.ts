/**
 * Project routes
 */

import { Hono } from 'hono';
import { projectService } from '../services/project.service.js';
import { schedulerService } from '../services/scheduler.service.js';

export const projectsRouter = new Hono();

// List projects
projectsRouter.get('/', async (c) => {
  const orgId = c.req.query('orgId');
  const projects = await projectService.list(orgId);
  return c.json({ data: projects });
});

// Get project by ID
projectsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const project = await projectService.getById(id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  return c.json({ data: project });
});

// Create project
projectsRouter.post('/', async (c) => {
  const body = await c.req.json();
  const project = await projectService.create(body);

  // Setup polling if enabled
  if (project.pollEnabled && project.pollIntervalSec > 0) {
    await schedulerService.setupPollingSchedule(project.id, project.pollIntervalSec);
  }

  return c.json({ data: project }, 201);
});

// Update project
projectsRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const project = await projectService.update(id, body);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Update polling schedule if changed
  if (body.pollEnabled !== undefined || body.pollIntervalSec !== undefined) {
    if (project.pollEnabled && project.pollIntervalSec > 0) {
      await schedulerService.setupPollingSchedule(project.id, project.pollIntervalSec);
    } else {
      await schedulerService.removePollingSchedule(project.id);
    }
  }

  return c.json({ data: project });
});

// Delete project
projectsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await projectService.delete(id);
  if (!deleted) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Remove polling schedule
  await schedulerService.removePollingSchedule(id);

  return c.json({ success: true });
});

// Trigger manual sync
projectsRouter.post('/:id/sync', async (c) => {
  const id = c.req.param('id');
  const project = await projectService.getById(id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const jobId = await schedulerService.scheduleSyncJob(id, null, 'manual');
  return c.json({ data: { jobId, message: 'Sync job scheduled' } });
});

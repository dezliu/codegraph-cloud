/**
 * API Key routes
 */

import { Hono } from 'hono';
import { apiKeyService } from '../services/api-key.service.js';

export const apiKeysRouter = new Hono();

// List API keys for an organization
apiKeysRouter.get('/', async (c) => {
  const orgId = c.req.query('orgId');
  if (!orgId) {
    return c.json({ error: 'orgId is required' }, 400);
  }
  const keys = await apiKeyService.list(orgId);
  // Don't return key hashes
  const safeKeys = keys.map(({ keyHash, ...rest }) => rest);
  return c.json({ data: safeKeys });
});

// Create API key
apiKeysRouter.post('/', async (c) => {
  const body = await c.req.json();
  const { key, apiKey } = await apiKeyService.create(body);

  return c.json({
    data: {
      ...apiKey,
      key, // Only returned once!
    },
  }, 201);
});

// Revoke API key
apiKeysRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const revoked = await apiKeyService.revoke(id);
  if (!revoked) {
    return c.json({ error: 'API key not found' }, 404);
  }
  return c.json({ success: true });
});

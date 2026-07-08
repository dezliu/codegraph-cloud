/**
 * Auth middleware - API Key validation
 */

import { Context, Next } from 'hono';
import { apiKeyService } from '../services/api-key.service.js';

// Extend Hono context variables
declare module 'hono' {
  interface ContextVariableMap {
    apiKey: {
      id: string;
      orgId: string;
      projectId: string | null;
      scopes: string[];
    };
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const key = authHeader.slice(7);
  const apiKey = await apiKeyService.validate(key);

  if (!apiKey) {
    return c.json({ error: 'Invalid or expired API key' }, 401);
  }

  c.set('apiKey', {
    id: apiKey.id,
    orgId: apiKey.orgId,
    projectId: apiKey.projectId,
    scopes: apiKey.scopes as string[],
  });

  await next();
}

/**
 * Require specific scope
 */
export function requireScope(scope: string) {
  return async (c: Context, next: Next) => {
    const apiKey = c.get('apiKey');
    if (!apiKey || !apiKey.scopes.includes(scope)) {
      return c.json({ error: `Insufficient permissions. Required scope: ${scope}` }, 403);
    }
    await next();
  };
}

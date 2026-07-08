/**
 * MCP Server Entry Point
 * 
 * Implements MCP Streamable HTTP transport for remote code graph queries.
 * Clients (Cursor, Claude) connect via HTTP and query project indexes.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { eq } from 'drizzle-orm';
import { db } from './db.js';
import { projects, apiKeys } from '@codegraph-cloud/db-schema';
import { CodeGraphEngine } from '@codegraph-cloud/core';
import { TOOLS, executeTool } from './tools/index.js';
import * as path from 'path';
import crypto from 'node:crypto';

const app = new Hono();

// Global middleware
app.use('*', cors());

// Engine cache - keep engines alive for active projects
const engineCache = new Map<string, CodeGraphEngine>();
const GIT_WORKSPACE_DIR = process.env.GIT_WORKSPACE_DIR || './data/git-workspace';

/**
 * Get or create an engine for a project
 */
async function getEngine(projectId: string): Promise<CodeGraphEngine | null> {
  // Check cache
  if (engineCache.has(projectId)) {
    return engineCache.get(projectId)!;
  }

  // Get project info
  const result = await db.select().from(projects).where(eq(projects.id, projectId));
  const project = result[0];
  if (!project) return null;

  const workDir = path.join(GIT_WORKSPACE_DIR, projectId);
  
  // Check if project has been indexed
  if (!project.lastIndexedAt) {
    return null;
  }

  try {
    const engine = await CodeGraphEngine.open({
      projectRoot: workDir,
      indexConfig: project.indexConfig as any,
    });
    engineCache.set(projectId, engine);
    return engine;
  } catch (err) {
    console.error(`[MCP] Failed to open engine for ${projectId}:`, err);
    return null;
  }
}

/**
 * Validate API key
 */
async function validateApiKey(key: string): Promise<{ orgId: string; projectId: string | null } | null> {
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const result = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));
  const apiKey = result[0];
  
  if (!apiKey) return null;
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) return null;

  // Update last used
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, apiKey.id));

  return { orgId: apiKey.orgId, projectId: apiKey.projectId };
}

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'mcp-server' }));

// MCP endpoint - Streamable HTTP
app.post('/mcp', async (c) => {
  // Authenticate
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const apiKey = await validateApiKey(authHeader.slice(7));
  if (!apiKey) {
    return c.json({ error: 'Invalid or expired API key' }, 401);
  }

  // Get project ID from header or API key scope
  let projectId = c.req.header('X-Project-Id') || apiKey.projectId;
  if (!projectId) {
    return c.json({ error: 'X-Project-Id header required (or use project-scoped API key)' }, 400);
  }

  // Parse MCP request
  const body = await c.req.json();
  const { method, params, id } = body;

  // Handle MCP methods
  switch (method) {
    case 'initialize':
      return c.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2025-06-18',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'codegraph-cloud',
            version: '0.1.0',
          },
        },
      });

    case 'tools/list':
      return c.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: TOOLS,
        },
      });

    case 'tools/call': {
      const { name, arguments: args } = params;
      
      // Get engine for project
      const engine = await getEngine(projectId);
      if (!engine) {
        return c.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `Project ${projectId} has not been indexed yet. Please wait for indexing to complete.`,
              },
            ],
            isError: false,
          },
        });
      }

      try {
        const result = await executeTool(engine, name, args || {});
        return c.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          },
        });
      } catch (err) {
        return c.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `Error executing ${name}: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
            isError: true,
          },
        });
      }
    }

    default:
      return c.json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
      }, 404);
  }
});

// SSE endpoint (optional, for streaming)
app.get('/mcp/sse', (c) => {
  return c.json({ message: 'SSE not yet implemented' }, 501);
});

// Start server
const port = parseInt(process.env.MCP_PORT || '3002');

async function main() {
  serve({
    fetch: app.fetch,
    port,
  });
  console.log(`[MCP] Server running at http://0.0.0.0:${port}`);
  console.log(`[MCP] Endpoint: POST /mcp`);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[MCP] Shutting down...');
  for (const engine of engineCache.values()) {
    engine.close();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[MCP] Shutting down...');
  for (const engine of engineCache.values()) {
    engine.close();
  }
  process.exit(0);
});

main().catch((err) => {
  console.error('[MCP] Failed to start:', err);
  process.exit(1);
});

export default app;

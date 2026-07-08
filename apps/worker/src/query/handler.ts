/**
 * Query Handler
 * 
 * Manages CodeGraphEngine instances for each project and handles
 * query requests forwarded from the MCP server.
 */

import * as path from 'path';
import { CodeGraphEngine } from '@codegraph-cloud/core';
import { eq } from 'drizzle-orm';
import { db } from '../db.js';
import { projects } from '@codegraph-cloud/db-schema';

const GIT_WORKSPACE_DIR = process.env.GIT_WORKSPACE_DIR || './data/git-workspace';

/**
 * QueryHandler manages engine instances and routes queries
 */
export class QueryHandler {
  private engines = new Map<string, CodeGraphEngine>();

  /**
   * Get or create an engine for a project
   */
  async getEngine(projectId: string): Promise<CodeGraphEngine | null> {
    // Check cache
    if (this.engines.has(projectId)) {
      return this.engines.get(projectId)!;
    }

    // Get project info
    const result = await db.select().from(projects).where(eq(projects.id, projectId));
    const project = result[0];
    if (!project) return null;

    // Check if project has been indexed
    if (!project.lastIndexedAt) return null;

    const workDir = path.join(GIT_WORKSPACE_DIR, projectId);
    const indexConfig = project.indexConfig as { exclude?: string[]; include?: string[]; extensions?: string[] };

    try {
      const engine = await CodeGraphEngine.open({
        projectRoot: workDir,
        indexConfig,
      });
      this.engines.set(projectId, engine);
      return engine;
    } catch (err) {
      console.error(`[QueryHandler] Failed to open engine for ${projectId}:`, err);
      return null;
    }
  }

  /**
   * Execute a query on a project's engine
   */
  async executeQuery(projectId: string, tool: string, args: Record<string, any>): Promise<any> {
    const engine = await this.getEngine(projectId);
    if (!engine) {
      throw new Error(`Project ${projectId} not indexed yet`);
    }

    switch (tool) {
      case 'codegraph_explore':
        return engine.explore(args.query, { depth: args.depth });
      case 'codegraph_search':
        return engine.search(args.query, { limit: args.limit });
      case 'codegraph_callers':
        return engine.getCallers(args.symbolName);
      case 'codegraph_callees':
        return engine.getCallees(args.symbolName);
      case 'codegraph_impact':
        return engine.getImpactRadius(args.symbolName, args.depth || 3);
      case 'codegraph_status':
        return engine.getStatus();
      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
  }

  /**
   * Invalidate a project's engine (e.g., after re-index)
   */
  invalidate(projectId: string): void {
    const engine = this.engines.get(projectId);
    if (engine) {
      engine.close();
      this.engines.delete(projectId);
    }
  }

  /**
   * Close all engines
   */
  closeAll(): void {
    for (const [, engine] of this.engines) {
      engine.close();
    }
    this.engines.clear();
  }
}

export const queryHandler = new QueryHandler();

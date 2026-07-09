/**
 * CodeGraphEngine - Cloud-adapted wrapper for the codegraph core
 * 
 * This is the main entry point for using the indexing engine in the cloud.
 * It wraps the forked codegraph modules and provides a clean API for:
 * - Full indexing of a project
 * - Incremental sync (only changed files)
 * - Querying the index (explore, search, callers, callees, impact)
 */

import * as path from 'path';
import * as fs from 'fs';
import { createDirectory, isInitialized, getCodeGraphDir } from './directory.js';
import { DatabaseConnection, getDatabasePath } from './db/index.js';
import { QueryBuilder } from './db/queries.js';
import { ExtractionOrchestrator, IndexResult as CoreIndexResult, SyncResult as CoreSyncResult, IndexProgress, initGrammars } from './extraction/index.js';
import { createResolver, ReferenceResolver, ResolutionResult } from './resolution/index.js';
import { GraphTraverser } from './graph/traversal.js';
import { GraphQueryManager } from './graph/queries.js';
import { ContextBuilder, createContextBuilder } from './context/index.js';
import type { Node, Edge, Subgraph, SearchOptions, SearchResult as CoreSearchResult } from './types.js';

// Re-export types from the core
export * from './types.js';
export { getCodeGraphDir, isInitialized, createDirectory, removeDirectory, validateDirectory, isCodeGraphDataDir } from './directory.js';
export { DatabaseConnection, getDatabasePath } from './db/index.js';
export { QueryBuilder } from './db/queries.js';

export interface EngineOptions {
  /** Project root directory (Git workspace) */
  projectRoot: string;
  /** Optional: custom database path (default: projectRoot/.codegraph/codegraph.db) */
  dbPath?: string;
  /** Index configuration */
  indexConfig?: {
    exclude?: string[];
    include?: string[];
    extensions?: string[];
  };
}

export interface IndexResult {
  filesIndexed: number;
  nodesExtracted: number;
  duration: number;
  errors: string[];
}

export interface SyncResult extends IndexResult {
  filesChanged: number;
  filesDeleted: number;
}

export interface ExploreResult {
  content: string;
  nodes: Array<{
    id: string;
    name: string;
    kind: string;
    filePath: string;
    startLine: number;
    endLine: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
    kind: string;
  }>;
}

export interface SearchResult {
  id: string;
  name: string;
  qualifiedName: string;
  kind: string;
  filePath: string;
  startLine: number;
  endLine: number;
  docstring: string | null;
  score: number;
}

/**
 * CodeGraphEngine - Main class for cloud-based code intelligence
 * 
 * Usage:
 * ```ts
 * const engine = await CodeGraphEngine.open({
 *   projectRoot: '/data/git-workspace/project-123',
 * });
 * 
 * // Full index
 * await engine.indexAll();
 * 
 * // Incremental sync
 * await engine.sync({ changedFiles: ['src/foo.ts'] });
 * 
 * // Query
 * const result = engine.explore('UserService');
 * ```
 */
export class CodeGraphEngine {
  private projectRoot: string;
  private dbPath: string;
  private indexConfig: EngineOptions['indexConfig'];
  
  // Core components from forked codegraph
  private db: DatabaseConnection | null = null;
  private queries: QueryBuilder | null = null;
  private orchestrator: ExtractionOrchestrator | null = null;
  private resolver: ReferenceResolver | null = null;
  private graphManager: GraphQueryManager | null = null;
  private traverser: GraphTraverser | null = null;
  private contextBuilder: ContextBuilder | null = null;
  private initialized = false;

  private constructor(options: EngineOptions) {
    this.projectRoot = options.projectRoot;
    this.dbPath = options.dbPath || getDatabasePath(options.projectRoot);
    this.indexConfig = options.indexConfig;
  }

  /**
   * Open or create a CodeGraph engine for a project
   */
  static async open(options: EngineOptions): Promise<CodeGraphEngine> {
    const engine = new CodeGraphEngine(options);
    await engine.initialize();
    return engine;
  }

  /**
   * Initialize the engine - create directories, open database, wire layers
   */
  private async initialize(): Promise<void> {
    // Ensure .codegraph directory exists
    if (!isInitialized(this.projectRoot)) {
      createDirectory(this.projectRoot);
    }

    // Initialize tree-sitter grammars
    await initGrammars();

    // Open or create database
    if (fs.existsSync(this.dbPath)) {
      this.db = DatabaseConnection.open(this.dbPath);
    } else {
      this.db = DatabaseConnection.initialize(this.dbPath);
    }

    // Create query builder
    this.queries = new QueryBuilder(this.db.getDb());

    // Wire up the pipeline layers
    this.orchestrator = new ExtractionOrchestrator(this.projectRoot, this.queries);
    this.resolver = createResolver(this.projectRoot, this.queries);
    this.traverser = new GraphTraverser(this.queries);
    this.graphManager = new GraphQueryManager(this.queries);
    this.contextBuilder = createContextBuilder(this.projectRoot, this.queries, this.traverser);

    this.initialized = true;
  }

  /**
   * Full index of all files in the project
   */
  async indexAll(onProgress?: (progress: IndexProgress) => void): Promise<IndexResult> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      const result = await this.orchestrator!.indexAll(onProgress);

      try {
        await this.resolver!.resolveAndPersistBatched();
      } catch (err) {
        errors.push(`Resolution error: ${err instanceof Error ? err.message : String(err)}`);
      }

      this.db!.runMaintenance();

      return {
        filesIndexed: result.filesIndexed,
        nodesExtracted: result.nodesCreated,
        duration: Date.now() - startTime,
        errors: [
          ...errors,
          ...result.errors.map((e) => e.message),
        ],
      };
    } catch (err) {
      errors.push(`Index error: ${err instanceof Error ? err.message : String(err)}`);
      return {
        filesIndexed: 0,
        nodesExtracted: 0,
        duration: Date.now() - startTime,
        errors,
      };
    }
  }

  /**
   * Incremental sync - only index changed files
   */
  async sync(options: { changedFiles?: string[] }): Promise<SyncResult> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      const result = await this.orchestrator!.sync();

      try {
        await this.resolver!.resolveAndPersistBatched();
      } catch (err) {
        errors.push(`Resolution error: ${err instanceof Error ? err.message : String(err)}`);
      }

      this.db!.runMaintenance();

      const filesChanged = result.filesAdded + result.filesModified;

      return {
        filesIndexed: filesChanged,
        nodesExtracted: result.nodesUpdated,
        filesChanged,
        filesDeleted: result.filesRemoved,
        duration: Date.now() - startTime,
        errors,
      };
    } catch (err) {
      errors.push(`Sync error: ${err instanceof Error ? err.message : String(err)}`);
      return {
        filesIndexed: 0,
        nodesExtracted: 0,
        filesChanged: options.changedFiles?.length ?? 0,
        filesDeleted: 0,
        duration: Date.now() - startTime,
        errors,
      };
    }
  }

  /**
   * Explore the code graph - find symbols matching a query
   */
  async explore(query: string, options?: { depth?: number }): Promise<ExploreResult> {
    this.ensureInitialized();
    
    try {
      const depth = options?.depth ?? 2;
      const [subgraph, context] = await Promise.all([
        this.contextBuilder!.findRelevantContext(query, { traversalDepth: depth }),
        this.contextBuilder!.buildContext(query, { traversalDepth: depth }),
      ]);

      const nodes = Array.from(subgraph.nodes.values()).map((n) => ({
        id: n.id,
        name: n.name,
        kind: n.kind,
        filePath: n.filePath,
        startLine: n.startLine,
        endLine: n.endLine,
      }));

      const edges = subgraph.edges.map((e) => ({
        source: e.source,
        target: e.target,
        kind: e.kind,
      }));

      const content = typeof context === 'string' ? context : context.summary;

      return { content, nodes, edges };
    } catch {
      return { content: '', nodes: [], edges: [] };
    }
  }

  /**
   * Search for symbols by name using FTS
   */
  search(query: string, options?: { limit?: number }): SearchResult[] {
    this.ensureInitialized();
    
    try {
      const results = this.queries!.searchNodes(query, {
        limit: options?.limit ?? 20,
      });
      
      return results.map((r: CoreSearchResult) => ({
        id: r.node.id,
        name: r.node.name,
        qualifiedName: r.node.qualifiedName,
        kind: r.node.kind,
        filePath: r.node.filePath,
        startLine: r.node.startLine,
        endLine: r.node.endLine,
        docstring: r.node.docstring ?? null,
        score: r.score ?? 0,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get callers of a function/method
   */
  getCallers(nodeIdOrName: string): Node[] {
    this.ensureInitialized();
    
    try {
      const nodeId = this.resolveNodeId(nodeIdOrName);
      if (!nodeId) return [];
      
      const incomingEdges = this.queries!.getIncomingEdges(nodeId);
      const callers: Node[] = [];
      for (const edge of incomingEdges) {
        if (edge.kind === 'calls') {
          const caller = this.queries!.getNodeById(edge.source);
          if (caller) callers.push(caller);
        }
      }
      return callers;
    } catch {
      return [];
    }
  }

  /**
   * Get callees of a function/method
   */
  getCallees(nodeIdOrName: string): Node[] {
    this.ensureInitialized();
    
    try {
      const nodeId = this.resolveNodeId(nodeIdOrName);
      if (!nodeId) return [];
      
      const outgoingEdges = this.queries!.getOutgoingEdges(nodeId);
      const callees: Node[] = [];
      for (const edge of outgoingEdges) {
        if (edge.kind === 'calls') {
          const callee = this.queries!.getNodeById(edge.target);
          if (callee) callees.push(callee);
        }
      }
      return callees;
    } catch {
      return [];
    }
  }

  /**
   * Get impact radius of a symbol
   */
  getImpactRadius(nodeIdOrName: string, depth: number = 3): Subgraph | null {
    this.ensureInitialized();
    
    try {
      const nodeId = this.resolveNodeId(nodeIdOrName);
      if (!nodeId) return null;
      
      return this.traverser!.getImpactRadius(nodeId, depth);
    } catch {
      return null;
    }
  }

  /**
   * Persist index metadata (commit SHA, timestamp) into the SQLite store.
   */
  setIndexMetadata(metadata: { commitSha?: string | null; indexedAt?: number }): void {
    this.ensureInitialized();
    if (metadata.commitSha) {
      this.queries!.setMetadata('indexed_commit_sha', metadata.commitSha);
    }
    if (metadata.indexedAt !== undefined) {
      this.queries!.setMetadata('last_indexed_at', String(metadata.indexedAt));
    }
  }

  /**
   * Get index status information
   */
  getStatus(): {
    indexed: boolean;
    lastIndexedAt: Date | null;
    filesIndexed: number;
    nodesCount: number;
    commitSha: string | null;
  } {
    if (!this.initialized || !this.db) {
      return { indexed: false, lastIndexedAt: null, filesIndexed: 0, nodesCount: 0, commitSha: null };
    }

    try {
      const stats = this.queries!.getStats();
      const indexedAtRaw = this.queries!.getMetadata('last_indexed_at');
      const commitSha = this.queries!.getMetadata('indexed_commit_sha');
      return {
        indexed: true,
        lastIndexedAt: indexedAtRaw ? new Date(parseInt(indexedAtRaw, 10)) : null,
        filesIndexed: stats.fileCount ?? 0,
        nodesCount: stats.nodeCount ?? 0,
        commitSha,
      };
    } catch {
      return { indexed: false, lastIndexedAt: null, filesIndexed: 0, nodesCount: 0, commitSha: null };
    }
  }

  /**
   * Close the engine and release resources
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initialized = false;
  }

  /**
   * Resolve a node ID from either an ID string or a name lookup
   */
  private resolveNodeId(idOrName: string): string | null {
    // Try direct ID lookup first
    const byId = this.queries!.getNodeById(idOrName);
    if (byId) return byId.id;

    // Fall back to name search
    const results = this.queries!.searchNodes(idOrName, { limit: 1 });
    if (results.length > 0) return results[0].node.id;

    return null;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('CodeGraphEngine not initialized. Call CodeGraphEngine.open() first.');
    }
  }
}


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
import { createDirectory, isInitialized, getCodeGraphDir } from './directory.js';

// Re-export types from the core
export * from './types.js';
export { getCodeGraphDir, isInitialized, createDirectory, removeDirectory, validateDirectory } from './directory.js';

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
  
  // These will be initialized lazily
  private codeGraph: any = null; // Will be the CodeGraph instance from forked code
  private initialized = false;

  private constructor(options: EngineOptions) {
    this.projectRoot = options.projectRoot;
    this.dbPath = options.dbPath || path.join(getCodeGraphDir(options.projectRoot), 'codegraph.db');
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
   * Initialize the engine - create directories, open database
   */
  private async initialize(): Promise<void> {
    // Ensure .codegraph directory exists
    if (!isInitialized(this.projectRoot)) {
      createDirectory(this.projectRoot);
    }

    // TODO: Initialize the CodeGraph instance from forked code
    // This requires adapting the original CodeGraph class
    // For now, we'll implement the interface and fill in the implementation
    
    this.initialized = true;
  }

  /**
   * Full index of all files in the project
   */
  async indexAll(): Promise<IndexResult> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    
    // TODO: Implement using forked extraction/resolution modules
    // 1. Scan all files matching indexConfig
    // 2. Parse with tree-sitter
    // 3. Store in SQLite
    // 4. Resolve references
    
    return {
      filesIndexed: 0,
      nodesExtracted: 0,
      duration: Date.now() - startTime,
      errors: [],
    };
  }

  /**
   * Incremental sync - only index changed files
   */
  async sync(options: { changedFiles: string[] }): Promise<SyncResult> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    
    // TODO: Implement incremental sync
    // 1. For each changed file, re-parse and update SQLite
    // 2. Delete nodes/edges for removed files
    // 3. Resolve new references
    
    return {
      filesIndexed: 0,
      nodesExtracted: 0,
      filesChanged: options.changedFiles.length,
      filesDeleted: 0,
      duration: Date.now() - startTime,
      errors: [],
    };
  }

  /**
   * Explore the code graph - find symbols matching a query
   */
  explore(query: string, options?: { depth?: number }): ExploreResult {
    this.ensureInitialized();
    
    // TODO: Implement using forked context/graph modules
    return {
      content: '',
      nodes: [],
      edges: [],
    };
  }

  /**
   * Search for symbols by name
   */
  search(query: string, options?: { limit?: number }): SearchResult[] {
    this.ensureInitialized();
    
    // TODO: Implement using FTS5 search
    return [];
  }

  /**
   * Get callers of a function/method
   */
  getCallers(nodeId: string): any[] {
    this.ensureInitialized();
    return [];
  }

  /**
   * Get callees of a function/method
   */
  getCallees(nodeId: string): any[] {
    this.ensureInitialized();
    return [];
  }

  /**
   * Get impact radius of a symbol
   */
  getImpactRadius(nodeId: string, depth: number): any {
    this.ensureInitialized();
    return {};
  }

  /**
   * Get index status information
   */
  getStatus(): {
    indexed: boolean;
    lastIndexedAt: Date | null;
    filesIndexed: number;
    nodesCount: number;
  } {
    return {
      indexed: this.initialized,
      lastIndexedAt: null,
      filesIndexed: 0,
      nodesCount: 0,
    };
  }

  /**
   * Close the engine and release resources
   */
  close(): void {
    // TODO: Close SQLite connection
    this.initialized = false;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('CodeGraphEngine not initialized. Call CodeGraphEngine.open() first.');
    }
  }
}


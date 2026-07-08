/**
 * Directory adapter for cloud environment
 * 
 * Replaces the local directory detection logic with Git workspace path management.
 * In cloud, we don't look for .codegraph/ directories - we manage paths explicitly.
 */

import * as path from 'path';
import * as fs from 'fs';

const CODEGRAPH_DIR = '.codegraph';

/**
 * Get the codegraph directory for a given project root
 */
export function getCodeGraphDir(projectRoot: string): string {
  return path.join(projectRoot, CODEGRAPH_DIR);
}

/**
 * Check if a project is initialized (has .codegraph directory)
 */
export function isInitialized(projectRoot: string): boolean {
  const dir = getCodeGraphDir(projectRoot);
  return fs.existsSync(dir);
}

/**
 * Create the codegraph directory if it doesn't exist
 */
export function createDirectory(projectRoot: string): void {
  const dir = getCodeGraphDir(projectRoot);
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Remove the codegraph directory
 */
export function removeDirectory(projectRoot: string): void {
  const dir = getCodeGraphDir(projectRoot);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Validate that a directory exists and is accessible
 */
export function validateDirectory(projectRoot: string): boolean {
  try {
    fs.accessSync(projectRoot, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find the nearest codegraph root (not used in cloud, but kept for compatibility)
 */
export function findNearestCodeGraphRoot(startPath: string): string | null {
  if (isInitialized(startPath)) {
    return startPath;
  }
  return null;
}

/**
 * Check if a directory name is a codegraph data directory
 */
export function isCodeGraphDataDir(name: string): boolean {
  return (
    name === CODEGRAPH_DIR ||
    name.startsWith(CODEGRAPH_DIR + '-')
  );
}

/**
 * Get the codegraph directory name
 */
export function codeGraphDirName(): string {
  return CODEGRAPH_DIR;
}

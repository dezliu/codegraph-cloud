/**
 * Git URL and credential helpers
 */

import type { GitCredentials, GitProvider } from './types.js';

/**
 * Inject token credentials into an HTTPS repo URL for clone/fetch operations.
 */
export function withGitCredentials(repoUrl: string, credentials?: GitCredentials): string {
  if (!credentials?.token) return repoUrl;

  let url: URL;
  try {
    url = new URL(repoUrl);
  } catch {
    return repoUrl;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return repoUrl;
  }

  if (url.hostname.includes('gitlab')) {
    url.username = 'oauth2';
    url.password = credentials.token;
  } else if (url.hostname.includes('github')) {
    url.username = credentials.token;
    url.password = 'x-oauth-basic';
  } else {
    url.username = credentials.token;
    url.password = 'x-oauth-basic';
  }

  return url.toString();
}

/**
 * Normalize a repo path from a Git remote URL or webhook payload path.
 */
export function normalizeRepoPath(path: string): string {
  return path.replace(/^\//, '').replace(/\.git$/, '').toLowerCase();
}

/**
 * Extract the repo path (org/repo) from a remote URL.
 */
export function repoPathFromUrl(repoUrl: string): string | null {
  try {
    const url = new URL(repoUrl);
    return normalizeRepoPath(url.pathname);
  } catch {
    return null;
  }
}

/**
 * Match a webhook repo path against a stored project URL.
 */
export function repoPathsMatch(repoUrl: string, webhookPath: string): boolean {
  const stored = repoPathFromUrl(repoUrl);
  if (!stored) return false;
  return stored === normalizeRepoPath(webhookPath);
}

export function webhookUrlForProvider(
  baseUrl: string,
  provider: GitProvider,
): string {
  const trimmed = baseUrl.replace(/\/$/, '');
  return `${trimmed}/webhooks/${provider}`;
}

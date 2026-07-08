/**
 * Git provider factory
 */

import type { GitProvider as GitProviderType } from './provider.js';
import type { GitProvider } from '@codegraph-cloud/shared';
import { GitLabProvider } from './gitlab.js';
import { GitHubProvider } from './github.js';

const providers: Record<GitProvider, GitProviderType> = {
  gitlab: new GitLabProvider(),
  github: new GitHubProvider(),
};

export function getGitProvider(provider: GitProvider): GitProviderType {
  const p = providers[provider];
  if (!p) {
    throw new Error(`Unsupported Git provider: ${provider}`);
  }
  return p;
}

export type { GitProvider as IGitProvider } from './provider.js';

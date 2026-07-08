/**
 * GitLab provider implementation
 */

import simpleGit, { SimpleGit } from 'simple-git';
import crypto from 'node:crypto';
import type { GitCredentials, WebhookPayload } from '@codegraph-cloud/shared';
import type { GitProvider } from './provider.js';

export class GitLabProvider implements GitProvider {
  verifyWebhookSignature(headers: Record<string, string>, body: Buffer, secret: string): boolean {
    // GitLab uses a simple token match (X-Gitlab-Token header)
    // The token is passed in headers, not as a signature
    const token = headers['x-gitlab-token'];
    return token === secret;
  }

  parseWebhookPayload(body: any): WebhookPayload {
    const eventType = body.object_kind === 'push' ? 'push' : 
                      body.object_kind === 'tag_push' ? 'tag_push' : 'merge_request';

    return {
      eventType,
      projectPath: body.project?.path_with_namespace || '',
      commitSha: body.after || body.checkout_sha || '',
      branch: body.ref?.replace('refs/heads/', '') || '',
      changedFiles: this.extractChangedFiles(body),
    };
  }

  async getRemoteHead(repoUrl: string, branch: string, credentials?: GitCredentials): Promise<string> {
    const git = this.createGit(credentials);
    const result = await git.listRemote(['--heads', repoUrl, branch]);
    // Parse the output: "sha\trefs/heads/branch"
    const match = result.match(/^([a-f0-9]{40})/m);
    if (!match) {
      throw new Error(`Could not find branch ${branch} in ${repoUrl}`);
    }
    return match[1];
  }

  async clone(options: {
    repoUrl: string;
    targetDir: string;
    branch?: string;
    credentials?: GitCredentials;
  }): Promise<void> {
    const git = this.createGit(options.credentials);
    const cloneOptions: string[] = ['--bare'];
    if (options.branch) {
      cloneOptions.push('--branch', options.branch);
    }
    await git.clone(options.repoUrl, options.targetDir, cloneOptions);
  }

  async fetch(mirrorDir: string, credentials?: GitCredentials): Promise<void> {
    const git = simpleGit(mirrorDir);
    await git.fetch(['--all', '--prune']);
  }

  async checkout(options: {
    mirrorDir: string;
    commitSha: string;
    workDir: string;
  }): Promise<void> {
    // For bare repos, we need to use git archive or worktree
    const git = simpleGit(options.mirrorDir);
    
    // Use git worktree to checkout the specific commit
    await git.raw(['worktree', 'add', '--detach', options.workDir, options.commitSha]);
  }

  async getDiff(options: {
    mirrorDir: string;
    fromSha: string;
    toSha: string;
  }): Promise<string[]> {
    const git = simpleGit(options.mirrorDir);
    const diff = await git.diff(['--name-only', options.fromSha, options.toSha]);
    return diff.split('\n').filter(Boolean);
  }

  async registerWebhook(options: {
    repoUrl: string;
    webhookUrl: string;
    secret: string;
    credentials?: GitCredentials;
  }): Promise<void> {
    // TODO: Implement GitLab API webhook registration
    // This requires the GitLab API URL and a personal access token
    // For now, webhooks need to be registered manually
    throw new Error('Automatic webhook registration not yet implemented');
  }

  private createGit(credentials?: GitCredentials): SimpleGit {
    const env: Record<string, string> = {};
    
    if (credentials?.type === 'token' && credentials.token) {
      // Use credential helper for token auth
      env.GIT_ASKPASS = 'echo';
      env.GIT_PASSWORD = credentials.token;
    }

    return simpleGit({
      config: [
        'core.askpass=echo',
      ],
      env,
    });
  }

  private extractChangedFiles(body: any): string[] {
    const files: Set<string> = new Set();
    
    if (body.commits) {
      for (const commit of body.commits) {
        if (commit.added) commit.added.forEach((f: string) => files.add(f));
        if (commit.modified) commit.modified.forEach((f: string) => files.add(f));
        if (commit.removed) commit.removed.forEach((f: string) => files.add(f));
      }
    }
    
    return Array.from(files);
  }
}

/**
 * Git Provider abstraction interface
 * 
 * Supports multiple Git hosting platforms (GitLab, GitHub, etc.)
 */

import type { GitCredentials, WebhookPayload } from '@codegraph-cloud/shared';

export interface GitProvider {
  /**
   * Verify webhook signature from the Git platform
   */
  verifyWebhookSignature(headers: Record<string, string>, body: Buffer, secret: string): boolean;

  /**
   * Parse webhook payload into a standardized format
   */
  parseWebhookPayload(body: any): WebhookPayload;

  /**
   * Register a webhook on the remote platform (if API access available)
   */
  registerWebhook?(options: {
    repoUrl: string;
    webhookUrl: string;
    secret: string;
    credentials?: GitCredentials;
  }): Promise<void>;

  /**
   * Get the remote HEAD commit SHA
   */
  getRemoteHead(repoUrl: string, branch: string, credentials?: GitCredentials): Promise<string>;

  /**
   * Clone a repository
   */
  clone(options: {
    repoUrl: string;
    targetDir: string;
    branch?: string;
    credentials?: GitCredentials;
  }): Promise<void>;

  /**
   * Fetch updates for a bare mirror
   */
  fetch(mirrorDir: string, credentials?: GitCredentials): Promise<void>;

  /**
   * Checkout a specific commit to a working directory
   */
  checkout(options: {
    mirrorDir: string;
    commitSha: string;
    workDir: string;
  }): Promise<void>;

  /**
   * Get the list of changed files between two commits
   */
  getDiff(options: {
    mirrorDir: string;
    fromSha: string;
    toSha: string;
  }): Promise<string[]>;
}

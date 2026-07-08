/**
 * API Key service
 */

import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { apiKeys, type ApiKeyRow } from '@codegraph-cloud/db-schema';
import { API_KEY_PREFIX, type ApiKeyScope } from '@codegraph-cloud/shared';

export interface CreateApiKeyInput {
  orgId: string;
  projectId?: string;
  name: string;
  scopes?: ApiKeyScope[];
  expiresAt?: Date;
}

export class ApiKeyService {
  /**
   * Create a new API key. Returns the plaintext key ONCE - it cannot be retrieved again.
   */
  async create(input: CreateApiKeyInput): Promise<{ key: string; apiKey: ApiKeyRow }> {
    const id = `key_${nanoid(24)}`;
    const plaintextKey = `${API_KEY_PREFIX}${nanoid(40)}`;
    const keyHash = this.hashKey(plaintextKey);

    const result = await db
      .insert(apiKeys)
      .values({
        id,
        orgId: input.orgId,
        projectId: input.projectId || null,
        keyHash,
        name: input.name,
        scopes: input.scopes || ['read'],
        expiresAt: input.expiresAt || null,
      })
      .returning();

    return { key: plaintextKey, apiKey: result[0] };
  }

  async list(orgId: string): Promise<ApiKeyRow[]> {
    return db.select().from(apiKeys).where(eq(apiKeys.orgId, orgId));
  }

  async listByProject(projectId: string): Promise<ApiKeyRow[]> {
    return db.select().from(apiKeys).where(eq(apiKeys.projectId, projectId));
  }

  async validate(key: string): Promise<ApiKeyRow | null> {
    const keyHash = this.hashKey(key);
    const result = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash));

    const apiKey = result[0];
    if (!apiKey) return null;

    // Check expiration
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return null;
    }

    // Update last used
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKey.id));

    return apiKey;
  }

  async revoke(id: string): Promise<boolean> {
    const result = await db.delete(apiKeys).where(eq(apiKeys.id, id)).returning();
    return result.length > 0;
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
}

export const apiKeyService = new ApiKeyService();

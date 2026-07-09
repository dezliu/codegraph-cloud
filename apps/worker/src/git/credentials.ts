/**
 * Load decrypted Git credentials for a project from PostgreSQL.
 */

import { decryptGitCredentials, type GitCredentials } from '@codegraph-cloud/shared';
import type { ProjectRow } from '@codegraph-cloud/db-schema';

export function getProjectCredentials(project: ProjectRow): GitCredentials | undefined {
  if (!project.credentialsRef) return undefined;

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.warn('[Git] ENCRYPTION_KEY not set; cannot decrypt credentials');
    return undefined;
  }

  try {
    const creds = decryptGitCredentials(project.credentialsRef, encryptionKey);
    if (creds.type === 'token' && creds.token) {
      return { type: 'token', token: creds.token };
    }
    if (creds.type === 'ssh_key' && creds.sshKey) {
      return { type: 'ssh_key', sshKey: creds.sshKey, passphrase: creds.passphrase };
    }
  } catch (err) {
    console.error('[Git] Failed to decrypt credentials:', err);
  }

  return undefined;
}

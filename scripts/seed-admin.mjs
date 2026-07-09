#!/usr/bin/env node
/**
 * Seed default org and an admin API key for local development.
 */

import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const postgres = require('postgres');

const DEFAULT_DATABASE_URL =
  'postgresql://codegraph:codegraph_dev@localhost:5432/codegraph_cloud';
const DATABASE_URL = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

const ORG_ID = 'default';
const API_KEY_PREFIX = 'cgk_';

function randomId(prefix) {
  return `${prefix}${crypto.randomBytes(18).toString('base64url')}`;
}

const sql = postgres(DATABASE_URL);

try {
  await sql`
    INSERT INTO organizations (id, name, created_at, updated_at)
    VALUES (${ORG_ID}, 'Default', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `;

  const existing = await sql`
    SELECT id FROM api_keys
    WHERE org_id = ${ORG_ID}
    LIMIT 1
  `;

  if (existing.length > 0) {
    console.log('[seed:admin] Default org exists and at least one API key is already present.');
    console.log('[seed:admin] Create another key via Admin → Settings, or revoke and re-run this script.');
    process.exit(0);
  }

  const id = randomId('key_');
  const plaintextKey = `${API_KEY_PREFIX}${crypto.randomBytes(30).toString('base64url')}`;
  const keyHash = crypto.createHash('sha256').update(plaintextKey).digest('hex');

  await sql`
    INSERT INTO api_keys (id, org_id, project_id, key_hash, name, scopes, created_at)
    VALUES (
      ${id},
      ${ORG_ID},
      NULL,
      ${keyHash},
      'Admin Dev Key',
      ${JSON.stringify(['read', 'write', 'admin'])}::jsonb,
      NOW()
    )
  `;

  console.log('[seed:admin] Created default organization and admin API key.');
  console.log('');
  console.log('Add to apps/admin/.env.local:');
  console.log(`NEXT_PUBLIC_ADMIN_API_KEY=${plaintextKey}`);
  console.log('');
  console.log('Or paste the key in Admin → Settings → Admin API Key.');
  console.log('');
  console.log(plaintextKey);
} finally {
  await sql.end();
}

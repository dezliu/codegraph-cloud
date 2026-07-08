/**
 * Database connection setup
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@codegraph-cloud/db-schema';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://codegraph:codegraph_dev@localhost:5432/codegraph_cloud';

// Create postgres.js connection pool
const client = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create Drizzle instance with schema
export const db = drizzle(client, { schema });

export type Database = typeof db;

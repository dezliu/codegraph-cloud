/**
 * pg-boss job queue setup
 */

import PgBoss from 'pg-boss';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://codegraph:codegraph_dev@localhost:5432/codegraph_cloud';

let boss: PgBoss | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss({
      connectionString: DATABASE_URL,
      noSupervisor: false,
      noMigrations: false,
    });
    await boss.start();
  }
  return boss;
}

export async function stopBoss(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
  }
}

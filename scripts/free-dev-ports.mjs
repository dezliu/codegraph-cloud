#!/usr/bin/env node
/**
 * Free dev ports before starting pnpm dev.
 * Kills listeners on API (3000), Worker (3001), MCP (3002), Admin (3003).
 */

import { execSync } from 'node:child_process';

const PORTS = [3000, 3001, 3002, 3003];

function listPids(port) {
  try {
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' }).trim();
    if (!out) return [];
    return [...new Set(out.split('\n').filter(Boolean))];
  } catch {
    return [];
  }
}

const pids = new Set();
for (const port of PORTS) {
  for (const pid of listPids(port)) {
    pids.add(pid);
  }
}

if (pids.size === 0) {
  console.log('[predev] Dev ports are free');
  process.exit(0);
}

console.log(`[predev] Freeing ports ${PORTS.join(', ')} (PIDs: ${[...pids].join(', ')})`);
for (const pid of pids) {
  try {
    process.kill(Number(pid), 'SIGTERM');
  } catch {
    // process may have already exited
  }
}

// Give processes a moment to release ports gracefully
execSync('sleep 1');

for (const pid of pids) {
  try {
    process.kill(Number(pid), 0);
    process.kill(Number(pid), 'SIGKILL');
  } catch {
    // already gone
  }
}

console.log('[predev] Done');

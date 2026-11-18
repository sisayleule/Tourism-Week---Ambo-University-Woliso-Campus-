/**
 * build-health.mjs — Generate public/health.json at build time.
 *
 * Writes a small JSON file consumed by uptime monitors:
 *   { "version": "1.0.0", "buildTime": "...", "commitSha": "..." }
 *
 * Run automatically as part of postbuild, or standalone:
 *   node scripts/build-health.mjs
 */

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname }           from 'node:path';
import { fileURLToPath }           from 'node:url';
import { execSync }                from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function getCommitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
  } catch {
    return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'unknown';
  }
}

function getVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
    return pkg.version ?? '1.0.0';
  } catch {
    return '1.0.0';
  }
}

const health = {
  version:   '1.0.0',
  buildTime: new Date().toISOString(),
  commitSha: getCommitSha(),
};

mkdirSync(join(ROOT, 'public'), { recursive: true });
writeFileSync(join(ROOT, 'public', 'health.json'), JSON.stringify(health, null, 2) + '\n', 'utf-8');
console.log('  ✓ public/health.json written:', health);

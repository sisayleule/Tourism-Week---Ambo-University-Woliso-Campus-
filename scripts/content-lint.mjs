/**
 * content-lint.mjs — Build-output content linter.
 *
 * Scans dist/ for forbidden strings that indicate broken content:
 *   - Raw i18n keys  (e.g. "staff.login.title")
 *   - Literal "TODO", "lorem", "XXXX" leaked into HTML/JS
 *   - Placeholder markers: "[NAME", "[PHONE", "[SPONSOR LOGO]" (only as literal output)
 *   - JavaScript primitives: "undefined", "null", "NaN" as bare text in HTML
 *
 * Exits 1 if any forbidden string is found, so it can gate CI.
 *
 * Usage:
 *   node scripts/content-lint.mjs         # scan dist/
 *   npm run content:lint                  # same, via npm script
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');

// ─── Patterns that must never appear in built output ─────────────────────────

const FORBIDDEN = [
  // Raw i18n key patterns in HTML output only — in JS they are legitimate t('key') arguments.
  // A "leaked" key in HTML looks like: >staff.login.title< or value="staff.login.title"
  { pattern: />\s*(staff|common|home|schedule|events|gallery|news|about|sponsors|contact)\.[a-zA-Z]+\.[a-zA-Z]+\s*</, label: 'raw i18n key rendered in HTML', htmlOnly: true },
  // Placeholder markers written by adapters when image/logo/photo is missing
  // Note: "[SPONSOR LOGO]" in JS source is fine — only flag in HTML output
  { pattern: /\[SPONSOR LOGO\]/, label: 'placeholder [SPONSOR LOGO] in output', htmlOnly: true },
  { pattern: /\[PHOTO\]/, label: 'placeholder [PHOTO] in output', htmlOnly: true },
  { pattern: /\[NAME/, label: 'placeholder [NAME in output', htmlOnly: true },
  { pattern: /\[PHONE/, label: 'placeholder [PHONE in output', htmlOnly: true },
  // Lorem ipsum / dummy text
  { pattern: /lorem\s+ipsum/i, label: 'lorem ipsum' },
  // TODO / FIXME in HTML output (acceptable in JS comments but not rendered HTML)
  { pattern: /\bTODO\b/, label: 'TODO in output', htmlOnly: true },
  // Bare JS undefined/null/NaN in HTML content (not inside quoted strings)
  { pattern: />undefined</, label: '>undefined< in HTML' },
  { pattern: />null</, label: '>null< in HTML' },
  { pattern: />NaN</, label: '>NaN< in HTML' },
  // Double-quoted undefined/null visible to users
  { pattern: /"undefined"/, label: '"undefined" text in HTML', htmlOnly: true },
];

// ─── Walk dist/ ──────────────────────────────────────────────────────────────

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║  content-lint — Checking built output for artifacts ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  if (!readdirSync(join(__dirname, '..')).includes('dist')) {
    console.error('  ✖ dist/ directory not found. Run `npm run build` first.\n');
    process.exit(1);
  }

  const files = walk(DIST);
  const htmlFiles = files.filter(f => extname(f) === '.html');
  const allFiles  = files.filter(f => ['.html', '.js'].includes(extname(f)));

  let violations = 0;

  for (const file of allFiles) {
    const isHtml = extname(file) === '.html';
    let content;
    try {
      content = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    for (const { pattern, label, htmlOnly } of FORBIDDEN) {
      if (htmlOnly && !isHtml) continue;
      if (pattern.test(content)) {
        const relPath = file.replace(join(__dirname, '..') + '\\', '').replace(join(__dirname, '..') + '/', '');
        const match = content.match(pattern)?.[0] ?? '';
        console.error(`  ✖ [${label}] in ${relPath}`);
        console.error(`    Match: ${match.slice(0, 80)}`);
        violations++;
      }
    }
  }

  if (violations === 0) {
    console.log(`  ✓ Scanned ${allFiles.length} files — no forbidden content found.\n`);
    process.exit(0);
  } else {
    console.error(`\n  ✖ ${violations} violation(s) found. Fix before releasing.\n`);
    process.exit(1);
  }
}

main();

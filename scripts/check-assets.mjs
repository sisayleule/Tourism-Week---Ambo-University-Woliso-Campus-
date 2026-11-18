/**
 * scripts/check-assets.mjs
 *
 * Post-build broken-asset guard.
 *
 * Scans every file in dist/ that can reference local asset paths:
 *   - dist/index.html and all dist/**\/index.html (static SEO pages)
 *   - dist/assets/*.js and dist/assets/*.css
 *   - dist/sitemap.xml
 *   - dist/content-meta.json
 *   - Any *.json files written by seo-html (snapshot-driven pages)
 *
 * For every local URL found (/some/path) it checks that the file
 * dist/some/path actually exists.
 *
 * Exits 1 if any referenced file is missing, or if any reference to
 * /assets/aistudio/*.png is found (those PNGs must have been replaced
 * by their share JPEG or optimized WebP equivalents before deploy).
 *
 * Usage:
 *   node scripts/check-assets.mjs
 * Wired via:
 *   package.json  "postbuild": "... && node scripts/check-assets.mjs"
 *   .github/workflows/ci.yml
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')

// ─── Recursive directory walk ─────────────────────────────────────────────────

function walk(dir, out = []) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

// ─── Patterns that extract local asset references from text content ──────────

/**
 * Extract every /…-looking path from a string.
 * We deliberately cast a wide net and filter to known asset-like extensions.
 */
const LOCAL_URL_RE = /(?:href|src|content|url|poster|image|og:image)\s*[=:]\s*["']?(\/[^\s"'>),;]+)/gi

const ASSET_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg',
  '.ico', '.mp4', '.webm', '.woff', '.woff2', '.ttf', '.otf',
  '.js', '.css', '.json', '.xml', '.txt', '.pdf',
])

function hasAssetExtension(p) {
  const dot = p.lastIndexOf('.')
  if (dot === -1) return false
  return ASSET_EXTENSIONS.has(p.slice(dot).toLowerCase().split('?')[0])
}

// ─── Main ────────────────────────────────────────────────────────────────────

if (!existsSync(DIST)) {
  console.error('❌  dist/ not found — run `npm run build` first.')
  process.exit(1)
}

const allDistFiles = walk(DIST)

// Only scan files that can contain URLs (not binary assets)
const SCAN_EXTS = new Set(['.html', '.js', '.css', '.json', '.xml', '.txt'])
const scanFiles = allDistFiles.filter(f => {
  const dot = f.lastIndexOf('.')
  return dot !== -1 && SCAN_EXTS.has(f.slice(dot).toLowerCase())
})

console.log(`\n🔍  check-assets — scanning ${scanFiles.length} text files in dist/\n`)

const missing = []    // { file, url }
const forbidden = []  // { file, url } — aistudio PNGs that must not appear

for (const file of scanFiles) {
  let text
  try { text = readFileSync(file, 'utf-8') } catch { continue }

  const hits = new Set()
  let m
  // Reset lastIndex between calls on global RE
  LOCAL_URL_RE.lastIndex = 0
  while ((m = LOCAL_URL_RE.exec(text)) !== null) {
    const raw = m[1].split(/[?#]/)[0]  // strip query/fragment
    if (!hasAssetExtension(raw)) continue
    // Skip Vite-hashed assets (they always exist if the build succeeded)
    if (raw.startsWith('/assets/') && raw.match(/\.[a-f0-9]{8,}\.(js|css)$/)) continue
    hits.add(raw)
  }

  for (const url of hits) {
    // ── Forbidden: any /assets/aistudio/*.png ───────────────────────────
    if (/^\/assets\/aistudio\/[^/]+\.png$/i.test(url)) {
      forbidden.push({ file: file.replace(DIST, ''), url })
      continue
    }

    // ── Missing file check ───────────────────────────────────────────────
    const absPath = join(DIST, url.replace(/\//g, '/'))
    if (!existsSync(absPath)) {
      missing.push({ file: file.replace(DIST, ''), url })
    }
  }
}

// ─── Report ──────────────────────────────────────────────────────────────────

let failed = false

if (forbidden.length > 0) {
  console.error(`❌  Found ${forbidden.length} reference(s) to /assets/aistudio/*.png — these must be replaced`)
  console.error('    with their share JPEG (/assets/share/<name>.jpg) or optimized WebP.\n')
  for (const { file, url } of forbidden) {
    console.error(`    ${file}  →  ${url}`)
  }
  console.error()
  failed = true
}

if (missing.length > 0) {
  console.error(`❌  Found ${missing.length} reference(s) to files that do not exist in dist/\n`)
  for (const { file, url } of missing) {
    console.error(`    ${file}  →  ${url}`)
  }
  console.error()
  failed = true
}

if (!failed) {
  console.log(`✅  All local asset references are valid. No /assets/aistudio/*.png found.\n`)
}

process.exit(failed ? 1 : 0)

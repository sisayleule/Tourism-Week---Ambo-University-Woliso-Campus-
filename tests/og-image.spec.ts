/**
 * tests/og-image.spec.ts
 *
 * Verifies that every og:image and twitter:image URL in the built dist/
 * static HTML pages:
 *   1. Points to a file that actually exists on disk.
 *   2. Is a JPEG or PNG (never WebP — social crawlers don't support WebP).
 *   3. Is an absolute HTTPS URL (not relative) — required by Open Graph spec.
 *   4. Points to a 1200×630 image (share dimensions).
 *
 * Run after a production build:
 *   npm run build && npx tsx --test tests/og-image.spec.ts
 *
 * The test reads dist/ directly — no server needed.
 */

import { strict as assert } from 'node:assert'
import { describe, it, before } from 'node:test'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')
const PUBLIC = join(ROOT, 'public')

// ─── Collect all static HTML files in dist/ ──────────────────────────────────

function walkHtml(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) walkHtml(full, out)
    else if (e.name.endsWith('.html')) out.push(full)
  }
  return out
}

// ─── Extract og:image / twitter:image content values ─────────────────────────

const OG_IMAGE_RE    = /<meta\s+property="og:image"\s+content="([^"]+)"/gi
const TW_IMAGE_RE    = /<meta\s+name="twitter:image"\s+content="([^"]+)"/gi
const OG_IMAGE_W_RE  = /<meta\s+property="og:image:width"\s+content="([^"]+)"/i
const OG_IMAGE_H_RE  = /<meta\s+property="og:image:height"\s+content="([^"]+)"/i

function extractImageMeta(html: string): { ogImages: string[], twitterImages: string[], width: string | null, height: string | null } {
  const ogImages: string[] = []
  const twitterImages: string[] = []
  OG_IMAGE_RE.lastIndex = 0
  TW_IMAGE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = OG_IMAGE_RE.exec(html)) !== null) ogImages.push(m[1])
  while ((m = TW_IMAGE_RE.exec(html)) !== null) twitterImages.push(m[1])
  const wMatch = OG_IMAGE_W_RE.exec(html)
  const hMatch = OG_IMAGE_H_RE.exec(html)
  return { ogImages, twitterImages, width: wMatch?.[1] ?? null, height: hMatch?.[1] ?? null }
}

// ─── Resolve an og:image URL to a local file path ────────────────────────────

const SITE_URL_RE = /^https?:\/\/[^/]+/

/** True if the URL looks like a Supabase storage CDN URL (not a local asset). */
function isRemoteCdn(url: string): boolean {
  return url.includes('.supabase.co/') || url.includes('.supabase.in/')
}

function urlToLocalPath(url: string): string | null {
  // Remote CDN — cannot verify on disk; skip
  if (isRemoteCdn(url)) return null
  // Absolute URL → strip origin, map to public/ or dist/
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const path = url.replace(SITE_URL_RE, '')
    // Check public/ first (committed assets), then dist/
    const inPublic = join(PUBLIC, path)
    if (existsSync(inPublic)) return inPublic
    const inDist = join(DIST, path)
    if (existsSync(inDist)) return inDist
    // Return the dist path for the error message even if missing
    return inDist
  }
  // Relative URL (should not appear — test will catch it)
  return null
}

// ─── Tests ───────────────────────────────────────────────────────────────────

let htmlFiles: string[] = []

before(() => {
  if (!existsSync(DIST)) {
    throw new Error(`dist/ not found at ${DIST} — run 'npm run build' first`)
  }
  htmlFiles = walkHtml(DIST)
})

describe('og:image in built HTML pages', () => {

  it('dist/ contains at least one HTML file', () => {
    assert.ok(htmlFiles.length > 0, 'No HTML files found in dist/')
  })

  it('every og:image is an absolute HTTPS URL', () => {
    const errors: string[] = []
    for (const file of htmlFiles) {
      const html = readFileSync(file, 'utf-8')
      const { ogImages } = extractImageMeta(html)
      for (const url of ogImages) {
        if (!url.startsWith('https://')) {
          errors.push(`${file.replace(DIST, '')}: og:image is not absolute HTTPS: ${url}`)
        }
      }
    }
    assert.deepEqual(errors, [], errors.join('\n'))
  })

  it('every og:image points to a JPEG or PNG file (never WebP)', () => {
    const errors: string[] = []
    for (const file of htmlFiles) {
      const html = readFileSync(file, 'utf-8')
      const { ogImages } = extractImageMeta(html)
      for (const url of ogImages) {
        const ext = extname(url.split('?')[0]).toLowerCase()
        if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') {
          errors.push(`${file.replace(DIST, '')}: og:image has bad extension "${ext}": ${url}`)
        }
      }
    }
    assert.deepEqual(errors, [], errors.join('\n'))
  })

  it('every og:image file exists on disk', () => {
    const errors: string[] = []
    for (const file of htmlFiles) {
      const html = readFileSync(file, 'utf-8')
      const { ogImages } = extractImageMeta(html)
      for (const url of ogImages) {
        if (isRemoteCdn(url)) continue  // CDN files can't be verified locally
        const local = urlToLocalPath(url)
        if (!local) {
          errors.push(`${file.replace(DIST, '')}: og:image is relative (not absolute): ${url}`)
          continue
        }
        if (!existsSync(local)) {
          errors.push(`${file.replace(DIST, '')}: og:image file missing: ${url} → ${local}`)
        }
      }
    }
    assert.deepEqual(errors, [], errors.join('\n'))
  })

  it('every og:image has og:image:width=1200 and og:image:height=630', () => {
    const errors: string[] = []
    for (const file of htmlFiles) {
      const html = readFileSync(file, 'utf-8')
      const { ogImages, width, height } = extractImageMeta(html)
      if (ogImages.length === 0) continue
      if (width !== '1200') errors.push(`${file.replace(DIST, '')}: og:image:width=${width ?? 'missing'}`)
      if (height !== '630') errors.push(`${file.replace(DIST, '')}: og:image:height=${height ?? 'missing'}`)
    }
    assert.deepEqual(errors, [], errors.join('\n'))
  })

  it('every twitter:image is an absolute HTTPS URL', () => {
    const errors: string[] = []
    for (const file of htmlFiles) {
      const html = readFileSync(file, 'utf-8')
      const { twitterImages } = extractImageMeta(html)
      for (const url of twitterImages) {
        if (!url.startsWith('https://')) {
          errors.push(`${file.replace(DIST, '')}: twitter:image is not absolute HTTPS: ${url}`)
        }
      }
    }
    assert.deepEqual(errors, [], errors.join('\n'))
  })

  it('every twitter:image file exists on disk', () => {
    const errors: string[] = []
    for (const file of htmlFiles) {
      const html = readFileSync(file, 'utf-8')
      const { twitterImages } = extractImageMeta(html)
      for (const url of twitterImages) {
        if (isRemoteCdn(url)) continue  // CDN files can't be verified locally
        const local = urlToLocalPath(url)
        if (!local) {
          errors.push(`${file.replace(DIST, '')}: twitter:image is relative: ${url}`)
          continue
        }
        if (!existsSync(local)) {
          errors.push(`${file.replace(DIST, '')}: twitter:image file missing: ${url} → ${local}`)
        }
      }
    }
    assert.deepEqual(errors, [], errors.join('\n'))
  })

})

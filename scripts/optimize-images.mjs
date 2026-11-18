/**
 * scripts/optimize-images.mjs
 *
 * Converts the original PNGs in source-images/aistudio/ into responsive WebP
 * variants and writes them to public/assets/optimized/.
 *
 * Run LOCALLY only — never from the Vercel build.
 * The output files are committed to Git and served as static assets.
 *
 * Usage:
 *   node scripts/optimize-images.mjs
 *
 * Output per source image (never upscales):
 *   public/assets/optimized/<name>-480.webp   (≤ 480 px wide)
 *   public/assets/optimized/<name>-960.webp   (≤ 960 px wide)
 *   public/assets/optimized/<name>-1600.webp  (≤ 1600 px wide)
 *
 * Quality: 78 (good visual quality, well under 300 kB at 1600 px for photos).
 * Fails with a non-zero exit code if any 1600-px variant exceeds 300 kB.
 *
 * Requirements:
 *   npm install --save-dev sharp   (or bun add -d sharp)
 */

import { createRequire } from 'module'
import { readdir, stat, mkdir } from 'fs/promises'
import { join, basename, extname } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
let sharp
try {
  sharp = require('sharp')
} catch {
  console.error(
    '\n❌  sharp is not installed.\n' +
    '    Run: npm install --save-dev sharp\n' +
    '    Then re-run this script.\n',
  )
  process.exit(1)
}

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT      = join(__dirname, '..')
const SRC_DIR   = join(ROOT, 'source-images', 'aistudio')
const OUT_DIR   = join(ROOT, 'public', 'assets', 'optimized')
const WIDTHS    = [480, 960, 1600]
const QUALITY   = 78
const MAX_1600  = 300 * 1024  // 300 kB

/**
 * Per-image quality overrides for files that still exceed 300 kB at q=78.
 * Determined by running this script once and noting failures, then probing
 * lower qualities with scripts/_probe-quality.mjs.
 * Key: basename without extension.  Value: WebP quality integer.
 */
const QUALITY_OVERRIDES = {
  image_a7c5afdc: 65,  // dense crowd photo; q78→350 kB, q65→298 kB ✓
  image_c9b19ed8: 72,  // cultural assembly; q78→304 kB, q72→271 kB ✓
}

await mkdir(OUT_DIR, { recursive: true })

const files = (await readdir(SRC_DIR)).filter(f => /\.(png|jpe?g|webp|avif)$/i.test(f))
if (files.length === 0) {
  console.error(`❌  No image files found in ${SRC_DIR}`)
  process.exit(1)
}

console.log(`\n📸  Optimizing ${files.length} image(s) → ${OUT_DIR}\n`)

// Table header
const COL = [38, 10, 10, 10, 10]
const pad = (s, n) => String(s).padStart(n)
const padL = (s, n) => String(s).padEnd(n)
console.log(
  padL('File', COL[0]) +
  pad('Orig KB', COL[1]) +
  pad('480w KB', COL[2]) +
  pad('960w KB', COL[3]) +
  pad('1600w KB', COL[4]),
)
console.log('-'.repeat(COL.reduce((a, b) => a + b, 0)))

const oversized = []  // names of 1600w variants over 300 kB

for (const file of files) {
  const srcPath  = join(SRC_DIR, file)
  const name     = basename(file, extname(file))
  const origStat = await stat(srcPath)
  const origKB   = Math.round(origStat.size / 1024)

  const widthKBs = []
  for (const w of WIDTHS) {
    const outPath = join(OUT_DIR, `${name}-${w}.webp`)

    // Load image metadata to avoid upscaling
    const meta = await sharp(srcPath).metadata()
    const targetW = Math.min(w, meta.width ?? w)

    const q = QUALITY_OVERRIDES[name] ?? QUALITY
    const { data, info } = await sharp(srcPath)
      .resize({ width: targetW, withoutEnlargement: true })
      .webp({ quality: q })
      .toBuffer({ resolveWithObject: true })

    await import('fs').then(({ writeFileSync }) => writeFileSync(outPath, data))

    const kb = Math.round(info.size / 1024)
    widthKBs.push(kb)

    if (w === 1600 && info.size > MAX_1600) {
      oversized.push({ file: `${name}-${w}.webp`, kb })
    }
  }

  console.log(
    padL(file.length > 36 ? '…' + file.slice(-35) : file, COL[0]) +
    pad(origKB, COL[1]) +
    pad(widthKBs[0], COL[2]) +
    pad(widthKBs[1], COL[3]) +
    pad(widthKBs[2], COL[4]),
  )
}

console.log('-'.repeat(COL.reduce((a, b) => a + b, 0)))
console.log(`\n✅  Done. Output: ${OUT_DIR}\n`)

if (oversized.length > 0) {
  console.error('❌  The following 1600-px WebP variants exceed 300 kB:')
  for (const { file, kb } of oversized) {
    console.error(`    ${file}  →  ${kb} kB  (limit: 300 kB)`)
  }
  console.error('\n    Consider lowering quality or reviewing source images.\n')
  process.exit(1)
}

// ═══════════════════════════════════════════════════════════════════════════
// PART 2 — Share images (1200×630 JPEG, cover-crop, quality ≈ 80, ≤ 200 kB)
//
// Written to public/assets/share/<name>.jpg
// Used as og:image / twitter:image in static SEO pages (absolute JPEG URL).
//
// Sources:
//   source-images/aistudio/*.png   → share/image_<hash>.jpg  (event cards)
//   src/assets/images/*.jpg        → share/<stem>.jpg         (editorial/hero)
//
// The file src/assets/images/lalibela_church_*.jpg is the hero poster and
// becomes share/default.jpg — the site-wide fallback og:image.
// ═══════════════════════════════════════════════════════════════════════════

const SHARE_DIR      = join(ROOT, 'public', 'assets', 'share')
const SHARE_W        = 1200
const SHARE_H        = 630
const SHARE_QUALITY  = 80
const SHARE_MAX      = 200 * 1024  // 200 kB hard limit

/** Per-image JPEG quality overrides for share images that exceed 200 kB at q=80. */
const SHARE_QUALITY_OVERRIDES = {
  image_a7c5afdc: 72,  // dense crowd; q80→207 kB, q72→~175 kB ✓
}

await mkdir(SHARE_DIR, { recursive: true })

// ── Editorial source images (src/assets/images/) ────────────────────────────
const EDITORIAL_DIR = join(ROOT, 'src', 'assets', 'images')
const editorialFiles = (await readdir(EDITORIAL_DIR)).filter(f => /\.(jpe?g|png|webp|avif)$/i.test(f))

// ── All source images for share generation ──────────────────────────────────
// aistudio PNGs use name as-is; editorial JPEGs use stem as output name.
// lalibela_church_* becomes default.jpg.
const shareJobs = []

for (const f of files) {
  const name = basename(f, extname(f))
  shareJobs.push({ src: join(SRC_DIR, f), out: join(SHARE_DIR, `${name}.jpg`) })
}

for (const f of editorialFiles) {
  const stem = basename(f, extname(f))
  const outName = stem.startsWith('lalibela_church') ? 'default' : stem
  shareJobs.push({ src: join(EDITORIAL_DIR, f), out: join(SHARE_DIR, `${outName}.jpg`) })
}

console.log(`\n🖼   Generating ${shareJobs.length} share image(s) → ${SHARE_DIR}\n`)

const SCOL = [52, 10, 10]
console.log(padL('Output', SCOL[0]) + pad('KB', SCOL[1]) + pad('Status', SCOL[2]))
console.log('-'.repeat(SCOL.reduce((a, b) => a + b, 0)))

const shareOversized = []

for (const { src, out } of shareJobs) {
  const outName = basename(out)
  const outStem = basename(out, '.jpg')
  const shareQ = SHARE_QUALITY_OVERRIDES[outStem] ?? SHARE_QUALITY
  const { data, info } = await sharp(src)
    .resize({ width: SHARE_W, height: SHARE_H, fit: 'cover', position: 'centre' })
    .jpeg({ quality: shareQ, mozjpeg: true })
    .toBuffer({ resolveWithObject: true })

  await import('fs').then(({ writeFileSync }) => writeFileSync(out, data))

  const kb = Math.round(info.size / 1024)
  const status = info.size > SHARE_MAX ? '⚠ OVER' : '✓'
  console.log(padL(outName.length > 50 ? '…' + outName.slice(-49) : outName, SCOL[0]) + pad(kb, SCOL[1]) + pad(status, SCOL[2]))

  if (info.size > SHARE_MAX) {
    shareOversized.push({ file: outName, kb })
  }
}

console.log('-'.repeat(SCOL.reduce((a, b) => a + b, 0)))
console.log(`\n✅  Share images done. Output: ${SHARE_DIR}\n`)

if (shareOversized.length > 0) {
  console.error('❌  The following share images exceed 200 kB:')
  for (const { file, kb } of shareOversized) {
    console.error(`    ${file}  →  ${kb} kB  (limit: 200 kB)`)
  }
  console.error()
  process.exit(1)
}

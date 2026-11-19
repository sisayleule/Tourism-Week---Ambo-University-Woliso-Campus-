/**
 * scripts/check-hero-media.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Pre-build guard for the hero video files.
 *
 * Fails (exit 1) with a clear message if:
 *   1. Either default hero video file is missing from public/videos/.
 *   2. Either file exceeds 6 MB.
 *   3. Either file has its moov box AFTER the mdat box (not faststart-ready).
 *      The check reads only the first 64 KB of each file to locate box headers.
 *
 * Run manually:  node scripts/check-hero-media.mjs
 * Run in CI:     already wired into the "prebuild" npm script.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { existsSync, openSync, readSync, statSync, closeSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const FILES = [
  { name: 'hero-720-v2.mp4', desc: 'desktop 720p' },
  { name: 'hero-480-v2.mp4', desc: 'mobile 480p'  },
]

const MAX_SIZE_BYTES  = 6 * 1024 * 1024   // 6 MB
const SCAN_BYTES      = 64 * 1024          // read first 64 KB to find box headers
const HEADER_BUF_SIZE = SCAN_BYTES

let failures = 0

function fail(msg) {
  console.error(`  ✗ FAIL: ${msg}`)
  failures++
}
function pass(msg) {
  console.log(`  ✓ ${msg}`)
}

/**
 * Scan the first SCAN_BYTES of an MP4 file and return the byte offsets of the
 * first "moov" and "mdat" top-level box headers found.  Returns null for a box
 * type if it was not found in the scanned region.
 *
 * MP4 box layout (ISO 14496-12):
 *   bytes 0–3  : uint32 big-endian box size (includes these 8 bytes)
 *   bytes 4–7  : 4-char ASCII box type
 *   (if size === 1, bytes 8–15 are a uint64 extended size)
 *
 * We walk boxes sequentially until we find both types or run out of scan data.
 */
function findMoovMdat(filePath) {
  const buf    = Buffer.alloc(HEADER_BUF_SIZE)
  const fd     = openSync(filePath, 'r')
  const bytesRead = readSync(fd, buf, 0, HEADER_BUF_SIZE, 0)
  closeSync(fd)

  let moovOffset = null
  let mdatOffset = null
  let pos = 0

  while (pos + 8 <= bytesRead) {
    // Read box size (big-endian uint32)
    const size = buf.readUInt32BE(pos)
    // Read box type (4 ASCII bytes)
    const type = buf.slice(pos + 4, pos + 8).toString('ascii').replace(/\0/g, '')

    if (type === 'moov') moovOffset = pos
    if (type === 'mdat') mdatOffset = pos

    if (moovOffset !== null && mdatOffset !== null) break

    // Advance to next box
    if (size === 0) break           // box extends to EOF — stop scanning
    if (size === 1) {
      // Extended 64-bit size
      if (pos + 16 > bytesRead) break
      // Read the high 32 bits (low 32 bits ignored — files are ≤ 6 MB)
      const hiSize = buf.readUInt32BE(pos + 8)
      if (hiSize > 0) break         // implausibly large; stop
      const loSize = buf.readUInt32BE(pos + 12)
      pos += loSize
    } else {
      pos += size
    }
  }

  return { moovOffset, mdatOffset }
}

console.log('\n=== Hero video pre-build check ===\n')

for (const { name, desc } of FILES) {
  const filePath = join(ROOT, 'public', 'videos', name)
  console.log(`  — ${name} (${desc})`)

  // 1. Existence
  if (!existsSync(filePath)) {
    fail(`${name} not found in public/videos/`)
    fail(`  → Run: ffmpeg ... -movflags +faststart -an -t 12 public/videos/${name}`)
    fail(`  → See source-media/README.md for the full ffmpeg command.`)
    console.log()
    continue   // no point checking size/moov on a missing file
  }
  pass(`${name} exists`)

  // 2. Size
  const { size } = statSync(filePath)
  const sizeMB   = (size / 1024 / 1024).toFixed(2)
  if (size > MAX_SIZE_BYTES) {
    fail(`${name} is ${sizeMB} MB — exceeds the 6 MB limit`)
    fail(`  → Re-encode with a higher CRF value (e.g. --crf 30) or trim to ≤12 s.`)
  } else {
    pass(`${name} size: ${sizeMB} MB (≤ 6 MB)`)
  }

  // 3. moov-before-mdat (faststart)
  const { moovOffset, mdatOffset } = findMoovMdat(filePath)

  if (moovOffset === null) {
    fail(`${name}: moov box not found in first ${SCAN_BYTES / 1024} KB — file may be corrupt`)
  } else if (mdatOffset === null) {
    // mdat not in first 64 KB — common when moov is at the front (faststart OK)
    pass(`${name}: moov found at byte ${moovOffset} (mdat not yet in scan window — faststart OK)`)
  } else if (moovOffset < mdatOffset) {
    pass(`${name}: moov at byte ${moovOffset} is BEFORE mdat at byte ${mdatOffset} (faststart ✓)`)
  } else {
    fail(`${name}: moov at byte ${moovOffset} is AFTER mdat at byte ${mdatOffset} — NOT faststart`)
    fail(`  → Re-encode with: ffmpeg ... -movflags +faststart ... public/videos/${name}`)
  }

  console.log()
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed — build aborted.\n`)
  process.exit(1)
} else {
  console.log('All hero video checks passed ✓\n')
}

/**
 * restore-from-backup.mjs — Restores a backup JSON into an empty Supabase project.
 *
 * Run locally by a developer. The service role key must be set in the terminal
 * environment — NEVER committed to the repository.
 *
 * Usage:
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/restore-from-backup.mjs path/to/tourism-week-backup-YYYY-MM-DD.zip
 *
 * The script:
 *   1. Reads the ZIP file from the path given as the first argument.
 *   2. Parses tourism-week-data.json from the archive.
 *   3. Inserts each table's rows in dependency order using upsert (ON CONFLICT DO NOTHING).
 *   4. Skips activity_log and message_rate_limits (write-protected / rate-limit tables).
 *   5. Prints a summary: rows attempted, inserted, skipped.
 *
 * Notes on storage images:
 *   This script restores database rows only. If you also need to restore storage
 *   images (event images, gallery photos, etc.):
 *     1. Log in to https://supabase.com → your project → Storage.
 *     2. Download the relevant buckets manually or use the Supabase CLI:
 *          supabase storage cp -r ss:///event-images ./restored-event-images
 *     3. Re-upload the files to the new project using the same bucket names and paths.
 *   The image-urls.txt file inside the backup ZIP lists every URL that was
 *   referenced in the database, which helps you identify what to restore.
 *
 * IMPORTANT:
 *   - Run against an EMPTY project (after applying all migrations and running
 *     the seed to create the site_settings row if desired).
 *   - The service role key bypasses RLS — keep it private.
 *   - site_settings uses a boolean PK (id = true); it is upserted with ON CONFLICT UPDATE.
 */

import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// ─── Environment ─────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment.')
  console.error('Example:')
  console.error('  SUPABASE_URL=https://xxxx.supabase.co \\')
  console.error('  SUPABASE_SERVICE_ROLE_KEY=eyJ... \\')
  console.error('  node scripts/restore-from-backup.mjs path/to/backup.zip')
  process.exit(1)
}

const backupPath = process.argv[2]
if (!backupPath) {
  console.error('ERROR: Provide the path to the backup ZIP as the first argument.')
  console.error('  node scripts/restore-from-backup.mjs path/to/tourism-week-backup-YYYY-MM-DD.zip')
  process.exit(1)
}
if (!existsSync(backupPath)) {
  console.error(`ERROR: File not found: ${backupPath}`)
  process.exit(1)
}

// ─── Supabase client (service role) ──────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ─── Table restore order (dependency-safe) ───────────────────────────────────
// profiles must come before messages (handled_by FK).
// editions before events, gallery_items, news.
// Skip activity_log (immutable, written by triggers during restore) and
// message_rate_limits (rate-limit log, not meaningful to restore).

const RESTORE_ORDER = [
  'profiles',
  'editions',
  'events',
  'announcements',
  'news',
  'gallery_items',
  'sponsors',
  'committee_members',
  'faqs',
  'site_settings',
  'messages',
]

// Tables we deliberately skip.
const SKIP_TABLES = new Set(['activity_log', 'message_rate_limits'])

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  restore-from-backup — Tourism Week database restore          ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')
  console.log(`  Backup file : ${backupPath}`)
  console.log(`  Target URL  : ${SUPABASE_URL}\n`)

  // ── Read and parse the ZIP ──
  console.log('  → Reading backup ZIP…')
  let data

  try {
    // Dynamically import JSZip (must be installed: npm install jszip)
    let JSZip
    try {
      ;({ default: JSZip } = await import('jszip'))
    } catch {
      console.error('ERROR: jszip is not installed. Run: npm install jszip')
      process.exit(1)
    }

    const zipBuffer = readFileSync(backupPath)
    const zip = await JSZip.loadAsync(zipBuffer)
    const jsonFile = zip.file('tourism-week-data.json')
    if (!jsonFile) {
      console.error('ERROR: tourism-week-data.json not found in the ZIP.')
      process.exit(1)
    }
    const jsonText = await jsonFile.async('string')
    data = JSON.parse(jsonText)
    console.log('  ✓ Parsed tourism-week-data.json')
  } catch (err) {
    console.error('ERROR reading ZIP:', err.message)
    process.exit(1)
  }

  // ── Restore each table ──
  const results = []

  for (const tableName of RESTORE_ORDER) {
    const rows = data[tableName]
    if (!rows || rows.length === 0) {
      console.log(`  ⊘ ${tableName}: no rows — skipping`)
      results.push({ table: tableName, attempted: 0, inserted: 0, skipped: 0 })
      continue
    }

    console.log(`  → ${tableName}: ${rows.length} rows…`)

    // Insert in batches of 100 to stay within Supabase request limits.
    let inserted = 0
    let skipped = 0
    const BATCH = 100

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)

      // For site_settings the PK is boolean — use upsert.
      const { error } = await supabase
        .from(tableName)
        .upsert(batch, {
          onConflict: 'id',
          ignoreDuplicates: true,
        })

      if (error) {
        console.warn(`    ⚠ Batch ${Math.floor(i / BATCH) + 1} error on ${tableName}: ${error.message}`)
        skipped += batch.length
      } else {
        inserted += batch.length
      }
    }

    console.log(`  ✓ ${tableName}: ${inserted} inserted, ${skipped} skipped`)
    results.push({ table: tableName, attempted: rows.length, inserted, skipped })
  }

  // ── Report skipped tables ──
  for (const skippedTable of SKIP_TABLES) {
    if (data[skippedTable]?.length) {
      console.log(`  ⊘ ${skippedTable}: skipped intentionally (${data[skippedTable].length} rows not restored)`)
    }
  }

  // ── Summary ──
  console.log('\n  ─────────────────────────────────────────────────────────────')
  console.log('  Restore summary:')
  for (const r of results) {
    if (r.attempted > 0) {
      console.log(`    ${r.table.padEnd(22)} ${r.inserted} / ${r.attempted} inserted, ${r.skipped} skipped`)
    }
  }
  console.log('\n  ✅ Restore complete.')
  console.log('\n  Next steps:')
  console.log('    1. Verify content in the Supabase table editor.')
  console.log('    2. Restore storage images manually from the Supabase dashboard → Storage.')
  console.log('       (image-urls.txt inside the ZIP lists all referenced image URLs.)')
  console.log('    3. Run the site build: npm run build')
  console.log()
}

main().catch(err => {
  console.error('\n  ✖ Restore failed:', err.message ?? err)
  process.exit(1)
})

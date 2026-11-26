/**
 * fix-event-images.mjs
 *
 * One-time script to update event image_url values in the live Supabase DB.
 * Run with: node scripts/fix-event-images.mjs
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY env var (from Supabase dashboard → Settings → API).
 * Never commit the service role key.
 *
 * Usage:
 *   $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
 *   node scripts/fix-event-images.mjs
 */

const SUPABASE_URL      = 'https://otdaiykbrmjycjwfjndt.supabase.co';
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌  SUPABASE_SERVICE_ROLE_KEY env var is required.');
  console.error('    Set it with:');
  console.error('      $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  console.error('    Then run:  node scripts/fix-event-images.mjs');
  process.exit(1);
}

const headers = {
  'apikey':        SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=representation',
};

async function updateEvents(slugPattern, imageUrl) {
  // Use PostgREST LIKE filter: slug=like.*pattern*
  const url = `${SUPABASE_URL}/rest/v1/events?slug=like.*${encodeURIComponent(slugPattern)}*`;
  const res  = await fetch(url, {
    method:  'PATCH',
    headers,
    body: JSON.stringify({ image_url: imageUrl }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH failed for "${slugPattern}": ${res.status} ${text}`);
  }

  // PostgREST returns updated rows when Prefer: return=representation
  const rows = await res.json();
  return Array.isArray(rows) ? rows.length : 0;
}

console.log('\n🔧  Fixing event image_url values in Supabase…\n');

try {
  let n;

  n = await updateEvents('miss-mr-tourism',    '/assets/events/event-miss-mr-tourism.jpg');
  console.log(`  ✓  Miss & Mr. Tourism Pageant   → event-miss-mr-tourism.jpg  (${n} row${n!==1?'s':''})`);

  n = await updateEvents('miss-and-mr-tourism', '/assets/events/event-miss-mr-tourism.jpg');
  if (n) console.log(`  ✓  miss-and-mr-tourism variant  → event-miss-mr-tourism.jpg  (${n} row${n!==1?'s':''})`);

  n = await updateEvents('guest-tour',          '/assets/events/event-guest-tour.jpg');
  console.log(`  ✓  Guest Tour                    → event-guest-tour.jpg       (${n} row${n!==1?'s':''})`);

  console.log('\n✅  Done. The live site will reflect the changes on next content fetch (~60 s).\n');
} catch (err) {
  console.error('\n❌  Error:', err.message);
  process.exit(1);
}

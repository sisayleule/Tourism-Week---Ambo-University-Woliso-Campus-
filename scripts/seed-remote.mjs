/**
 * seed-remote.mjs — Seeds the remote Supabase project via the REST API.
 *
 * Uses the anon key (read-only by default) + a SERVICE ROLE key to INSERT.
 * Run with:  node scripts/seed-remote.mjs
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local or as an environment var.
 * The anon key alone can't INSERT — you need the service role key to bypass RLS.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

dotenv.config({ path: join(ROOT, '.env') });
dotenv.config({ path: join(ROOT, '.env.local'), override: true });

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? '';
const ANON_KEY     = process.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL) {
  console.error('❌  VITE_SUPABASE_URL is not set.');
  process.exit(1);
}

if (!SERVICE_KEY) {
  console.error('');
  console.error('❌  SUPABASE_SERVICE_ROLE_KEY is not set.');
  console.error('');
  console.error('   To seed the remote DB you need the service role key.');
  console.error('   Find it in: Supabase dashboard → Settings → API → service_role (secret).');
  console.error('   Add it to .env.local (never commit it):');
  console.error('   SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."');
  console.error('');
  process.exit(1);
}

const REST = `${SUPABASE_URL}/rest/v1`;
const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function upsert(table, rows, label) {
  if (!rows || rows.length === 0) {
    console.log(`  ⏭  ${label}: skipped (empty)`);
    return;
  }
  const res = await fetch(`${REST}/${table}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`  ✖  ${label}: HTTP ${res.status} — ${body.slice(0, 300)}`);
    return;
  }
  console.log(`  ✓  ${label}: ${Array.isArray(rows) ? rows.length : 1} row(s)`);
}

async function count(table) {
  const res = await fetch(`${REST}/${table}?select=id`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, Accept: 'application/json' },
  });
  if (!res.ok) return '?';
  const rows = await res.json();
  return Array.isArray(rows) ? rows.length : '?';
}

// ─── Seed data ─────────────────────────────────────────────────────────────

const EDITION_ID = '00000000-0000-0000-0000-000000000005';

const edition = {
  id: EDITION_ID,
  number: 5,
  slug: '5th-annual-2017-ec',
  edition_name_i18n: { en: '5th Annual Tourism Celebration', am: '5ኛው ዓመታዊ የቱሪዝም ሳምንት ክብረ በዓል', om: 'Ayyaana Turizimii Waggaa 5ffaa' },
  title_i18n:        { en: 'Ambo University Woliso Campus Tourism Week', am: 'የአምቦ ዩኒቨርሲቲ ወሊሶ ካምፓስ የቱሪዝም ሳምንት', om: 'Torban Turizimii Yuunivarsiitii Amboo Kaampasii Walisoo' },
  theme_i18n:        { en: 'Tourism for Peace and Stability', am: 'ቱሪዝም ለሰላምና መረጋጋት', om: 'Turizimiin Nageenyaa fi Tasgabbiif' },
  sub_theme_i18n:    { en: 'Promoting Sustainable Heritage, Youth Empowerment, and Community Hospitality', am: 'ዘላቂ ቅርስን ማስተዋወቅ፣ የወጣቶችን አቅም መገንባት እና ማህበረሰባዊ መስተንግዶ', om: 'Hambaalee Itti Fufiinsa Qaban Beeksisuu fi Kunuunsuu' },
  venue_i18n:        { en: 'Woliso Campus & Woliso Town', am: 'ወሊሶ ካምፓስ እና ወሊሶ ከተማ', om: 'Kaampasii Walisoo fi Magaalaa Walisoo' },
  date_range_display_i18n: { en: 'Megabit 29 – Miyazya 03, 2017 E.C. (April 7 – 11, 2025 G.C.)', am: 'መጋቢት 29 – ሚያዝያ 03 ቀን 2017 ዓ.ም (ኤፕሪል 7 – 11፣ 2025 እ.ኤ.አ)', om: 'Bitootessa 29 – Ebla 03, 2017 (Ebla 7 – 11, 2025)' },
  start_date: '2025-04-07',
  end_date:   '2025-04-11',
  start_date_ec: '29/07/2017',
  end_date_ec:   '03/08/2017',
  stats: { expectedParticipants: null, exhibitorsCount: null },
  is_current: true,
};

const events = [
  { id: '00000000-0000-0000-0001-000000000001', edition_id: EDITION_ID, slug: 'cleaning-campaign-campus-town', day: 1, session: 'morning', sort_order: 1, title_i18n: { en: 'Cleaning Campaign within Campus and Woliso Town', am: 'የፅዳት ዘመቻ በካምፓስ እና በወሊሶ ከተማ', om: 'Duula Qulqullinaa Mooraa fi Magaalaa Walisoo Keessatti' }, description_i18n: { en: 'A joint community mobilization uniting students, academic instructors, campus staff, and Woliso town municipal workers. Fostering environmental hygiene and tourism destination sanitation.', am: 'ተማሪዎችን፣ መምህራንን፣ የካምፓስ ሰራተኞችንና የወሊሶ ከተማ ነዋሪዎችን ያቀናጀ የጋራ የፅዳት ዘመቻ።', om: 'Duula qulqullinaa barattoota, barsiisota fi hawaasa magaalaa wal-taasisun qulqullina naannoo eeguu.' }, venue_name_i18n: { en: 'Woliso Campus Quad & Woliso Main Boulevard', am: 'ወሊሶ ካምፓስ እና የወሊሶ ከተማ ዋና አውራ ጎዳና', om: 'Mooraa Kaampasii fi Daandii Guddaa Magaalaa' }, category: 'community', venue_type: 'both', featured: true, status: 'scheduled', state: 'published', image_url: '/assets/aistudio/image_fe8a90e0.png' },
  { id: '00000000-0000-0000-0001-000000000002', edition_id: EDITION_ID, slug: 'street-cultural-show-handcrafts-music', day: 2, session: 'morning', sort_order: 1, title_i18n: { en: 'Street Cultural Show: Traditional Handcrafts & Music', am: 'የጎዳና ላይ ባህላዊ ትዕይንት፡ ባህላዊ ስራዎች እና ሙዚቃ', om: 'Agarsiisa Aadaa Karaa irratti: Hojii Harkaa fi Muuziqaa' }, description_i18n: { en: 'A vibrant showcase of South West Shewa craftsmanship—weaving, pottery, traditional jewellery and live Oromo music performances along Woliso\'s main boulevard.', am: 'የደቡብ ምዕራብ ሸዋ ጥበብ ቀርቶ የሚቀርብ ሲሆን አከሳሰር፣ ሸክላ፣ ወርቅ ስራ እና ቀጥተኛ የኦሮሚኛ ሙዚቃ ይቀርባሉ።', om: 'Hojii harkaa Shawaa Kibba Lixaa—huccuu, abaaboo, warqee fi muuziqaa Oromoo.' }, venue_name_i18n: { en: 'Woliso Main Boulevard & Cultural Square', am: 'የወሊሶ ከተማ ዋና አውራ ጎዳና', om: 'Daandii Guddaa Magaalaa Walisoo' }, category: 'culture', venue_type: 'town', featured: true, status: 'scheduled', state: 'published', image_url: '/assets/aistudio/image_c7963080.png' },
  { id: '00000000-0000-0000-0001-000000000003', edition_id: EDITION_ID, slug: 'tourism-academic-seminar', day: 2, session: 'afternoon', sort_order: 1, title_i18n: { en: 'Tourism Academic Seminar: Research & Industry Linkage', am: 'የቱሪዝም አካዳሚክ ሴሚናር፡ ምርምርና ኢንዱስትሪ ትስስር', om: 'Seminarri Akadaemii Turizimii: Qorannoo fi Industirii' }, description_i18n: { en: 'A formal academic session presenting student research projects, faculty papers, and industry presentations on tourism development in the South West Shewa corridor.', am: 'የተማሪዎች ምርምር ፕሮጄክቶች፣ የዳሰሳ ጥናቶች እና ስለ ቱሪዝም ልማት ቀርበው ይወያያሉ።', om: 'Dhiyeessaa qorannoo barattoota, barsiisota fi industirii turizimii irratti xiyyeeffate.' }, venue_name_i18n: { en: 'Woliso Campus Main Auditorium', am: 'ወሊሶ ካምፓስ ዋና አዳራሽ', om: 'Mana Walgahii Guddaa Kaampasii Walisoo' }, category: 'academic', venue_type: 'campus', featured: false, status: 'scheduled', state: 'published', image_url: null },
  { id: '00000000-0000-0000-0001-000000000004', edition_id: EDITION_ID, slug: 'great-campus-road-run', day: 3, session: 'morning', sort_order: 1, title_i18n: { en: 'Great Woliso Campus Road Run (5 km & 10 km)', am: 'ታላቁ ወሊሶ ካምፓስ የመንገድ ሩጫ (5 ኪ.ሜ እና 10 ኪ.ሜ)', om: 'Fiigichaa Guddaa Kaampasii Walisoo (5km fi 10km)' }, description_i18n: { en: 'An open road race through Woliso town and campus, with categories for students, staff, and community members. Promotes physical wellness and community integration.', am: 'ለተማሪዎች፣ ለሰራተኞችና ለህብረተሰቡ ክፍት የሆነ የመንገድ ሩጫ። ወሊሶ ከተማ ውስጥ ይካሄዳል።', om: 'Fiigichaa karaa banaa barattoota, hojjettootaa fi hawaasaaf.' }, venue_name_i18n: { en: 'Woliso Campus Main Gate → Town Circuit → Return', am: 'ወሊሶ ካምፓስ ዋና ደጃፍ → ወሊሶ ከተማ ዙሪያ → ተመለስ', om: 'Karaa Kaampasii → Magaalaa Walisoo → Deebi\'i' }, category: 'sports', venue_type: 'both', featured: true, status: 'scheduled', state: 'published', image_url: '/assets/aistudio/image_9108d7cc.png' },
  { id: '00000000-0000-0000-0001-000000000005', edition_id: EDITION_ID, slug: 'miss-mr-tourism-pageant', day: 3, session: 'afternoon', sort_order: 1, title_i18n: { en: 'Miss & Mr. Tourism Pageant', am: 'ሚስ እና ሚስተር ቱሪዝም ውድድር', om: 'Dorgommii Bareedina Durbaa fi Dhiiraa Turizimii' }, description_i18n: { en: 'The flagship pageant celebrating cultural identity, traditional attire, and tourism ambassadorship. Contestants represent Ethiopia\'s diverse heritage regions in a programme of talent and advocacy.', am: 'ባህላዊ ማንነትን፣ ባህላዊ ልብስን እና ቱሪዝምን ለማስተዋወቅ የሚካሄደው የዓመቱ ታላቅ ውድድር።', om: 'Dorgommii eenyummaa aadaa, uffata dhalootaa fi bakka bu\'umsa turizimii agarsiisu.' }, venue_name_i18n: { en: 'Grand Auditorium, Woliso Campus', am: 'ትልቁ አዳራሽ፣ ወሊሶ ካምፓስ', om: 'Mana Walgahii Guddaa, Kaampasii Walisoo' }, category: 'culture', venue_type: 'campus', featured: true, status: 'scheduled', state: 'published', image_url: '/assets/aistudio/image_6eb824fd.png' },
  { id: '00000000-0000-0000-0001-000000000006', edition_id: EDITION_ID, slug: 'university-football-derby', day: 4, session: 'morning', sort_order: 1, title_i18n: { en: 'University Football Derby & Sports Competitions', am: 'ዩኒቨርሲቲ የእግር ኳስ ደርቢ እና የስፖርት ፉክክሮች', om: 'Dorgommii Kubbaa Miilaa Yuniversitii fi Ispoortii' }, description_i18n: { en: 'Inter-department and inter-year football matches, alongside volleyball and athletics events. A sports day celebrating teamwork, fitness, and campus spirit.', am: 'ፍሬ ክፍሎችን የሚያካትት የእግር ኳስ ደርቢ፣ ቮሊቦልና ስፖርት ውድድሮች።', om: 'Kubbaa miilaa fi ispoortii gidduugaleessaa yuniversitii.' }, venue_name_i18n: { en: 'Woliso Campus Sports Ground', am: 'ወሊሶ ካምፓስ የስፖርት ሜዳ', om: 'Dirree Ispoortii Kaampasii Walisoo' }, category: 'sports', venue_type: 'campus', featured: false, status: 'scheduled', state: 'published', image_url: null },
  { id: '00000000-0000-0000-0001-000000000007', edition_id: EDITION_ID, slug: 'tourism-quiz-debate-competition', day: 4, session: 'afternoon', sort_order: 1, title_i18n: { en: 'Tourism Quiz & Debate Competition', am: 'የቱሪዝም ጥያቄ እና ክርክር ውድድር', om: 'Dorgommii Gaaffii fi Marii Turizimii' }, description_i18n: { en: 'An inter-department academic quiz on Ethiopian heritage, natural attractions, and global tourism trends, followed by a structured debate on the role of tourism in peacebuilding.', am: 'ስለ ኢትዮጵያ ቅርስ፣ ተፈጥሮ መስህቦች እና ዓለምአቀፍ ቱሪዝም አዝማሚያዎች ጥያቄና ክርክር ።', om: 'Gaaffii fi marii aadaa fi turizmii Itoophiyaa irratti.' }, venue_name_i18n: { en: 'Woliso Campus Library Hall', am: 'ወሊሶ ካምፓስ ቤተ-መፃህፍት አዳራሽ', om: 'Mana Kitaabaa Kaampasii Walisoo' }, category: 'competition', venue_type: 'campus', featured: false, status: 'scheduled', state: 'published', image_url: null },
  { id: '00000000-0000-0000-0001-000000000008', edition_id: EDITION_ID, slug: 'cultural-exhibition-heritage-showcase', day: 5, session: 'morning', sort_order: 1, title_i18n: { en: 'Cultural Exhibition & Heritage Showcase', am: 'ባህላዊ ትዕይንት እና የቅርስ ማሳያ', om: 'Agarsiisa Aadaa fi Hambaalee Dhalootaa' }, description_i18n: { en: 'A multi-booth cultural fair featuring indigenous crafts, traditional cuisine, Oromo, Amhara and southern Ethiopian cultural attire, and a heritage photography exhibition from previous editions.', am: 'ብሔር ብሔረሰቦችን ያካተተ ባህላዊ ሐብቶችን፣ ምግቦችን፣ ልብሶችን እና የቀድሞ ዓመታት ፎቶ ማሳያ።', om: 'Agarsiisa hojii harkaa, nyaata, uffata aadaa fi suuraa sirna darbee.' }, venue_name_i18n: { en: 'Woliso Campus Open Grounds', am: 'ወሊሶ ካምፓስ ሜዳ', om: 'Dirree Banaa Kaampasii Walisoo' }, category: 'culture', venue_type: 'campus', featured: true, status: 'scheduled', state: 'published', image_url: '/assets/aistudio/image_a7c5afdc.png' },
];

const announcement = {
  id: '20000000-0000-0000-0000-000000000001',
  message_i18n: { en: 'The 5th Annual Tourism Week is live! All events are free and open to the public.', am: 'ቱሪዝም ሳምንት ጀምሯል! ሁሉም ፕሮግራሞች ለህዝብ ክፍት ናቸው።', om: 'Torban Turizimii 5ffaan eegaleera! Sagantaaleen hundumtuu saafaa dha.' },
  type: 'urgent',
  starts_at: '2025-04-07T05:00:00+03:00',
  expires_at: '2025-04-12T00:00:00+03:00',
  state: 'published',
};

const siteSettings = {
  id: true,
  contact_email: null,
  phone: null,
  address_i18n: { en: 'Ambo University, Woliso Campus, South West Shewa, Oromia, Ethiopia', am: 'አምቦ ዩኒቨርሲቲ፣ ወሊሶ ካምፓስ፣ ደቡብ ምዕራብ ሸዋ፣ ኦሮሚያ፣ ኢትዮጵያ', om: 'Yuniversitii Amboo, Kaampasii Walisoo, Shawaa Kibba Lixaa, Oromiyaa, Itoophiyaa' },
  social: null,
  footer_text_i18n: null,
};

// ─── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  seed-remote — Seed the Supabase project via REST API         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`  URL: ${SUPABASE_URL}\n`);

  await upsert('editions',         [edition],      'Edition');
  await upsert('events',           events,         'Events');
  await upsert('announcements',    [announcement], 'Announcement');
  await upsert('site_settings',    [siteSettings], 'Site settings');

  console.log('\n  Verifying counts:');
  console.log(`  editions:  ${await count('edition_public')}`);
  console.log(`  events:    ${await count('events')}`);
  console.log(`\n  ✅ Done — run "npm run build" to generate the snapshot from live data.\n`);
}

main().catch((err) => {
  console.error('❌ seed-remote failed:', err.message);
  process.exit(1);
});

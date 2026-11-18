-- =============================================================================
-- supabase/fixes/align_programme.sql
--
-- PURPOSE
--   Align the seeded events in the database with the official 5-day
--   programme provided by the organizing committee.
--
-- REVIEW BEFORE RUNNING
--   All Amharic (am) and Afaan Oromo (om) translations below are marked
--   "needs review" where the original seed used placeholder text.
--   Have a native speaker verify those values before running in production.
--
-- HOW TO RUN
--   1. Open: https://supabase.com/dashboard/project/otdaiykbrmjycjwfjndt/sql
--   2. Click "New query", paste this file, and click Run.
--   3. Verify the output with:
--        SELECT id, slug, day, session, title_i18n->>'en', state
--        FROM public.events
--        WHERE edition_id = '00000000-0000-0000-0000-000000000005'
--        ORDER BY day, session;
--
-- DIFF TABLE
--   ID suffix | Old slug / title (EN)                     | Action      | New slug / title (EN)
--   ...000001 | cleaning-campaign-campus-town             | keep        | (unchanged)
--   ...000002 | street-cultural-show-handcrafts-music     | retitle+    | (richer title matching spec)
--   ...000003 | tourism-academic-seminar                  | keep        | (unchanged)
--   ...000004 | great-campus-road-run                     | keep        | (unchanged)
--   ...000005 | miss-mr-tourism-pageant                   | keep        | (unchanged)
--   ...000006 | university-football-derby                 | REPLACE     | seminar-tourism-promotion-…
--              Day 4 morning was wrongly "Football Derby" — spec says morning=academic seminar
--   ...000007 | tourism-quiz-debate-competition           | REPLACE     | football-academic-vs-admin…
--              Day 4 afternoon was wrongly "Quiz" — spec says afternoon=staff football match
--   ...000008 | cultural-exhibition-heritage-showcase     | REPLACE     | guest-tour-woliso-destinations
--              Day 5 morning was wrongly "Cultural Exhibition" — spec says morning=Guest Tour
--   ...000009 | (did not exist)                           | INSERT      | end-of-the-programme-closing
--              Day 5 afternoon (End of the Programme) was missing entirely
--
--   The two Day 4 events had their content swapped. This file corrects that
--   by updating id ...000006 to the morning academic seminar and id ...000007
--   to the afternoon staff football match (preserving the UUIDs so any
--   external references remain valid).
-- =============================================================================

BEGIN;

-- ─── Event 00000000-0000-0000-0001-000000000001 ───────────────────────────────
-- Day 1 morning: Cleaning Campaign — no change needed.
-- (Included for completeness; UPDATE is a no-op if already correct.)

UPDATE public.events SET
  slug             = 'cleaning-campaign-campus-town',
  day              = 1,
  session          = 'morning',
  sort_order       = 1,
  title_i18n       = '{"en":"Cleaning Campaign within Campus and Woliso Town",
                        "am":"የፅዳት ዘመቻ በካምፓስ እና በወሊሶ ከተማ",
                        "om":"Duula Qulqullinaa Mooraa fi Magaalaa Walisoo"}'::jsonb,
  description_i18n = '{"en":"A joint community mobilization uniting students, academic instructors, campus staff, and Woliso town municipal workers. Fostering environmental hygiene and tourism destination sanitation.",
                        "am":"ተማሪዎችን፣ መምህራንን፣ የካምፓስ ሰራተኞችንና የወሊሶ ከተማ ነዋሪዎችን ያቀናጀ የጋራ የፅዳት ዘመቻ። ለአረንጓዴና ፅዱ ቱሪዝም መዳረሻ ጥሪ የሚያስተላልፍ መርሃ ግብር።",
                        "om":"Duula qulqullinaa barattoota, barsiisota fi hawaasa magaalaa wal-taasisun qulqullina naannoo eeguu fi qophii ayyaanichaaf godhamu. (needs review)"}'::jsonb,
  venue_name_i18n  = '{"en":"Woliso Campus Quad & Woliso Main Boulevard",
                        "am":"ወሊሶ ካምፓስ እና የወሊሶ ከተማ ዋና አውራ ጎዳና",
                        "om":"Mooraa Kaampasii Walisoo fi Daandii Guddaa Magaalaa (needs review)"}'::jsonb,
  updated_at       = now()
WHERE id = '00000000-0000-0000-0001-000000000001'
  AND edition_id = '00000000-0000-0000-0000-000000000005';

-- ─── Event 00000000-0000-0000-0001-000000000002 ───────────────────────────────
-- Day 2 morning: Street Cultural Show, Handcrafts, Music Festival, Dance Contest
-- Original seed had a shorter title; spec specifies all four sub-activities.

UPDATE public.events SET
  slug             = 'street-cultural-show-handcrafts-music',
  day              = 2,
  session          = 'morning',
  sort_order       = 1,
  title_i18n       = '{"en":"Street Cultural Show, Handcrafts Exhibition, Music Festival & Dance Contest",
                        "am":"የጎዳና ላይ የባህል ትዕይንት፣ የባህል ቁሳቁስ አውደ ርዕይ፣ የሙዚቃ ፌስቲቫል እና የዳንስ ውድድር",
                        "om":"Agarsiisa Aadaa Daandii Irraa, Meeshaalee Aadaa, Dorgommii Muuziqaa fi Shubbisaa (needs review)"}'::jsonb,
  description_i18n = '{"en":"Vibrant outdoor festival displaying rich Ethiopian traditional attire, indigenous craftsmanship, live regional music ensembles, and dynamic modern/traditional dance contests along Woliso town boulevard.",
                        "am":"የኢትዮጵያን ብሔር ብሔረሰቦች ውብ የባህል አልባሳት፣ ጥበብና የእጅ ስራዎች፣ ባህላዊና ዘመናዊ የሙዚቃ ትዕይንቶች እንዲሁም የዳንስ ውድድር የሚያካትት ደማቅ ፌስቲቫል።",
                        "om":"Agarsiisa aadaa boonsaa fi miidhagina uffannaa aadaa, meeshaalee aadaa, sirboota fi dorgommii shubbisaa kan of keessatti qabate. (needs review)"}'::jsonb,
  updated_at       = now()
WHERE id = '00000000-0000-0000-0001-000000000002'
  AND edition_id = '00000000-0000-0000-0000-000000000005';

-- ─── Event 00000000-0000-0000-0001-000000000003 ───────────────────────────────
-- Day 2 afternoon: Tourism Academic Seminar — no change needed.

UPDATE public.events SET
  slug             = 'tourism-academic-seminar',
  day              = 2,
  session          = 'afternoon',
  sort_order       = 1,
  updated_at       = now()
WHERE id = '00000000-0000-0000-0001-000000000003'
  AND edition_id = '00000000-0000-0000-0000-000000000005';

-- ─── Event 00000000-0000-0000-0001-000000000004 ───────────────────────────────
-- Day 3 morning: Great Campus Road Run — no change needed.

UPDATE public.events SET
  slug             = 'great-campus-road-run',
  day              = 3,
  session          = 'morning',
  sort_order       = 1,
  updated_at       = now()
WHERE id = '00000000-0000-0000-0001-000000000004'
  AND edition_id = '00000000-0000-0000-0000-000000000005';

-- ─── Event 00000000-0000-0000-0001-000000000005 ───────────────────────────────
-- Day 3 afternoon: Miss & Mr. Tourism Pageant — no change needed.

UPDATE public.events SET
  slug             = 'miss-mr-tourism-pageant',
  day              = 3,
  session          = 'afternoon',
  sort_order       = 1,
  updated_at       = now()
WHERE id = '00000000-0000-0000-0001-000000000005'
  AND edition_id = '00000000-0000-0000-0000-000000000005';

-- ─── Event 00000000-0000-0000-0001-000000000006 ───────────────────────────────
-- CORRECTED: was "University Football Derby" (Day 4 morning) in the original seed.
-- Target: Day 4 morning = Academic Seminar, Destination Promotion, Contests & Awards.

UPDATE public.events SET
  slug             = 'seminar-tourism-promotion-competitions-awards',
  day              = 4,
  session          = 'morning',
  sort_order       = 1,
  title_i18n       = '{"en":"Academic Seminar on Tourism Issues, Destination Promotion, Interdepartmental Contests & Awards",
                        "am":"በቱሪዝም ጉዳዮች ላይ ሴሚናር፣ የቱሪዝም መዳረሻዎች ማስተዋወቅ፣ የጥያቄና ስነ-ጽሑፍ ውድድር እና የምስክር ወረቀት መርሃ ግብር",
                        "om":"Seminaara Dhimmoota Turizimii, Beeksisa Bakkeewwan Hawwataa, Dorgommii Kutaalee Gidduutti fi Sagantaa Waraqaa Ragaa (needs review)"}'::jsonb,
  description_i18n = '{"en":"Scholarly presentations on \"Tourism for Peace and Stability\", local destination marketing showcases, student interdepartmental quiz with poetry and essay competition, and certificate and award programme for organizers and sponsors.",
                        "am":"ስለ ቱሪዝምና ሰላም ፅናት ጥናታዊ ቀረቤታዎች፣ የቱሪዝም መዳረሻዎች ማስተዋወቂያ፣ የጥያቄ፣ ስነ-ጽሑፍ እና የድርሰት ውድድር፣ ለስፖንሰሮችና ለአዘጋጆች የምስክር ወረቀትና ሽልማት ፕሮግራም።",
                        "om":"Dhiyeessaa qorannoo turizimii fi nagaa, beeksisa bakkeewwan hawwataa, dorgommii gaaffii fi deebii barattootaa, fi sagantaa waraqaa ragaa isponsarootaa fi qopheessitootaaf. (needs review)"}'::jsonb,
  venue_name_i18n  = '{"en":"Woliso Campus Conference Hall",
                        "am":"የወሊሶ ካምፓስ የኮንፈረንስ አዳራሽ",
                        "om":"Galma Walgahii Kaampasii Walisoo (needs review)"}'::jsonb,
  category         = 'academic',
  venue_type       = 'campus',
  featured         = true,
  image_url        = '/assets/aistudio/image_25e4d059.png',
  updated_at       = now()
WHERE id = '00000000-0000-0000-0001-000000000006'
  AND edition_id = '00000000-0000-0000-0000-000000000005';

-- ─── Event 00000000-0000-0000-0001-000000000007 ───────────────────────────────
-- CORRECTED: was "Tourism Quiz & Debate Competition" (Day 4 afternoon) in the original seed.
-- Target: Day 4 afternoon = Staff Friendly Football Match (Academic vs Administrative).

UPDATE public.events SET
  slug             = 'football-academic-vs-administrative-staff',
  day              = 4,
  session          = 'afternoon',
  sort_order       = 1,
  title_i18n       = '{"en":"Staff Friendly Football Match: Academic vs. Administrative Staff",
                        "am":"የሰራተኞች የወዳጅነት እግር ኳስ ግጥሚያ፡ አካዳሚክ ከ አስተዳደር ሰራተኞች ጋር",
                        "om":"Tapha Kubbaa Miilaa: Barsiisotaa fi Hojjettoota Bulchiinsaa Gidduutti (needs review)"}'::jsonb,
  description_i18n = '{"en":"Entertaining sports derby building camaraderie, teamwork, and institutional wellness between teaching faculty and administrative personnel.",
                        "am":"በመምህራን እና በአስተዳደር ሰራተኞች መካከል የጋራ አንድነትን፣ ጤናን እና ደስታን የሚያጠናክር አጓጊ የእግር ኳስ የወዳጅነት ጨዋታ።",
                        "om":"Tapha kubbaa miilaa jaalalaa fi tokkummaa hojjettoota kaampasii gidduutti taasifamu. (needs review)"}'::jsonb,
  venue_name_i18n  = '{"en":"Woliso Campus Sports Stadium",
                        "am":"የወሊሶ ካምፓስ ስፖርት ሜዳ",
                        "om":"Dirree Ispoortii Kaampasii Walisoo (needs review)"}'::jsonb,
  category         = 'sports',
  venue_type       = 'campus',
  featured         = false,
  image_url        = '/assets/aistudio/image_6eb824fd.png',
  updated_at       = now()
WHERE id = '00000000-0000-0000-0001-000000000007'
  AND edition_id = '00000000-0000-0000-0000-000000000005';

-- ─── Event 00000000-0000-0000-0001-000000000008 ───────────────────────────────
-- CORRECTED: was "Cultural Exhibition & Heritage Showcase" (Day 5 morning) in the original seed.
-- Target: Day 5 morning = Guest Tour to Regional Eco-Tourism & Heritage Sites.

UPDATE public.events SET
  slug             = 'guest-tour-woliso-destinations',
  day              = 5,
  session          = 'morning',
  sort_order       = 1,
  title_i18n       = '{"en":"Guest Tour to Regional Eco-Tourism & Heritage Sites",
                        "am":"የእንግዶች ጉብኝት ወደ ተፈጥሮ እና ባህላዊ መስህቦች",
                        "om":"Daawwannaa Keessummootaa Bakkeewwan Hawwata Turizimiitti (needs review)"}'::jsonb,
  description_i18n = '{"en":"Guided field exploration for invited delegates, academics, and guests visiting regional natural hot springs, eco-lodges, and cultural landscape attractions surrounding Woliso.",
                        "am":"ለክብር እንግዶች፣ ለተመራማሪዎችና ለተሳታፊዎች የተዘጋጀ የወሊሶ እና አካባቢዋን የተፈጥሮ ፍልውሃዎች፣ የመዝናኛ ስፍራዎች እና ቅርሶች የመስክ ጉብኝት።",
                        "om":"Daawwannaa iddoowwan qabeenya uumamaa fi hawwata turizimii naannoo Walisootti argaman daawwachuuf qophaa''e. (needs review)"}'::jsonb,
  venue_name_i18n  = '{"en":"Woliso Eco-Tourism Hot Springs & Landscape Sites",
                        "am":"የወሊሶ የተፈጥሮ ፍልውሃ እና የቱሪዝም መስህቦች",
                        "om":"Bakkeewwan Hawwata Uumamaa fi Burqaa Walisoo (needs review)"}'::jsonb,
  category         = 'culture',
  venue_type       = 'town',
  featured         = true,
  image_url        = '/assets/aistudio/image_7544bf77.png',
  updated_at       = now()
WHERE id = '00000000-0000-0000-0001-000000000008'
  AND edition_id = '00000000-0000-0000-0000-000000000005';

-- ─── Event 00000000-0000-0000-0001-000000000009 ───────────────────────────────
-- INSERT NEW: Day 5 afternoon = End of the Programme — Closing Ceremony.
-- This event was completely missing from the original seed.

INSERT INTO public.events (
  id, edition_id, slug, day, session, sort_order,
  title_i18n, description_i18n, venue_name_i18n,
  category, venue_type, featured, status, state, image_url
) VALUES (
  '00000000-0000-0000-0001-000000000009',
  '00000000-0000-0000-0000-000000000005',
  'end-of-the-programme-closing',
  5, 'afternoon', 1,
  '{"en":"End of the Programme — Closing Ceremony",
    "am":"የፕሮግራሙ ማጠቃለያ እና የክብር መዝጊያ ስነ ስርዓት",
    "om":"Xumura Sagantichaa fi Eebba Cufiinsaa (needs review)"}'::jsonb,
  '{"en":"Official closing remarks from university leadership, announcement of competition winners, cultural banquet, and final festival thanksgiving.",
    "am":"የዩኒቨርሲቲው የበላይ አመራሮች የማጠቃለያ ንግግር፣ የአሸናፊዎች ማስታወቂያና ሽልማት እንዲሁም ይፋዊ የሳምንቱ ማጠቃለያ።",
    "om":"Sagantaa cufiinsa boonsaa kan hoggantoota yuunivarsiitiin geggeeffamu fi badhaasa xumuraa. (needs review)"}'::jsonb,
  '{"en":"Woliso Campus Grand Auditorium",
    "am":"የወሊሶ ካምፓስ ታላቅ አዳራሽ",
    "om":"Galma Guddaa Kaampasii Walisoo (needs review)"}'::jsonb,
  'community', 'campus', true, 'scheduled', 'published',
  '/assets/aistudio/image_c9b19ed8.png'
) ON CONFLICT (id) DO UPDATE SET
  slug             = EXCLUDED.slug,
  day              = EXCLUDED.day,
  session          = EXCLUDED.session,
  title_i18n       = EXCLUDED.title_i18n,
  description_i18n = EXCLUDED.description_i18n,
  venue_name_i18n  = EXCLUDED.venue_name_i18n,
  category         = EXCLUDED.category,
  venue_type       = EXCLUDED.venue_type,
  featured         = EXCLUDED.featured,
  image_url        = EXCLUDED.image_url,
  updated_at       = now();

-- ─── Verify ───────────────────────────────────────────────────────────────────

COMMIT;

-- Run this after the transaction to confirm the final state:
SELECT
  id,
  day,
  session,
  slug,
  title_i18n->>'en'                              AS title_en,
  CASE WHEN title_i18n->>'am' ILIKE '%needs review%' THEN '⚠ AM needs review' ELSE 'AM ok' END AS am_status,
  CASE WHEN title_i18n->>'om' ILIKE '%needs review%' THEN '⚠ OM needs review' ELSE 'OM ok' END AS om_status,
  state
FROM public.events
WHERE edition_id = '00000000-0000-0000-0000-000000000005'
ORDER BY day, session;

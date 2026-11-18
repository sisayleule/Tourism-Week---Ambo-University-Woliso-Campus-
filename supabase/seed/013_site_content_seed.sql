-- =============================================================================
-- Seed 013 — Initial page_sections and page_section_items
--
-- PURPOSE
--   Convert every hard-coded public string found in Phase 6B audit into a
--   published database row with needs_review = true (so the department can
--   verify copy).  Text is IDENTICAL to what the public site shows today,
--   so running this seed produces zero visual change.
--
-- FACTS THAT NEED DEPARTMENT VERIFICATION (marked ⚠ below)
--   • "32 km from Woliso"           — Wonchi badge
--   • "UN Tourism Best Tourism Villages" award claim — Wonchi description
--   • "2,000+"  expected participants — editions.stats
--   • "30+"     artisan exhibitors    — editions.stats
--   • "Established 1947"            — About page, department founding year
--   • Past editions 1–4 themes and impact summaries (inverted from code)
--
-- HOW TO RUN
--   supabase db push --local          (local dev)
--   supabase db push                  (remote, via Supabase CLI)
--   Or paste into SQL Editor and run.
--
-- IDEMPOTENCY
--   Uses INSERT ... ON CONFLICT (key) DO UPDATE so it is safe to re-run.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1.  home.hero — Featured Wonders chips
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.page_sections
  (key, title_i18n, subtitle_i18n, state, needs_review)
VALUES (
  'home.hero',
  '{"en":"Featured Wonders","am":"ተፈላጊ አካባቢዎች","om":"Bakkeewwan Mul''ataa"}',
  NULL,
  'published', true
)
ON CONFLICT (key) DO UPDATE SET
  title_i18n   = EXCLUDED.title_i18n,
  needs_review = EXCLUDED.needs_review,
  updated_at   = now();

-- Chips (page_section_items) — delete and re-insert to keep order clean
DO $$
DECLARE v_sid uuid;
BEGIN
  SELECT id INTO v_sid FROM public.page_sections WHERE key = 'home.hero';
  DELETE FROM public.page_section_items WHERE section_id = v_sid;
  INSERT INTO public.page_section_items (section_id, title_i18n, sort_order, state) VALUES
    (v_sid, '{"en":"Lalibela","am":"ላሊበላ","om":"Laalibelaa"}',       0, 'published'),
    (v_sid, '{"en":"Aksum","am":"አክሱም","om":"Aksuum"}',               1, 'published'),
    (v_sid, '{"en":"Simien Mts.","am":"ስምን ተራሮች","om":"Simiyen Mts."}', 2, 'published'),
    (v_sid, '{"en":"Wonchi Lake","am":"ወንጪ ሐይቅ","om":"Haroo Wonchii"}',  3, 'published');
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2.  home.highlights — section heading
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.page_sections
  (key, title_i18n, subtitle_i18n, state, needs_review)
VALUES (
  'home.highlights',
  '{"en":"Top Festival Highlights"}',
  '{"en":"Cultural pageantry, athletic determination, and living heritage — five days of celebration."}',
  'published', true
)
ON CONFLICT (key) DO UPDATE SET
  title_i18n    = EXCLUDED.title_i18n,
  subtitle_i18n = EXCLUDED.subtitle_i18n,
  needs_review  = EXCLUDED.needs_review,
  updated_at    = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.  home.itinerary — daily schedule heading
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.page_sections
  (key, title_i18n, subtitle_i18n, state, needs_review)
VALUES (
  'home.itinerary',
  '{"en":"Select a Day to Preview Sessions","am":"ቀን ምረጥ የክፍለ ጊዜ ቅድሚያ ዕይታ","om":"Guyyaa filadhu shiraa ilaaluf"}',
  '{"en":"Daily Itinerary","am":"ዕለታዊ ፕሮግራም","om":"Sagantaa Guyyaa"}',
  'published', true
)
ON CONFLICT (key) DO UPDATE SET
  title_i18n    = EXCLUDED.title_i18n,
  subtitle_i18n = EXCLUDED.subtitle_i18n,
  needs_review  = EXCLUDED.needs_review,
  updated_at    = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.  home.explore — Explore Woliso section + 2 cards
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.page_sections
  (key, title_i18n, subtitle_i18n, state, needs_review)
VALUES (
  'home.explore',
  '{"en":"Explore Woliso & the South West Shewa Eco-Corridor","am":"ወሊሶን እና የደቡብ ምዕራብ ሸዋ ስነ-ምህዳር ኮሪደርን ያስሱ","om":"Walisoo fi Koridiira Eco-Shawaa Kibba-Lixaa Daawwadhaa"}',
  '{"en":"Woliso is a gateway to volcanic caldera lakes, geothermal hot springs, and ancient forests — a living classroom for our Tourism students.","am":"ወሊሶ ወደ እሳተጎሞራ ሐይቆች፣ ሞቃት ምንጮች እና ጥንታዊ ደኖች መንገድ ነው።","om":"Walisoo karaa galaana caldera, bubbee bishaanii fi bosonaa gara duraawaatti banamtuu dha."}',
  'published', true
)
ON CONFLICT (key) DO UPDATE SET
  title_i18n    = EXCLUDED.title_i18n,
  subtitle_i18n = EXCLUDED.subtitle_i18n,
  needs_review  = EXCLUDED.needs_review,
  updated_at    = now();

DO $$
DECLARE v_sid uuid;
BEGIN
  SELECT id INTO v_sid FROM public.page_sections WHERE key = 'home.explore';
  DELETE FROM public.page_section_items WHERE section_id = v_sid;
  INSERT INTO public.page_section_items
    (section_id, title_i18n, body_i18n, icon, badge_i18n, sort_order, state)
  VALUES
  (
    v_sid,
    '{"en":"Wonchi (Wenchi) Crater Lake","am":"ወንጪ ቅርጽ ሐይቅ","om":"Haroo Caldera Wonchii"}',
    -- ⚠ VERIFY: "UN Tourism Best Tourism Villages" award claim; exact distance "32 km"
    '{"en":"Awarded by UN Tourism as one of the \"Best Tourism Villages,\" Wonchi features an emerald volcanic caldera lake, island monasteries, horseback trails, and mineral waterfalls.","am":"በተባበሩት መንግሥታት ቱሪዝም \"ምርጥ የቱሪስት መንደሮች\" ከሚባሉት አንዱ። ወንጪ አረንጓዴ እሳተጎሞራ ሐይቅ፣ ደሴቶች ቤተ-ክርስቲያን፣ የፈረስ መንገዶች እና ሚኒሬል ፏፏቴዎች ያሉት ነው።","om":"UN Tourism \"Ganda Turizimii Gaarii\" jedhamtee badhaafamte. Haroo caldera magariisa, manneen amantii, karaa fardaa fi burkutaa mineeral qabdi."}',
    'Mountain',
    -- ⚠ VERIFY: exact distance from Woliso town centre to Wonchi
    '{"en":"32 km from Woliso","am":"ወሊሶ ከ32 ኪ.ሜ ርቀት","om":"KM 32 Walisoo irraa"}',
    0, 'published'
  ),
  (
    v_sid,
    '{"en":"Woliso Hot Springs & Traditional Hospitality","am":"የወሊሶ ሙቀቱ ምንጭ እና ባህላዊ አስተናጋጅነት","om":"Bubbee Bishaanii Walisoo fi Keessummaa Aadaa"}',
    '{"en":"Renowned for natural geothermal thermal baths, lush gardens, and indigenous Oromo coffee ceremonies. Department students conduct real-time hospitality studies here.","am":"ለተፈጥሯዊ ሙቅ ምንጮች፣ ቆንጆ ቦታዎች፣ እና ሐበሻ ቡና ስርዓቶች የሚታወቅ። የክፍሉ ተማሪዎች እዚ ቦታ ቀጥተኛ አስተናጋጅነት ያጠናሉ።","om":"Bubbee bishaanii uumamaa, lafa midhaanii fi sirna buna Oromoo. Barataan kutaa asii barnnoota keessummaa qoratu."}',
    'Coffee',
    '{"en":"In Woliso Town","am":"በወሊሶ ከተማ","om":"Magaalaa Walisoo keessa"}',
    1, 'published'
  );
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5.  home.philosophy — Guiding Philosophy + 4 virtue cards
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.page_sections
  (key, title_i18n, subtitle_i18n, body_i18n, state, needs_review)
VALUES (
  'home.philosophy',
  '{"en":"The Guiding Philosophy","am":"መሪ ፍልስፍና","om":"Falaasama Hogganaa"}',
  NULL,
  '{"en":"The Department of Tourism and Hotel Management at Ambo University Woliso Campus trains future industry leaders in intercultural respect, community-based hospitality, and dialogue-driven conflict resolution.","am":"የቱሪዝም እና ሆቴል ማኔጅመንት ትምህርት ክፍል የወደፊት ኢንዱስትሪ መሪዎችን ሥልጠና ይሰጣል።","om":"Kutaan barnootaa hoggansa turizimii fi hoteela hoggantoota gara fuulduraa leenjisa."}',
  'published', true
)
ON CONFLICT (key) DO UPDATE SET
  title_i18n    = EXCLUDED.title_i18n,
  body_i18n     = EXCLUDED.body_i18n,
  needs_review  = EXCLUDED.needs_review,
  updated_at    = now();

DO $$
DECLARE v_sid uuid;
BEGIN
  SELECT id INTO v_sid FROM public.page_sections WHERE key = 'home.philosophy';
  DELETE FROM public.page_section_items WHERE section_id = v_sid;
  INSERT INTO public.page_section_items
    (section_id, title_i18n, body_i18n, icon, sort_order, state)
  VALUES
  (v_sid, '{"en":"Peace & Unity","am":"ሰላምና አንድነት","om":"Nageenyaa fi Tokkummaa"}',
          '{"en":"Intercultural dialogue through folk dance, poetry, and shared sport.","am":"ቅርጽ ዳንስ፣ ግጥም እና ስፖርት በኩል ባህላዊ ውይይት።","om":"Qaayyoo aadaa, barruulee fi ispoortiitiin haasaa."}',
          'Heart',    0, 'published'),
  (v_sid, '{"en":"Eco-Conservation","am":"ሥነ-ምህዳር ጥበቃ","om":"Eegumsa Naannoo"}',
          '{"en":"Wonchi Crater Lake and Woliso hot springs natural preservation.","am":"ወንጪ ሐይቅ እና የወሊሶ ሙቅ ምንጮች ተፈጥሮ ጥበቃ።","om":"Haroo Caldera Wonchii fi bubbee bishaanii Walisoo eeguu."}',
          'TreePine', 1, 'published'),
  (v_sid, '{"en":"Academic Rigor","am":"አካዳሚክ ጥብቅነት","om":"Cimina Barnootaa"}',
          '{"en":"Degrees in Tourism Management and Hotel Operations.","am":"ቱሪዝም ማኔጅመንት እና ሆቴል ሥራ ዲግሪ ፕሮግራሞች።","om":"Digiriin Hoggansa Turizimii fi Hoteela."}',
          'BookOpen', 2, 'published'),
  (v_sid, '{"en":"Cultural Pride","am":"ባህላዊ ኩርያ","om":"Dheebuu Aadaa"}',
          '{"en":"Traditional Habesha attire, pottery, and culinary arts.","am":"ባህላዊ አቀማጣሎ፣ ሸክላ ሥርሥር እና ምግብ ጥበብ።","om":"Uffata aadaa, abaaboo uduu fi sanaa nyaataa."}',
          'Sparkles', 3, 'published');
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.  home.gallery — gallery strip heading
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.page_sections
  (key, title_i18n, subtitle_i18n, state, needs_review)
VALUES (
  'home.gallery',
  '{"en":"Celebration Media Gallery","am":"የክብረ-በዓል ሚዲያ ጋለሪ","om":"Gaaliree Miidiyaa Ayyaanaa"}',
  '{"en":"Authentic event photography capturing student pageantry, athletic runs, and cultural pride.","am":"ትክክለኛ የዝግጅት ፎቶግራፊ — የተማሪ ትዕይንቶች፣ ሩጫዎች፣ እና ባህላዊ ኩርያ።","om":"Suuraa dhugaa ayyaanaa — fiigicha barattoota fi dheebuu aadaa."}',
  'published', true
)
ON CONFLICT (key) DO UPDATE SET
  title_i18n    = EXCLUDED.title_i18n,
  subtitle_i18n = EXCLUDED.subtitle_i18n,
  needs_review  = EXCLUDED.needs_review,
  updated_at    = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7.  home.news — news strip heading
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.page_sections
  (key, title_i18n, subtitle_i18n, state, needs_review)
VALUES (
  'home.news',
  '{"en":"Latest News & Notices","am":"የቅርብ ጊዜ ዜናዎች እና ማሳወቂያዎች","om":"Oduu fi Beeksistuu Haaraa"}',
  '{"en":"Campus Bulletins","am":"የካምፓስ ቡሌቲኖች","om":"Ibsa Kaampasii"}',
  'published', true
)
ON CONFLICT (key) DO UPDATE SET
  title_i18n    = EXCLUDED.title_i18n,
  subtitle_i18n = EXCLUDED.subtitle_i18n,
  needs_review  = EXCLUDED.needs_review,
  updated_at    = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8.  home.cta — Call-to-Action band (overrides i18n keys when published)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.page_sections
  (key, title_i18n, subtitle_i18n, body_i18n, cta_label_i18n, cta_url, state, needs_review)
VALUES (
  'home.cta',
  '{"en":"Be Part of the Celebration","am":"የክብረ-በዓሉ አካል ሁን","om":"Hirmaataa Ayyaanaa Ta''i"}',
  '{"en":"Tourism for Peace and Stability","am":"ቱሪዝም ለሰላምና መረጋጋት","om":"Turizimiin Nageenyaa fi Tasgabbiif"}',
  '{"en":"Five days of cultural exchange, athletic competitions, academic seminars, and community celebrations at Ambo University Woliso Campus.","am":"አምስት ቀን ባህላዊ ልውውጥ፣ ስፖርታዊ ፉክክር፣ አካዳሚክ ሴሚናር እና ማህበረሰባዊ ምስጋና።","om":"Guyyaa shan jijjiirama aadaa, dorgommii ispoorti, siminaaraa fi ayyaana hawaasaa."}',
  '{"en":"View Full Schedule","am":"ሙሉ መርሃ ግብርን ይዩ","om":"Sagantaa Guutuu Ilaalaa"}',
  '/schedule',
  'published', true
)
ON CONFLICT (key) DO UPDATE SET
  title_i18n     = EXCLUDED.title_i18n,
  subtitle_i18n  = EXCLUDED.subtitle_i18n,
  body_i18n      = EXCLUDED.body_i18n,
  cta_label_i18n = EXCLUDED.cta_label_i18n,
  cta_url        = EXCLUDED.cta_url,
  needs_review   = EXCLUDED.needs_review,
  updated_at     = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9.  about.intro — Department intro + 4 stat cards
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.page_sections
  (key, title_i18n, subtitle_i18n, body_i18n, state, needs_review)
VALUES (
  'about.intro',
  '{"en":"Pioneering Tourism & Hotel Leadership in Ethiopia","am":"የቱሪዝምና ሆቴል አስተዳደር አቅርቦት በኢትዮጵያ","om":"Hoggansa Turizimii fi Hoteela Biyya Itoophiyaa keessatti Durfachuu"}',
  -- ⚠ VERIFY: "Established 1947" — founding year of Ambo University Woliso Campus department
  '{"en":"The Department of Tourism and Hotel Management at Ambo University Woliso Campus is one of the nation''s foremost academic bodies dedicated to hospitality development, eco-tourism stewardship, and heritage preservation.","am":"የቱሪዝም እና ሆቴል ማኔጅመንት ትምህርት ክፍል ከሀገሪቱ ቀዳሚ አካዳሚክ አካላት አንዱ ነው።","om":"Kutaan barnootaa hoggansa turizimii fi hoteela mootummaa keessa tokko isa duraa dha."}',
  '{"en":"Our annual Tourism Week is the department''s signature experiential learning initiative. Rather than confining hospitality studies to textbooks, our students actively manage public logistics, curate cultural exhibitions, liaise with municipal leaders, and lead field research tours.","am":"ዓመታዊ የቱሪዝም ሳምንት የክፍሉ ዋና የተፈጥሮ ትምህርት ዘዴ ነው። ተማሪዎቻችን ቀጥተኛ አስተዳደር ያካሂዳሉ።","om":"Torban Turizimii waggaatti tokko beellama barnootaa godhata. Barataan keenya bulchiinsa uumamaa gaggeessa."}',
  'published', true
)
ON CONFLICT (key) DO UPDATE SET
  title_i18n    = EXCLUDED.title_i18n,
  subtitle_i18n = EXCLUDED.subtitle_i18n,
  body_i18n     = EXCLUDED.body_i18n,
  needs_review  = EXCLUDED.needs_review,
  updated_at    = now();

DO $$
DECLARE v_sid uuid;
BEGIN
  SELECT id INTO v_sid FROM public.page_sections WHERE key = 'about.intro';
  DELETE FROM public.page_section_items WHERE section_id = v_sid;
  INSERT INTO public.page_section_items
    (section_id, title_i18n, body_i18n, icon, sort_order, state)
  VALUES
  (v_sid, '{"en":"Rigorous Curriculum","am":"ጥብቅ ትምህርት","om":"Barnootaa Cimaa"}',
          '{"en":"BSc degree programs in Tourism Management and Hotel Operations.","am":"ቱሪዝም ማኔጅመንት እና ሆቴል ሥራ ዲግሪ ፕሮግራሞች።","om":"Sagantaa digiriin BSc Hoggansa Turizimii fi Hoteela."}',
          'BookOpen', 0, 'published'),
  (v_sid, '{"en":"Community Outreach","am":"የማህበረሰብ ተደራሽነት","om":"Hawaasaaf Qaqabu"}',
          '{"en":"Direct sanitation and hygiene campaigns supporting Woliso municipality.","am":"ቀጥተኛ ፅዳትና ጤና ዘመቻዎች ወሊሶ ከተማ ደጋፊዎች።","om":"Duula qulqullinaa fi fayyaa magaalaa Walisoo."}',
          'Heart', 1, 'published'),
  (v_sid, '{"en":"Cultural Heritage","am":"ባህላዊ ቅርስ","om":"Dhaloota Aadaa"}',
          '{"en":"Documenting indigenous crafts, textiles, and traditional culinary arts.","am":"ሀገር-በቀል ሥራዎች፣ ጨርቃጨርቅ፣ እና ምግብ ጥበቦችን ማስታወቅ።","om":"Hojii harkaa, uffata fi sanaa nyaataa aadaa galmaa''uu."}',
          'Award', 2, 'published'),
  (v_sid, '{"en":"Public Inclusivity","am":"ሕዝባዊ ተሳትፎ","om":"Hirmaannaa Uummataa"}',
          '{"en":"100% free public access to all celebrations, sports, and seminars.","am":"100% ነፃ ሕዝባዊ ተሳትፎ ለሁሉ ዝግጅቶች፣ ስፖርቶች፣ እና ሴሚናሮች።","om":"Hirmaannaa uummataa 100% bilisaa ayyaanota, ispoorti fi siminaaraaf."}',
          'Users', 3, 'published');
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. about.heritage — section heading
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.page_sections
  (key, title_i18n, subtitle_i18n, state, needs_review)
VALUES (
  'about.heritage',
  '{"en":"Past Editions Timeline","am":"ያለፉ እትሞች ታሪክ","om":"Seenaa Maxxansaalee Darban"}',
  '{"en":"Heritage & Precedents","am":"ቅርስ እና ቀዳሚ ምሳሌዎች","om":"Dhaloota fi Fakkeenya Duraanoo"}',
  'published', true
)
ON CONFLICT (key) DO UPDATE SET
  title_i18n    = EXCLUDED.title_i18n,
  subtitle_i18n = EXCLUDED.subtitle_i18n,
  needs_review  = EXCLUDED.needs_review,
  updated_at    = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. about.timeline — section metadata (content driven by editions table)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.page_sections
  (key, title_i18n, subtitle_i18n, state, needs_review)
VALUES (
  'about.timeline',
  '{"en":"Past Editions","am":"ያለፉ እትሞች","om":"Maxxansaalee Darban"}',
  '{"en":"The story of Tourism Week through the years.","am":"የቱሪዝም ሳምንት ታሪክ ከዓመታት ጋር።","om":"Seenaa Torban Turizimii waggaadhaa waggaatti."}',
  'published', true
)
ON CONFLICT (key) DO UPDATE SET
  title_i18n    = EXCLUDED.title_i18n,
  subtitle_i18n = EXCLUDED.subtitle_i18n,
  needs_review  = EXCLUDED.needs_review,
  updated_at    = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. sponsors.intro
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.page_sections
  (key, title_i18n, subtitle_i18n, body_i18n, state, needs_review)
VALUES (
  'sponsors.intro',
  '{"en":"Institutional Alliances","am":"ተቋማዊ ትብብሮች","om":"Waliin-hojii Dhaabbilee"}',
  '{"en":"Become a Sponsor","am":"ስፖንሰር ሁን","om":"Deeggaraa Ta''i"}',
  '{"en":"Support the 5th Annual Tourism Celebration and connect your brand with Ethiopia''s future tourism leaders.","am":"5ኛውን ዓመታዊ የቱሪዝም ክብረ-በዓል ደጉፉ።","om":"Ayyaana Turizimii Waggaa 5ffaa gargaari."}',
  'published', true
)
ON CONFLICT (key) DO UPDATE SET
  title_i18n    = EXCLUDED.title_i18n,
  subtitle_i18n = EXCLUDED.subtitle_i18n,
  body_i18n     = EXCLUDED.body_i18n,
  needs_review  = EXCLUDED.needs_review,
  updated_at    = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. contact.intro
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.page_sections
  (key, title_i18n, subtitle_i18n, body_i18n, state, needs_review)
VALUES (
  'contact.intro',
  '{"en":"Secretariat & Inquiries","am":"ሴክሬታሪያትና ጥያቄዎች","om":"Sekireeteriyaatii fi Gaaffii"}',
  '{"en":"Department Office & Secretariat","am":"የዲፓርትመንት ቢሮና ሴክሬታሪያት","om":"Waajjira Kutaa fi Sekireeteriyaatii"}',
  '{"en":"Reach the Tourism Week secretariat for programme inquiries, partnership proposals, and media accreditation.","am":"ለፕሮግራም ጥያቄዎች ፣ የሽርክና ሀሳቦች ፣ እና ሚዲያ አፈቃቀድ ቱሪዝም ሳምንት ሴክሬታሪያትን ያነጋግሩ።","om":"Gaaffii sagantaa, yaada hirmaannaa fi mirkanneessa miidiyaaf sekeretariyaatii Torban Turizimii quunnamaa."}',
  'published', true
)
ON CONFLICT (key) DO UPDATE SET
  title_i18n    = EXCLUDED.title_i18n,
  subtitle_i18n = EXCLUDED.subtitle_i18n,
  body_i18n     = EXCLUDED.body_i18n,
  needs_review  = EXCLUDED.needs_review,
  updated_at    = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. EDITIONS: back-fill new 013 columns on the existing 5th edition
--     and seed the 1st–4th editions as published past editions.
--
-- ⚠ FACTS TO VERIFY:
--   Past edition 1–4 themes and impact summaries are taken from the hard-coded
--   array in src/pages/About.tsx — the department should confirm accuracy.
-- ─────────────────────────────────────────────────────────────────────────────

-- 14a. Populate theme_highlight_i18n on the 5th edition (matches GOLD_WORDS in Home.tsx)
-- Also extend end_date to April 12 (Day 6).
UPDATE public.editions
SET
  theme_highlight_i18n = '{"en":"Peace","am":"ሰላምና","om":"Nageenyaa"}',
  end_date             = '2025-04-12',
  end_date_ec          = '04/08/2017',
  date_range_display_i18n = '{"en":"Megabit 29 – Miyazya 04, 2017 E.C. (April 7 – 12, 2025 G.C.)","am":"መጋቢት 29 – ሚያዝያ 04 ቀን 2017 ዓ.ም (ኤፕሪል 7 – 12፣ 2025 እ.ኤ.አ)","om":"Bitootessa 29 – Ebla 04, 2017 (Ebla 7 – 12, 2025)"}',
  state                = 'published'
WHERE slug = '5th-annual-2017-ec';

-- 14b. Seed past editions 1–4 (taken verbatim from About.tsx pastEditions array)
-- ⚠ VERIFY ALL: year, theme, and impact for editions 1–4

-- Seed past editions 1–4 individually (avoids multi-column VALUES ambiguity).

-- 1st edition — 2013 E.C. / 2021 G.C.
-- ⚠ VERIFY: exact EC dates and event count for edition 1
INSERT INTO public.editions (
  number, slug, edition_name_i18n, title_i18n, theme_i18n, venue_i18n,
  start_date, end_date, start_date_ec, end_date_ec, summary_i18n, state, is_current
) VALUES (
  1, '1st-annual-2013-ec',
  '{"en":"1st Annual Tourism Celebration","am":"1ኛው ዓመታዊ የቱሪዝም ሳምንት","om":"Ayyaana Turizimii Waggaa 1ffaa"}'::jsonb,
  '{"en":"Ambo University Woliso Campus Tourism Week"}'::jsonb,
  '{"en":"Inaugural Woliso Tourism Week: Rediscovering Local Natural Springs & Culture"}'::jsonb,
  '{"en":"Woliso Campus & Woliso Town","am":"ወሊሶ ካምፓስ እና ወሊሶ ከተማ","om":"Kaampasii Walisoo fi Magaalaa Walisoo"}'::jsonb,
  '2021-04-01'::date, '2021-04-05'::date,
  'Miaziya 2013 E.C.', 'Miaziya 2013 E.C.',
  '{"en":"Established the campus-wide cultural exhibition and initiated partnership with South West Shewa artisans."}'::jsonb,
  'published'::public.content_state, false
)
ON CONFLICT (slug) DO UPDATE SET
  theme_i18n   = EXCLUDED.theme_i18n,
  summary_i18n = EXCLUDED.summary_i18n,
  state        = EXCLUDED.state,
  updated_at   = now();

-- 2nd edition — 2014 E.C. / 2022 G.C.
INSERT INTO public.editions (
  number, slug, edition_name_i18n, title_i18n, theme_i18n, venue_i18n,
  start_date, end_date, start_date_ec, end_date_ec, summary_i18n, state, is_current
) VALUES (
  2, '2nd-annual-2014-ec',
  '{"en":"2nd Annual Tourism Celebration","am":"2ኛው ዓመታዊ የቱሪዝም ሳምንት","om":"Ayyaana Turizimii Waggaa 2ffaa"}'::jsonb,
  '{"en":"Ambo University Woliso Campus Tourism Week"}'::jsonb,
  '{"en":"Sustainable Hospitality and Youth Careers in Tourism"}'::jsonb,
  '{"en":"Woliso Campus & Woliso Town","am":"ወሊሶ ካምፓስ እና ወሊሶ ከተማ","om":"Kaampasii Walisoo fi Magaalaa Walisoo"}'::jsonb,
  '2022-04-01'::date, '2022-04-05'::date,
  'Miaziya 2014 E.C.', 'Miaziya 2014 E.C.',
  '{"en":"Launched the student debate competitions and the Great Woliso Campus road race."}'::jsonb,
  'published'::public.content_state, false
)
ON CONFLICT (slug) DO UPDATE SET
  theme_i18n   = EXCLUDED.theme_i18n,
  summary_i18n = EXCLUDED.summary_i18n,
  state        = EXCLUDED.state,
  updated_at   = now();

-- 3rd edition — 2015 E.C. / 2023 G.C.
-- ⚠ VERIFY: "municipal community cleaning campaigns and eco-lodge symposium"
INSERT INTO public.editions (
  number, slug, edition_name_i18n, title_i18n, theme_i18n, venue_i18n,
  start_date, end_date, start_date_ec, end_date_ec, summary_i18n, state, is_current
) VALUES (
  3, '3rd-annual-2015-ec',
  '{"en":"3rd Annual Tourism Celebration","am":"3ኛው ዓመታዊ የቱሪዝም ሳምንት","om":"Ayyaana Turizimii Waggaa 3ffaa"}'::jsonb,
  '{"en":"Ambo University Woliso Campus Tourism Week"}'::jsonb,
  '{"en":"Eco-Tourism as an Economic Driver for Oromia"}'::jsonb,
  '{"en":"Woliso Campus & Woliso Town","am":"ወሊሶ ካምፓስ እና ወሊሶ ከተማ","om":"Kaampasii Walisoo fi Magaalaa Walisoo"}'::jsonb,
  '2023-04-01'::date, '2023-04-05'::date,
  'Miaziya 2015 E.C.', 'Miaziya 2015 E.C.',
  '{"en":"Expanded the festival to include municipal community cleaning campaigns and eco-lodge symposium."}'::jsonb,
  'published'::public.content_state, false
)
ON CONFLICT (slug) DO UPDATE SET
  theme_i18n   = EXCLUDED.theme_i18n,
  summary_i18n = EXCLUDED.summary_i18n,
  state        = EXCLUDED.state,
  updated_at   = now();

-- 4th edition — 2016 E.C. / 2024 G.C.
-- ⚠ VERIFY: "Over 3,500 participants" exact attendance figure
INSERT INTO public.editions (
  number, slug, edition_name_i18n, title_i18n, theme_i18n, venue_i18n,
  start_date, end_date, start_date_ec, end_date_ec, summary_i18n, state, is_current
) VALUES (
  4, '4th-annual-2016-ec',
  '{"en":"4th Annual Tourism Celebration","am":"4ኛው ዓመታዊ የቱሪዝም ሳምንት","om":"Ayyaana Turizimii Waggaa 4ffaa"}'::jsonb,
  '{"en":"Ambo University Woliso Campus Tourism Week"}'::jsonb,
  '{"en":"Cultural Harmony & Indigenous Culinary Heritage"}'::jsonb,
  '{"en":"Woliso Campus & Woliso Town","am":"ወሊሶ ካምፓስ እና ወሊሶ ከተማ","om":"Kaampasii Walisoo fi Magaalaa Walisoo"}'::jsonb,
  '2024-04-01'::date, '2024-04-05'::date,
  'Miaziya 2016 E.C.', 'Miaziya 2016 E.C.',
  '{"en":"Over 3,500 participants joined the street cultural show and Miss & Mr. Tourism pageant."}'::jsonb,
  'published'::public.content_state, false
)
ON CONFLICT (slug) DO UPDATE SET
  theme_i18n   = EXCLUDED.theme_i18n,
  summary_i18n = EXCLUDED.summary_i18n,
  state        = EXCLUDED.state,
  updated_at   = now();

-- =============================================================================
-- END OF SEED 013
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SUMMARY OF FACTS NEEDING DEPARTMENT VERIFICATION
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. "32 km from Woliso"             — Wonchi badge (home.explore card 1)
-- 2. "UN Tourism Best Tourism Villages" award claim — Wonchi description
-- 3. "2,000+" expected participants  — editions.stats (already in DB)
-- 4. "30+"    artisan exhibitors     — editions.stats (already in DB)
-- 5. "Established 1947"             — About page department founding year
-- 6. Past edition 1 theme and impact (About.tsx source)
-- 7. Past edition 2 theme and impact (About.tsx source)
-- 8. Past edition 3 theme and impact (About.tsx source)
-- 9. Past edition 4 "Over 3,500 participants" and theme (About.tsx source)
-- 10. Approximate dates used for editions 1–4 (placeholders — need real EC dates)
-- ─────────────────────────────────────────────────────────────────────────────

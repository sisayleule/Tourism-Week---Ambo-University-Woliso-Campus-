-- =============================================================================
-- seed.sql — Real programme data for the 5th Annual Tourism Week
-- Ambo University Woliso Campus — Department of Tourism and Hotel Management
--
-- HOW TO RUN:
--   supabase db reset          (local)   — applies migrations then this file
--   psql $DATABASE_URL -f supabase/seed.sql   (remote, via service_role)
--
-- SCOPE: seeds only content that was explicitly supplied in the project brief
--   and verified against src/data/seedData.ts.
--
-- WHAT IS SEEDED:
--   ✓ editions          — 1 row (5th Annual, 2017 E.C.)
--   ✓ events            — 14 rows matching the real programme
--   ✓ announcements     — 1 row (the "urgent" notice from seedData.ts)
--   ✓ site_settings     — 1 row (phone intentionally NULL)
--
-- WHAT IS LEFT EMPTY (content not supplied by department; listed for review):
--   • news           — 3 articles in seedData.ts contain department-drafted
--                      text and cover image refs. Flagged at bottom of file.
--   • gallery_items  — 17 photos in seedData.ts reference 2024 archive images.
--                      Flagged at bottom of file.
--   • sponsors       — 8 entries in seedData.ts (names only, no logos, no URLs).
--                      Flagged at bottom of file.
--   • committee_members — 4 entries with placeholder names/photos.
--                      Flagged at bottom of file.
--   • faqs           — 4 entries in seedData.ts. Flagged at bottom of file.
--
-- NOTE ON sponsor_tier:
--   seedData.ts uses 'platinum' but the database enum is 'title' (top tier).
--   Seed inserts use 'title' in place of 'platinum'.
--
-- NOTE ON edition stats:
--   The spec mandates only computable values (5 days, 14 activities).
--   expectedParticipants / exhibitorsCount are left NULL here even though
--   seedData.ts has "2,000+" / "30+" — those are unverified estimates.
--   An admin can fill them in via the dashboard when confirmed.
--
-- NOTE ON (needs native review) strings:
--   Oromo translations carried as-is from seedData.ts. They are marked in a
--   code comment where applicable. Native speakers should review before live.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EDITION
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.editions (
  id,
  number,
  slug,
  edition_name_i18n,
  title_i18n,
  theme_i18n,
  sub_theme_i18n,
  venue_i18n,
  date_range_display_i18n,
  start_date,
  end_date,
  start_date_ec,
  end_date_ec,
  stats,
  is_current
)
VALUES (
  '00000000-0000-0000-0000-000000000005',   -- stable UUID for the 5th edition
  5,
  '5th-annual-2017-ec',
  '{"en": "5th Annual Tourism Celebration",
    "am": "5ኛው ዓመታዊ የቱሪዝም ሳምንት ክብረ በዓል",
    "om": "Ayyaana Turizimii Waggaa 5ffaa"}',
  '{"en": "Ambo University Woliso Campus Tourism Week",
    "am": "የአምቦ ዩኒቨርሲቲ ወሊሶ ካምፓስ የቱሪዝም ሳምንት",
    "om": "Torban Turizimii Yuunivarsiitii Amboo Kaampasii Walisoo"}',
  -- Theme: "Tourism for Peace and Stability"
  '{"en": "Tourism for Peace and Stability",
    "am": "ቱሪዝም ለሰላምና መረጋጋት",
    "om": "Turizimiin Nageenyaa fi Tasgabbiif"}',
  -- Sub-theme (optional display text)
  '{"en": "Promoting Sustainable Heritage, Youth Empowerment, and Community Hospitality",
    "am": "ዘላቂ ቅርስን ማስተዋወቅ፣ የወጣቶችን አቅም መገንባት እና ማህበረሰባዊ መስተንግዶ",
    "om": "Hambaalee Itti Fufiinsa Qaban Beeksisuu fi Kunuunsuu"}',
  '{"en": "Woliso Campus & Woliso Town",
    "am": "ወሊሶ ካምፓስ እና ወሊሶ ከተማ",
    "om": "Kaampasii Walisoo fi Magaalaa Walisoo"}',
  '{"en": "Megabit 29 \u2013 Miyazya 03, 2017 E.C. (April 7\u201311, 2025 G.C.)",
    "am": "መጋቢት 29 \u2013 ሚያዝያ 03 ቀን 2017 ዓ.ም (ኤፕሪል 7\u201311፣ 2025 እ.ኤ.አ)",
    "om": "Bitootessa 29 \u2013 Ebla 03, 2017 A.L.I (Ebla 7\u201311, 2025 G.C.)"}',
  '2025-04-07',   -- Monday, Megabit 29, 2017 E.C.
  '2025-04-11',   -- Friday, Miyazya 03, 2017 E.C. (Day 5)
  '29/07/2017',
  '03/08/2017',
  -- Only confirmed computable stats; estimates left NULL per spec.
  -- expectedParticipants and exhibitorsCount are in seedData.ts as "2,000+" / "30+"
  -- but are unverified. An admin can set them via the dashboard.
  '{"daysCount": 5, "activitiesCount": 14,
    "expectedParticipants": null, "exhibitorsCount": null}',
  true
)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. EVENTS  (14 rows, all state='published', status='scheduled')
--
-- sort_order follows the programme order within each day+session.
-- image_url values are the exact paths from seedData.ts — do not rename files.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.events (
  id, edition_id, slug, day, session, sort_order,
  title_i18n, description_i18n, venue_name_i18n,
  category, venue_type, image_url, featured, status, state
)
VALUES

-- ─── DAY 1 ───────────────────────────────────────────────────────────────────

(
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000005',
  'cleaning-campaign-campus-town',
  1, 'morning', 1,
  '{"en": "Cleaning Campaign within Campus and Woliso Town",
    "am": "የፅዳት ዘመቻ በካምፓስ እና በወሊሶ ከተማ",
    "om": "Duula Qulqullinaa Mooraa fi Magaalaa Walisoo Keessatti"}',
  '{"en": "A joint community mobilization uniting students, academic instructors, campus staff, and Woliso town municipal workers. Fostering environmental hygiene and tourism destination sanitation.",
    "am": "ተማሪዎችን፣ መምህራንን፣ የካምፓስ ሰራተኞችንና የወሊሶ ከተማ ነዋሪዎችን ያቀናጀ የጋራ የፅዳት ዘመቻ። ለአረንጓዴና ፅዱ ቱሪዝም መዳረሻ ጥሪ የሚያስተላልፍ መርሃ ግብር።",
    "om": "Duula qulqullinaa barattoota, barsiisota fi hawaasa magaalaa wal-taasisun qulqullina naannoo eeguu fi qophii ayyaanichaaf godhamu."}',
  '{"en": "Woliso Campus Quad & Woliso Main Boulevard",
    "am": "ወሊሶ ካምፓስ እና የወሊሶ ከተማ ዋና አውራ ጎዳና",
    "om": "Mooraa Kaampasii Walisoo fi Daandii Guddaa Magaalaa"}',
  'community', 'both',
  '/assets/aistudio/image_fe8a90e0.png',
  true, 'scheduled', 'published'
),

-- ─── DAY 2 ───────────────────────────────────────────────────────────────────
-- The brief says "street cultural show, exhibition of cultural materials and
-- handcrafts, traditional and modern music festival, dance contest" — these are
-- four distinct sub-events listed under one Day 2 block in seedData.ts.
-- The spec says 14 events total; to reach that count each sub-event is a
-- separate row (matching the spec's enumeration verbatim).

(
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000005',
  'street-cultural-show',
  2, 'morning', 1,
  '{"en": "Street Cultural Show",
    "am": "የጎዳና ላይ የባህል ትዕይንት",
    "om": "Agarsiisa Aadaa Daandii Irraa"}',
  '{"en": "Vibrant outdoor display of rich Ethiopian traditional attire, indigenous craftsmanship and dynamic performance along Woliso town avenues.",
    "am": "የኢትዮጵያን ብሔር ብሔረሰቦች ውብ የባህል አልባሳትና ጥበቦች የሚያቀርብ ደማቅ የጎዳና ላይ ትዕይንት።",
    "om": "Agarsiisa aadaa boonsaa fi miidhagina uffannaa aadaa fi meeshaalee aadaa hojii harkaa daandii irratti."}',
  '{"en": "Woliso Town Cultural Square",
    "am": "የወሊሶ ከተማ የባህል አደባባይ",
    "om": "Addabaabayi Aadaa Magaalaa Walisoo"}',
  'culture', 'both',
  '/assets/aistudio/image_9108d7cc.png',
  true, 'scheduled', 'published'
),

(
  '10000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000005',
  'exhibition-cultural-materials-handcrafts',
  2, 'morning', 2,
  '{"en": "Exhibition of Cultural Materials and Handcrafts",
    "am": "የባህል ቁሳቁስ እና የእጅ ስራዎች አውደ ርዕይ",
    "om": "Agarsiisa Meeshaalee Aadaa fi Hojii Harkaa"}',
  '{"en": "An open exhibition showcasing indigenous handwoven textiles, pottery, jewellery, and traditional crafts from across Ethiopian communities.",
    "am": "ከተለያዩ የኢትዮጵያ ብሔር ብሔረሰቦች የተሰበሰቡ ባህላዊ ጥበቦች፣ ሸማ፣ ሸክላ እና ጌጣጌጦች አውደ ርዕይ።",
    "om": "Agarsiisa uffata aadaa, meeshaalee hojii harkaa fi mi'aa aadaa saboota adda addaa irraa."}',
  '{"en": "Campus Cultural Hall",
    "am": "የካምፓሱ አዳራሽ",
    "om": "Galma Aadaa Kaampasii"}',
  'culture', 'campus',
  '/assets/aistudio/image_9108d7cc.png',
  false, 'scheduled', 'published'
),

(
  '10000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005',
  'traditional-modern-music-festival',
  2, 'afternoon', 1,
  '{"en": "Traditional and Modern Music Festival",
    "am": "በባህላዊና ዘመናዊ ሙዚቃ ፌስቲቫል",
    "om": "Sirba Aadaa fi Ammayyaa"}',
  '{"en": "Live regional music ensembles performing traditional Oromo, Amhara, and Southern Ethiopian folk music alongside contemporary artists.",
    "am": "ባህላዊ እና ዘመናዊ ሙዚቃ ያቀርቡ ቡድኖች ድምፃቸውን ሲያሰሙ።",
    "om": "Sirbootni aadaa fi ammayyaa Oromoo, Amaaraa fi saboota kaanii dhaga'amuuf dhiyaatan."}',
  '{"en": "Woliso Town Cultural Square & Campus Cultural Hall",
    "am": "የወሊሶ ከተማ የባህል አደባባይ እና የካምፓሱ አዳራሽ",
    "om": "Addabaabayi Aadaa Magaalaa Walisoo fi Galma Kaampasii"}',
  'culture', 'both',
  '/assets/aistudio/image_9108d7cc.png',
  false, 'scheduled', 'published'
),

(
  '10000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000005',
  'dance-contest-traditional-modern',
  2, 'afternoon', 2,
  '{"en": "Dance Contest (Traditional & Modern)",
    "am": "የዳንስ ውድድር (ባህላዊና ዘመናዊ)",
    "om": "Dorgommii Shubbisa Aadaa fi Ammayyaa"}',
  '{"en": "Competitive dance showcase where student troupes compete in traditional folk dance and modern choreography.",
    "am": "ተማሪዎች ባህላዊና ዘመናዊ ዳንስ ቀርበው በሚወዳደሩበት ሕዝባዊ ትዕይንት።",
    "om": "Dorgommii shubbisaa itti barattoonni fi kutaaleen adda addaa aadaa fi ammayyaatiin wal-dorgoman."}',
  '{"en": "Woliso Town Cultural Square & Campus Cultural Hall",
    "am": "የወሊሶ ከተማ የባህል አደባባይ እና የካምፓሱ አዳራሽ",
    "om": "Addabaabayi Aadaa Magaalaa Walisoo fi Galma Kaampasii"}',
  'competition', 'both',
  '/assets/aistudio/image_9108d7cc.png',
  false, 'scheduled', 'published'
),

-- ─── DAY 3 ───────────────────────────────────────────────────────────────────

(
  '10000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000005',
  'great-ambo-university-woliso-campus-running',
  3, 'morning', 1,
  '{"en": "Great Ambo University Woliso Campus Running",
    "am": "አምቦ ዩኒቨርስቲ፣ ወሊሶ ካምፓስ የጎዳና ላይ ታላቅ ሩጫ",
    "om": "Fiigicha Guddaa Yuunivarsiitii Amboo Kaampasii Walisoo"}',
  '{"en": "Mass participation road race promoting athletic vitality, peace, and tourism awareness throughout the picturesque avenues of Woliso town and campus entrance.",
    "am": "ሰላምን፣ ጤናማ የአኗኗር ዘይቤንና የቱሪዝም ግንዛቤን ለማስረጽ በወሊሶ ጎዳናዎች የሚካሄድ ሕዝባዊ የጎዳና ላይ ታላቅ ሩጫ።",
    "om": "Fiigicha daandii guddaa nagaa fi fayyummaa akkasumas hubannoo turizimii guddisuuf qophaa''e."}',
  '{"en": "Woliso Town Roundabout to Campus Gate",
    "am": "ከወሊሶ ከተማ አደባባይ እስከ ዩኒቨርሲቲው ካምፓስ መግቢያ",
    "om": "Ispoortii Daandii Magaalaa Walisoo gara Mooraa Kaampasiitti"}',
  'sports', 'both',
  '/assets/aistudio/image_3856f7f5.png',
  true, 'scheduled', 'published'
),

(
  '10000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000005',
  'miss-and-mr-tourism-woliso-campus',
  3, 'afternoon', 1,
  '{"en": "Miss and Mr. Tourism Ambo University Woliso Campus",
    "am": "ቁንጅና ውድድር በሴት እና በወንድ (Miss and Mr. Tourism)",
    "om": "Dorgommii Bareedinaa Miss fi Mr. Turizimii"}',
  '{"en": "Flagship pageant celebrating intellect, cultural eloquence, sustainable tourism advocacy, and community ambassadorship among male and female university students.",
    "am": "የተማሪዎችን እውቀት፣ የባህል ክህሎት እና የቱሪዝም አምባሳደርነት የሚያጎላ በሴት እና በወንድ መካከል የሚካሄድ ክብር ያለው የቁንጅና ውድድር።",
    "om": "Dorgommii dandeettii, beekumsa aadaa fi ambaasaaddarummaa turizimii barattoota gidduutti taasifamu."}',
  '{"en": "Campus Main Grand Auditorium",
    "am": "የካምፓሱ ዋና ታላቅ አዳራሽ",
    "om": "Galma Guddaa Kaampasii Walisoo"}',
  'competition', 'campus',
  '/assets/aistudio/image_db590259.png',
  true, 'scheduled', 'published'
),

-- ─── DAY 4 ───────────────────────────────────────────────────────────────────
-- Day 4 morning in seedData has 4 sub-events; counting each separately brings
-- the total to 14 (matching the spec's "14 activities" statement).

(
  '10000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000005',
  'seminar-on-tourism-issues',
  4, 'morning', 1,
  '{"en": "Seminar on Tourism Issues",
    "am": "በቱሪዝም ጉዳዮች ላይ ውይይት",
    "om": "Seminaara Dhimmoota Turizimii Irratti"}',
  '{"en": "Scholarly presentations exploring \"Tourism for Peace and Stability\", sustainable hospitality, and heritage preservation in Oromia and South West Shewa.",
    "am": "\"ቱሪዝም ለሰላምና መረጋጋት\" እና ዘላቂ ሆስፒታሊቲ ላይ ያተኮሩ ጥናታዊ ውይይቶች።",
    "om": "Marii qorannoo dhimma turizimii, nageenyaa fi kunuunsaa qabeenya aadaa irratti."}',
  '{"en": "Woliso Campus Conference Hall",
    "am": "የወሊሶ ካምፓስ የኮንፈረንስ አዳራሽ",
    "om": "Galma Walgahii Kaampasii Walisoo"}',
  'academic', 'campus',
  '/assets/aistudio/image_25e4d059.png',
  false, 'scheduled', 'published'
),

(
  '10000000-0000-0000-0000-000000000009',
  '00000000-0000-0000-0000-000000000005',
  'tourism-destination-promotion',
  4, 'morning', 2,
  '{"en": "Tourism Destination Promotion",
    "am": "የቱሪዝም መዳረሻዎች ማስተዋወቅ",
    "om": "Beeksisa Bakkeewwan Hawwata Turizimii"}',
  '{"en": "Presentations and posters showcasing Wonchi Crater Lake, Woliso Hot Springs, and other South West Shewa eco-tourism destinations to guests and academics.",
    "am": "ወንቺ ሐይቅ፣ የወሊሶ ፍልውሃ እና ሌሎች የደቡብ ምዕራብ ሸዋ የቱሪዝም መዳረሻዎችን ማስተዋወቅ።",
    "om": "Agarsiisa bakkeewwan hawwata turizimii Wonchi, burqaa ho''aa Walisoo fi kan biroo."}',
  '{"en": "Woliso Campus Conference Hall",
    "am": "የወሊሶ ካምፓስ የኮንፈረንስ አዳራሽ",
    "om": "Galma Walgahii Kaampasii Walisoo"}',
  'academic', 'campus',
  '/assets/aistudio/image_25e4d059.png',
  true, 'scheduled', 'published'
),

(
  '10000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000005',
  'interdepartmental-quiz-poetry-essay',
  4, 'morning', 3,
  '{"en": "Interdepartmental Q&A, Poetry and Essay Competition",
    "am": "የጥያቄ እና መልስ ውድድር በትምህርት ክፍሎች መካከል፣ የግጥም እና ስነ ጽሁፍ ውድድር",
    "om": "Dorgommii Gaaffii fi Deebii, Walaloo fi Barreeffamaa"}',
  '{"en": "Student literary and quiz competitions between university departments, celebrating academic achievement and cultural expression.",
    "am": "በዩኒቨርሲቲው ትምህርት ክፍሎች መካከል የሚካሄዱ የጥያቄ-መልስ፣ ግጥምና ስነ-ጽሑፍ ውድድሮች።",
    "om": "Dorgommii gaaffii fi deebii, walaloo fi barreeffamaa kutaalee barnootaa gidduutti taasifamu."}',
  '{"en": "Woliso Campus Conference Hall",
    "am": "የወሊሶ ካምፓስ የኮንፈረንስ አዳራሽ",
    "om": "Galma Walgahii Kaampasii Walisoo"}',
  'competition', 'campus',
  '/assets/aistudio/image_25e4d059.png',
  false, 'scheduled', 'published'
),

(
  '10000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000005',
  'certificate-award-programme-organizers-sponsors',
  4, 'morning', 4,
  '{"en": "Certificate and Award Programme for Organizers and Sponsors",
    "am": "ለአዘጋጆች እና ስፖንሰሮች የምስክር ወረቀት እና እውቅና ፕሮግራም",
    "om": "Sagantaa Waraqaa Ragaa fi Badhaasa Qopheessitootaa fi Isponsarootaaf"}',
  '{"en": "Recognition ceremony awarding certificates of appreciation to sponsors, partner organisations, and volunteer organisers for their contribution to the 5th Annual Tourism Week.",
    "am": "ለ5ኛው ዓመታዊ የቱሪዝም ሳምንት ላበረከቱ አዘጋጆች እና ስፖንሰሮች የምስክር ወረቀትና እውቅና የሚሰጥ ስነ-ስርዓት።",
    "om": "Sagantaa badhaasa waraqaa ragaa isponsaroota, dhaabbilee fi qopheessitootaaf kenname."}',
  '{"en": "Woliso Campus Conference Hall",
    "am": "የወሊሶ ካምፓስ የኮንፈረንስ አዳራሽ",
    "om": "Galma Walgahii Kaampasii Walisoo"}',
  'community', 'campus',
  '/assets/aistudio/image_25e4d059.png',
  false, 'scheduled', 'published'
),

(
  '10000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000005',
  'football-academic-vs-administrative-staff',
  4, 'afternoon', 1,
  '{"en": "Staff Friendly Match: Academic vs. Administrative Staff",
    "am": "የሰራተኞች የወዳጅነት እግር ኳስ ግጥሚያ፡ አካዳሚክ ከ አስተዳደር ሰራተኞች ጋር",
    "om": "Tapha Kubbaa Miilaa: Barsiisotaa fi Hojjettoota Bulchiinsaa Gidduutti"}',
  '{"en": "Entertaining sports derby building camaraderie, teamwork, and institutional wellness between teaching faculty and administrative personnel.",
    "am": "በመምህራን እና በአስተዳደር ሰራተኞች መካከል የጋራ አንድነትን፣ ጤናን እና ደስታን የሚያጠናክር አጓጊ የእግር ኳስ የወዳጅነት ጨዋታ።",
    "om": "Tapha kubbaa miilaa jaalalaa fi tokkummaa hojjettoota kaampasii gidduutti taasifamu."}',
  '{"en": "Woliso Campus Sports Stadium",
    "am": "የወሊሶ ካምፓስ ስፖርት ሜዳ",
    "om": "Dirree Ispoortii Kaampasii Walisoo"}',
  'sports', 'campus',
  '/assets/aistudio/image_6eb824fd.png',
  false, 'scheduled', 'published'
),

-- ─── DAY 5 ───────────────────────────────────────────────────────────────────

(
  '10000000-0000-0000-0000-000000000013',
  '00000000-0000-0000-0000-000000000005',
  'guest-tour-woliso-destinations',
  5, 'morning', 1,
  '{"en": "Guest Tour to Regional Eco-Tourism & Heritage Sites",
    "am": "የእንግዶች ጉብኝት ወደ ተፈጥሮ እና ባህላዊ መስህቦች",
    "om": "Daawwannaa Keessummootaa Bakkeewwan Hawwata Turizimiitti"}',
  '{"en": "Guided field exploration for invited delegates, academics, and guests visiting regional natural springs, eco-lodges, and cultural landscape attractions surrounding Woliso.",
    "am": "ለክብር እንግዶች፣ ለተመራማሪዎችና ለተሳታፊዎች የተዘጋጀ የወሊሶ እና አካባቢዋን የተፈጥሮ ፍልውሃዎች፣ የመዝናኛ ስፍራዎች እና ቅርሶች የመስክ ጉብኝት።",
    "om": "Daawwannaa iddoowwan qabeenya uumamaa fi hawwata turizimii naannoo Walisootti argaman daawwachuuf qophaa''e."}',
  '{"en": "Woliso Eco-Tourism Hot Springs & Landscape Sites",
    "am": "የወሊሶ የተፈጥሮ ፍልውሃ እና የቱሪዝም መስህቦች",
    "om": "Bakkeewwan Hawwata Uumamaa fi Burqaa Walisoo"}',
  'culture', 'town',
  '/assets/aistudio/image_7544bf77.png',
  true, 'scheduled', 'published'
),

(
  '10000000-0000-0000-0000-000000000014',
  '00000000-0000-0000-0000-000000000005',
  'end-of-the-programme-closing',
  5, 'afternoon', 1,
  '{"en": "Closing Ceremony & Conclusion of the Tourism Week Programme",
    "am": "የፕሮግራሙ ማጠቃለያ እና የክብር መዝጊያ ስነ ስርዓት",
    "om": "Xumura Sagantichaa fi Eebba Cufiinsaa"}',
  '{"en": "Official closing remarks from university leadership, announcement of competition winners, cultural banquet, and final festival thanksgiving.",
    "am": "የዩኒቨርሲቲው የበላይ አመራሮች የማጠቃለያ ንግግር፣ የአሸናፊዎች ማስታወቂያና ሽልማት እንዲሁም ይፋዊ የሳምንቱ ማጠቃለያ።",
    "om": "Sagantaa cufiinsa boonsaa kan hoggantoota yuunivarsiitiin geggeeffamu fi badhaasa xumuraa."}',
  '{"en": "Woliso Campus Grand Auditorium",
    "am": "የወሊሶ ካምፓስ ታላቅ አዳራሽ",
    "om": "Galma Guddaa Kaampasii Walisoo"}',
  'community', 'campus',
  '/assets/aistudio/image_c9b19ed8.png',
  true, 'scheduled', 'published'
)

ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ANNOUNCEMENT  (the urgent notice from seedData.ts)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.announcements (id, message_i18n, type, link, starts_at, expires_at, state)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  '{"en": "Official Notice: The 5th Annual Tourism Celebration begins Monday, Megabit 29, 2017 E.C. All sessions are free and open to the public.",
    "am": "ይፋዊ ማስታወቂያ፡ 5ኛው ዓመታዊ የቱሪዝም ሳምንት ሰኞ መጋቢት 29 ቀን 2017 ዓ.ም ይጀምራል። ሁሉም መርሃ ግብሮች ለሕዝብ ክፍት ናቸው።",
    "om": "Beeksisa: Ayyaanni Turizimii Waggaa 5ffaa Wiixata, Bitootessa 29, 2017 A.L.I ni eegala. Sagantaan hunduu hawaasaaf banaadha."}',
  'urgent',
  '/schedule',
  '2025-04-07 00:00:00+03',   -- Goes live at start of Day 1 (EAT = UTC+3)
  '2025-04-11 23:59:59+03',   -- Expires at end of Day 5
  'published'
)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SITE_SETTINGS  (one row; phone deliberately NULL)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.site_settings (
  id, contact_email, phone, address_i18n, social, footer_text_i18n
)
VALUES (
  true,
  NULL,     -- Replace with the department's real email via the admin dashboard
  NULL,     -- Phone intentionally NULL — update when a verified number is available
  '{"en": "Ambo University, Woliso Campus, South West Shewa, Oromia, Ethiopia",
    "am": "አምቦ ዩኒቨርሲቲ ወሊሶ ካምፓስ፣ ደቡብ ምዕራብ ሸዋ፣ ኦሮሚያ፣ ኢትዮጵያ",
    "om": "Yuunivarsiitii Amboo Kaampasii Walisoo, Shawaa Kibba Lixaa, Oromiyaa, Itoophiyaa"}',
  '{}',     -- Populate social links (Telegram, Facebook, etc.) via the dashboard
  '{"en": "Ambo University, Woliso Campus. Department of Tourism and Hotel Management. All rights reserved.",
    "am": "አምቦ ዩኒቨርሲቲ ወሊሶ ካምፓስ። የቱሪዝም እና ሆቴል ማኔጅመንት ትምህርት ክፍል። መብቱ በህግ የተጠበቀ ነው።",
    "om": "Yuunivarsiitii Amboo Kaampasii Walisoo. Kutaa Barnootaa Hoggansa Turizimii fi Hoteelaa. Mirgi hundi seeraan eegamaadha."}'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- =============================================================================
-- ITEMS IN seedData.ts NOT SEEDED — AWAITING DEPARTMENT VERIFICATION
-- =============================================================================
--
-- The following tables were left EMPTY because the spec says:
-- "Leave ... EMPTY unless seedData.ts contains content that the department
--  supplied; list for me anything in seedData.ts that was not supplied by me
--  so I can verify it."
--
-- ── NEWS (3 articles) ─────────────────────────────────────────────────────────
-- news-1  slug: preparations-finalized-for-5th-annual-tourism-week
--         Cover image: /news-prep.jpg  (file exists in repo at public/news-prep.jpg)
--         Content: department-drafted text about final preparations
--
-- news-2  slug: great-run-route-announced
--         Cover image: /images/news-run.jpg  (FILE DOES NOT EXIST in repo)
--         Content: route and registration details for the Great Run
--
-- news-3  slug: academic-symposium-call-for-posters
--         Cover image: /images/news-symposium.jpg  (FILE DOES NOT EXIST in repo)
--         Content: call for papers for Day 4 academic seminar
--
-- ACTION NEEDED: Confirm these articles are accurate and supply missing images.
-- Missing image paths: /images/news-run.jpg, /images/news-symposium.jpg
--
-- ── GALLERY (17 items) ────────────────────────────────────────────────────────
-- All 17 gallery items reference year=2024 photos from a previous edition
-- stored at /assets/aistudio/image_*.png (these files DO exist in the repo).
-- They contain rich multilingual captions and categories.
-- The spec says to seed only what the department supplied — these are from the
-- AI-generated seedData.ts, not explicitly supplied in the brief.
-- ACTION NEEDED: Confirm these are real photos from a previous edition and
-- that the captions are accurate before seeding into the live database.
--
-- ── SPONSORS (8 entries) ─────────────────────────────────────────────────────
-- sp-1  Ethiopian Tourism Board           tier: title (was 'platinum')
-- sp-2  Oromia Tourism Commission         tier: title (was 'platinum')
-- sp-3  Woliso Eco-Lodge & Hot Springs    tier: gold
-- sp-4  Negash Resort & Botanical Garden  tier: gold
-- sp-5  Woliso Town Municipality          tier: silver
-- sp-6  Commercial Bank of Ethiopia       tier: silver
-- sp-7  SW Shewa Cultural Artisans Assoc. tier: partner
-- sp-8  Ambo University Alumni Network    tier: partner
-- No logos, no website URLs. logoPlaceholder values are bracketed placeholders.
-- ACTION NEEDED: Confirm these sponsors are real/current, supply logos and URLs.
--
-- ── COMMITTEE MEMBERS (4 entries) ────────────────────────────────────────────
-- All 4 entries have placeholder names ("[NAME: Department Head]" etc.)
-- and no real photos. The roles are real job titles.
-- ACTION NEEDED: Supply real names and headshot photos before seeding.
--
-- ── FAQS (4 entries) ─────────────────────────────────────────────────────────
-- faq-1 through faq-4 contain well-written answers in all three languages.
-- They appear accurate but were generated rather than supplied by the department.
-- ACTION NEEDED: Have the department review and confirm before seeding.
-- To seed them now, uncomment the block at the bottom of this file or
-- run: INSERT INTO public.faqs (...) VALUES (...) directly after confirmation.
--
-- ── STATS ────────────────────────────────────────────────────────────────────
-- seedData.ts has expectedParticipants="2,000+" and exhibitorsCount="30+".
-- The spec mandates only computable values — these estimates were left NULL.
-- ACTION NEEDED: Confirm the figures and update via:
--   UPDATE public.editions
--   SET stats = stats || '{"expectedParticipants": "2,000+", "exhibitorsCount": "30+"}'
--   WHERE number = 5;
-- =============================================================================

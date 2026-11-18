/**
 * sectionRegistry.ts — Typed registry of every editable public-site section.
 *
 * Rules:
 *  - NO supabase import. This module is shared between the public site and
 *    the portal; it must never pull in the Supabase client.
 *  - Each entry defines the section's machine key, human label, page, public
 *    URL + anchor, which fields it uses, max lengths, card configuration,
 *    allowed icons, and the built-in DEFAULT copy (identical to the
 *    hard-coded text in the codebase).  The default copy is the fall-back
 *    when no published DB row exists for the key.
 *  - Organizers can only edit registered sections — they cannot add new layouts.
 *  - The `fields` array drives which form controls appear in SectionEditorPage.
 */

export type SectionField =
  | 'title'
  | 'subtitle'
  | 'body'
  | 'image'
  | 'cta_label'
  | 'cta_url'

export type AllowedIcon =
  | 'Mountain'
  | 'Coffee'
  | 'Heart'
  | 'TreePine'
  | 'BookOpen'
  | 'Sparkles'
  | 'Award'
  | 'Users'
  | 'Globe'
  | 'Compass'
  | 'Flame'
  | 'Leaf'
  | 'Star'
  | 'Music'
  | 'Camera'
  | 'Landmark'

export interface I18nDefault {
  en: string
  am?: string
  om?: string
}

export interface CardDefault {
  title: I18nDefault
  body?: I18nDefault
  icon?: AllowedIcon
  badge?: I18nDefault
  /** Internal path or https:// */
  link?: string
}

export interface SectionRegistryEntry {
  /** Machine key — unique, matches page_sections.key in DB. */
  key: string
  /** Human-readable label shown in the portal. */
  label: string
  /** Page slug, e.g. 'home', 'about', 'sponsors', 'contact'. */
  page: 'home' | 'about' | 'sponsors' | 'contact'
  /** Full public URL with optional anchor. */
  publicUrl: string
  /** Which fields this section exposes in the editor. */
  fields: SectionField[]
  /** Max character lengths for text fields. */
  maxLengths?: {
    title?: number
    subtitle?: number
    body?: number
    cta_label?: number
    cta_url?: number
  }
  /** Whether this section has a card/item list. */
  hasCards: boolean
  /** Maximum number of cards allowed (0 = unlimited). */
  maxCards: number
  /** Allowed Lucide icon names for card items. */
  allowedIcons: AllowedIcon[]
  /**
   * Whether a missing or draft DB row hides the section or falls back to
   * the built-in default copy.  hero and cta always fall back.
   */
  fallbackBehaviour: 'hide' | 'default'
  /** Built-in default copy — IDENTICAL to current hard-coded text. */
  defaultContent: {
    title?: I18nDefault
    subtitle?: I18nDefault
    body?: I18nDefault
    cta_label?: I18nDefault
    cta_url?: string
    cards?: CardDefault[]
  }
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const SECTION_REGISTRY: SectionRegistryEntry[] = [
  // ── home.hero ───────────────────────────────────────────────────────────────
  {
    key:    'home.hero',
    label:  'Hero — Wonders chips',
    page:   'home',
    publicUrl: '/#hero',
    fields: ['title', 'subtitle'],
    maxLengths: { title: 80, subtitle: 200 },
    hasCards: true,
    maxCards: 8,
    allowedIcons: [],
    fallbackBehaviour: 'default',
    defaultContent: {
      title: { en: 'Featured Wonders', am: 'ተፈላጊ አካባቢዎች', om: 'Bakkeewwan Mul\'ataa' },
      // Individual chips are cards; default set matches the hard-coded array.
      cards: [
        { title: { en: 'Lalibela',    am: 'ላሊበላ',    om: 'Laalibelaa' } },
        { title: { en: 'Aksum',       am: 'አክሱም',     om: 'Aksuum' } },
        { title: { en: 'Simien Mts.', am: 'ስምን ተራሮች', om: 'Simiyen Mts.' } },
        { title: { en: 'Wonchi Lake', am: 'ወንጪ ሐይቅ',  om: 'Haroo Wonchii' } },
      ],
    },
  },

  // ── home.highlights ─────────────────────────────────────────────────────────
  {
    key:    'home.highlights',
    label:  'Top Festival Highlights — heading',
    page:   'home',
    publicUrl: '/#below-hero',
    fields: ['title', 'subtitle'],
    maxLengths: { title: 80, subtitle: 200 },
    hasCards: false,
    maxCards: 0,
    allowedIcons: [],
    fallbackBehaviour: 'default',
    defaultContent: {
      title:    { en: 'Top Festival Highlights' },
      subtitle: { en: 'Cultural pageantry, athletic determination, and living heritage — five days of celebration.' },
    },
  },

  // ── home.itinerary ──────────────────────────────────────────────────────────
  {
    key:    'home.itinerary',
    label:  'Daily Itinerary — heading',
    page:   'home',
    publicUrl: '/#schedule-preview',
    fields: ['title', 'subtitle'],
    maxLengths: { title: 80, subtitle: 200 },
    hasCards: false,
    maxCards: 0,
    allowedIcons: [],
    fallbackBehaviour: 'default',
    defaultContent: {
      title:    { en: 'Select a Day to Preview Sessions' },
      subtitle: { en: 'Daily Itinerary' },
    },
  },

  // ── home.explore ────────────────────────────────────────────────────────────
  {
    key:    'home.explore',
    label:  'Explore Woliso — section & cards',
    page:   'home',
    publicUrl: '/#explore-woliso',
    fields: ['title', 'subtitle'],
    maxLengths: { title: 100, subtitle: 300 },
    hasCards: true,
    maxCards: 4,
    allowedIcons: ['Mountain', 'Coffee', 'Leaf', 'Compass', 'Landmark', 'Globe'],
    fallbackBehaviour: 'default',
    defaultContent: {
      title:    { en: 'Explore Woliso & the South West Shewa Eco-Corridor' },
      subtitle: {
        en: 'Woliso is a gateway to volcanic caldera lakes, geothermal hot springs, and ancient forests — a living classroom for our Tourism students.',
        am: 'ወሊሶ ወደ እሳተጎሞራ ሐይቆች፣ ሞቃት ምንጮች እና ጥንታዊ ደኖች መንገድ ነው።',
        om: 'Walisoo karaa galaana caldera, bubbee bishaanii fi bosonaa gara duraawaatti banamtuu dha.',
      },
      cards: [
        {
          title: {
            en: 'Wonchi (Wenchi) Crater Lake',
            am: 'ወንጪ (ወንጪ) ቅርጽ ሐይቅ',
            om: 'Haroo Caldera Wonchii',
          },
          body: {
            en: "Awarded by UN Tourism as one of the \"Best Tourism Villages,\" Wonchi features an emerald volcanic caldera lake, island monasteries, horseback trails, and mineral waterfalls.",
            am: 'በተባበሩት መንግሥታት ቱሪዝም "ምርጥ የቱሪስት መንደሮች" ከሚባሉት አንዱ።',
            om: 'UN Tourism "Ganda Turizimii Gaarii" jedhamtee badhaafamte.',
          },
          icon: 'Mountain',
          badge: { en: '32 km from Woliso', am: 'ወሊሶ ከ32 ኪ.ሜ ርቀት', om: 'KM 32 Walisoo irraa' },
        },
        {
          title: {
            en: 'Woliso Hot Springs & Traditional Hospitality',
            am: 'የወሊሶ ሙቀቱ ምንጭ እና ባህላዊ አስተናጋጅነት',
            om: 'Bubbee Bishaanii Walisoo fi Keessummaa Aadaa',
          },
          body: {
            en: 'Renowned for natural geothermal thermal baths, lush gardens, and indigenous Oromo coffee ceremonies. Department students conduct real-time hospitality studies here.',
            am: 'ለተፈጥሯዊ ሙቅ ምንጮች፣ ቆንጆ ቦታዎች፣ እና ሐበሻ ቡና ስርዓቶች የሚታወቅ።',
            om: 'Bubbee bishaanii uumamaa, lafa midhaanii fi sirna buna Oromoo.',
          },
          icon: 'Coffee',
          badge: { en: 'In Woliso Town', am: 'በወሊሶ ከተማ', om: 'Magaalaa Walisoo keessa' },
        },
      ],
    },
  },

  // ── home.philosophy ─────────────────────────────────────────────────────────
  {
    key:    'home.philosophy',
    label:  'Guiding Philosophy — section & virtue cards',
    page:   'home',
    publicUrl: '/#guiding-philosophy',
    fields: ['title', 'subtitle', 'body'],
    maxLengths: { title: 100, subtitle: 200, body: 300 },
    hasCards: true,
    maxCards: 6,
    allowedIcons: ['Heart', 'TreePine', 'BookOpen', 'Sparkles', 'Award', 'Users', 'Globe', 'Flame', 'Leaf', 'Star', 'Music'],
    fallbackBehaviour: 'default',
    defaultContent: {
      title:    { en: 'The Guiding Philosophy' },
      body:     {
        en: 'Why "Tourism for Peace and Stability"?',
        am: 'ለምን "ቱሪዝም ለሰላምና መረጋጋት"?',
        om: 'Maaliif "Turizimiin Nageenyaa fi Tasgabbiif"?',
      },
      subtitle: {
        en: 'Tourism is more than economic commerce; it is a catalyst for peaceful coexistence, intercultural exchange, and reciprocal respect among diverse peoples. Woliso Campus champions this vital connection.',
        am: 'ቱሪዝም ከንግድ እንቅስቃሴ ባለፈ የባህል ልውውጥን፣ የጋራ መግባባትንና ሰላማዊ አብሮነትን ለመገንባት ቁልፍ ድልድይ ነው። ወሊሶ ካምፓስ ይህንን ጽንሰ-ሃሳብ በተግባር ያጎላል።',
        om: 'Turizimiin nagaa fi wal-hubannoo sabootaa cimsuuf bu\'uura guddaadha.',
      },
      cards: [
        {
          title: { en: 'Peace & Unity',    am: 'ሰላምና አንድነት',   om: 'Nageenyaa fi Tokkummaa' },
          body:  { en: 'Intercultural dialogue through folk dance, poetry, and shared sport.',   am: 'ቅርጽ ዳንስ፣ ግጥም እና ስፖርት በኩል ባህላዊ ውይይት።',  om: 'Qaayyoo aadaa, barruulee fi ispoortiitiin haasaa giddugaleessa.' },
          icon:  'Heart',
        },
        {
          title: { en: 'Eco-Conservation', am: 'ሥነ-ምህዳር ጥበቃ', om: 'Eegumsa Naannoo' },
          body:  { en: 'Wonchi Crater Lake and Woliso hot springs natural preservation.',        am: 'ወንጪ ሐይቅ እና የወሊሶ ሙቅ ምንጮች ተፈጥሮ ጥበቃ።',          om: 'Haroo Caldera Wonchii fi bubbee bishaanii Walisoo eeguu.' },
          icon:  'TreePine',
        },
        {
          title: { en: 'Academic Rigor',   am: 'አካዳሚክ ጥብቅነት', om: 'Cimina Barnootaa' },
          body:  { en: 'Degrees in Tourism Management and Hotel Operations.',                    am: 'ቱሪዝም ማኔጅመንት እና ሆቴል ሥራ ዲግሪ ፕሮግራሞች።',           om: 'Digiriin Hoggansa Turizimii fi Hoteela.' },
          icon:  'BookOpen',
        },
        {
          title: { en: 'Cultural Pride',   am: 'ባህላዊ ኩርያ',     om: 'Dheebuu Aadaa' },
          body:  { en: 'Traditional Habesha attire, pottery, and culinary arts.',                am: 'ባህላዊ አቀማጣሎ፣ ሸክላ ሥርሥር እና ምግብ ጥበብ።',              om: 'Uffata aadaa, abaaboo uduu fi sanaa nyaataa.' },
          icon:  'Sparkles',
        },
      ],
    },
  },

  // ── home.gallery ─────────────────────────────────────────────────────────────
  {
    key:    'home.gallery',
    label:  'Gallery strip — heading',
    page:   'home',
    publicUrl: '/#gallery',
    fields: ['title', 'subtitle'],
    maxLengths: { title: 80, subtitle: 200 },
    hasCards: false,
    maxCards: 0,
    allowedIcons: [],
    fallbackBehaviour: 'default',
    defaultContent: {
      title:    { en: 'Celebration Media Gallery' },
      subtitle: { en: 'Authentic event photography capturing student pageantry, athletic runs, and cultural pride.' },
    },
  },

  // ── home.news ───────────────────────────────────────────────────────────────
  {
    key:    'home.news',
    label:  'News strip — heading',
    page:   'home',
    publicUrl: '/#news',
    fields: ['title', 'subtitle'],
    maxLengths: { title: 80, subtitle: 200 },
    hasCards: false,
    maxCards: 0,
    allowedIcons: [],
    fallbackBehaviour: 'default',
    defaultContent: {
      title:    { en: 'Latest News & Notices' },
      subtitle: { en: 'Campus Bulletins' },
    },
  },

  // ── home.cta ────────────────────────────────────────────────────────────────
  {
    key:    'home.cta',
    label:  'Call-to-Action band',
    page:   'home',
    publicUrl: '/#cta',
    fields: ['title', 'subtitle', 'body', 'cta_label', 'cta_url'],
    maxLengths: { title: 100, subtitle: 150, body: 400, cta_label: 50, cta_url: 200 },
    hasCards: false,
    maxCards: 0,
    allowedIcons: [],
    fallbackBehaviour: 'default',
    defaultContent: {
      // CTA copy lives in i18n keys (cta.*) — the DB overrides them when present.
      // Defaults match the en translation strings.
      title:     { en: 'Be Part of the Celebration' },
      subtitle:  { en: 'Tourism for Peace and Stability' },
      body:      { en: 'Five days of cultural exchange, athletic competitions, academic seminars, and community celebrations at Ambo University Woliso Campus.' },
      cta_label: { en: 'View Full Schedule' },
      cta_url:   '/schedule',
    },
  },

  // ── about.intro ──────────────────────────────────────────────────────────────
  {
    key:    'about.intro',
    label:  'About — Department intro',
    page:   'about',
    publicUrl: '/about#intro',
    fields: ['title', 'subtitle', 'body'],
    maxLengths: { title: 100, subtitle: 200, body: 1200 },
    hasCards: true,
    maxCards: 6,
    allowedIcons: ['BookOpen', 'Heart', 'Award', 'Users', 'Globe', 'Sparkles'],
    fallbackBehaviour: 'default',
    defaultContent: {
      title:    { en: 'Pioneering Tourism & Hotel Leadership in Ethiopia' },
      subtitle: { en: 'The Department of Tourism and Hotel Management at Ambo University Woliso Campus is one of the nation\'s foremost academic bodies dedicated to hospitality development, eco-tourism stewardship, and heritage preservation.' },
      body:     { en: 'Our annual Tourism Week is the department\'s signature experiential learning initiative. Rather than confining hospitality studies to textbooks, our students actively manage public logistics, curate cultural exhibitions, liaise with municipal leaders, and lead field research tours.' },
      cards: [
        { title: { en: 'Rigorous Curriculum' },  body: { en: 'BSc degree programs in Tourism Management and Hotel Operations.' },              icon: 'BookOpen' },
        { title: { en: 'Community Outreach' },   body: { en: 'Direct sanitation and hygiene campaigns supporting Woliso municipality.' },        icon: 'Heart' },
        { title: { en: 'Cultural Heritage' },    body: { en: 'Documenting indigenous crafts, textiles, and traditional culinary arts.' },        icon: 'Award' },
        { title: { en: 'Public Inclusivity' },   body: { en: '100% free public access to all celebrations, sports, and seminars.' },            icon: 'Users' },
      ],
    },
  },

  // ── about.heritage ──────────────────────────────────────────────────────────
  {
    key:    'about.heritage',
    label:  'Heritage & Precedents — section heading',
    page:   'about',
    publicUrl: '/about#heritage',
    fields: ['title', 'subtitle'],
    maxLengths: { title: 100, subtitle: 300 },
    hasCards: false,
    maxCards: 0,
    allowedIcons: [],
    fallbackBehaviour: 'default',
    defaultContent: {
      title:    { en: 'Past Editions Timeline' },
      subtitle: { en: 'Heritage & Precedents' },
    },
  },

  // ── about.timeline (past editions) ──────────────────────────────────────────
  // This section drives the timeline; cards come from published editions
  // with a past status, not from page_section_items.
  // The entry here is for the section heading only.
  {
    key:    'about.timeline',
    label:  'Past Editions Timeline — section metadata',
    page:   'about',
    publicUrl: '/about#past-editions',
    fields: ['title', 'subtitle'],
    maxLengths: { title: 80, subtitle: 200 },
    hasCards: false,
    maxCards: 0,
    allowedIcons: [],
    fallbackBehaviour: 'hide',
    defaultContent: {
      title:    { en: 'Past Editions' },
      subtitle: { en: 'The story of Tourism Week through the years.' },
    },
  },

  // ── sponsors.intro ───────────────────────────────────────────────────────────
  {
    key:    'sponsors.intro',
    label:  'Sponsors — page intro',
    page:   'sponsors',
    publicUrl: '/sponsors#intro',
    fields: ['title', 'subtitle', 'body'],
    maxLengths: { title: 80, subtitle: 200, body: 600 },
    hasCards: false,
    maxCards: 0,
    allowedIcons: [],
    fallbackBehaviour: 'default',
    defaultContent: {
      title:    { en: 'Institutional Alliances' },
      subtitle: { en: 'Become a Sponsor' },
      body:     { en: 'Support the 5th Annual Tourism Celebration and connect your brand with Ethiopia\'s future tourism leaders.' },
    },
  },

  // ── contact.intro ────────────────────────────────────────────────────────────
  {
    key:    'contact.intro',
    label:  'Contact — page intro',
    page:   'contact',
    publicUrl: '/contact#intro',
    fields: ['title', 'subtitle', 'body'],
    maxLengths: { title: 80, subtitle: 200, body: 600 },
    hasCards: false,
    maxCards: 0,
    allowedIcons: [],
    fallbackBehaviour: 'default',
    defaultContent: {
      title:    { en: 'Secretariat & Inquiries' },
      subtitle: { en: 'Department Office & Secretariat' },
      body:     { en: 'Reach the Tourism Week secretariat for programme inquiries, partnership proposals, and media accreditation.' },
    },
  },
]

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Look up a registry entry by its key. Returns undefined if not found. */
export function getSectionEntry(key: string): SectionRegistryEntry | undefined {
  return SECTION_REGISTRY.find((e) => e.key === key)
}

/** All entries for a given page, in display order. */
export function getSectionsByPage(page: SectionRegistryEntry['page']): SectionRegistryEntry[] {
  return SECTION_REGISTRY.filter((e) => e.page === page)
}

/** All page labels (deduplicated). */
export const ALL_PAGES = Array.from(
  new Set(SECTION_REGISTRY.map((e) => e.page))
) as SectionRegistryEntry['page'][]

export const PAGE_LABELS: Record<SectionRegistryEntry['page'], string> = {
  home:     'Home',
  about:    'About',
  sponsors: 'Sponsors',
  contact:  'Contact',
}

/**
 * Resolve an i18n value from a section's DB row or its built-in default.
 * Falls back through: DB value → English DB value → default text.
 */
export function resolveI18n(
  dbValue: { en?: string; am?: string; om?: string } | null | undefined,
  defaultValue: I18nDefault | undefined,
  lang: 'en' | 'am' | 'om'
): string {
  const v = dbValue?.[lang] ?? dbValue?.en ?? defaultValue?.[lang] ?? defaultValue?.en ?? ''
  return v
}

import {
  Announcement,
  CommitteeMember,
  Edition,
  EventItem,
  FAQ,
  GalleryItem,
  NewsItem,
  Sponsor,
} from '../types';

export const CURRENT_EDITION: Edition = {
  id: '5th-annual-2017',
  number: 5,
  editionNameI18n: {
    en: '5th Annual Tourism Celebration',
    am: '5ኛው ዓመታዊ የቱሪዝም ሳምንት ክብረ በዓል',
    om: 'Ayyaana Turizimii Waggaa 5ffaa (needs native review)',
  },
  titleI18n: {
    en: 'Ambo University Woliso Campus Tourism Week',
    am: 'የአምቦ ዩኒቨርሲቲ ወሊሶ ካምፓስ የቱሪዝም ሳምንት',
    om: 'Torban Turizimii Yuunivarsiitii Amboo Kaampasii Walisoo',
  },
  themeI18n: {
    en: 'Tourism for Peace and Stability',
    am: 'ቱሪዝም ለሰላምና መረጋጋት',
    om: 'Turizimiin Nageenyaa fi Tasgabbiif (needs native review)',
  },
  subThemeI18n: {
    en: 'Promoting Sustainable Heritage, Youth Empowerment, and Community Hospitality',
    am: 'ዘላቂ ቅርስን ማስተዋወቅ፣ የወጣቶችን አቅም መገንባት እና ማህበረሰባዊ መስተንግዶ',
    om: 'Hambaalee Itti Fufiinsa Qaban Beeksisuu fi Kunuunsuu (needs native review)',
  },
  startDateEC: '29/07/2017',
  endDateEC: '03/08/2017',
  dateRangeDisplayI18n: {
    en: 'Megabit 29 – Miyazya 03, 2017 E.C. (April 7 – 11, 2025 G.C.)',
    am: 'መጋቢት 29 – ሚያዝያ 03 ቀን 2017 ዓ.ም (ኤፕሪል 7 – 11፣ 2025 እ.ኤ.አ)',
    om: 'Bitootessa 29 – Ebla 03, 2017 A.L.I (Ebla 7 – 11, 2025 G.C.)',
  },
  startDateGC: '2025-04-07',
  endDateGC: '2025-04-11',
  status: 'upcoming', // configurable state: 'upcoming' | 'live' | 'past'
  venueI18n: {
    en: 'Woliso Campus & Woliso Town',
    am: 'ወሊሶ ካምፓስ እና ወሊሶ ከተማ',
    om: 'Kaampasii Walisoo fi Magaalaa Walisoo',
  },
  hostDepartmentI18n: {
    en: 'Department of Tourism and Hotel Management',
    am: 'የቱሪዝም እና ሆቴል ማኔጅመንት ትምህርት ክፍል',
    om: 'Kutaa Barnootaa Hoggansa Turizimii fi Hoteelaa',
  },
  hostUniversityI18n: {
    en: 'Ambo University',
    am: 'አምቦ ዩኒቨርሲቲ',
    om: 'Yuunivarsiitii Amboo',
  },
  campusI18n: {
    en: 'Woliso Campus',
    am: 'ወሊሶ ካምፓስ',
    om: 'Kaampasii Walisoo',
  },
  stats: {
    // Derived at runtime from events array — do not set here.
    daysCount: null,
    activitiesCount: null,
    // Set to a real figure when available; null hides the tile on the home page.
    expectedParticipants: '2,000+',
    exhibitorsCount: '30+',
  },
};

export const SEED_EVENTS: EventItem[] = [
  // DAY 1
  {
    id: 'day-1-cleaning-campaign',
    slug: 'cleaning-campaign-campus-town',
    editionId: '5th-annual-2017',
    day: 1,
    dayNameI18n: {
      en: 'Day 1 — Monday, Megabit 29',
      am: 'ቀን 1 — ሰኞ፣ መጋቢት 29',
      om: 'Guyyaa 1 — Wiixata, Bitootessa 29',
    },
    session: 'morning',
    startTime: 'Morning',
    endTime: 'Afternoon',
    titleI18n: {
      en: 'Cleaning Campaign within Campus and Woliso Town',
      am: 'የፅዳት ዘመቻ በካምፓስ እና በወሊሶ ከተማ',
      om: 'Duula Qulqullinaa Mooraa fi Magaalaa Walisoo Keessatti (needs native review)',
    },
    descriptionI18n: {
      en: 'A joint community mobilization uniting students, academic instructors, campus staff, and Woliso town municipal workers. Fostering environmental hygiene and tourism destination sanitation.',
      am: 'ተማሪዎችን፣ መምህራንን፣ የካምፓስ ሰራተኞችንና የወሊሶ ከተማ ነዋሪዎችን ያቀናጀ የጋራ የፅዳት ዘመቻ። ለአረንጓዴና ፅዱ ቱሪዝም መዳረሻ ጥሪ የሚያስተላልፍ መርሃ ግብር።',
      om: 'Duula qulqullinaa barattoota, barsiisota fi hawaasa magaalaa wal-taasisun qulqullina naannoo eeguu fi qophii ayyaanichaaf godhamu (needs native review).',
    },
    category: 'community',
    venueType: 'both',
    venueNameI18n: {
      en: 'Woliso Campus Quad & Woliso Main Boulevard',
      am: 'ወሊሶ ካምፓስ እና የወሊሶ ከተማ ዋና አውራ ጎዳና',
      om: 'Mooraa Kaampasii Walisoo fi Daandii Guddaa Magaalaa',
    },
    status: 'scheduled',
    featured: true,
    image: '/assets/aistudio/image_fe8a90e0.png',
  },

  // DAY 2
  {
    id: 'day-2-street-cultural-show',
    slug: 'street-cultural-show-handcrafts-music',
    editionId: '5th-annual-2017',
    day: 2,
    dayNameI18n: {
      en: 'Day 2 — Tuesday, Megabit 30',
      am: 'ቀን 2 — ማክሰኞ፣ መጋቢት 30',
      om: 'Guyyaa 2 — Kibxata, Bitootessa 30',
    },
    session: 'morning',
    startTime: 'Morning',
    endTime: 'Afternoon',
    titleI18n: {
      en: 'Street Cultural Show, Handcrafts Exhibition & Music Festival',
      am: 'የጎዳና ላይ የባህል ትዕይንት፣ የባህል ቁሳቁስ አውደ ርዕይ እና የሙዚቃ ፌስቲቫል',
      om: 'Agarsiisa Aadaa Daandii Irraa, Meeshaalee Aadaa fi Dorgommii Shubbisaa (needs native review)',
    },
    descriptionI18n: {
      en: 'Vibrant outdoor festival displaying rich Ethiopian traditional attire, indigenous craftsmanship, live regional music ensembles, and dynamic modern/traditional dance contests.',
      am: 'የኢትዮጵያን ብሔር ብሔረሰቦች ውብ የባህል አልባሳት፣ ጥበብና የእጅ ስራዎች፣ ባህላዊና ዘመናዊ የሙዚቃ ትዕይንቶች እንዲሁም የዳንስ ውድድር የሚያካትት ደማቅ ፌስቲቫል።',
      om: 'Agarsiisa aadaa boonsaa fi miidhagina uffannaa aadaa, meeshaalee aadaa hojii harkaa, fi sirboota aadaa fi ammayyaa kan of keessatti qabate (needs native review).',
    },
    category: 'culture',
    venueType: 'both',
    venueNameI18n: {
      en: 'Woliso Town Cultural Square & Campus Cultural Hall',
      am: 'የወሊሶ ከተማ የባህል አደባባይ እና የካምፓሱ አዳራሽ',
      om: 'Addabaabayi Aadaa Magaalaa Walisoo fi Galma Kaampasii',
    },
    status: 'scheduled',
    featured: true,
    image: '/assets/aistudio/image_9108d7cc.png',
    subEvents: [
      {
        titleI18n: {
          en: 'Street Cultural Show',
          am: 'የጎዳና ላይ የባህል ትዕይንት',
          om: 'Agarsiisa Aadaa Daandii Irraa (needs native review)',
        },
        category: 'culture',
      },
      {
        titleI18n: {
          en: 'Exhibition of Cultural Materials and Handcrafts',
          am: 'የባህል ቁሳቁስ እና የእጅ ስራዎች አውደ ርዕይ',
          om: 'Agarsiisa Meeshaalee Aadaa fi Hojii Harkaa (needs native review)',
        },
        category: 'culture',
      },
      {
        titleI18n: {
          en: 'Traditional and Modern Music Festival',
          am: 'በባህላዊና ዘመናዊ ሙዚቃ ፌስቲቫል',
          om: 'Sirba Aadaa fi Ammayyaa (needs native review)',
        },
        category: 'culture',
      },
      {
        titleI18n: {
          en: 'Dance Contest (Traditional & Modern)',
          am: 'የዳንስ ውድድር (ባህላዊና ዘመናዊ)',
          om: 'Dorgommii Shubbisa Aadaa fi Ammayyaa (needs native review)',
        },
        category: 'competition',
      },
    ],
  },

  // DAY 3 MORNING
  {
    id: 'day-3-great-run',
    slug: 'great-ambo-university-woliso-campus-running',
    editionId: '5th-annual-2017',
    day: 3,
    dayNameI18n: {
      en: 'Day 3 — Wednesday, Miyazya 01',
      am: 'ቀን 3 — ረቡዕ፣ ሚያዝያ 01',
      om: 'Guyyaa 3 — Roobii, Ebla 01',
    },
    session: 'morning',
    startTime: 'Morning',
    endTime: 'Midday',
    titleI18n: {
      en: 'Great Ambo University Woliso Campus Running',
      am: 'አምቦ ዩኒቨርስቲ፣ ወሊሶ ካምፓስ የጎዳና ላይ ታላቅ ሩጫ',
      om: 'Fiigicha Guddaa Yuunivarsiitii Amboo Kaampasii Walisoo (needs native review)',
    },
    descriptionI18n: {
      en: 'Mass participation road race promoting athletic vitality, peace, and tourism awareness throughout the picturesque avenues of Woliso town and campus entrance.',
      am: 'ሰላምን፣ ጤናማ የአኗኗር ዘይቤንና የቱሪዝም ግንዛቤን ለማስረጽ በወሊሶ ጎዳናዎች የሚካሄድ ሕዝባዊ የጎዳና ላይ ታላቅ ሩጫ።',
      om: 'Fiigicha daandii guddaa nagaa fi fayyummaa akkasumas hubannoo turizimii guddisuuf qophaa’e (needs native review).',
    },
    category: 'sports',
    venueType: 'both',
    venueNameI18n: {
      en: 'Woliso Town Roundabout to Campus Gate',
      am: 'ከወሊሶ ከተማ አደባባይ እስከ ዩኒቨርሲቲው ካምፓስ መግቢያ',
      om: 'Ispoortii Daandii Magaalaa Walisoo gara Mooraa Kaampasiitti',
    },
    status: 'scheduled',
    featured: true,
    image: '/assets/aistudio/image_3856f7f5.png',
  },

  // DAY 3 AFTERNOON
  {
    id: 'day-3-miss-mr-tourism',
    slug: 'miss-and-mr-tourism-woliso-campus',
    editionId: '5th-annual-2017',
    day: 3,
    dayNameI18n: {
      en: 'Day 3 — Wednesday, Miyazya 01',
      am: 'ቀን 3 — ረቡዕ፣ ሚያዝያ 01',
      om: 'Guyyaa 3 — Roobii, Ebla 01',
    },
    session: 'afternoon',
    startTime: 'Afternoon',
    endTime: 'Evening',
    titleI18n: {
      en: 'Miss and Mr. Tourism Ambo University Woliso Campus',
      am: 'ቁንጅና ውድድር በሴት እና በወንድ (Miss and Mr. Tourism)',
      om: 'Dorgommii Bareedinaa Miss fi Mr. Turizimii (needs native review)',
    },
    descriptionI18n: {
      en: 'Flagship pageant celebrating intellect, cultural eloquence, sustainable tourism advocacy, and community ambassadorship among male and female university students.',
      am: 'የተማሪዎችን እውቀት፣ የባህል ክህሎት እና የቱሪዝም አምባሳደርነት የሚያጎላ በሴት እና በወንድ መካከል የሚካሄድ ክብር ያለው የቁንጅና ውድድር።',
      om: 'Dorgommii dandeettii, beekumsa aadaa fi ambaasaaddarummaa turizimii barattoota gidduutti taasifamu (needs native review).',
    },
    category: 'competition',
    venueType: 'campus',
    venueNameI18n: {
      en: 'Campus Main Grand Auditorium',
      am: 'የካምፓሱ ዋና ታላቅ አዳራሽ',
      om: 'Galma Guddaa Kaampasii Walisoo',
    },
    status: 'scheduled',
    featured: true,
    image: '/assets/aistudio/image_db590259.png',
  },

  // DAY 4 MORNING
  {
    id: 'day-4-academic-symposium',
    slug: 'seminar-tourism-promotion-competitions-awards',
    editionId: '5th-annual-2017',
    day: 4,
    dayNameI18n: {
      en: 'Day 4 — Thursday, Miyazya 02',
      am: 'ቀን 4 — ሐሙስ፣ ሚያዝያ 02',
      om: 'Guyyaa 4 — Kamisa, Ebla 02',
    },
    session: 'morning',
    startTime: 'Morning',
    endTime: 'Afternoon',
    titleI18n: {
      en: 'Academic Seminar, Destination Promotion, Interdepartmental Contests & Awards',
      am: 'በቱሪዝም ጉዳዮች ላይ ሴሚናር፣ መዳረሻዎችን ማስተዋወቅ፣ የጥያቄና መልስ ውድድር እና የምስክር ወረቀት መርሃ ግብር',
      om: 'Seminaara Turizimii, Beeksisa Bakkeewwan Hawwataa, Dorgommii fi Badhaasa (needs native review)',
    },
    descriptionI18n: {
      en: 'Scholarly presentations exploring "Tourism for Peace and Stability", local destination marketing, student literary and quiz competitions, and recognition awards for sponsors and organizers.',
      am: 'በቱሪዝም እና ሰላም ግንባታ ላይ ጥናታዊ ውይይት፣ የቱሪዝም መዳረሻዎች ማስተዋወቂያ፣ የጥያቄና መልስ እንዲሁም የስነ-ጽሑፍ ውድድር እና ለስፖንሰሮች የምስክር ወረቀት አሰጣጥ።',
      om: 'Marii qorannoo dhimma turizimii fi nagaa, dorgommii gaaffii fi deebii barattootaa, fi sagantaa waraqaa ragaa isponsarootaa (needs native review).',
    },
    category: 'academic',
    venueType: 'campus',
    venueNameI18n: {
      en: 'Woliso Campus Conference Hall',
      am: 'የወሊሶ ካምፓስ የኮንፈረንስ አዳራሽ',
      om: 'Galma Walgahii Kaampasii Walisoo',
    },
    status: 'scheduled',
    featured: true,
    image: '/assets/aistudio/image_25e4d059.png',
    subEvents: [
      {
        titleI18n: {
          en: 'Seminar on Tourism Issues',
          am: 'በቱሪዝም ጉዳዮች ላይ ውይይት',
          om: 'Seminaara Dhimmoota Turizimii Irratti (needs native review)',
        },
        category: 'academic',
      },
      {
        titleI18n: {
          en: 'Tourism Destination Promotion',
          am: 'የቱሪዝም መዳረሻዎች ማስተዋወቅ',
          om: 'Beeksisa Bakkeewwan Hawwata Turizimii (needs native review)',
        },
        category: 'academic',
      },
      {
        titleI18n: {
          en: 'Interdepartmental Q&A, Poetry and Essay Competition',
          am: 'የጥያቄ እና መልስ ውድድር በትምህርት ክፍሎች መካከል፣ የግጥም እና ስነ ጽሁፍ ውድድር',
          om: 'Dorgommii Gaaffii fi Deebii, Walaloo fi Barreeffamaa (needs native review)',
        },
        category: 'competition',
      },
      {
        titleI18n: {
          en: 'Certificate and Award Programme for Organizers and Sponsors',
          am: 'ለአዘጋጆች እና ስፖንሰሮች የምስክር ወረቀት እና እውቅና ፕሮግራም',
          om: 'Sagantaa Waraqaa Ragaa fi Badhaasa Qopheessitootaa fi Isponsarootaaf (needs native review)',
        },
        category: 'community',
      },
    ],
  },

  // DAY 4 AFTERNOON
  {
    id: 'day-4-staff-football',
    slug: 'football-academic-vs-administrative-staff',
    editionId: '5th-annual-2017',
    day: 4,
    dayNameI18n: {
      en: 'Day 4 — Thursday, Miyazya 02',
      am: 'ቀን 4 — ሐሙስ፣ ሚያዝያ 02',
      om: 'Guyyaa 4 — Kamisa, Ebla 02',
    },
    session: 'afternoon',
    startTime: 'Afternoon',
    endTime: 'Evening',
    titleI18n: {
      en: 'Staff Friendly Match: Academic vs. Administrative Staff',
      am: 'የሰራተኞች የወዳጅነት እግር ኳስ ግጥሚያ፡ አካዳሚክ ከ አስተዳደር ሰራተኞች ጋር',
      om: 'Tapha Kubbaa Miilaa: Barsiisotaa fi Hojjettoota Bulchiinsaa Gidduutti (needs native review)',
    },
    descriptionI18n: {
      en: 'Entertaining sports derby building camaraderie, teamwork, and institutional wellness between teaching faculty and administrative personnel.',
      am: 'በመምህራን እና በአስተዳደር ሰራተኞች መካከል የጋራ አንድነትን፣ ጤናን እና ደስታን የሚያጠናክር አጓጊ የእግር ኳስ የወዳጅነት ጨዋታ።',
      om: 'Tapha kubbaa miilaa jaalalaa fi tokkummaa hojjettoota kaampasii gidduutti taasifamu (needs native review).',
    },
    category: 'sports',
    venueType: 'campus',
    venueNameI18n: {
      en: 'Woliso Campus Sports Stadium',
      am: 'የወሊሶ ካምፓስ ስፖርት ሜዳ',
      om: 'Dirree Ispoortii Kaampasii Walisoo',
    },
    status: 'scheduled',
    featured: false,
    image: '/assets/aistudio/image_6eb824fd.png',
  },

  // DAY 5 MORNING
  {
    id: 'day-5-guest-tour',
    slug: 'guest-tour-woliso-destinations',
    editionId: '5th-annual-2017',
    day: 5,
    dayNameI18n: {
      en: 'Day 5 — Friday, Miyazya 03',
      am: 'ቀን 5 — አርብ፣ ሚያዝያ 03',
      om: 'Guyyaa 5 — Jimmata, Ebla 03',
    },
    session: 'morning',
    startTime: 'Morning',
    endTime: 'Midday',
    titleI18n: {
      en: 'Guest Tour to Regional Eco-Tourism & Heritage Sites',
      am: 'የእንግዶች ጉብኝት ወደ ተፈጥሮ እና ባህላዊ መስህቦች',
      om: 'Daawwannaa Keessummootaa Bakkeewwan Hawwata Turizimiitti (needs native review)',
    },
    descriptionI18n: {
      en: 'Guided field exploration for invited delegates, academics, and guests visiting regional natural springs, eco-lodges, and cultural landscape attractions surrounding Woliso.',
      am: 'ለክብር እንግዶች፣ ለተመራማሪዎችና ለተሳታፊዎች የተዘጋጀ የወሊሶ እና አካባቢዋን የተፈጥሮ ፍልውሃዎች፣ የመዝናኛ ስፍራዎች እና ቅርሶች የመስክ ጉብኝት።',
      om: 'Daawwannaa iddoowwan qabeenya uumamaa fi hawwata turizimii naannoo Walisootti argaman daawwachuuf qophaa’e (needs native review).',
    },
    category: 'culture',
    venueType: 'town',
    venueNameI18n: {
      en: 'Woliso Eco-Tourism Hot Springs & Landscape Sites',
      am: 'የወሊሶ የተፈጥሮ ፍልውሃ እና የቱሪዝም መስህቦች',
      om: 'Bakkeewwan Hawwata Uumamaa fi Burqaa Walisoo',
    },
    status: 'scheduled',
    featured: true,
    image: '/assets/aistudio/image_7544bf77.png',
  },

  // DAY 5 AFTERNOON
  {
    id: 'day-5-closing-ceremony',
    slug: 'end-of-the-programme-closing',
    editionId: '5th-annual-2017',
    day: 5,
    dayNameI18n: {
      en: 'Day 5 — Friday, Miyazya 03',
      am: 'ቀን 5 — አርብ፣ ሚያዝያ 03',
      om: 'Guyyaa 5 — Jimmata, Ebla 03',
    },
    session: 'afternoon',
    startTime: 'Afternoon',
    endTime: 'Evening',
    titleI18n: {
      en: 'Closing Ceremony & Conclusion of the Tourism Week Programme',
      am: 'የፕሮግራሙ ማጠቃለያ እና የክብር መዝጊያ ስነ ስርዓት',
      om: 'Xumura Sagantichaa fi Eebba Cufiinsaa (needs native review)',
    },
    descriptionI18n: {
      en: 'Official closing remarks from university leadership, announcement of competition winners, cultural banquet, and final festival thanksgiving.',
      am: 'የዩኒቨርሲቲው የበላይ አመራሮች የማጠቃለያ ንግግር፣ የአሸናፊዎች ማስታወቂያና ሽልማት እንዲሁም ይፋዊ የሳምንቱ ማጠቃለያ።',
      om: 'Sagantaa cufiinsa boonsaa kan hoggantoota yuunivarsiitiin geggeeffamu fi badhaasa xumuraa (needs native review).',
    },
    category: 'community',
    venueType: 'campus',
    venueNameI18n: {
      en: 'Woliso Campus Grand Auditorium',
      am: 'የወሊሶ ካምፓስ ታላቅ አዳራሽ',
      om: 'Galma Guddaa Kaampasii Walisoo',
    },
    status: 'scheduled',
    featured: true,
    image: '/assets/aistudio/image_c9b19ed8.png',
  },
];

export const SEED_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    type: 'urgent',
    active: true,
    messageI18n: {
      en: 'Official Notice: The 5th Annual Tourism Celebration begins Monday, Megabit 29, 2017 E.C. All sessions are free and open to the public.',
      am: 'ይፋዊ ማስታወቂያ፡ 5ኛው ዓመታዊ የቱሪዝም ሳምንት ሰኞ መጋቢት 29 ቀን 2017 ዓ.ም ይጀምራል። ሁሉም መርሃ ግብሮች ለሕዝብ ክፍት ናቸው።',
      om: 'Beeksisa: Ayyaanni Turizimii Waggaa 5ffaa Wiixata, Bitootessa 29, 2017 A.L.I ni eegala. Sagantaan hunduu hawaasaaf banaadha.',
    },
    link: '/schedule',
  },
];

export const SEED_NEWS: NewsItem[] = [
  {
    id: 'news-1',
    slug: 'preparations-finalized-for-5th-annual-tourism-week',
    titleI18n: {
      en: 'Preparations Finalized for the 5th Annual Tourism Celebration',
      am: 'ለ5ኛው ዓመታዊ የቱሪዝም ሳምንት ክብረ በዓል ዝግጅት ተጠናቀቀ',
      om: 'Qophiin Ayyaana Turizimii Waggaa 5ffaaf Taasifamu Xumurame (needs native review)',
    },
    excerptI18n: {
      en: 'The Department of Tourism and Hotel Management at Ambo University Woliso Campus completes all logistics for 5 days of cultural, academic, and sporting events.',
      am: 'የአምቦ ዩኒቨርሲቲ ወሊሶ ካምፓስ የቱሪዝም እና ሆቴል ማኔጅመንት ትምህርት ክፍል ለአምስት ቀናት ለሚዘልቁት ዝግጅቶች አስፈላጊውን ቅድመ ዝግጅት ማጠናቀቁን አስታወቀ።',
      om: 'Kutaan Barnootaa Hoggansa Turizimii fi Hoteelaa qophii guyyoota shaniif turu guutummaatti xumuruu beeksise (needs native review).',
    },
    contentI18n: {
      en: 'The organizing committee of the Department of Tourism and Hotel Management held its final briefing with university management and municipal partners. The theme "Tourism for Peace and Stability" highlights how community-centred hospitality and heritage appreciation build national dialogue and sustainable regional development.',
      am: 'የአዘጋጅ ኮሚቴው ከዩኒቨርሲቲው አመራሮችና ከወሊሶ ከተማ መስተዳድር ጋር ውይይት አድርጓል። "ቱሪዝም ለሰላምና መረጋጋት" በሚል መሪ ቃል የሚከበረው ይህ ሳምንት ማህበረሰባዊ አብሮነትንና ዘላቂ ልማትን ለማጠናከር ትልቅ ሚና ይጫወታል።',
      om: 'Koreen qopheessituu marii xumuraa geggeessitee jirti. Dhimmi nageenyaa fi tasgabbii turizimiin walqabatee xiyyeeffannoo guddaa argatee jira (needs native review).',
    },
    publishedAt: '2025-04-03',
    publishedAtEC: '25/07/2017',
    categoryI18n: {
      en: 'Department Announcement',
      am: 'የትምህርት ክፍሉ ማስታወቂያ',
      om: 'Beeksisa Kutaa Barnootaa',
    },
    authorI18n: {
      en: 'Organizing Secretariat',
      am: 'የዝግጅት ኮሚቴው ጽሕፈት ቤት',
      om: 'Waajjira Qindeessaa',
    },
    pinned: true,
    image: '/news-prep.jpg',
  },
  {
    id: 'news-2',
    slug: 'great-run-route-announced',
    titleI18n: {
      en: 'Route and Registration Details for the Great Woliso Campus Run',
      am: 'የወሊሶ ካምፓስ ታላቅ ሩጫ መስመር ይፋ ተደረገ',
      om: 'Kallattiin Fiigicha Guddaa Kaampasii Walisoo Beeksifame (needs native review)',
    },
    excerptI18n: {
      en: 'Scenic road course starting from Woliso central avenue and finishing at the university athletic field. Open to all students, faculty, and residents.',
      am: 'ከወሊሶ ከተማ ማዕከል ተነስቶ በካምፓሱ ስፖርት ሜዳ የሚጠናቀቀው መስመር ዝግጁ ሆኗል። መላው ተማሪዎችና ነዋሪዎች እንዲሳተፉ ተጋብዘዋል።',
      om: 'Daandiin fiigichaa magaalaa keessaa gara mooraa kaampasiitti kan qophaa’e yoo ta’u hirmaannaan banaadha (needs native review).',
    },
    contentI18n: {
      en: 'Scheduled for Day 3 (Wednesday, Miyazya 01), the Great Woliso Campus Run promotes physical wellness and tourism pride. Water stations, medical personnel, and route guides will be stationed along the path.',
      am: 'በቀን 3 (ረቡዕ ሚያዝያ 01 ቀን) የሚካሄደው ሩጫ በከተማው ጎዳናዎች ላይ የሚደረግ ሲሆን የመጀመሪያ እርዳታ እና የውሃ ማከፋፈያ ጣቢያዎች ተዘጋጅተዋል።',
      om: 'Fiigichi kun guyyaa 3ffaa irratti kan gaggeeffamu yoo ta’u tajaajilli barbaachisaan hundi qophaa’ee jira (needs native review).',
    },
    publishedAt: '2025-04-04',
    publishedAtEC: '26/07/2017',
    categoryI18n: {
      en: 'Sports & Community',
      am: 'ስፖርት እና ማህበረሰብ',
      om: 'Ispoortii fi Hawaasa',
    },
    authorI18n: {
      en: 'Sports Coordination Team',
      am: 'የስፖርት አስተባባሪ ቡድን',
      om: 'Garee Qindeessituu Ispoortii',
    },
    pinned: false,
    image: '/images/news-run.jpg',
  },
  {
    id: 'news-3',
    slug: 'academic-symposium-call-for-posters',
    titleI18n: {
      en: 'Scholarly Papers & Destination Posters for Tourism Symposium',
      am: 'በቱሪዝም ሲምፖዚየም ላይ የሚቀርቡ የጥናት ጽሑፎች እና ፖስተሮች',
      om: 'Waraqaalee Qorannoo fi Agarsiisa Siimpooziyeemii (needs native review)',
    },
    excerptI18n: {
      en: 'Faculty and guest researchers present findings on eco-tourism potential in South West Shewa and Oromia region.',
      am: 'በደቡብ ምዕራብ ሸዋ እና በኦሮሚያ ክልል ስላሉ የኢኮ-ቱሪዝም መስህቦችና እድሎች የቀረቡ ጥናታዊ ጽሑፎች ይቀርባሉ።',
      om: 'Qorannoowwan carraa turizimii uumamaa Shawaa Kibba Lixaa fi Oromiyaa keessatti argaman irratti dhiyaatu (needs native review).',
    },
    contentI18n: {
      en: 'Day 4 features a multidisciplinary symposium exploring hotel administration, sustainable rural tourism, and local culinary preservation. All academic papers will be archived for campus students and industry stakeholders.',
      am: 'በቀን 4 የሚካሄደው ሲምፖዚየም የሆቴል አስተዳደር፣ ዘላቂ የገጠር ቱሪዝም እና ባህላዊ ምግቦችን አስመልክቶ ጥናታዊ ውይይቶችን ያካትታል።',
      om: 'Guyyaa 4ffaa irratti dhimmoota bulchiinsa hoteelaa fi turizimii ilaalchisee waraqaaleen qorannoo ni dhiyaatu (needs native review).',
    },
    publishedAt: '2025-04-05',
    publishedAtEC: '27/07/2017',
    categoryI18n: {
      en: 'Academic',
      am: 'አካዳሚክ',
      om: 'Barnoota',
    },
    authorI18n: {
      en: 'Academic Committee',
      am: 'የአካዳሚክ ኮሚቴ',
      om: 'Koreen Barnootaa',
    },
    pinned: false,
    image: '/images/news-symposium.jpg',
  },
];

export const SEED_GALLERY: GalleryItem[] = [
  {
    id: 'gal-1',
    titleI18n: {
      en: 'Pan-Ethiopian Cultural Attire Assembly',
      am: 'የኢትዮጵያ ብሔር ብሔረሰቦች ባህላዊ አልባሳት የጋራ ትዕይንት',
      om: 'Agarsiisa Uffata Aadaa Saboota fi Sab-lammoota Itoophiyaa',
    },
    captionI18n: {
      en: 'Students and organizers showcasing authentic traditional dresses of Oromo, Amhara, Tigray, Somali, Gurage, and Southern nations under the open campus sky.',
      am: 'የካምፓሱ ተማሪዎችና አዘጋጆች የተለያዩ የኢትዮጵያ ባህላዊ አልባሳትን በድምቀት ሲያቀርቡ።',
      om: 'Barattoonni fi qindeessitoonni uffata aadaa saboota adda addaa yeroo agarsiisan.',
    },
    year: 2024,
    category: 'culture',
    mediaType: 'image',
    url: '/assets/aistudio/image_c9b19ed8.png',
    thumbnail: '/assets/aistudio/image_c9b19ed8.png',
  },
  {
    id: 'gal-2',
    titleI18n: {
      en: 'Traditional Oromo Cavalry & Decorated Stallions Parade',
      am: 'የባህላዊ ፈረሰኞች ሰልፍ እና የፈረስ ጌጦች ትዕይንት በወሊሶ',
      om: 'Hiriira Abbootii Fardaa fi Faaya Farda Aadaa Walisoo',
    },
    captionI18n: {
      en: 'Spectacular procession of traditional cavalry mounted on decorated horses with ceremonial red and yellow harness along Woliso boulevard.',
      am: 'በቀይ እና ቢጫ ያጌጡ ፈረሰኞች በወሊሶ ጎዳናዎች ላይ ያደረጉት አስደናቂ ትዕይንት።',
      om: 'Abbootiin fardaa fardeen miidhagsanii daandii Walisoo irratti yeroo hiriiran.',
    },
    year: 2024,
    category: 'culture',
    mediaType: 'image',
    url: '/assets/aistudio/image_9108d7cc.png',
    thumbnail: '/assets/aistudio/image_9108d7cc.png',
  },
  {
    id: 'gal-3',
    titleI18n: {
      en: 'Miss & Mr. Tourism Campus Grand Coronation',
      am: 'የወሊሶ ካምፓስ ሚስ እና ሚስተር ቱሪዝም ዘውድ ማልበስ ስነ-ስርዓት',
      om: 'Sirna Badhaasa Eebba Miss fi Mr. Turizimii Kaampasii Walisoo',
    },
    captionI18n: {
      en: 'Grand coronation inside the campus auditorium featuring the crowned Miss Tourism, delegates, and celebratory stage lights.',
      am: 'በካምፓሱ አዳራሽ የተካሄደው የቱሪዝም አምባሳደሮች የዘውድ ማልበስ እና የዕውቅና ስነ-ስርዓት።',
      om: 'Galma Kaampasii Walisoo keessatti sirna gonfoo uffisuu fi badhaasa dorgommii bareedinaa.',
    },
    year: 2024,
    category: 'competition',
    mediaType: 'image',
    url: '/assets/aistudio/image_db590259.png',
    thumbnail: '/assets/aistudio/image_db590259.png',
  },
  {
    id: 'gal-4',
    titleI18n: {
      en: 'Celebration Street Carnival & Joyful Youth Dance',
      am: 'የጎዳና ላይ የደስታ ዳንስ እና የቱሪዝም ሳምንት ባነር ሰልፍ',
      om: 'Shubbisa Aadaa fi Gammachuu Daandii Irratti Barattootaan',
    },
    captionI18n: {
      en: 'Students and youth performing energetic dances and songs along Woliso avenue with the official Department of Tourism banner.',
      am: 'ተማሪዎችና ወጣቶች የወሊሶ ጎዳናዎችን በባህላዊ ጭፈራና በደስታ አጅበው ሲጓዙ።',
      om: 'Barattoonni fi dargaggoonni shubbisa aadaatiin daandii Walisoo yeroo miidhagsan.',
    },
    year: 2024,
    category: 'culture',
    mediaType: 'image',
    url: '/assets/aistudio/image_e6296589.png',
    thumbnail: '/assets/aistudio/image_e6296589.png',
  },
  {
    id: 'gal-5',
    titleI18n: {
      en: 'Mounted Horsemen Cavalry Guard with Traditional Shields',
      am: 'የባህላዊ ጋሻ እና ጦር የታጠቁ ፈረሰኞች የክብር ሰልፍ',
      om: 'Eegumsa Fardeen Aadaa fi Gaachana Seena-qabeessa',
    },
    captionI18n: {
      en: 'Historic cavalry lineup holding traditional embossed metal shields and ceremonial spears lining the main road.',
      am: 'የአባገዳ ባህላዊ ጋሻ እና ጦር የታጠቁ ፈረሰኞች በክብር ሰልፍ ላይ።',
      om: 'Abbootii fardaa gaachana fi eboo qabatanii hiriira kabajaa irratti.',
    },
    year: 2024,
    category: 'culture',
    mediaType: 'image',
    url: '/assets/aistudio/image_7544bf77.png',
    thumbnail: '/assets/aistudio/image_7544bf77.png',
  },
  {
    id: 'gal-6',
    titleI18n: {
      en: 'Great Woliso Morning Carnival March & Athletic Peloton',
      am: 'የጠዋቱ የወሊሶ ጎዳና ካርኒቫል ሰልፍ እና ሩጫ',
      om: 'Hiriira Kaarnivaalii Ganamaa fi Fiigicha Daandii Walisoo',
    },
    captionI18n: {
      en: 'Morning running peloton and festive cultural march through Woliso downtown in golden morning sunlight.',
      am: 'የጠዋቱ የወሊሶ ከተማ ታላቁ የጎዳና ላይ ሩጫ እና የደስታ ሰልፍ።',
      om: 'Fiigicha guddaa ganamaa fi soochii aadaa daandii magaalichaa irratti.',
    },
    year: 2024,
    category: 'sports',
    mediaType: 'image',
    url: '/assets/aistudio/image_3856f7f5.png',
    thumbnail: '/assets/aistudio/image_3856f7f5.png',
  },
  {
    id: 'gal-7',
    titleI18n: {
      en: 'Tourism Week Exhibition Pavilion & Cultural Hostesses',
      am: 'የቱሪዝም ሳምንት የኤግዚቢሽን ድንኳን እና ባህላዊ አልባሳት',
      om: 'Dunkana Agarsiisa Turizimii fi Dubartoota Uffata Aadaa',
    },
    captionI18n: {
      en: 'Hospitality and tourism students in vibrant cultural attire welcoming guests at the Ambo University Woliso Campus pavilion.',
      am: 'የሆቴል እና ቱሪዝም ማኔጅመንት ሴት ተማሪዎች በባህላዊ አልባሳት በኤግዚቢሽኑ ድንኳን ፊት።',
      om: 'Barattoonni dubaraa uffata aadaatiin keessummoota dunkana agarsiisaatti simatan.',
    },
    year: 2024,
    category: 'culture',
    mediaType: 'image',
    url: '/assets/aistudio/image_e2e72d06.png',
    thumbnail: '/assets/aistudio/image_e2e72d06.png',
  },
  {
    id: 'gal-8',
    titleI18n: {
      en: 'Traditional Stick Dance & Peace Procession',
      am: 'የባህላዊ ዘንግ ጭፈራ እና የቱሪዝም ለሰላም ሰልፍ',
      om: 'Dhiichisa Ulee Aadaa fi Hiriira Nageenyaa Turizimii',
    },
    captionI18n: {
      en: 'Choreographed traditional stick march carrying the "Tourism for Peace and Stability" banner along the campus route.',
      am: 'ተማሪዎች ባህላዊ ዱላና ሻማ በመያዝ "ቱሪዝም ለሰላምና ለዘላቂ ልማት" መሪ ቃልን ሲያስተጋቡ።',
      om: 'Dhiichisa ulee aadaa fi dhaadannoo "Turizimiin Nageenyaaf" jedhu qabatanii.',
    },
    year: 2024,
    category: 'culture',
    mediaType: 'image',
    url: '/assets/aistudio/image_d5bf61c0.png',
    thumbnail: '/assets/aistudio/image_d5bf61c0.png',
  },
  {
    id: 'gal-9',
    titleI18n: {
      en: 'Department Faculty & Student Leadership Delegation',
      am: 'የቱሪዝም እና ሆቴል ማኔጅመንት ትምህርት ክፍል መምህራን እና ተማሪዎች',
      om: 'Barsiisota fi Barattoota Muummee Turizimii fi Bulchiinsa Hoteelaa',
    },
    captionI18n: {
      en: 'Faculty professors, department leadership, and student organizers gathered outside the university academic block.',
      am: 'የክፍሉ መምህራን እና የተማሪዎች ኮሚቴ በካምፓሱ ህንፃ ፊት ያደረጉት የወዳጅነት ፎቶ።',
      om: 'Barsiisonni muummee fi barattoonni gamoo kaampasii fuulduratti waloon.',
    },
    year: 2024,
    category: 'academic',
    mediaType: 'image',
    url: '/assets/aistudio/image_25e4d059.png',
    thumbnail: '/assets/aistudio/image_25e4d059.png',
  },
  {
    id: 'gal-10',
    titleI18n: {
      en: 'Civic Sanitation & Town Beautification Volunteer Brigade',
      am: 'የወሊሶ ከተማ እና ካምፓስ የፅዳት ዘመቻ በጎ ፈቃደኞች',
      om: 'Duula Qulqullina Magaalaa Walisoo fi Kaampasii Barattootaan',
    },
    captionI18n: {
      en: 'Over a hundred students and staff mobilized with brooms, shovels, and sanitary gear for community environmental day.',
      am: 'በመጥረጊያ እና አካፋ የታጠቁ ተማሪዎችና ሰራተኞች ከተማዋን ለበዓሉ በፅዳት ሲያዘጋጁ።',
      om: 'Barattoonni fi hojjettoonni haxaa fi baalawa qabatanii qulqullina naannoo yeroo eegsisan.',
    },
    year: 2024,
    category: 'community',
    mediaType: 'image',
    url: '/assets/aistudio/image_fe8a90e0.png',
    thumbnail: '/assets/aistudio/image_fe8a90e0.png',
  },
  {
    id: 'gal-11',
    titleI18n: {
      en: 'Eco-Tourism Campus Cleanup & Brush Clearing',
      am: 'የአካባቢ ጥበቃ እና የካምፓስ አረንጓዴ ልማት ስራ',
      om: 'Hojii Qulqullina Naannoo fi Eegumsa Bosonaa Kaampasii',
    },
    captionI18n: {
      en: 'Volunteers gathering brush and debris to prepare the open-air venues for the celebration week.',
      am: 'የካምፓሱን አረንጓዴ ስፍራዎች እና ሜዳዎች የማፅዳት በጎ ፈቃድ ስራ።',
      om: 'Muka fi qulqullina dirree qindeessuun mooraa qulqulleessuu.',
    },
    year: 2024,
    category: 'community',
    mediaType: 'image',
    url: '/assets/aistudio/image_a7c5afdc.png',
    thumbnail: '/assets/aistudio/image_a7c5afdc.png',
  },
  {
    id: 'gal-12',
    titleI18n: {
      en: 'Community Mobilization & Event Sound Truck Broadcast',
      am: 'የማህበረሰብ ቅስቀሳ እና የድምፅ ማጉያ መኪና ጉዞ',
      om: 'Kakasa Hawaasaa fi Sagantaa Beeksisa Magaalaa',
    },
    captionI18n: {
      en: 'Sanitation squad and organizers gathered with the event broadcast vehicle to coordinate town-wide activities.',
      am: 'የበዓሉ አስተባባሪዎች የድምፅ ማጉያ መኪና በማዘጋጀት የወሊሶን ማህበረሰብ ሲያስተባብሩ።',
      om: 'Konkolaataa beeksisaa fi sagaleedhaan hawaasa dammaqsuun hirmaachisuu.',
    },
    year: 2024,
    category: 'community',
    mediaType: 'image',
    url: '/assets/aistudio/image_731dbb07.png',
    thumbnail: '/assets/aistudio/image_731dbb07.png',
  },
  {
    id: 'gal-13',
    titleI18n: {
      en: 'Traditional Oromo Cavalry Procession (Abba Gadaa Escort)',
      am: 'የፈረሰኞች የክብር ሰልፍ በወሊሶ አውራ ጎዳና',
      om: 'Goolii Fardeen Aadaa Oromoo Daandii Walisoo Irratti',
    },
    captionI18n: {
      en: 'Vibrant traditional horsemen dressed in ceremonial white and traditional headdresses leading the opening festival.',
      am: 'በነጭ ባህላዊ ልብስ ያጌጡ ፈረሰኞች የወሊሶ ከተማን ዋና ጎዳና ሲያደምቁ።',
      om: 'Abbootii fardaa uffata adii fi faaya aadaa uffatanii daandii irratti.',
    },
    year: 2024,
    category: 'culture',
    mediaType: 'image',
    url: '/assets/aistudio/image_1a90f9a9.png',
    thumbnail: '/assets/aistudio/image_1a90f9a9.png',
  },
  {
    id: 'gal-14',
    titleI18n: {
      en: 'Heritage Costume Poses & Student Fellowship',
      am: 'የተማሪዎች የወዳጅነት ፎቶ በባህላዊ አልባሳት',
      om: 'Suuraa Hiriyyummaa Barattootaa Uffata Aadaatiin',
    },
    captionI18n: {
      en: 'Students proudly displaying authentic handwoven dresses, embroidered scarves, and cultural jewelry in the garden grounds.',
      am: 'ተማሪዎች በተለያዩ ውብ የሀበሻ እና የኦሮሞ ባህላዊ አልባሳት አጊጠው።',
      om: 'Barattoonni uffata aadaa Itoophiyaa adda addaatiin miidhaganii.',
    },
    year: 2024,
    category: 'culture',
    mediaType: 'image',
    url: '/assets/aistudio/image_6eb824fd.png',
    thumbnail: '/assets/aistudio/image_6eb824fd.png',
  },
  {
    id: 'gal-15',
    titleI18n: {
      en: 'National Unity Cultural Representatives',
      am: 'የብሔራዊ አንድነት የባህል ልኡካን ተማሪዎች',
      om: 'Bakka-buutota Aadaa Tokkummaa Biyyooleessaa',
    },
    captionI18n: {
      en: 'Diverse student delegates posing together under Ethiopian flags in celebration of inter-cultural understanding.',
      am: 'የተለያዩ ብሔር ብሔረሰቦችን ባህል የሚወክሉ ተማሪዎች በሰንደቅ ዓላማ ስር አብረው።',
      om: 'Barattoonni saboota hundaa bakka bu’an alaabaa jalatti tokkummaadhaan.',
    },
    year: 2024,
    category: 'culture',
    mediaType: 'image',
    url: '/assets/aistudio/image_c7963080.png',
    thumbnail: '/assets/aistudio/image_c7963080.png',
  },
  {
    id: 'gal-16',
    titleI18n: {
      en: 'Grand Lineup of Ethiopian Cultural Attires',
      am: 'የተማሪዎች ረጅም የባህላዊ አልባሳት ሰልፍ',
      om: 'Hiriira Dheeraa Uffata Aadaa Barattootaa',
    },
    captionI18n: {
      en: 'Panoramic lineup displaying dozens of authentic regional dresses along the palm-lined campus avenue.',
      am: 'በካምፓሱ ዛፎች ጥላ ስር የተሰለፉ በርካታ ተማሪዎች በባህላዊ አልባሳት።',
      om: 'Hiriira bal’aa barattootaa uffata aadaa miidhagaadhaan daandii irratti.',
    },
    year: 2024,
    category: 'culture',
    mediaType: 'image',
    url: '/assets/aistudio/image_b3b470e9.png',
    thumbnail: '/assets/aistudio/image_b3b470e9.png',
  },
  {
    id: 'gal-17',
    titleI18n: {
      en: 'Traditional Shamma & Tibeb White Robe Delegation',
      am: 'የነጭ ሻማ እና ጥበብ አልባሳት የባህል ልዑክ',
      om: 'Uffata Aadaa Shammaa fi Xibabii Adii',
    },
    captionI18n: {
      en: 'Young men showcasing pure white cotton handwoven kuta and shamma with red and black geometric border embroidery.',
      am: 'ወጣቶች ነጭ ጥበብ የተጠለፈባቸው ባህላዊ የሀገር ልብሶችን ለብሰው።',
      om: 'Dargaggoonni uffata aadaa xibabii qabuun kabajaa agarsiisan.',
    },
    year: 2024,
    category: 'culture',
    mediaType: 'image',
    url: '/assets/aistudio/image_dd2f8daf.png',
    thumbnail: '/assets/aistudio/image_dd2f8daf.png',
  },
];

export const SEED_SPONSORS: Sponsor[] = [
  {
    id: 'sp-1',
    name: 'Ethiopian Tourism Board',
    tier: 'platinum',
    logoPlaceholder: '[SPONSOR LOGO: Ethiopian Tourism Board]',
    sectorI18n: {
      en: 'Government Tourism Promotion Agency',
      am: 'የመንግስት የቱሪዝም ማስተዋወቂያ ኤጀንሲ',
      om: 'Ejensii Beeksisa Turizimii Mootummaa',
    },
  },
  {
    id: 'sp-2',
    name: 'Oromia Tourism Commission',
    tier: 'platinum',
    logoPlaceholder: '[SPONSOR LOGO: Oromia Tourism Commission]',
    sectorI18n: {
      en: 'Regional Heritage and Tourism Commission',
      am: 'የክልሉ የቱሪዝም እና ቅርስ ኮሚሽን',
      om: 'Koomishinii Turizimii Oromiyaa',
    },
  },
  {
    id: 'sp-3',
    name: 'Woliso Eco-Lodge & Hot Springs Resort',
    tier: 'gold',
    logoPlaceholder: '[SPONSOR LOGO: Woliso Eco-Lodge & Resort]',
    sectorI18n: {
      en: 'Hospitality & Wellness Resort',
      am: 'የእንግዳ ማረፊያ እና የፍልውሃ ሪዞርት',
      om: 'Rizoortii fi Hoteela Ekoo-Turizimii',
    },
  },
  {
    id: 'sp-4',
    name: 'Negash Resort & Botanical Garden',
    tier: 'gold',
    logoPlaceholder: '[SPONSOR LOGO: Negash Resort]',
    sectorI18n: {
      en: 'Eco-Resort and Conference Facility',
      am: 'የስብሰባ እና የመዝናኛ ሪዞርት',
      om: 'Rizoortii fi Galma Konfaransii',
    },
  },
  {
    id: 'sp-5',
    name: 'Woliso Town Municipality',
    tier: 'silver',
    logoPlaceholder: '[SPONSOR LOGO: Woliso Municipality]',
    sectorI18n: {
      en: 'Civic & Urban Administration',
      am: 'የከተማው መስተዳድር',
      om: 'Bulchiinsa Magaalaa Walisoo',
    },
  },
  {
    id: 'sp-6',
    name: 'Commercial Bank of Ethiopia (Woliso Branch)',
    tier: 'silver',
    logoPlaceholder: '[SPONSOR LOGO: CBE Woliso]',
    sectorI18n: {
      en: 'Financial Partner',
      am: 'የፋይናንስ አጋር',
      om: 'Tajaajila Baankii',
    },
  },
  {
    id: 'sp-7',
    name: 'South West Shewa Cultural Artisans Association',
    tier: 'partner',
    logoPlaceholder: '[SPONSOR LOGO: Artisans Association]',
    sectorI18n: {
      en: 'Traditional Handicrafts Cooperative',
      am: 'የባህላዊ እደ-ጥበብ ባለሙያዎች ማህበር',
      om: 'Waldaa Ogummaa Harkaa Aadaa',
    },
  },
  {
    id: 'sp-8',
    name: 'Ambo University Alumni Hospitality Network',
    tier: 'partner',
    logoPlaceholder: '[SPONSOR LOGO: AU Hospitality Alumni]',
    sectorI18n: {
      en: 'Academic Alumni Network',
      am: 'የቀድሞ ተማሪዎች ማህበር',
      om: 'Hawaasa Barattoota Duraanii',
    },
  },
];

export const SEED_COMMITTEE: CommitteeMember[] = [
  {
    id: 'com-1',
    nameI18n: {
      en: '[NAME: Department Head]',
      am: '[ስም፡ የትምህርት ክፍሉ ኃላፊ]',
      om: '[MAQAA: Hoogganaa Kutaa Barnootaa]',
    },
    roleI18n: {
      en: 'Chairperson, Organizing Committee',
      am: 'የአዘጋጅ ኮሚቴው ሰብሳቢ',
      om: 'Walitti Qabaa Koree Qopheessituu',
    },
    departmentI18n: {
      en: 'Department of Tourism and Hotel Management',
      am: 'የቱሪዝም እና ሆቴል ማኔጅመንት ትምህርት ክፍል',
      om: 'Kutaa Barnootaa Hoggansa Turizimii fi Hoteelaa',
    },
    photoPlaceholder: '[PHOTO: Chairperson]',
    bioI18n: {
      en: 'Overseeing event strategic vision, academic symposia, and external university partnerships.',
      am: 'የዝግጅቱን ስትራቴጂካዊ እቅድ፣ ጥናታዊ ውይይቶችንና ውጫዊ ግንኙነቶችን ይመራሉ።',
      om: 'Kallattii tarsiimoo ayyaanichaa fi walitti dhufeenya qaamolee alaa ni hoogganu.',
    },
  },
  {
    id: 'com-2',
    nameI18n: {
      en: '[NAME: Events Coordinator]',
      am: '[ስም፡ የዝግጅት አስተባባሪ]',
      om: '[MAQAA: Qindeessaa Sagantaa]',
    },
    roleI18n: {
      en: 'Lead Operations & Cultural Program Director',
      am: 'የባህል ዝግጅቶች እና ኦፕሬሽን ዳይሬክተር',
      om: 'Daarektara Sagantaa Aadaa fi Hojii Raawwachiisaa',
    },
    departmentI18n: {
      en: 'Department of Tourism and Hotel Management',
      am: 'የቱሪዝም እና ሆቴል ማኔጅመንት ትምህርት ክፍል',
      om: 'Kutaa Barnootaa Hoggansa Turizimii fi Hoteelaa',
    },
    photoPlaceholder: '[PHOTO: Operations Coordinator]',
    bioI18n: {
      en: 'Coordinating student troupes, stage logistics, dance competitions, and street parade route safety.',
      am: 'የተማሪዎችን የባህል ትዕይንቶች፣ መድረክና የጎዳና ላይ ዝግጅቶችን ያስተባብራሉ።',
      om: 'Sagantaalee aadaa barattootaa fi nageenya daandii agarsiisa aadaa ni qindeessu.',
    },
  },
  {
    id: 'com-3',
    nameI18n: {
      en: '[NAME: Community Liaison]',
      am: '[ስም፡ የማህበረሰብ ግንኙነት ኃላፊ]',
      om: '[MAQAA: Walitti Dhufeenya Hawaasaa]',
    },
    roleI18n: {
      en: 'Woliso Town & Municipal Partnership Officer',
      am: 'የወሊሶ ከተማ እና ማህበረሰብ ግንኙነት ኃላፊ',
      om: 'Itti Gaafatamaa Walitti Dhufeenya Magaalaa fi Hawaasaa',
    },
    departmentI18n: {
      en: 'Department of Tourism and Hotel Management',
      am: 'የቱሪዝም እና ሆቴል ማኔጅመንት ትምህርት ክፍል',
      om: 'Kutaa Barnootaa Hoggansa Turizimii fi Hoteelaa',
    },
    photoPlaceholder: '[PHOTO: Community Liaison]',
    bioI18n: {
      en: 'Managing volunteer mobilization for the cleaning campaign and town vendor participation.',
      am: 'የፅዳት ዘመቻውንና የከተማውን ነጋዴዎች ተሳትፎ ያስተባብራሉ።',
      om: 'Duula qulqullinaa fi hirmaannaa daldaltoota magaalaa ni qindeessu.',
    },
  },
  {
    id: 'com-4',
    nameI18n: {
      en: '[NAME: Student Affairs Representative]',
      am: '[ስም፡ የተማሪዎች ጉዳይ ተወካይ]',
      om: '[MAQAA: Bakka Bu’aa Dhimma Barattootaa]',
    },
    roleI18n: {
      en: 'Student Activities Coordinator',
      am: 'የተማሪዎች እንቅስቃሴዎች አስተባባሪ',
      om: 'Qindeessaa Sochii Barattootaa',
    },
    departmentI18n: {
      en: 'Department of Tourism and Hotel Management',
      am: 'የቱሪዝም እና ሆቴል ማኔጅመንት ትምህርት ክፍል',
      om: 'Kutaa Barnootaa Hoggansa Turizimii fi Hoteelaa',
    },
    photoPlaceholder: '[PHOTO: Student Representative]',
    bioI18n: {
      en: 'Leading student teams in the Miss and Mr. Tourism contest, debates, and friendly sporting matches.',
      am: 'የቁንጅና ውድድሩን፣ የጥያቄና መልስ ዝግጅቶችንና የስፖርት ውድድሮችን ይመራሉ።',
      om: 'Dorgommii Miss fi Mr. Turizimii fi taphoota ispoortii barattootaa ni qindeessu.',
    },
  },
];

export const SEED_FAQS: FAQ[] = [
  {
    id: 'faq-1',
    category: 'general',
    questionI18n: {
      en: 'Is there any admission fee or ticket required to attend?',
      am: 'በበዓሉ ላይ ለመገኘት የመግቢያ ክፍያ ወይም ትኬት ያስፈልጋል?',
      om: 'Hirmaachuuf kaffaltiin ykn waraqaan seensaa ni barbaachisaa? (needs native review)',
    },
    answerI18n: {
      en: 'No. All events of the 5th Annual Tourism Celebration are completely free and open to the public, students, staff, and visitors. No registration, booking, or tickets are required.',
      am: 'በፍጹም። ሁሉም የቱሪዝም ሳምንት መርሃ ግብሮች ለሕዝብ፣ ለተማሪዎች፣ ለመምህራን እና ለእንግዶች ሙሉ በሙሉ በነጻ ክፍት ናቸው። ምንም አይነት ምዝገባ ወይም ትኬት አያስፈልግም።',
      om: 'Lakkii. Sagantaaleen hundi bilisaan kan hawaasaaf banaa ta’aniidha. Kaffaltiin ykn waraqaan seensaa tokkollee hin barbaachisu.',
    },
  },
  {
    id: 'faq-2',
    category: 'venue',
    questionI18n: {
      en: 'Where are the events taking place?',
      am: 'ዝግጅቶቹ የሚካሄዱት የት ነው?',
      om: 'Sagantaaleen kun eessatti gaggeeffamu? (needs native review)',
    },
    answerI18n: {
      en: 'Activities take place across both the Ambo University Woliso Campus grounds (Grand Auditorium, Conference Hall, Sports Stadium) and prominent venues in Woliso town (Central Avenue, Cultural Square, and surrounding hot springs). Each schedule item indicates whether it is on campus or in town.',
      am: 'ዝግጅቶቹ በአምቦ ዩኒቨርሲቲ ወሊሶ ካምፓስ (ዋና አዳራሽ፣ ስታዲየም፣ ኮንፈረንስ አዳራሽ) እና በወሊሶ ከተማ ዋና አደባባዮችና ጎዳናዎች ይካሄዳሉ። በሰሌዳው ላይ የእያንዳንዱ ዝግጅት ቦታ በግልጽ ተቀምጧል።',
      om: 'Mooraa Yuunivarsiitii Amboo Kaampasii Walisoo fi Magaalaa Walisoo keessatti gaggeeffamu.',
    },
  },
  {
    id: 'faq-3',
    category: 'participation',
    questionI18n: {
      en: 'Who can take part in the Great Run and Cleaning Campaign?',
      am: 'በታላቁ ሩጫ እና በፅዳት ዘመቻው ላይ ማን መሳተፍ ይችላል?',
      om: 'Fiigicha Guddaa fi duula qulqullinaa irratti eenyutu hirmaachuu danda’a? (needs native review)',
    },
    answerI18n: {
      en: 'Everyone is warmly invited! The Cleaning Campaign on Day 1 and the Great Run on Day 3 welcome university members, local townspeople, community elders, youth groups, and domestic visitors alike.',
      am: 'ማንኛውም ሰው በደስታ መሳተፍ ይችላል! በቀን 1 የሚካሄደው የፅዳት ዘመቻና በቀን 3 የሚካሄደው ታላቅ ሩጫ ለሁሉም የከተማው ነዋሪዎችና እንግዶች ክፍት ናቸው።',
      om: 'Namni fedhii qabu hundi hirmaachuu danda’a. Barattoota, barsiisota fi jiraattota magaalaa hundaa kan afeeramaniidha.',
    },
  },
  {
    id: 'faq-4',
    category: 'schedule',
    questionI18n: {
      en: 'How do the Ethiopian and Gregorian dates match?',
      am: 'የኢትዮጵያ እና የፈረንጆች (ጎርጎሪያን) ቀኖች እንዴት ይዛመዳሉ?',
      om: 'Guyyoonni Lakkoofsa Itoophiyaa fi Awurooppaa akkamitti wal-fakkaatu? (needs native review)',
    },
    answerI18n: {
      en: 'The celebration takes place Megabit 29 to Miyazya 03, 2017 in the Ethiopian Calendar (E.C.), which corresponds to April 7 through April 11, 2025 in the Gregorian Calendar (G.C.). Both date formats are displayed side-by-side across the schedule.',
      am: 'ክብረ በዓሉ ከመጋቢት 29 እስከ ሚያዝያ 03 ቀን 2017 ዓ.ም የሚከበር ሲሆን ይህም በፈረንጆች አቆጣጠር ከኤፕሪል 7 እስከ ኤፕሪል 11 ቀን 2025 እ.ኤ.አ ጋር ይጣጣማል። በጣቢያው ላይ ሁለቱም አቆጣጠሮች ተቀምጠዋል።',
      om: 'Ayyaanichi Bitootessa 29 hanga Ebla 03, 2017 A.L.I (Ebla 7 hanga 11, 2025 G.C.)tti gaggeeffama.',
    },
  },
];

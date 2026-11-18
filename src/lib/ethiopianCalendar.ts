import { Language } from '../types';

export interface EthiopianDate {
  year: number;
  month: number; // 1 to 13
  day: number;
}

export const ETHIOPIAN_MONTHS: Record<
  number,
  { en: string; am: string; om: string }
> = {
  1: { en: 'Meskerem', am: 'መስከረም', om: 'Fulbaana' },
  2: { en: 'Tikimt', am: 'ጥቅምት', om: 'Onkololeessa' },
  3: { en: 'Hidar', am: 'ኅዳር', om: 'Sadaasa' },
  4: { en: 'Tahsas', am: 'ታኅሣሥ', om: 'Muddee' },
  5: { en: 'Tir', am: 'ጥር', om: 'Amajjii' },
  6: { en: 'Yakatit', am: 'የካቲት', om: 'Guraandhala' },
  7: { en: 'Megabit', am: 'መጋቢት', om: 'Bitootessa' },
  8: { en: 'Miyazya', am: 'ሚያዝያ', om: 'Ebla' },
  9: { en: 'Ginbot', am: 'ግንቦት', om: 'Caamsaa' },
  10: { en: 'Sene', am: 'ሰኔ', om: 'Waxabajjii' },
  11: { en: 'Hamle', am: 'ሐምሌ', om: 'Adooleessa' },
  12: { en: 'Nehase', am: 'ነሐሴ', om: 'Hagayya' },
  13: { en: 'Pagume', am: 'ጳጉሜ', om: 'Qaammee' },
};

export const WEEKDAYS: Record<
  number,
  { en: string; am: string; om: string; shortEn: string; shortAm: string; shortOm: string }
> = {
  1: { en: 'Monday', am: 'ሰኞ', om: 'Wiixata', shortEn: 'Mon', shortAm: 'ሰኞ', shortOm: 'Wii' },
  2: { en: 'Tuesday', am: 'ማክሰኞ', om: 'Kibxata', shortEn: 'Tue', shortAm: 'ማክ', shortOm: 'Kib' },
  3: { en: 'Wednesday', am: 'ረቡዕ', om: 'Roobii', shortEn: 'Wed', shortAm: 'ረቡ', shortOm: 'Roo' },
  4: { en: 'Thursday', am: 'ሐሙስ', om: 'Kamisa', shortEn: 'Thu', shortAm: 'ሐሙ', shortOm: 'Kam' },
  5: { en: 'Friday', am: 'አርብ', om: 'Jimmata', shortEn: 'Fri', shortAm: 'አር', shortOm: 'Jim' },
  6: { en: 'Saturday', am: 'ቅዳሜ', om: 'Sanbata Duraa', shortEn: 'Sat', shortAm: 'ቅዳ', shortOm: 'San' },
  0: { en: 'Sunday', am: 'እሑድ', om: 'Dilbata', shortEn: 'Sun', shortAm: 'እሑ', shortOm: 'Dil' },
};

/**
 * Parses an Ethiopian date string formatted as DD/MM/YYYY into day, month, year.
 */
export function parseECDateString(ecString: string): EthiopianDate {
  const parts = ecString.split(/[/.-]/).map((p) => parseInt(p, 10));
  if (parts.length >= 3) {
    return { day: parts[0], month: parts[1], year: parts[2] };
  }
  return { day: 1, month: 7, year: 2017 };
}

/**
 * Returns formatted dual date string (Ethiopian Calendar + Gregorian Calendar)
 * e.g., "Megabit 29, 2017 E.C. (April 7, 2025)"
 */
export function formatDualDate(
  ecDate: string, // "29/07/2017"
  gcDate: string, // "2025-04-07"
  lang: Language = 'en'
): string {
  const { day, month, year } = parseECDateString(ecDate);
  const monthData = ETHIOPIAN_MONTHS[month] || ETHIOPIAN_MONTHS[7];
  const monthName = monthData[lang];

  const gcParts = gcDate.split('-');
  const gcYear = gcParts[0];
  const gcMonthNum = parseInt(gcParts[1] || '4', 10);
  const gcDayNum = parseInt(gcParts[2] || '7', 10);

  const gcMonthNames: Record<string, string[]> = {
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    am: ['ጃንዩ', 'ፌብሩ', 'ማርች', 'ኤፕሪል', 'ሜይ', 'ጁን', 'ጁላይ', 'ኦገስት', 'ሴፕቴ', 'ኦክቶ', 'ኖቬም', 'ዲሴም'],
    om: ['Ama', 'Gur', 'Bit', 'Ebl', 'Caa', 'Wax', 'Ado', 'Hag', 'Ful', 'Onk', 'Sad', 'Mud'],
  };

  const gcMonth = gcMonthNames[lang]?.[gcMonthNum - 1] || gcMonthNames['en'][gcMonthNum - 1];

  if (lang === 'am') {
    return `${monthName} ${day} ቀን ${year} ዓ.ም (${gcMonth} ${gcDayNum}፣ ${gcYear} እ.ኤ.አ)`;
  }
  if (lang === 'om') {
    return `${monthName} ${day}, ${year} A.L.I (${gcMonth} ${gcDayNum}, ${gcYear} G.C.)`;
  }
  return `${monthName} ${day}, ${year} E.C. (${gcMonth} ${gcDayNum}, ${gcYear} G.C.)`;
}

/**
 * Format only the Ethiopian calendar date with suffix
 */
export function formatECDate(ecDate: string, lang: Language = 'en'): string {
  const { day, month, year } = parseECDateString(ecDate);
  const monthName = (ETHIOPIAN_MONTHS[month] || ETHIOPIAN_MONTHS[7])[lang];

  if (lang === 'am') {
    return `${monthName} ${day} ቀን ${year} ዓ.ም`;
  }
  if (lang === 'om') {
    return `${monthName} ${day}, ${year} A.L.I`;
  }
  return `${monthName} ${day}, ${year} E.C.`;
}

/**
 * editionDays.ts — Derive per-day calendar metadata from an edition's
 * startDateGC / endDateGC strings.
 *
 * Rules:
 *  · Tab count = number of days between start and end (inclusive).
 *  · Dates are in the Gregorian calendar (YYYY-MM-DD).
 *  · Ethiopian Calendar (E.C.) and day-of-week strings are computed by
 *    arithmetic on the GC date — no DB column needed.
 *  · This module has zero runtime dependencies and no fetch calls.
 */

/** One day's display metadata for tab rendering. */
export interface DayMeta {
  /** 1-based day number relative to the edition start. */
  day: number;
  /** Gregorian date string (YYYY-MM-DD). */
  gc: string;
  /** Ethiopian Calendar display string (DD/MM/YYYY). */
  ec: string;
  /** Short E.C. string for tab display, e.g. "29/07". */
  ecShort: string;
  /** English day-of-week, e.g. "Monday". */
  dayOfWeek: string;
}

/**
 * Map a Gregorian date to an Ethiopian Calendar date string "DD/MM/YYYY".
 *
 * The Ethiopian calendar runs approximately 7–8 years behind the Gregorian
 * calendar.  Conversion is done via a Julian Day Number bridge.
 *
 * Returns "??" on any parse error (never throws).
 */
export function gcToEC(gcDateStr: string): string {
  try {
    const [yStr, mStr, dStr] = gcDateStr.split('-');
    const gy = parseInt(yStr, 10);
    const gm = parseInt(mStr, 10);
    const gd = parseInt(dStr, 10);

    if (isNaN(gy) || isNaN(gm) || isNaN(gd)) return '??';

    // Julian Day Number for the Gregorian date
    const a = Math.floor((14 - gm) / 12);
    const y = gy + 4800 - a;
    const m = gm + 12 * a - 3;
    const jdn =
      gd +
      Math.floor((153 * m + 2) / 5) +
      365 * y +
      Math.floor(y / 4) -
      Math.floor(y / 100) +
      Math.floor(y / 400) -
      32045;

    // Ethiopian epoch: JDN 1723856 = 1 Meskerem 1 E.C. (Gregorian-aligned)
    const r = (jdn - 1723856) % 1461;
    const n = r % 365 + 365 * Math.floor(r / 1460);
    const ey = 4 * Math.floor((jdn - 1723856) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
    const em = Math.floor(n / 30) + 1;
    const ed = n % 30 + 1;

    return `${String(ed).padStart(2, '0')}/${String(em).padStart(2, '0')}/${ey}`;
  } catch {
    return '??';
  }
}

/**
 * Build an array of DayMeta for every day in the edition range.
 *
 * @param startDateGC  YYYY-MM-DD
 * @param endDateGC    YYYY-MM-DD
 * @returns  Array with one entry per day (day 1 = startDateGC).
 *           Returns a 5-day fallback starting 2025-04-07 when either param is missing.
 */
export function buildEditionDays(
  startDateGC: string | undefined,
  endDateGC:   string | undefined,
): DayMeta[] {
  const start = startDateGC || '2025-04-07';
  const end   = endDateGC   || '2025-04-11';

  const startMs = new Date(start + 'T00:00:00Z').getTime();
  const endMs   = new Date(end   + 'T00:00:00Z').getTime();

  if (isNaN(startMs) || isNaN(endMs) || endMs < startMs) {
    // Fallback: 6 days from default start (Megabit 29 to Miyazya 04, 2017 E.C.)
    return buildEditionDays('2025-04-07', '2025-04-12');
  }

  const DAY_MS  = 86_400_000;
  const totalDays = Math.round((endMs - startMs) / DAY_MS) + 1;
  const days: DayMeta[] = [];

  for (let i = 0; i < totalDays; i++) {
    const ms = startMs + i * DAY_MS;
    const date = new Date(ms);
    const gc = date.toISOString().split('T')[0];
    const ec = gcToEC(gc);
    days.push({
      day: i + 1,
      gc,
      ec,
      ecShort: ec.substring(0, 5),
      dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
    });
  }

  return days;
}

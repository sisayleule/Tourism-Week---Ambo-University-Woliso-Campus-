/**
 * icsGenerator.ts — iCalendar (.ics) export.
 *
 * Rules enforced here:
 *  · Dates are derived from the edition startDateGC + (day - 1) day offset.
 *    No hard-coded date map — works for any number of days.
 *  · Timezone: Africa/Addis_Ababa (UTC+3, no DST).  VTIMEZONE block included
 *    so the calendar app displays the correct local time everywhere.
 *  · Timed event: when startTime is present (HH:MM or HH:MM:SS).
 *    DTSTART/DTEND are expressed as local floating time with TZID.
 *    endTime is used when present; otherwise the duration is 1 hour for
 *    morning and 2 hours for afternoon/evening (reasonable defaults).
 *  · All-day event: when startTime is absent, DTSTART;VALUE=DATE is used
 *    and the description notes the session (morning/afternoon/evening).
 *    No invented times — spec requirement.
 *  · X-WR-TIMEZONE header so Apple Calendar picks up the zone.
 */

import { EventItem } from '../types';

// ─── Fallback edition start date ─────────────────────────────────────────────
const DEFAULT_START = '2025-04-07';

// ─── VTIMEZONE for Africa/Addis_Ababa (UTC+3, no DST) ───────────────────────
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Africa/Addis_Ababa',
  'X-LIC-LOCATION:Africa/Addis_Ababa',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0300',
  'TZOFFSETTO:+0300',
  'TZNAME:EAT',
  'DTSTART:19700101T000000',
  'END:STANDARD',
  'END:VTIMEZONE',
].join('\r\n');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/**
 * Returns the Gregorian date string (YYYY-MM-DD) for a given day number
 * relative to the edition start date.
 */
function dayToGCDate(day: number, startDateGC: string): string {
  try {
    const startMs = new Date(startDateGC + 'T00:00:00Z').getTime();
    const ms      = startMs + (day - 1) * 86_400_000;
    return new Date(ms).toISOString().split('T')[0];
  } catch {
    return DEFAULT_START;
  }
}

/**
 * Parse a time string like "08:30", "14:00:00" into { h, m, s }.
 * Returns null when unparseable.
 */
function parseTime(timeStr: string): { h: number; m: number; s: number } | null {
  const parts = timeStr.split(':').map((p) => parseInt(p, 10));
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  return { h: parts[0], m: parts[1], s: parts[2] ?? 0 };
}

/**
 * Format a local floating-time string for iCal (no Z suffix — TZID carries
 * the timezone).  e.g. "20250407T083000"
 */
function localTimeStr(dateStr: string, h: number, m: number, s: number): string {
  return `${dateStr.replace(/-/g, '')}T${pad(h)}${pad(m)}${pad(s)}`;
}

/**
 * Default end-time offset in minutes when endTime is absent.
 * Morning sessions: 4 hours (typical half-day).
 * Afternoon/Evening sessions: 2 hours.
 */
function defaultDurationMinutes(session: string): number {
  return session === 'morning' ? 240 : 120;
}

/** Fold iCal lines longer than 75 octets (RFC 5545 §3.1). */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let pos = 0;
  while (pos < line.length) {
    if (pos === 0) {
      chunks.push(line.slice(0, 75));
      pos = 75;
    } else {
      chunks.push(' ' + line.slice(pos, pos + 74));
      pos += 74;
    }
  }
  return chunks.join('\r\n');
}

/** Escape special characters in iCal TEXT values (RFC 5545 §3.3.11). */
function escapeText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Generate an iCalendar string for one or many events.
 *
 * @param events        Array of EventItem (from live data — never from seed).
 * @param calendarName  VCALENDAR display name.
 * @param startDateGC   Edition start date (YYYY-MM-DD).  Used to compute the
 *                      Gregorian date for each day number.  When absent the
 *                      function falls back to 2025-04-07 (original edition).
 */
export function generateICS(
  events: EventItem[],
  calendarName = 'Woliso Tourism Week',
  startDateGC?: string | null,
): string {
  const editionStart = startDateGC || DEFAULT_START;
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ambo University Woliso Campus//Tourism Week//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${escapeText(calendarName)}`),
    'X-WR-TIMEZONE:Africa/Addis_Ababa',
    VTIMEZONE,
  ];

  for (const evt of events) {
    const dateStr = dayToGCDate(evt.day, editionStart); // e.g. "2025-04-07"

    lines.push('BEGIN:VEVENT');
    lines.push(foldLine(`UID:tw-${evt.id}@ambou.edu.et`));
    lines.push(`DTSTAMP:${dtstamp}`);

    const startT = evt.startTime ? parseTime(evt.startTime) : null;

    if (startT) {
      // ── Timed event ──────────────────────────────────────────────────────
      const dtStart = localTimeStr(dateStr, startT.h, startT.m, startT.s);
      lines.push(foldLine(`DTSTART;TZID=Africa/Addis_Ababa:${dtStart}`));

      // End time: use endTime if set, else add default duration
      let endH = startT.h;
      let endM = startT.m;
      let endS = startT.s;
      if (evt.endTime) {
        const endT = parseTime(evt.endTime);
        if (endT) { endH = endT.h; endM = endT.m; endS = endT.s; }
      } else {
        const totalMinutes = startT.h * 60 + startT.m + defaultDurationMinutes(evt.session);
        endH = Math.floor(totalMinutes / 60) % 24;
        endM = totalMinutes % 60;
        endS = 0;
      }
      const dtEnd = localTimeStr(dateStr, endH, endM, endS);
      lines.push(foldLine(`DTEND;TZID=Africa/Addis_Ababa:${dtEnd}`));
    } else {
      // ── All-day event (no startTime) ─────────────────────────────────────
      const dateCompact = dateStr.replace(/-/g, ''); // "20250407"
      lines.push(`DTSTART;VALUE=DATE:${dateCompact}`);
      // DTEND for all-day = next day (RFC 5545 convention)
      const endMs  = new Date(dateStr + 'T00:00:00Z').getTime() + 86_400_000;
      const endStr = new Date(endMs).toISOString().split('T')[0].replace(/-/g, '');
      lines.push(`DTEND;VALUE=DATE:${endStr}`);
    }

    lines.push(foldLine(`SUMMARY:${escapeText(evt.titleI18n.en)}`));

    // Description: body text + session note (all-day events include session)
    const sessionNote = startT ? '' : ` [${evt.session} session]`;
    const descBody = escapeText(evt.descriptionI18n.en.replace(/\n/g, '\\n'));
    lines.push(foldLine(`DESCRIPTION:${descBody}${sessionNote} (Category: ${escapeText(evt.category)})`));

    lines.push(foldLine(`LOCATION:${escapeText(evt.venueNameI18n.en)}`));

    // STATUS: map internal status to iCal STATUS
    const statusMap: Record<string, string> = {
      scheduled: 'CONFIRMED',
      live:      'CONFIRMED',
      delayed:   'TENTATIVE',
      cancelled: 'CANCELLED',
    };
    lines.push(`STATUS:${statusMap[evt.status] ?? 'CONFIRMED'}`);

    if (evt.status === 'cancelled') {
      lines.push('TRANSP:TRANSPARENT');
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Trigger a browser download of the generated .ics content.
 */
export function downloadICSFile(icsContent: string, filename = 'tourism-week-schedule.ics'): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

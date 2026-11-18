export type Language = 'en' | 'am' | 'om';

export interface I18nString {
  en: string;
  am: string;
  om: string; // Afaan Oromo (draft translations flagged for native review where indicated)
}

export type EditionStatus = 'upcoming' | 'live' | 'past';

export type EventCategory = 'culture' | 'sports' | 'academic' | 'competition' | 'community';

export type VenueType = 'campus' | 'town' | 'both';

export type EventSession = 'morning' | 'afternoon' | 'evening';

export type EventStatus = 'scheduled' | 'live' | 'delayed' | 'cancelled';

export interface Edition {
  id: string;
  number: number;
  editionNameI18n: I18nString;
  titleI18n: I18nString;
  themeI18n: I18nString;
  subThemeI18n?: I18nString;
  startDateEC: string; // e.g., "29/07/2017"
  endDateEC: string;   // e.g., "03/08/2017"
  dateRangeDisplayI18n: I18nString;
  startDateGC: string; // ISO string or YYYY-MM-DD
  endDateGC: string;
  status: EditionStatus;
  venueI18n: I18nString;
  hostDepartmentI18n: I18nString;
  hostUniversityI18n: I18nString;
  campusI18n: I18nString;
  stats: {
    /** Computed at runtime from the events array; null in seed so the UI derives it. */
    daysCount: number | null;
    /** Computed at runtime from the events array; null in seed so the UI derives it. */
    activitiesCount: number | null;
    /** Fill in with a real figure. While null the stat tile is hidden on the home page. */
    expectedParticipants: string | null;
    /** Fill in with a real figure. While null the stat tile is hidden on the home page. */
    exhibitorsCount: string | null;
  };
}

export interface EventItem {
  id: string;
  slug: string;
  editionId: string;
  day: number; // 1 to 5
  dayNameI18n: I18nString;
  session: EventSession;
  startTime?: string; // intentionally optional as exact hours vary
  endTime?: string;
  titleI18n: I18nString;
  descriptionI18n: I18nString;
  category: EventCategory;
  venueType: VenueType;
  venueNameI18n: I18nString;
  status: EventStatus;
  featured?: boolean;
  image?: string;
  /** Optional localised status note (e.g. "Starts 30 minutes late") shown under a Delayed badge. */
  statusNoteI18n?: I18nString;
  subEvents?: {
    titleI18n: I18nString;
    category?: EventCategory;
  }[];
}

export interface NewsItem {
  id: string;
  slug: string;
  titleI18n: I18nString;
  excerptI18n: I18nString;
  contentI18n: I18nString;
  publishedAt: string;
  publishedAtEC: string;
  categoryI18n: I18nString;
  authorI18n: I18nString;
  pinned?: boolean;
  image?: string;
}

export interface Announcement {
  id: string;
  messageI18n: I18nString;
  link?: string;
  type: 'info' | 'urgent' | 'alert';
  active: boolean;
  /** ISO timestamp — announcement is hidden before this time. Evaluated at runtime. */
  startsAt?: string;
  /** ISO timestamp — announcement is hidden after this time. Evaluated at runtime. Null = no expiry. */
  expiresAt?: string | null;
}

export interface GalleryItem {
  id: string;
  titleI18n: I18nString;
  captionI18n?: I18nString;
  year: number;
  category: EventCategory | 'highlights';
  mediaType: 'image' | 'video';
  url: string;
  thumbnail: string;
  eventSlug?: string;
}

export type SponsorTier = 'platinum' | 'gold' | 'silver' | 'partner';

export interface Sponsor {
  id: string;
  name: string;
  tier: SponsorTier;
  logoPlaceholder: string; // Clearly marked [SPONSOR LOGO] until official assets are uploaded
  sectorI18n: I18nString;
  website?: string;
}

export interface CommitteeMember {
  id: string;
  nameI18n: I18nString;
  roleI18n: I18nString;
  departmentI18n: I18nString;
  photoPlaceholder: string; // [PHOTO] when no photo; otherwise the public URL
  photo_url?: string | null; // public Storage URL — same value as photoPlaceholder when set
  bioI18n?: I18nString;
}

export interface FAQ {
  id: string;
  questionI18n: I18nString;
  answerI18n: I18nString;
  category: 'general' | 'venue' | 'participation' | 'schedule';
}

export interface ContactFormPayload {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  /** Honeypot — must be empty. Bots fill hidden fields. */
  website?: string;
  /** Form render timestamp (ms) — rejects submissions faster than 3 seconds. */
  formRenderedAt?: number;
  /** Cloudflare Turnstile token (optional, behind feature flag). */
  turnstileToken?: string;
}

export interface SponsorInquiryPayload {
  name: string;
  organization: string;
  email: string;
  phone: string;
  tierInterest: SponsorTier | 'custom';
  message: string;
  /** Honeypot — must be empty. Bots fill hidden fields. */
  website?: string;
  /** Form render timestamp (ms) — rejects submissions faster than 3 seconds. */
  formRenderedAt?: number;
  /** Cloudflare Turnstile token (optional, behind feature flag). */
  turnstileToken?: string;
}

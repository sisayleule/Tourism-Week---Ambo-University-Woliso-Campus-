/**
 * database.ts — Hand-crafted TypeScript types for the Supabase schema.
 *
 * These types mirror every table, view, enum and function defined in
 * supabase/migrations/001–009.  Keep this file in sync whenever a migration
 * adds or changes a column.
 *
 * Usage with the Supabase client:
 *   import { createClient } from '@supabase/supabase-js'
 *   import type { Database } from './types/database'
 *   const supabase = createClient<Database>(url, anonKey)
 *
 * Note: The `supabase gen types typescript` CLI can regenerate this file
 * automatically once the project is linked:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_REF \
 *     --schema public > src/types/database.ts
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Internationalised string — English is required; am/om are optional. */
export interface I18nJson {
  en: string
  am?: string
  om?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Enums  (mirror public.* enum types in the database)
// ─────────────────────────────────────────────────────────────────────────────

export type AppRole          = 'organizer' | 'admin'
export type ContentState     = 'draft'     | 'published'
export type EventStatus      = 'scheduled' | 'live' | 'delayed' | 'cancelled'
export type EventCategory    = 'culture'   | 'sports' | 'academic' | 'competition' | 'community'
export type VenueType        = 'campus'    | 'town'   | 'both'
/** Added 'evening' in migration 017. */
export type SessionType      = 'morning'   | 'afternoon' | 'evening'
export type AnnouncementType = 'normal'    | 'urgent'
export type NewsCategory     = 'department'| 'sports_community' | 'academic' | 'general'
/** Note: 'title' is the top tier (maps to what seedData.ts calls 'platinum'). */
export type SponsorTier      = 'title'     | 'gold' | 'silver' | 'partner'

/** Computed field returned by the edition_public view — not stored in editions. */
export type EditionStatus    = 'upcoming'  | 'live' | 'past'

// ─────────────────────────────────────────────────────────────────────────────
// Row types  (one interface per table, shaped for SELECT *)
// ─────────────────────────────────────────────────────────────────────────────

export interface Profile {
  id:                   string        // uuid — mirrors auth.users(id)
  full_name:            string | null
  role:                 AppRole
  is_active:            boolean
  /** Added in migration 008. True = force password change on next login. */
  must_change_password: boolean
  created_at:           string        // timestamptz returned as ISO string
  updated_at:           string
}

export interface Edition {
  id:                       string
  number:                   number
  slug:                     string
  edition_name_i18n:        I18nJson
  title_i18n:               I18nJson
  theme_i18n:               I18nJson
  sub_theme_i18n:           I18nJson | null
  venue_i18n:               I18nJson
  date_range_display_i18n:  I18nJson | null
  start_date:               string   // YYYY-MM-DD
  end_date:                 string
  start_date_ec:            string | null
  end_date_ec:              string | null
  stats:                    EditionStats | null
  is_current:               boolean
  // ── Added in migration 013 ──
  /** Short hero subtitle; falls back to sub_theme_i18n when null. */
  subtitle_i18n:            I18nJson | null
  /** Word/phrase within theme_i18n to render gold-italic per language. */
  theme_highlight_i18n:     I18nJson | null
  /** Override hero poster; null = keep application default. */
  hero_poster_url:          string | null
  /** Override hero video; null = keep application default. */
  hero_video_url:           string | null
  /** One-paragraph summary for the Past Editions Timeline. */
  summary_i18n:             I18nJson | null
  /** Cover image for the Past Editions Timeline card. */
  cover_image_url:          string | null
  /** draft = only staff visible; published = anon visible. */
  state:                    ContentState
  // ── Added in migration 017 ──
  /** Edition logo URL (site-content bucket). null = use application default. */
  logo_url:                 string | null
  /** Markdown prose for the "About this edition" section (3 languages). */
  about_i18n:               I18nJson | null
  created_at:               string
  updated_at:               string
}

// ── Added in migration 013 ────────────────────────────────────────────────────

/**
 * A named, editable section of a public page.
 * key matches a registered entry in src/lib/sectionRegistry.ts.
 */
export interface PageSection {
  id:             string
  key:            string
  title_i18n:     I18nJson | null
  subtitle_i18n:  I18nJson | null
  body_i18n:      I18nJson | null
  image_url:      string | null
  cta_label_i18n: I18nJson | null
  cta_url:        string | null
  state:          ContentState
  needs_review:   boolean
  created_at:     string
  updated_at:     string
}

/**
 * A card or chip within a page section.
 * Cascade-deleted when the parent section is deleted.
 */
export interface PageSectionItem {
  id:          string
  section_id:  string
  title_i18n:  I18nJson | null
  body_i18n:   I18nJson | null
  /** Lucide icon name (PascalCase), e.g. "Mountain", "Coffee". */
  icon:        string | null
  image_url:   string | null
  link_url:    string | null
  badge_i18n:  I18nJson | null
  sort_order:  number
  state:       ContentState
  created_at:  string
  updated_at:  string
}

export interface EditionStats {
  daysCount:             number | null
  activitiesCount:       number | null
  expectedParticipants:  string | null
  exhibitorsCount:       string | null
}

/** edition_public view — Edition + computed status field. */
export interface EditionPublic extends Edition {
  status: EditionStatus
}

export interface Event {
  id:                string
  edition_id:        string
  slug:              string
  day:               number  // 1–31 (widened from 1–7 in migration 017)
  session:           SessionType
  start_time:        string | null   // HH:MM:SS
  end_time:          string | null
  sort_order:        number
  title_i18n:        I18nJson
  description_i18n:  I18nJson | null
  venue_name_i18n:   I18nJson | null
  category:          EventCategory
  venue_type:        VenueType
  image_url:         string | null
  featured:          boolean
  status:            EventStatus
  /** Added in migration 009. Short note for Delayed/Cancelled status. Cleared when returning to Scheduled/Live. */
  status_note_i18n:  I18nJson | null
  state:             ContentState
  created_at:        string
  updated_at:        string
}

export interface Announcement {
  id:           string
  message_i18n: I18nJson
  type:         AnnouncementType
  link:         string | null
  starts_at:    string   // timestamptz
  expires_at:   string | null
  state:        ContentState
  created_at:   string
  updated_at:   string
}

export interface News {
  id:              string
  edition_id:      string | null
  slug:            string
  title_i18n:      I18nJson
  summary_i18n:    I18nJson | null
  body_i18n:       I18nJson | null
  category:        NewsCategory
  cover_image_url: string | null
  pinned:          boolean
  published_at:    string | null
  state:           ContentState
  created_at:      string
  updated_at:      string
}

export interface GalleryItem {
  id:           string
  edition_id:   string
  event_id:     string | null
  media_type:   'photo' | 'video'
  image_url:    string
  video_url:    string | null
  caption_i18n: I18nJson | null
  year:         number
  category:     EventCategory | 'highlights'
  sort_order:   number
  state:        ContentState
  created_at:   string
  updated_at:   string
}

export interface Sponsor {
  id:          string
  name:        string
  logo_url:    string | null
  website_url: string | null
  tier:        SponsorTier
  sort_order:  number
  state:       ContentState
  created_at:  string
  updated_at:  string
}

export interface CommitteeMember {
  id:         string
  full_name:  string
  role_i18n:  I18nJson
  photo_url:  string | null
  sort_order: number
  state:      ContentState
  // ── Added in migration 015 ──
  committee_key: CommitteeKey | null
  is_leader:     boolean
  edition_id:    string | null
  // ── Added in migration 017 ──
  bio_i18n:   I18nJson | null
  department: string | null
  created_at: string
  updated_at: string
}

/** The five fixed committee identifiers. Added in migration 015. */
export type CommitteeKey =
  | 'publicity_promotion'
  | 'technical_physical'
  | 'sponsorship_fundraising'
  | 'award_beauty_contest'
  | 'documentation'

/** Per-day programme metadata for an edition. Added in migration 017. */
export interface EditionDay {
  id:               string
  edition_id:       string
  day:              number       // 1–31
  title_i18n:       I18nJson | null
  description_i18n: I18nJson | null
  created_at:       string
  updated_at:       string
}

/**
 * Optional public contact details for a committee member.
 * Added in migration 017. show_public=false rows are invisible to anon.
 */
export interface CommitteeMemberContact {
  member_id:   string   // uuid PK = FK to committee_members
  email:       string | null
  phone:       string | null
  telegram:    string | null
  show_public: boolean
  created_at:  string
  updated_at:  string
}

/** Return type of publish_edition() RPC. Added in migration 017. */
export interface PublishEditionResult {
  edition_id:        string
  is_current:        boolean
  published_events:  number
  published_days:    number
  published_members: number
  days_in_edition:   number
  warnings:          string[]
}

export interface Faq {
  id:           string
  question_i18n: I18nJson
  answer_i18n:   I18nJson
  sort_order:    number
  state:         ContentState
  created_at:    string
  updated_at:    string
}

export interface Message {
  id:           number   // bigint identity
  kind:         'contact' | 'sponsor_inquiry'
  name:         string
  organisation: string | null
  email:        string
  phone:        string | null
  message:      string
  handled:      boolean
  handled_by:   string | null   // uuid → profile id
  handled_at:   string | null
  created_at:   string
}

/** Insert shape for Message — omits server-generated fields. */
export interface MessageInsert {
  kind:         'contact' | 'sponsor_inquiry'
  name:         string
  organisation?: string
  email:        string
  phone?:       string
  message:      string
}

export interface SiteSettings {
  id:               true          // boolean PK, always true
  contact_email:    string | null
  phone:            string | null
  address_i18n:     I18nJson | null
  social:           Record<string, string> | null
  footer_text_i18n: I18nJson | null
  created_at:       string
  updated_at:       string
}

export interface ActivityLog {
  id:         number   // bigint identity
  actor_id:   string | null   // uuid → profile id; null = system
  action:     'INSERT' | 'UPDATE' | 'DELETE'
  table_name: string
  row_id:     string
  old_data:   Record<string, unknown> | null
  new_data:   Record<string, unknown> | null
  created_at: string
}

/** Added in migration 011 — rate-limit log for public form submissions. */
export interface MessageRateLimit {
  id:          number   // bigint identity
  ip_hash:     string
  kind:        'contact' | 'sponsor_inquiry'
  created_at:  string
}

/** Added in migration 011 — single-row table for the publishing pipeline. */
export interface SiteState {
  id:                       true          // boolean PK, always true
  last_change_at:           string        // timestamptz — set by content triggers
  last_deploy_requested_at: string | null // timestamptz — set by trigger-deploy function
  /** Added in migration 012 — set by the admin Backup page after a ZIP download. */
  last_backup_at:           string | null // timestamptz
  created_at:               string
  updated_at:               string
}

// ─────────────────────────────────────────────────────────────────────────────
// Database interface  (used to type the Supabase client)
// ─────────────────────────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row:    Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Pick<Profile, 'full_name' | 'must_change_password'>>
      }
      editions: {
        Row:    Edition
        Insert: Omit<Edition, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Edition, 'id' | 'created_at' | 'updated_at'>>
      }
      events: {
        Row:    Event
        Insert: Omit<Event, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Event, 'id' | 'created_at' | 'updated_at'>>
      }
      announcements: {
        Row:    Announcement
        Insert: Omit<Announcement, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Announcement, 'id' | 'created_at' | 'updated_at'>>
      }
      news: {
        Row:    News
        Insert: Omit<News, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<News, 'id' | 'created_at' | 'updated_at'>>
      }
      gallery_items: {
        Row:    GalleryItem
        Insert: Omit<GalleryItem, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<GalleryItem, 'id' | 'created_at' | 'updated_at'>>
      }
      sponsors: {
        Row:    Sponsor
        Insert: Omit<Sponsor, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Sponsor, 'id' | 'created_at' | 'updated_at'>>
      }
      committee_members: {
        Row:    CommitteeMember
        Insert: Omit<CommitteeMember, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CommitteeMember, 'id' | 'created_at' | 'updated_at'>>
      }
      faqs: {
        Row:    Faq
        Insert: Omit<Faq, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Faq, 'id' | 'created_at' | 'updated_at'>>
      }
      messages: {
        Row:    Message
        Insert: MessageInsert
        Update: Pick<Message, 'handled' | 'handled_by' | 'handled_at'>
      }
      site_settings: {
        Row:    SiteSettings
        Insert: Omit<SiteSettings, 'created_at' | 'updated_at'>
        Update: Partial<Omit<SiteSettings, 'id' | 'created_at' | 'updated_at'>>
      }
      activity_log: {
        Row:    ActivityLog
        Insert: never   // written only by the log_activity() trigger
        Update: never   // immutable
      }
      // Added in migration 011
      message_rate_limits: {
        Row:    MessageRateLimit
        Insert: Omit<MessageRateLimit, 'id'>
        Update: never   // immutable rate-limit log
      }
      site_state: {
        Row:    SiteState
        Insert: never   // written only by triggers / service role
        Update: never   // written only by triggers / service role
      }
      // Added in migration 013
      page_sections: {
        Row:    PageSection
        Insert: Omit<PageSection, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<PageSection, 'id' | 'created_at' | 'updated_at'>>
      }
      page_section_items: {
        Row:    PageSectionItem
        Insert: Omit<PageSectionItem, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<PageSectionItem, 'id' | 'created_at' | 'updated_at'>>
      }
      // Added in migration 017
      edition_days: {
        Row:    EditionDay
        Insert: Omit<EditionDay, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<EditionDay, 'id' | 'created_at' | 'updated_at'>>
      }
      committee_member_contacts: {
        Row:    CommitteeMemberContact
        Insert: Omit<CommitteeMemberContact, 'created_at' | 'updated_at'>
        Update: Partial<Omit<CommitteeMemberContact, 'member_id' | 'created_at' | 'updated_at'>>
      }
    }
    Views: {
      edition_public: {
        Row: EditionPublic
      }
    }
    Functions: {
      is_staff: {
        Args:    Record<string, never>
        Returns: boolean
      }
      is_admin: {
        Args:    Record<string, never>
        Returns: boolean
      }
      // Added in migration 012 — admin tools
      set_current_edition: {
        Args:    { p_edition_id: string }
        Returns: void
      }
      create_edition_from_template: {
        Args: {
          p_source:      string
          p_number:      number
          p_slug:        string
          p_title_i18n:  I18nJson
          p_theme_i18n:  I18nJson
          p_venue_i18n:  I18nJson
          p_start:       string
          p_end:         string
        }
        Returns: { new_edition_id: string; copied: number; skipped: number }
      }
      restore_log_entry: {
        Args:    { p_log_id: number }
        Returns: { success: boolean; message: string }
      }
      purge_activity_log: {
        Args:    { p_older_than_days: number }
        Returns: { deleted: number }
      }
      set_last_backup_at: {
        Args:    Record<string, never>
        Returns: void
      }
    }
    Enums: {
      app_role:          AppRole
      content_state:     ContentState
      event_status:      EventStatus
      event_category:    EventCategory
      venue_type:        VenueType
      session_type:      SessionType
      announcement_type: AnnouncementType
      news_category:     NewsCategory
      sponsor_tier:      SponsorTier
    }
  }
}

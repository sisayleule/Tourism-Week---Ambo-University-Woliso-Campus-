# Content Map — Ambo University Woliso Campus Tourism Week

> **Phase 6B** — Every piece of public text, number, link, and image is listed here with its database source, portal screen, public URL, and update speed.
>
> UI-only elements (navigation labels, button labels, form placeholders, legal pages) are intentionally **not** listed — they remain in code and do not need a database entry.

---

## Table of Contents

1. [How to read this table](#1-how-to-read-this-table)
2. [Edition-level content](#2-edition-level-content)
3. [Home page sections](#3-home-page-sections)
4. [About page sections](#4-about-page-sections)
5. [Sponsors page](#5-sponsors-page)
6. [Contact page](#6-contact-page)
7. [News, Gallery, Events, Sponsors, Committee, FAQs](#7-news-gallery-events-sponsors-committee-faqs)
8. [Unverified facts requiring department confirmation](#8-unverified-facts-requiring-department-confirmation)
9. [What stays in code (UI-only)](#9-what-stays-in-code-ui-only)

---

## 1. How to read this table

| Column | Meaning |
|--------|---------|
| **Element** | What appears on the public site |
| **Table · key** | Database table and column (or `page_sections.key` for section rows) |
| **Portal screen** | URL where staff or admins can edit it |
| **Public URL · anchor** | Where it appears on the public site |
| **Update speed** | How quickly a change reaches the public: *Live* = instant via Edge Function, *Next sync* = after next website update (≤ 90 s after save) |
| **Who edits** | Organizer (staff portal) or Admin only |

---

## 2. Edition-level content

These fields live on the `editions` table row with `is_current = true` and are exposed via the `edition_public` view.

| Element | Table · key | Portal screen | Public URL · anchor | Update speed | Who edits |
|---------|-------------|---------------|---------------------|--------------|-----------|
| Edition overline (e.g. "5th Annual Tourism Celebration") | `editions.edition_name_i18n` | `/admin/editions` → Edit | `/` (hero overline) | Next sync | Organizer |
| Hero headline / theme | `editions.theme_i18n` | `/admin/editions` → Edit | `/` (hero H1) | Next sync | Organizer |
| Hero highlight word (gold italic) | `editions.theme_highlight_i18n` | `/admin/editions` → Edit | `/` (hero H1) | Next sync | Organizer |
| Hero subtitle / sub-theme | `editions.subtitle_i18n` | `/admin/editions` → Edit | `/` (hero subtitle) | Next sync | Organizer |
| Hero sub-theme (longer version) | `editions.sub_theme_i18n` | `/admin/editions` → Edit | `/` (hero subtitle fallback) | Next sync | Organizer |
| Venue chip | `editions.venue_i18n` | `/admin/editions` → Edit | `/` (hero venue chip) | Next sync | Organizer |
| Start date (countdown target) | `editions.start_date` | `/admin/editions` → Edit | `/` (countdown) | Next sync | Organizer |
| End date | `editions.end_date` | `/admin/editions` → Edit | `/` (edition status) | Next sync | Organizer |
| Ethiopian dates (display only) | `editions.start_date_ec` / `end_date_ec` | `/admin/editions` → Edit | `/` (date range display) | Next sync | Organizer |
| Date range display string | `editions.date_range_display_i18n` | `/admin/editions` → Edit | `/` (stats band sub-label) | Next sync | Organizer |
| Expected participants stat | `editions.stats.expectedParticipants` | `/admin/editions` → Edit | `/` (stats band) | Next sync | Organizer |
| Exhibitors count stat | `editions.stats.exhibitorsCount` | `/admin/editions` → Edit | `/` (stats band) | Next sync | Organizer |
| Hero poster image (override) | `editions.hero_poster_url` | `/admin/editions` → Edit | `/` (hero background) | Next sync | Organizer |
| Hero video (override) | `editions.hero_video_url` | `/admin/editions` → Edit | `/` (hero background) | Next sync | Organizer |
| Cover image (timeline) | `editions.cover_image_url` | `/admin/editions` → Edit | `/about#past-editions` | Next sync | Organizer |
| Past edition summary | `editions.summary_i18n` | `/admin/editions` → Edit | `/about#past-editions` | Next sync | Organizer |
| Edition visibility | `editions.state` | `/admin/editions` → Edit | Public = published only | Next sync | Organizer |
| `<title>` / meta description | `editions.theme_i18n` + `subtitle_i18n` | `/admin/editions` → Edit | HTML `<head>` | Next sync | Organizer |
| `og:title` / `og:description` share tags | `editions.theme_i18n` | `/admin/editions` → Edit | HTML `<head>` | Next sync | Organizer |

---

## 3. Home page sections

Each row in `page_sections` with the given key controls a named section of the home page.  
**Portal screen (staff):** `/staff/site/<key>`  
**Portal screen (admin):** `/admin/content/site/<key>`

| Element | Table · key | Public URL · anchor | Update speed | Who edits | Fallback |
|---------|-------------|---------------------|--------------|-----------|---------|
| Featured Wonders chips | `page_sections` key `home.hero` + items | `/#hero` | Next sync | Organizer | Built-in list (Lalibela, Aksum, Simien Mts., Wonchi Lake) |
| "Top Festival Highlights" heading | `page_sections` key `home.highlights` | `/#below-hero` | Next sync | Organizer | Hard-coded default |
| Highlights subtitle ("Cultural pageantry…") | `page_sections` key `home.highlights` (`subtitle_i18n`) | `/#below-hero` | Next sync | Organizer | Hard-coded default |
| "Select a Day to Preview Sessions" heading | `page_sections` key `home.itinerary` | `/#schedule-preview` | Next sync | Organizer | Hard-coded default |
| "Explore Woliso…" section heading | `page_sections` key `home.explore` | `/#explore-woliso` | Next sync | Organizer | Hard-coded default |
| Explore Woliso intro paragraph | `page_sections` key `home.explore` (`subtitle_i18n`) | `/#explore-woliso` | Next sync | Organizer | Hard-coded default |
| Wonchi card (title, description, badge, icon) | `page_sections` key `home.explore` items[0] | `/#explore-woliso` | Next sync | Organizer | Hard-coded card |
| Woliso Hot Springs card (title, description, badge, icon) | `page_sections` key `home.explore` items[1] | `/#explore-woliso` | Next sync | Organizer | Hard-coded card |
| "The Guiding Philosophy" overline | `page_sections` key `home.philosophy` (`title_i18n`) | `/#guiding-philosophy` | Next sync | Organizer | Hard-coded default |
| Philosophy dept. description paragraph | `page_sections` key `home.philosophy` (`subtitle_i18n`) | `/#guiding-philosophy` | Next sync | Organizer | Hard-coded default |
| Virtue grid cards (Peace & Unity, Eco-Conservation, Academic Rigor, Cultural Pride) | `page_sections` key `home.philosophy` items | `/#guiding-philosophy` | Next sync | Organizer | Hard-coded 4 cards |
| "Celebration Media Gallery" heading | `page_sections` key `home.gallery` | `/#gallery` | Next sync | Organizer | Hard-coded default |
| Gallery subtitle | `page_sections` key `home.gallery` (`subtitle_i18n`) | `/#gallery` | Next sync | Organizer | Hard-coded default |
| "Latest News & Notices" heading | `page_sections` key `home.news` | `/#news` | Next sync | Organizer | Hard-coded default |
| News overline ("Campus Bulletins") | `page_sections` key `home.news` (`subtitle_i18n`) | `/#news` | Next sync | Organizer | Hard-coded default |
| CTA headline | `page_sections` key `home.cta` (`title_i18n`) | `/#cta` | Next sync | Organizer | i18n key `cta.chip` |
| CTA main heading | `page_sections` key `home.cta` (`subtitle_i18n`) | `/#cta` | Next sync | Organizer | i18n key `cta.headline` |
| CTA body paragraph | `page_sections` key `home.cta` (`body_i18n`) | `/#cta` | Next sync | Organizer | i18n key `cta.body` |
| CTA button label | `page_sections` key `home.cta` (`cta_label_i18n`) | `/#cta` | Next sync | Organizer | i18n key `cta.primaryBtn` |
| CTA button URL | `page_sections` key `home.cta` (`cta_url`) | `/#cta` | Next sync | Organizer | `/schedule` |

---

## 4. About page sections

| Element | Table · key | Public URL · anchor | Update speed | Who edits | Fallback |
|---------|-------------|---------------------|--------------|-----------|---------|
| Dept. intro heading | `page_sections` key `about.intro` (`title_i18n`) | `/about#intro` | Next sync | Organizer | Hard-coded default |
| Dept. intro first paragraph | `page_sections` key `about.intro` (`subtitle_i18n`) | `/about#intro` | Next sync | Organizer | Hard-coded default |
| Dept. intro second paragraph | `page_sections` key `about.intro` (`body_i18n`) | `/about#intro` | Next sync | Organizer | Hard-coded default |
| Dept. stat cards (Rigorous Curriculum etc.) | `page_sections` key `about.intro` items | `/about#intro` | Next sync | Organizer | Hard-coded 4 cards |
| "Heritage & Precedents" badge | `page_sections` key `about.heritage` (`subtitle_i18n`) | `/about#past-editions` | Next sync | Organizer | Hard-coded default |
| "Past Editions Timeline" heading | `page_sections` key `about.heritage` (`title_i18n`) | `/about#past-editions` | Next sync | Organizer | i18n key `about.historyTitle` |
| Past editions data (all cards) | `editions` table (published, status=past, newest first) | `/about#past-editions` | Next sync | Organizer | Hidden when empty |

---

## 5. Sponsors page

| Element | Table · key | Public URL · anchor | Update speed | Who edits | Fallback |
|---------|-------------|---------------------|--------------|-----------|---------|
| "Institutional Alliances" badge | `page_sections` key `sponsors.intro` (`title_i18n`) | `/sponsors#intro` | Next sync | Organizer | Hard-coded default |
| "Become a Sponsor" page heading | `page_sections` key `sponsors.intro` (`subtitle_i18n`) | `/sponsors#intro` | Next sync | Organizer | i18n key `sponsors.becomeSponsorTitle` |
| Sponsors intro body | `page_sections` key `sponsors.intro` (`body_i18n`) | `/sponsors#intro` | Next sync | Organizer | Hard-coded default |
| Individual sponsors (name, logo, tier) | `sponsors` table | `/staff/sponsors` or `/admin/content/sponsors` | Next sync | Organizer | Hidden when empty |

---

## 6. Contact page

| Element | Table · key | Public URL · anchor | Update speed | Who edits | Fallback |
|---------|-------------|---------------------|--------------|-----------|---------|
| "Secretariat & Inquiries" badge | `page_sections` key `contact.intro` (`title_i18n`) | `/contact#intro` | Next sync | Organizer | Hard-coded default |
| "Department Office & Secretariat" sub-label | `page_sections` key `contact.intro` (`subtitle_i18n`) | `/contact#intro` | Next sync | Organizer | Hard-coded default |
| Contact intro body | `page_sections` key `contact.intro` (`body_i18n`) | `/contact#intro` | Next sync | Organizer | Hard-coded default |
| Contact email | `site_settings.contact_email` | `/admin/settings` | Next sync | Admin only | Hard-coded literal |
| Phone number | `site_settings.phone` | `/admin/settings` | Next sync | Admin only | Hidden when null |
| FAQs | `faqs` table | `/staff/committee` or `/admin/content/committee` | Next sync | Organizer | Hidden when empty |

---

## 7. News, Gallery, Events, Sponsors, Committee, FAQs

These sections are fully DB-driven (Phase 5). The content map below confirms the portal URL for each.

| Content | Table | Portal screen | Public URL | Update speed |
|---------|-------|---------------|------------|--------------|
| News articles | `news` | `/staff/news` or `/admin/content/news` | `/news` and `/news/<slug>` | Next sync |
| Gallery items | `gallery_items` | `/staff/gallery` or `/admin/content/gallery` | `/gallery` and home gallery strip | Next sync |
| Event programme | `events` | `/staff/events` or `/admin/content/events` | `/schedule`, `/events`, `/events/<slug>` | Next sync (status = Live) |
| Event live status | `events.status` | `/staff/live` or `/admin/content/live` | Live immediately (no rebuild needed) | Live |
| Sponsors | `sponsors` | `/staff/sponsors` or `/admin/content/sponsors` | `/sponsors` and home sponsors strip | Next sync |
| Committee members | `committee_members` | `/staff/committee` or `/admin/content/committee` | `/about` | Next sync |
| FAQs | `faqs` | `/staff/committee` (FAQ tab) or admin equivalent | `/contact` | Next sync |
| Announcements | `announcements` | `/staff/announcements` or `/admin/content/announcements` | Site-wide banner | Live |

---

## 8. Unverified facts requiring department confirmation

The following values were seeded from hard-coded text in the codebase. The department should verify each before publishing.

| # | Value | Location in seed | Notes |
|---|-------|-----------------|-------|
| 1 | "32 km from Woliso" | `page_section_items` (home.explore card 1 badge) | Distance from Woliso town centre to Wonchi Crater Lake entrance |
| 2 | "UN Tourism Best Tourism Villages" award claim | `page_section_items` (home.explore card 1 body) | Confirm Wonchi holds this designation |
| 3 | "2,000+" expected participants | `editions.stats.expectedParticipants` | Confirm target attendance for 5th edition |
| 4 | "30+" artisan exhibitors | `editions.stats.exhibitorsCount` | Confirm exhibitor count |
| 5 | "Established 1947" | `page_section_items` (about.intro — hard-coded in JSX) | Confirm founding year of Ambo University Woliso Campus |
| 6 | 1st edition theme & impact | `editions` row slug `1st-annual-2013-ec` | Taken verbatim from About.tsx — confirm accuracy |
| 7 | 2nd edition theme & impact | `editions` row slug `2nd-annual-2014-ec` | Taken verbatim from About.tsx — confirm accuracy |
| 8 | 3rd edition theme & impact | `editions` row slug `3rd-annual-2015-ec` | "municipal community cleaning campaigns and eco-lodge symposium" — confirm |
| 9 | 4th edition "Over 3,500 participants" | `editions` row slug `4th-annual-2016-ec` | Confirm exact attendance figure |
| 10 | Approximate dates for editions 1–4 | `editions.start_date` / `end_date` | Placeholder dates used (April 1–5 of each year); replace with real EC/GC dates |

To correct any of these:
- For page section text: edit via the portal at `/staff/site/<key>` or `/admin/content/site/<key>`.
- For edition data: edit via `/admin/editions` → Edit.
- Once corrected, `needs_review` is automatically cleared when you save via the portal.

---

## 9. What stays in code (UI-only)

The following elements are intentionally NOT in the database and do not need a portal entry:

- Navigation link labels (`Schedule`, `Events`, `Gallery`, `News`, `About`, `Sponsors`, `Contact`)
- Button labels (`Publish`, `Save draft`, `Add to Calendar`, `Details →`, `Full Schedule →`, etc.)
- Form labels, field hints, error messages (contact and sponsor forms)
- Status badges for events (`Scheduled`, `Live`, `Delayed`, `Cancelled`)
- Countdown unit labels (`Days`, `Hours`, `Minutes`, `Seconds`)
- Video play/pause controls
- Footer copyright symbol and language switcher
- Legal pages (Terms & Privacy Notice)
- 404 page copy
- Day number labels in the schedule explorer (Day 1, Day 2, etc.)
- Portal UI copy (admin/organizer portal labels, tooltips, confirmations)

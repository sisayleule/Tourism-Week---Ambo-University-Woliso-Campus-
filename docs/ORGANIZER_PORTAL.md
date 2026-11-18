# Organizer Portal — Operations Guide

> **Phase 3 — Dashboard, Events, Agenda, Live Control, Announcements**  
> This guide covers day-to-day use of the staff portal by organizers.

---

## Table of Contents

1. [Add and publish an event](#1-add-and-publish-an-event)
2. [Reorder the agenda](#2-reorder-the-agenda)
3. [Run live control during the event](#3-run-live-control-during-the-event)
4. [Post an announcement](#4-post-an-announcement)
5. [Manual test script](#5-manual-test-script)

---

## 1. Add and publish an event

### Create a draft

1. Sign in at `/staff/login`.
2. From the dashboard, click **Add event** (or navigate to `/staff/events/new`).
3. Fill in the **title** — English is required. Amharic and Afaan Oromo are optional; if left empty, English is shown on the public site.
4. Set the **day** (limited to the edition's number of days), **session** (morning/afternoon), and optional start/end times.
5. Choose a **category** and **venue type**. Optionally add a venue name in any of the three languages.
6. Toggle **featured** if the event should be highlighted.
7. Upload an **image** (JPEG, PNG, WebP, or AVIF, max 5 MB). The image is automatically resized to 1600 px wide and converted to WebP in your browser before upload. The alt text is derived from the English title.
8. Click **Save draft**. The event is saved with `state = 'draft'` — it is not visible to the public yet.

### Publish

1. From the events list (`/staff/events`), click any event to edit it.
2. Click **Publish**. A confirmation dialog appears: *"This will be visible to the public immediately."*
3. Confirm. The event's `state` changes to `published` and it appears on the public site instantly.

### Unpublish

1. Open a published event.
2. Click **Unpublish**. The event returns to draft and is hidden from the public site.

### Edit the slug

The URL slug is auto-generated from the English title. It can only be edited while the event is a **draft** — once published, the slug is locked to prevent breaking public URLs.

### Delete an event

Only **admins** see a Delete button. Organizers cannot delete events — the button is hidden, and a direct delete request through the Supabase API is rejected by the database Row Level Security policy (`events: admin delete` requires `is_admin()`).

---

## 2. Reorder the agenda

The Agenda Builder (`/staff/events/agenda`) shows all events for the current edition on a day-by-day board with Morning and Afternoon columns.

### Desktop (drag and drop)

1. Select the day using the tabs at the top.
2. Drag an event card by its handle (the grip icon on the left) to reorder it within a session, or drag it to the other session column to move it between morning and afternoon.
3. The new order is saved immediately. A toast appears with an **Undo** button if you want to revert.

### Mobile (Move-to menu)

On phones, drag-and-drop is replaced by a **Move to…** button on each card:

1. Tap the arrow icon on an event card.
2. Select the target day and session from the menu.
3. The move is saved immediately with an Undo toast.

### Crowded day warning

If a day has more than 6 events, a yellow warning appears: *"This day looks crowded."* This is a soft suggestion only — it does not block saving. The threshold is defined as a constant (`MAX_ITEMS_PER_DAY = 6`) in `src/staff/pages/events/AgendaPage.tsx` and is easy to change.

---

## 3. Run live control during the event

The Live Control screen (`/staff/live`) is the most important page during the event. It is designed for one-handed phone use.

### Changing a status

1. Navigate to `/staff/live`. Today's events are shown grouped by Morning and Afternoon. Use the day selector to view other days.
2. Each event has four large buttons: **Scheduled**, **Live now**, **Delayed**, **Cancelled**.
3. Tap a button to change the status instantly. The change is sent to the database immediately with an optimistic update (the UI updates before the server responds). If the server rejects the change, the UI rolls back and shows an error toast.
4. **Cancelled** requires a confirmation dialog to prevent accidental taps.

### Adding a delay note

When you set an event to **Delayed**, a note editor opens:

1. Enter a short note in English (required). Amharic and Afaan Oromo are optional.
2. Click **Save note**. The note is stored in `status_note_i18n` and shown alongside the status.

### Clearing a note

When you change the status back to **Scheduled** or **Live now**, the note is automatically cleared (set to `null`).

### Auto-refresh

The page auto-refreshes every 30 seconds and when the tab regains focus (e.g. switching back from another app). This ensures a second device sees status changes from the first device within 30 seconds.

---

## 4. Post an announcement

### Create

1. Navigate to `/staff/announcements` and click **New announcement**.
2. Type the **message** in English (required, max 280 characters). Amharic and Afaan Oromo are optional.
3. Choose the **type**: Normal or Urgent. Urgent announcements get a red badge and appear as the pinned banner on the public site.
4. Set the **start time**: Now (immediate) or schedule for later.
5. Choose an **expiry preset**: 6 hours, 24 hours, 3 days, no expiry, or a custom date/time.
6. Optionally add a **link** (e.g. `/schedule`).
7. Click **Publish**. The announcement goes live immediately and a preview of the banner is shown on the form.

### Which announcement is the pinned banner?

The public site shows one pinned banner at a time. The portal indicates which one it is: the **newest live urgent announcement**, or if no urgent one is live, the **newest live normal announcement**. A gold "Currently the pinned banner" notice appears on the announcements list.

### Edit, unpublish, delete

- **Edit**: Click the Edit link on any announcement.
- **Unpublish**: Sets `state = 'draft'` to hide it from the public site without deleting.
- **Delete**: Permanently removes the announcement. Any staff member can delete announcements (per the database RLS rules).

---

## 5. Manual test script

Run these tests after deploying Phase 3.

---

### TC-01 — Organizer creates a draft then publishes

**Steps:**
1. Sign in as an organizer.
2. Navigate to `/staff/events/new`.
3. Fill in a title in English, select Day 1, Morning, Culture category.
4. Click **Save draft**. Verify a success toast appears.
5. Return to `/staff/events`. Verify the new event appears with a **Draft** badge.
6. Click the event to edit it.
7. Click **Publish**. Confirm in the dialog.
8. Verify the badge changes to **Published**.

**Expected:** Event transitions from draft to published. The Supabase REST API with the anon key now returns the event (because `state = 'published'`).

---

### TC-02 — Anon API shows only published events

**Steps:**
1. Using curl or the browser, call the Supabase REST endpoint with the anon key:
   ```
   GET https://YOUR_PROJECT.supabase.co/rest/v1/events?select=id,slug,state&apikey=YOUR_ANON_KEY
   ```
2. Verify only events with `state = 'published'` appear in the response.

**Expected:** Draft events are invisible to the anon role (RLS policy `events: public read published`).

---

### TC-03 — Organizer cannot delete an event

**Steps:**
1. Sign in as an organizer.
2. Open any event at `/staff/events/:id`.
3. Verify there is **no Delete button** visible.

**Steps (direct API attempt):**
4. In the browser console (while signed in as organizer), run:
   ```js
   await supabase.from('events').delete().eq('id', 'SOME_EVENT_ID')
   ```
5. Verify the request is rejected by the database.

**Expected:** No UI button. Direct delete returns an RLS error (`events: admin delete` requires `is_admin()`).

---

### TC-04 — Admin can delete an event

**Steps:**
1. Sign in as an admin.
2. Open any event.
3. Verify the **Delete button** is visible.
4. Click Delete. Confirm in the dialog.
5. Verify the event is removed from the list.

**Expected:** Admin sees and can use the Delete button. The delete succeeds (RLS `is_admin()` returns true).

---

### TC-05 — Image upload rejects a 6 MB file and a PDF

**Steps:**
1. Open `/staff/events/new`.
2. Try uploading a 6 MB JPEG. Verify the error message: *"File is too large (6.0 MB). Maximum 5 MB."*
3. Try uploading a PDF. Verify the error: *"Unsupported file type: application/pdf. Accepted: JPEG, PNG, WebP, AVIF."*

**Expected:** Both files are rejected with friendly error messages before any upload attempt.

---

### TC-06 — Two browsers editing the same event triggers the conflict message

**Steps:**
1. Open the same event in two browser tabs (signed in as two different organizers).
2. In Tab A, change the title and save.
3. In Tab B, change the description and save.

**Expected:** Tab B shows the conflict message: *"Someone else changed this item. Reload to see their changes."* The change from Tab B is rejected to prevent silent overwriting.

---

### TC-07 — Live status change appears on a second device within 30 seconds

**Steps:**
1. Open `/staff/live` on Device A (signed in as organizer).
2. Open `/staff/live` on Device B (signed in as another organizer).
3. On Device A, tap **Live now** on an event.
4. Wait up to 30 seconds (or switch to the tab on Device B to trigger focus refresh).

**Expected:** Device B shows the event status as "Live now" within 30 seconds (auto-refresh interval).

---

### TC-08 — All screens usable at 360 px

**Steps:**
1. Open Chrome DevTools, set viewport to 360 × 640 px.
2. Navigate through: `/staff` (dashboard), `/staff/events`, `/staff/events/new`, `/staff/events/agenda`, `/staff/live`, `/staff/announcements`.

**Expected:** All screens are readable and usable at 360 px wide. No horizontal scroll, no overlapping elements. Touch targets are at least 48 px on the Live Control page. The sidebar is replaced by the bottom nav and a drawer menu.

---

*End of ORGANIZER_PORTAL.md*

---

## 6. Edit website content (Phase 6B)

The Website Content screen (`/staff/site`) lets organizers change every editable piece of text, image, and card on the public site — without touching code.

### Browse sections

1. Sign in at `/staff/login`.
2. Click **Website Content** in the sidebar.
3. Sections are grouped by page (Home, About, Sponsors, Contact).
4. Each row shows: section name, "View on website" link, status badge (Published / Draft / Needs review), last updated date, and an **Edit** button.
5. A yellow banner at the top shows how many sections need review.

### Edit a section

1. Click **Edit** on any section row. You are taken to the Section Editor.
2. Use the **English / Amharic / Afaan Oromo** tabs to fill in content. English is required for any field that accepts text.
3. Depending on the section, you will see: Title, Subtitle, Body, Button label, Button URL, and/or Image.
4. For sections with cards (Explore Woliso, Guiding Philosophy, Hero wonders chips, About dept. stat cards): add, remove, and reorder cards with the + / trash / arrow buttons. Each card has Title, Description, Badge, Icon, and Link.
5. Click **Save draft** to save without making it public, or **Publish** to publish immediately (a confirmation dialog appears).
6. After saving, a website update is queued automatically (90-second debounce before the deploy trigger fires).

### Unpublish a section

1. Open a published section.
2. Click **Unpublish**. A confirmation dialog explains what happens: some sections fall back to built-in default text; others disappear entirely.

### Reset to default text

1. Open any section.
2. Click **Reset to default text** (amber button). After confirming, the section is reset to the original hard-coded copy from the application code and published immediately.

### Section rules

- Organizers can edit and publish any registered section. They cannot create new layouts or delete sections (delete requires admin).
- CTA URL and card link URLs must start with `/` (internal) or `https://` (external). Other schemes are rejected.
- English is always required for titles and theme text. Amharic and Afaan Oromo are optional — English is shown when they are empty.

### Section permissions (organizer vs admin)

| Action | Organizer | Admin |
|--------|-----------|-------|
| View all sections | ✓ | ✓ |
| Edit text and save | ✓ | ✓ |
| Publish / Unpublish | ✓ | ✓ |
| Delete a section | ✗ | ✓ |
| Delete section items (cards) | ✓ | ✓ |
| Upload images to site-content bucket | ✓ | ✓ |
| Delete images from site-content bucket | ✗ | ✓ |

---

## 7. Add or edit past editions

Organizers can create new editions using `create_edition_from_template` (since Phase 6B this no longer requires admin). The edition form at `/admin/editions` now includes Phase 6B fields.

### Edit an existing edition's content

1. Go to `/admin/editions` (organizer is redirected here from the sidebar).
2. Click **Edit** on the edition row.
3. Fill in core fields (title, theme, venue, dates) as before.
4. Scroll to the Phase 6B section to fill in:
   - **Hero highlight word** — the word inside the theme that renders gold-italic. The live preview shows how it looks.
   - **Hero subtitle** — short subtitle shown under the headline.
   - **Summary** — paragraph shown in the Past Editions Timeline on the About page.
   - **Hero poster URL / Hero video URL** — override the default hero media.
   - **Cover image URL** — image shown in the Past Editions Timeline card.
   - **State** — `Published` = visible to public; `Draft` = staff only.
5. Click **Save**. A website update is queued.

> **Important:** An edition must be `Published` before it can be set as the live edition. The "Set as current" action (admin only) will reject draft editions.

---

## 8. Manual test script (Phase 6B)

Run these checks after applying migration 013 and the seed.

1. **Slogan and highlight word:** in the portal, change the theme and highlight word for the current edition in all three languages. Trigger a website sync. Verify the hero headline updates and the correct word is gold-italic.
2. **Dates → countdown:** change the edition start date to tomorrow. Verify the hero shows the countdown. Restore.
3. **Past editions timeline:** create a new past edition (state=published, start_date in the past). Trigger sync. Verify it appears on `/about#past-editions`. Delete it.
4. **Guiding Philosophy:** in the portal, change the Philosophy virtue grid cards. Trigger sync. Verify the grid on the home page shows the new text. Reset to default and sync again — verify the original text returns.
5. **Explore Woliso:** change card 1 title and badge. Trigger sync. Verify the Wonchi card shows new content.
6. **Publish a news article with image and Markdown:** publish via the portal, trigger sync, verify it appears on Home (`/`), `/news`, and `/news/<slug>`. Unpublish and sync — verify it vanishes from all three.
7. **Upload gallery photos:** add photos via the portal, publish, trigger sync. Verify they appear on Home gallery strip and `/gallery`.
8. **Make a section Draft:** set `home.philosophy` to Draft. Trigger sync. Verify the Guiding Philosophy section falls back to built-in default text (since fallbackBehaviour = 'default').
9. **Seed visual check:** immediately after running the seed (`supabase db push` or running the SQL directly), trigger a sync and confirm the public site looks identical to before — no visible change.
10. **Supabase unreachable fallback:** disconnect Supabase (empty the env vars temporarily) and run `npm run build`. Verify the build succeeds using the last-good snapshot and the site renders correctly.
11. **Organizer can set live edition:** confirm the "Set as current" button is visible on the Editions page and requires password confirmation before it fires.
12. **Organizer cannot delete section:** verify there is no Delete button for page_sections in the portal (only for items). Attempting a direct API delete returns an RLS error.

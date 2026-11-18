/**
 * sectionsService.ts — CRUD for page_sections, page_section_items, and the
 * Phase 6B edition fields (subtitle_i18n, theme_highlight_i18n, hero_poster_url,
 * hero_video_url, summary_i18n, cover_image_url, state).
 *
 * All functions accept a `client` parameter (staff or admin Supabase client)
 * so they can be called from either portal.
 *
 * Optimistic concurrency: UPDATE calls check the loaded updated_at value and
 * throw CONFLICT_MSG when it has changed since the form was loaded.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  I18nJson,
  ContentState,
  PageSection,
  PageSectionItem,
} from '../../types/database'
import {
  isConflictError,
  UNREACHABLE_MSG,
  CONFLICT_MSG,
} from './helpers'
import {
  processImageForUpload,
  makeImageFileName,
} from './imageResize'

// ─── Image upload ─────────────────────────────────────────────────────────────

/**
 * Upload an image to the site-content storage bucket.
 * Returns the public URL.
 */
export async function uploadSiteContentImage(
  client: SupabaseClient,
  blob: Blob,
  fileName: string
): Promise<string> {
  const { data, error } = await client.storage
    .from('site-content')
    .upload(`sections/${fileName}`, blob, {
      contentType: 'image/webp',
      upsert: true,
    })
  if (error) throw new Error(`Image upload failed: ${error.message}`)
  const { data: urlData } = client.storage
    .from('site-content')
    .getPublicUrl(data.path)
  return urlData.publicUrl
}

/**
 * Process a File and upload it to site-content.
 * Resizes to 1600 px wide, converts to WebP.
 */
export async function processAndUploadSiteImage(
  client: SupabaseClient,
  file: File,
  namePrefix: string
): Promise<string> {
  const processed = await processImageForUpload(file)
  const fileName = makeImageFileName(namePrefix)
  return uploadSiteContentImage(client, processed.blob, fileName)
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SectionInput {
  key:            string
  title_i18n:     I18nJson | null
  subtitle_i18n:  I18nJson | null
  body_i18n:      I18nJson | null
  image_url:      string | null
  cta_label_i18n: I18nJson | null
  cta_url:        string | null
  state:          ContentState
  needs_review:   boolean
}

export interface SectionItemInput {
  section_id:  string
  title_i18n:  I18nJson | null
  body_i18n:   I18nJson | null
  icon:        string | null
  image_url:   string | null
  link_url:    string | null
  badge_i18n:  I18nJson | null
  sort_order:  number
  state:       ContentState
}

/** Extended edition patch that includes the Phase 6B fields. */
export interface EditionContentPatch {
  subtitle_i18n?:        I18nJson | null
  theme_highlight_i18n?: I18nJson | null
  hero_poster_url?:      string | null
  hero_video_url?:       string | null
  summary_i18n?:         I18nJson | null
  cover_image_url?:      string | null
  state?:                ContentState
  // Core fields that may be updated from the edition editor
  edition_name_i18n?: I18nJson
  title_i18n?:        I18nJson
  theme_i18n?:        I18nJson
  sub_theme_i18n?:    I18nJson | null
  venue_i18n?:        I18nJson
  start_date?:        string
  end_date?:          string
  start_date_ec?:     string | null
  end_date_ec?:       string | null
  date_range_display_i18n?: I18nJson | null
  stats?:             Record<string, unknown> | null
}

// ─── Page Sections ────────────────────────────────────────────────────────────

/** Fetch all page sections (staff sees drafts). */
export async function fetchAllSections(
  client: SupabaseClient
): Promise<PageSection[]> {
  const { data, error } = await client
    .from('page_sections')
    .select('*')
    .order('key')
  if (error) throw new Error(UNREACHABLE_MSG)
  return (data ?? []) as PageSection[]
}

/** Fetch a single section by its registry key. */
export async function fetchSectionByKey(
  client: SupabaseClient,
  key: string
): Promise<PageSection | null> {
  const { data, error } = await client
    .from('page_sections')
    .select('*')
    .eq('key', key)
    .maybeSingle()
  if (error) throw new Error(UNREACHABLE_MSG)
  return (data ?? null) as PageSection | null
}

/** Fetch all items for a section, ordered by sort_order. */
export async function fetchSectionItems(
  client: SupabaseClient,
  sectionId: string
): Promise<PageSectionItem[]> {
  const { data, error } = await client
    .from('page_section_items')
    .select('*')
    .eq('section_id', sectionId)
    .order('sort_order')
  if (error) throw new Error(UNREACHABLE_MSG)
  return (data ?? []) as PageSectionItem[]
}

/** Create or update a section by key (upsert on key). */
export async function upsertSection(
  client: SupabaseClient,
  input: SectionInput,
  loadedUpdatedAt?: string
): Promise<PageSection> {
  // If we have a loaded_updated_at, verify the row hasn't changed (optimistic concurrency).
  if (loadedUpdatedAt) {
    const { data: current } = await client
      .from('page_sections')
      .select('updated_at')
      .eq('key', input.key)
      .maybeSingle()
    if (current && current.updated_at !== loadedUpdatedAt) {
      throw new Error(CONFLICT_MSG)
    }
  }

  const { data, error } = await client
    .from('page_sections')
    .upsert({ ...input }, { onConflict: 'key' })
    .select()
    .single()
  if (error) throw new Error(`Failed to save section: ${error.message}`)
  return data as PageSection
}

/** Publish a section (set state = 'published', needs_review = false). */
export async function publishSection(
  client: SupabaseClient,
  key: string,
  loadedUpdatedAt: string
): Promise<PageSection> {
  const { data: current } = await client
    .from('page_sections')
    .select('updated_at')
    .eq('key', key)
    .maybeSingle()
  if (current && current.updated_at !== loadedUpdatedAt) {
    throw new Error(CONFLICT_MSG)
  }
  const { data, error } = await client
    .from('page_sections')
    .update({ state: 'published', needs_review: false })
    .eq('key', key)
    .select()
    .single()
  if (error) throw new Error(`Failed to publish section: ${error.message}`)
  return data as PageSection
}

/** Unpublish a section (set state = 'draft'). */
export async function unpublishSection(
  client: SupabaseClient,
  key: string,
  loadedUpdatedAt: string
): Promise<PageSection> {
  const { data: current } = await client
    .from('page_sections')
    .select('updated_at')
    .eq('key', key)
    .maybeSingle()
  if (current && current.updated_at !== loadedUpdatedAt) {
    throw new Error(CONFLICT_MSG)
  }
  const { data, error } = await client
    .from('page_sections')
    .update({ state: 'draft' })
    .eq('key', key)
    .select()
    .single()
  if (error) throw new Error(`Failed to unpublish section: ${error.message}`)
  return data as PageSection
}

/** Reset a section to the built-in default copy from the registry. */
export async function resetSectionToDefault(
  client: SupabaseClient,
  key: string,
  defaultInput: SectionInput
): Promise<PageSection> {
  const { data, error } = await client
    .from('page_sections')
    .upsert({ ...defaultInput, key, needs_review: false }, { onConflict: 'key' })
    .select()
    .single()
  if (error) throw new Error(`Failed to reset section: ${error.message}`)
  return data as PageSection
}

// ─── Page Section Items ───────────────────────────────────────────────────────

/** Create a new section item. */
export async function createSectionItem(
  client: SupabaseClient,
  input: SectionItemInput
): Promise<PageSectionItem> {
  const { data, error } = await client
    .from('page_section_items')
    .insert(input)
    .select()
    .single()
  if (error) throw new Error(`Failed to create item: ${error.message}`)
  return data as PageSectionItem
}

/** Update a section item. */
export async function updateSectionItem(
  client: SupabaseClient,
  id: string,
  patch: Partial<SectionItemInput>
): Promise<PageSectionItem> {
  const { data, error } = await client
    .from('page_section_items')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(`Failed to update item: ${error.message}`)
  return data as PageSectionItem
}

/** Delete a section item (staff and admin may delete items). */
export async function deleteSectionItem(
  client: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await client
    .from('page_section_items')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`Failed to delete item: ${error.message}`)
}

/**
 * Replace all items for a section in one transaction-like operation.
 * Deletes all existing items, then inserts the new ordered list.
 */
export async function replaceSectionItems(
  client: SupabaseClient,
  sectionId: string,
  items: Omit<SectionItemInput, 'section_id'>[]
): Promise<PageSectionItem[]> {
  // Delete existing
  const { error: delErr } = await client
    .from('page_section_items')
    .delete()
    .eq('section_id', sectionId)
  if (delErr) throw new Error(`Failed to replace items: ${delErr.message}`)

  if (items.length === 0) return []

  // Insert new
  const inserts = items.map((item, i) => ({
    ...item,
    section_id: sectionId,
    sort_order: i,
  }))
  const { data, error } = await client
    .from('page_section_items')
    .insert(inserts)
    .select()
  if (error) throw new Error(`Failed to insert items: ${error.message}`)
  return (data ?? []) as PageSectionItem[]
}

// ─── Edition content patch (Phase 6B fields) ─────────────────────────────────

/**
 * Update the Phase 6B content fields on an edition (available to both staff
 * and admin, since migration 013 gave staff INSERT/UPDATE rights on editions).
 * Uses optimistic concurrency via loaded_updated_at.
 */
export async function updateEditionContent(
  client: SupabaseClient,
  editionId: string,
  loadedUpdatedAt: string,
  patch: EditionContentPatch
): Promise<void> {
  const { data: current } = await client
    .from('editions')
    .select('updated_at')
    .eq('id', editionId)
    .maybeSingle()
  if (current && current.updated_at !== loadedUpdatedAt) {
    throw new Error(CONFLICT_MSG)
  }

  const { data, error } = await client
    .from('editions')
    .update(patch)
    .eq('id', editionId)
    .select('id')
  if (error || isConflictError(error, (data as unknown[])?.length ?? 0)) {
    if (isConflictError(error, (data as unknown[])?.length ?? 0)) throw new Error(CONFLICT_MSG)
    throw new Error(`Failed to update edition: ${error?.message}`)
  }
}

// ─── Needs-review count ───────────────────────────────────────────────────────

/** Count sections with needs_review = true (for dashboard card). */
export async function fetchNeedsReviewCount(
  client: SupabaseClient
): Promise<number> {
  const { count, error } = await client
    .from('page_sections')
    .select('*', { count: 'exact', head: true })
    .eq('needs_review', true)
  if (error) return 0
  return count ?? 0
}
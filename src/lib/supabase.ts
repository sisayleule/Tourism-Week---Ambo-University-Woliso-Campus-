/**
 * supabase.ts — Backward-compatibility re-export.
 *
 * All existing staff services (eventsService, announcementsService, etc.)
 * import `supabase` from this file. We re-export the staff client so they
 * continue to work without modification.
 *
 * New code should import from supabaseStaff directly.
 */

export { supabaseStaff as supabase } from './supabaseStaff'

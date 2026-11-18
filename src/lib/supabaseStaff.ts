/**
 * supabaseStaff.ts — Supabase client for the ORGANIZER portal (/staff/*).
 *
 * Uses storageKey 'tw-staff-auth'. Both organizer and admin-role accounts
 * sign in here — there is no separate admin client.
 *
 * NEVER import this from the public site, App.tsx top-level, or any public
 * component. It is imported only from staff/* code paths.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string | undefined
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (import.meta.env.DEV && (!supabaseUrl || !supabaseAnon)) {
  throw new Error(
    '[supabaseStaff] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.'
  )
}

export const supabaseStaff = createClient<Database>(
  supabaseUrl  ?? '',
  supabaseAnon ?? '',
  {
    auth: {
      persistSession:   true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'tw-staff-auth',   // Separate from admin session
    },
  }
)

/**
 * PortalContext.tsx
 *
 * Provides portal-specific values to any component in the tree:
 *   - client    — the Supabase client for this portal
 *   - basePath  — always '/staff'
 *   - canDelete — always true (every organizer may delete content)
 *
 * The old isAdminPortal / canDelete=false split is gone: there is now only
 * one portal and everyone gets full content permissions (enforced by RLS).
 */

import React, { createContext, useContext } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as staffSupabase } from '../../lib/supabase'

export interface PortalContextValue {
  /** The Supabase client for this portal. */
  client: SupabaseClient
  /** Route prefix — always '/staff'. */
  basePath: '/staff'
  /** Every organizer may delete content. Always true. */
  canDelete: boolean
}

const PortalContext = createContext<PortalContextValue>({
  client: staffSupabase,
  basePath: '/staff',
  canDelete: true,
})

export function PortalProvider({
  children,
  client,
  basePath,
  canDelete,
}: {
  children: React.ReactNode
  client: SupabaseClient
  basePath: '/staff'
  canDelete: boolean
}) {
  return (
    <PortalContext.Provider value={{ client, basePath, canDelete }}>
      {children}
    </PortalContext.Provider>
  )
}

export function usePortal(): PortalContextValue {
  return useContext(PortalContext)
}

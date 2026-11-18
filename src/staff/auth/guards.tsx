/**
 * guards.tsx — Route-level auth guard for the Organizer portal.
 *
 * <RequireStaff> — must be authenticated with an active profile
 *                  (organizer OR admin role).  Used to wrap /staff/*.
 *
 * Logged-out users are redirected to /staff/login with the original
 * destination saved in location.state.from for post-login redirect.
 *
 * Note: This guard is a UX convenience only. Real security lives in
 * Supabase Row Level Security policies.
 */

import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'

function AuthLoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)]">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-10 w-10 rounded-full border-4 border-[#0F3D2E] border-t-transparent animate-spin"
          role="status"
          aria-label="Loading"
        />
        <p className="text-sm text-[var(--text-muted)] font-sans">Loading…</p>
      </div>
    </div>
  )
}

export function RequireStaff({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <AuthLoadingSpinner />

  if (!session || !profile) {
    return (
      <Navigate
        to="/staff/login"
        state={{ from: location }}
        replace
      />
    )
  }

  return <>{children}</>
}

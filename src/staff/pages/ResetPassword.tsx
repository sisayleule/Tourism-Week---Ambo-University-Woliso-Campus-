/**
 * ResetPassword.tsx — /staff/reset-password
 *
 * This page is the target of Supabase's password-reset email link.
 * The link contains a session token in the URL hash; Supabase's client
 * (detectSessionInUrl: true) exchanges it automatically and fires
 * onAuthStateChange with event='PASSWORD_RECOVERY'.
 *
 * We simply delegate to <SetPassword /> which already handles the full
 * new-password form, strength hints, and the must_change_password clear.
 */

import React from 'react'
import { SetPassword } from './SetPassword'

export function ResetPassword() {
  // SetPassword handles both the first-login forced flow and the recovery
  // link flow.  The page title/subtitle differ slightly for recovery, but
  // the form is identical.
  return <SetPassword />
}

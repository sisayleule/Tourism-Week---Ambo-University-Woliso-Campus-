/**
 * SaveConfirmationToast.tsx
 *
 * A self-contained toast that appears after a staff save and confirms
 * the change is live on the public website by polling content_version().
 *
 * Usage — add to any portal form/page component:
 *
 *   const { check: confirmLive, ...confirmation } = useLiveSaveConfirmation()
 *
 *   // in your mutation's onSuccess:
 *   confirmLive()
 *
 *   // in your JSX:
 *   <SaveConfirmationToast confirmation={confirmation} />
 *
 * The toast dismisses itself when the user clicks ×.
 * It auto-hides 10 s after confirmation is reached.
 */

import React, { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, AlertCircle, X } from 'lucide-react'
import type { LiveSaveConfirmation } from '../hooks/useLiveSaveConfirmation'

interface Props {
  confirmation: LiveSaveConfirmation
}

export const SaveConfirmationToast: React.FC<Props> = ({ confirmation }) => {
  const { state, label, reset } = confirmation
  const [visible, setVisible] = useState(false)

  // Show when active, auto-hide 10 s after confirmed
  useEffect(() => {
    if (state === 'idle') { setVisible(false); return }
    setVisible(true)
    if (state === 'confirmed') {
      const t = setTimeout(() => { setVisible(false); reset() }, 10_000)
      return () => clearTimeout(t)
    }
  }, [state, reset])

  if (!visible || state === 'idle') return null

  const isError    = state === 'error' || state === 'timeout'
  const isLoading  = state === 'saving' || state === 'polling'
  const isOk       = state === 'confirmed'

  const bg    = isError ? 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800'
              : isOk    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800'
              :            'bg-white dark:bg-[#12221C] border-stone-200 dark:border-stone-700'

  const textCls = isError ? 'text-red-700 dark:text-red-300'
                : isOk    ? 'text-emerald-700 dark:text-emerald-300'
                :            'text-stone-700 dark:text-stone-300'

  const Icon = isError ? AlertCircle : isOk ? CheckCircle2 : Loader2

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border shadow-lg text-sm max-w-sm w-max ${bg}`}
    >
      <Icon
        size={15}
        className={`shrink-0 ${isLoading ? 'animate-spin' : ''} ${textCls}`}
        aria-hidden="true"
      />
      <span className={textCls}>{label}</span>
      <button
        onClick={() => { setVisible(false); reset() }}
        className="ml-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  )
}

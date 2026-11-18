/**
 * ConfirmDialog.tsx — Reusable confirmation modal.
 *
 * Desktop (≥640 px): centred card, max-w-sm.
 * Mobile   (<640 px): bottom sheet anchored to the screen bottom, rounded top
 *                     corners, safe-area padding so buttons clear the home
 *                     indicator on notched phones.
 *
 * All action buttons: min-h-[48px] for one-handed thumb reachability.
 * Focus: confirm button receives focus on open; Escape calls onCancel.
 */

import React, { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

export interface ConfirmDialogProps {
  open:         boolean
  title:        string
  message:      string
  confirmLabel: string
  cancelLabel?: string
  variant?:     'danger' | 'default'
  onConfirm:    () => void
  onCancel:     () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => confirmRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  const confirmClasses =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-[#0F3D2E] hover:bg-[#0A2A20] text-white'

  return (
    /*
     * Outer: full-screen scrim.
     * On phones (< sm): flex-col justify-end → sheet slides up from the bottom.
     * On sm+: flex items-center justify-center → centred card.
     */
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end sm:items-center sm:justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
      onClick={onCancel}
    >
      <div
        className={[
          /* Mobile: bottom sheet */
          'w-full bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-2xl',
          'rounded-t-3xl sm:rounded-2xl',
          /* Desktop: constrained card */
          'sm:max-w-sm sm:mx-4',
          'p-6 space-y-5',
          /* Safe-area so buttons clear the home bar */
          'pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:pb-6',
        ].join(' ')}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle (mobile only) */}
        <div className="sm:hidden w-10 h-1 rounded-full bg-[var(--border-subtle)] mx-auto -mt-1 mb-2" aria-hidden="true" />

        <div className="flex items-start gap-3">
          {variant === 'danger' && (
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 shrink-0">
              <AlertTriangle size={20} aria-hidden="true" />
            </span>
          )}
          <div className="space-y-1.5 min-w-0">
            <h2 id="confirm-title" className="font-display text-lg font-bold text-[var(--text-main)]">
              {title}
            </h2>
            <p id="confirm-desc" className="text-sm text-[var(--text-muted)] leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* Buttons: stacked full-width on phones, side-by-side on sm+ */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto min-h-[48px] px-5 py-3 rounded-xl border border-[var(--border-subtle)] text-[var(--text-main)] text-sm font-medium hover:bg-[var(--bg-section-alt)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`w-full sm:w-auto min-h-[48px] px-5 py-3 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2 ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Loading.tsx — Loading skeleton and empty-state components for staff pages.
 */

import React from 'react'
import { Inbox } from 'lucide-react'

export function LoadingSkeleton({ lines = 5 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-xl bg-[var(--bg-section-alt)] animate-pulse"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  )
}

export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-10 w-10 rounded-full border-4 border-[#0F3D2E] border-t-transparent animate-spin"
          role="status"
          aria-label={label}
        />
        <p className="text-sm text-[var(--text-muted)]">{label}</p>
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title:       string
  description?: string
  action?:     React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4 gap-4">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--bg-section-alt)] text-[var(--text-muted)]">
        <Inbox size={28} aria-hidden="true" />
      </div>
      <div className="space-y-1 max-w-xs">
        <h3 className="font-display text-base font-semibold text-[var(--text-main)]">{title}</h3>
        {description && (
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

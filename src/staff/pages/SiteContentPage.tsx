/**
 * SiteContentPage.tsx — /staff/site and /admin/content/site
 *
 * Lists every registered section grouped by page, with:
 *   - Section name + "View on website" link
 *   - Status badge (Published / Draft / Needs review)
 *   - Last updated timestamp
 *   - Edit button → SectionEditorPage
 *
 * Portal-aware: uses PortalContext for base path and client.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import {
  ExternalLink,
  Pencil,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { usePortal } from '../context/PortalContext'
import { useAllSections } from '../hooks/useSectionsQueries'
import { SECTION_REGISTRY, getSectionsByPage, PAGE_LABELS, ALL_PAGES } from '../../lib/sectionRegistry'
import type { PageSection } from '../../types/database'
import { FullPageSpinner } from '../components/Loading'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      timeZone: 'Africa/Addis_Ababa',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function StatusBadge({ section }: { section: PageSection | undefined }) {
  if (!section) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
        No data
      </span>
    )
  }
  if (section.needs_review) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
        Needs review
      </span>
    )
  }
  if (section.state === 'published') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Published
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-700">
      <Clock className="h-3 w-3" aria-hidden="true" />
      Draft
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SiteContentPage() {
  const { client, basePath } = usePortal()
  const { data: sections, isLoading, error } = useAllSections(client)

  // Build a lookup map keyed by section.key
  const sectionMap = React.useMemo(() => {
    const map: Record<string, PageSection> = {}
    for (const s of sections ?? []) map[s.key] = s
    return map
  }, [sections])

  // Count needs-review
  const needsReviewCount = (sections ?? []).filter((s) => s.needs_review).length

  if (isLoading) return <FullPageSpinner label="Loading website content…" />

  if (error) {
    return (
      <div className="max-w-4xl px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
        {(error as Error).message}
      </div>
    )
  }

  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100">
            Website Content
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Every editable section of the public site. Changes take effect after the next website update.
          </p>
        </div>
        {needsReviewCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{needsReviewCount} section{needsReviewCount !== 1 ? 's' : ''} need review</span>
          </div>
        )}
      </div>

      {/* Sections grouped by page */}
      {ALL_PAGES.map((page) => {
        const entries = getSectionsByPage(page)
        return (
          <div key={page} className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[#D9A441] pb-1 border-b border-stone-200 dark:border-stone-800">
              {PAGE_LABELS[page]}
            </h2>
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 dark:bg-[#12221C] text-xs text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left font-semibold">Section</th>
                    <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">Public URL</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Last Updated</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {entries.map((entry) => {
                    const dbRow = sectionMap[entry.key]
                    const editPath = `${basePath}/site/${encodeURIComponent(entry.key)}`
                    const siteUrl  = entry.publicUrl
                    return (
                      <tr
                        key={entry.key}
                        className="bg-white dark:bg-[#0F1E19] hover:bg-stone-50 dark:hover:bg-[#12221C] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-stone-900 dark:text-stone-100">
                            {entry.label}
                          </div>
                          <div className="text-xs text-stone-400 font-mono">{entry.key}</div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <a
                            href={siteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[#0F3D2E] dark:text-[#D9A441] hover:underline"
                          >
                            {siteUrl}
                            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge section={dbRow} />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-stone-400">
                          {dbRow ? formatTs(dbRow.updated_at) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={editPath}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F3D2E] text-white text-xs font-semibold hover:bg-[#0A2A20] transition-colors"
                          >
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                            Edit
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

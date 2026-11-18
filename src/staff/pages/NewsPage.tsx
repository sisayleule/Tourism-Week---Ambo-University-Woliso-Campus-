/**
 * NewsPage.tsx — /staff/news and /admin/content/news
 *
 * Lists all news articles with state badges and published_at.
 * Create / edit / publish / unpublish. Delete for admins only.
 * Portal-aware: uses usePortal() client and canDelete flag.
 */

import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Newspaper, PlusCircle, Pencil, Trash2, Eye, EyeOff, Search,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { usePortal } from '../context/PortalContext'
import { useToast } from '../components/Toast'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ContentStateBadge } from '../components/StatusBadge'
import { EmptyState, FullPageSpinner } from '../components/Loading'
import { scheduleDeploy } from '../lib/deployScheduler'
import type { News, ContentState } from '../../types/database'

// ─── Service helpers ──────────────────────────────────────────────────────────

function useNews() {
  const { client } = usePortal()
  return useQuery({
    queryKey: ['staff', 'news'],
    queryFn: async () => {
      const { data, error } = await client
        .from('news')
        .select('*')
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as News[]
    },
  })
}

function useNewsActions() {
  const { client } = usePortal()
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['staff', 'news'] })

  const publishMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.from('news').update({ state: 'published', published_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      scheduleDeploy()
    },
    onSuccess: invalidate,
  })

  const unpublishMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.from('news').update({ state: 'draft' }).eq('id', id)
      if (error) throw error
      scheduleDeploy()
    },
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.from('news').delete().eq('id', id)
      if (error) throw error
      scheduleDeploy()
    },
    onSuccess: invalidate,
  })

  return { publishMut, unpublishMut, deleteMut }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NewsPage() {
  const { t } = useTranslation()
  const { canDelete, basePath } = usePortal()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const { data: items, isLoading, error } = useNews()
  const { publishMut, unpublishMut, deleteMut } = useNewsActions()

  const [search, setSearch]           = useState('')
  const [deleteTarget, setDeleteTarget] = useState<News | null>(null)

  const filtered = (items ?? []).filter(n => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      n.title_i18n?.en?.toLowerCase().includes(q) ||
      n.slug?.toLowerCase().includes(q) ||
      (n.title_i18n?.am ?? '').toLowerCase().includes(q)
    )
  })

  const toggle = async (item: News) => {
    try {
      if (item.state === 'published') {
        await unpublishMut.mutateAsync(item.id)
        showToast({ type: 'success', message: 'News unpublished.' })
      } else {
        await publishMut.mutateAsync(item.id)
        showToast({ type: 'success', message: 'News published.' })
      }
    } catch (err) {
      showToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed' })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMut.mutateAsync(deleteTarget.id)
      showToast({ type: 'success', message: 'News deleted.' })
    } catch (err) {
      showToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed' })
    } finally { setDeleteTarget(null) }
  }

  if (isLoading) return <FullPageSpinner label={t('staff.common.loading')} />

  if (error) {
    return (
      <div className="max-w-4xl space-y-4">
        <Header basePath={basePath} />
        <ErrBanner msg={(error as Error).message} />
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <Header basePath={basePath} />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
        <input
          type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search news…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[#D9A441]"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No news articles yet"
          description="Create your first news article to get started."
          action={
            <Link to={`${basePath}${basePath.startsWith('/admin') ? '/content' : ''}/news/new`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] transition-colors">
              <PlusCircle size={16} /> New article
            </Link>
          }
        />
      ) : (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] overflow-hidden">
          <div className="divide-y divide-[var(--border-subtle)]">
            {filtered.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-section-alt)] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[var(--text-main)] truncate">
                      {item.title_i18n?.en ?? item.slug}
                    </span>
                    <ContentStateBadge state={item.state as ContentState} />
                    {item.pinned && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 uppercase tracking-wider">Pinned</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {item.category} · {item.published_at ? new Date(item.published_at).toLocaleDateString() : 'unpublished'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <IconBtn
                    icon={item.state === 'published' ? <EyeOff size={15} /> : <Eye size={15} />}
                    label={item.state === 'published' ? 'Unpublish' : 'Publish'}
                    onClick={() => toggle(item)}
                  />
                  <IconBtn
                    icon={<Pencil size={15} />}
                    label="Edit"
                    onClick={() => navigate(`${basePath}${basePath.startsWith('/admin') ? '/content' : ''}/news/${item.id}`)}
                  />
                  {canDelete && (
                    <IconBtn
                      icon={<Trash2 size={15} />}
                      label="Delete"
                      onClick={() => setDeleteTarget(item)}
                      danger
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete news article?"
        message={`"${deleteTarget?.title_i18n?.en ?? ''}" will be permanently deleted.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

function Header({ basePath }: { basePath: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0F3D2E] text-[#D9A441]">
          <Newspaper size={20} />
        </div>
        <h1 className="font-display text-xl font-bold text-[var(--text-main)]">News</h1>
      </div>
      <Link to={`${basePath}${basePath.startsWith('/admin') ? '/content' : ''}/news/new`}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2">
        <PlusCircle size={16} /> New article
      </Link>
    </div>
  )
}

function IconBtn({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] ${danger ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] hover:text-[var(--text-main)]'}`}>
      {icon}
    </button>
  )
}

function ErrBanner({ msg }: { msg: string }) {
  return <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">{msg}</div>
}

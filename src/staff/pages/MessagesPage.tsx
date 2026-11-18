/**
 * MessagesPage.tsx — /staff/messages and /admin/content/messages
 *
 * Lists visitor contact + sponsor inquiry messages.
 * Mark as handled / unhandled. Delete for admins only.
 * Portal-aware via usePortal().
 */

import React, { useState } from 'react'
import { MessageSquare, CheckCircle2, Circle, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { usePortal } from '../context/PortalContext'
import { useToast } from '../components/Toast'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState, FullPageSpinner } from '../components/Loading'
import type { Message } from '../../types/database'

function useMessages() {
  const { client } = usePortal()
  return useQuery({
    queryKey: ['staff', 'messages'],
    queryFn: async () => {
      const { data, error } = await client
        .from('messages')
        .select('*')
        .order('handled', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Message[]
    },
  })
}

function useMessageActions() {
  const { client } = usePortal()
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['staff', 'messages'] })

  const handleMut = useMutation({
    mutationFn: async ({ id, handled }: { id: number; handled: boolean }) => {
      const { error } = await client.from('messages').update({
        handled,
        handled_at: handled ? new Date().toISOString() : null,
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: inv,
  })

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await client.from('messages').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: inv,
  })

  return { handleMut, deleteMut }
}

export function MessagesPage() {
  const { t } = useTranslation()
  const { canDelete } = usePortal()
  const { showToast } = useToast()

  const { data: messages, isLoading, error } = useMessages()
  const { handleMut, deleteMut } = useMessageActions()
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null)
  const [expanded, setExpanded]         = useState<Set<number>>(new Set())

  const toggleExpand = (id: number) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const toggleHandled = async (msg: Message) => {
    try {
      await handleMut.mutateAsync({ id: msg.id, handled: !msg.handled })
      showToast({ type: 'success', message: `Marked as ${!msg.handled ? 'handled' : 'unhandled'}.` })
    } catch (err) {
      showToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed' })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMut.mutateAsync(deleteTarget.id)
      showToast({ type: 'success', message: 'Message deleted.' })
    } catch (err) {
      showToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed' })
    } finally { setDeleteTarget(null) }
  }

  if (isLoading) return <FullPageSpinner label={t('staff.common.loading')} />
  if (error) return <ErrBanner msg={(error as Error).message} />

  const unhandled = (messages ?? []).filter(m => !m.handled)
  const handled   = (messages ?? []).filter(m => m.handled)

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0F3D2E] text-[#D9A441]"><MessageSquare size={20} /></div>
          <h1 className="font-display text-xl font-bold text-[var(--text-main)]">Messages</h1>
        </div>
        <div className="flex gap-2 text-xs text-[var(--text-muted)]">
          <span className="font-semibold text-amber-600 dark:text-amber-400">{unhandled.length} unhandled</span>
          <span>· {handled.length} handled</span>
        </div>
      </div>

      {/* Privacy note */}
      <div className="px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
        Messages contain private visitor contact details. Handle with care.
      </div>

      {!messages || messages.length === 0 ? (
        <EmptyState title="No messages" description="Contact and sponsor inquiry messages will appear here." />
      ) : (
        <div className="space-y-6">
          {/* Unhandled */}
          {unhandled.length > 0 && (
            <Section title="Unhandled" messages={unhandled} expanded={expanded} onToggleExpand={toggleExpand}
              onToggleHandled={toggleHandled} onDelete={canDelete ? m => setDeleteTarget(m) : undefined} />
          )}
          {/* Handled */}
          {handled.length > 0 && (
            <Section title="Handled" messages={handled} expanded={expanded} onToggleExpand={toggleExpand}
              onToggleHandled={toggleHandled} onDelete={canDelete ? m => setDeleteTarget(m) : undefined} muted />
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete message?"
        message="This message and all its content will be permanently deleted."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

function Section({ title, messages, expanded, onToggleExpand, onToggleHandled, onDelete, muted }: {
  title: string
  messages: Message[]
  expanded: Set<number>
  onToggleExpand: (id: number) => void
  onToggleHandled: (m: Message) => void
  onDelete?: (m: Message) => void
  muted?: boolean
}) {
  return (
    <div className="space-y-2">
      <h2 className={`text-xs font-semibold uppercase tracking-widest px-1 ${muted ? 'text-[var(--text-muted)]' : 'text-amber-600 dark:text-amber-400'}`}>{title}</h2>
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] overflow-hidden">
        <div className="divide-y divide-[var(--border-subtle)]">
          {messages.map(msg => {
            const isOpen = expanded.has(msg.id)
            return (
              <div key={msg.id} className={muted ? 'opacity-60' : ''}>
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-section-alt)] cursor-pointer" onClick={() => onToggleExpand(msg.id)}>
                  {/* Kind badge */}
                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${msg.kind === 'sponsor_inquiry' ? 'bg-[#D9A441]/20 text-[#D9A441]' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                    {msg.kind === 'sponsor_inquiry' ? 'Sponsor' : 'Contact'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-main)] truncate">{msg.name}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{msg.email} · {new Date(msg.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={e => { e.stopPropagation(); onToggleHandled(msg) }}
                      title={msg.handled ? 'Mark unhandled' : 'Mark handled'}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] hover:text-[var(--text-main)] transition-colors">
                      {msg.handled ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Circle size={18} />}
                    </button>
                    {onDelete && (
                      <button onClick={e => { e.stopPropagation(); onDelete(msg) }}
                        title="Delete"
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    )}
                    {isOpen ? <ChevronUp size={16} className="text-[var(--text-muted)]" /> : <ChevronDown size={16} className="text-[var(--text-muted)]" />}
                  </div>
                </div>
                {isOpen && (
                  <div className="px-4 pb-4 pt-0 border-t border-[var(--border-subtle)] space-y-2 bg-[var(--bg-section-alt)]">
                    {msg.organisation && <InfoRow label="Organisation" value={msg.organisation} />}
                    {msg.phone && <InfoRow label="Phone" value={msg.phone} />}
                    <InfoRow label="Message" value={msg.message} multiline />
                    {msg.handled_at && <InfoRow label="Handled" value={new Date(msg.handled_at).toLocaleString()} />}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className={multiline ? 'space-y-1' : 'flex gap-2'}>
      <span className="text-xs font-semibold text-[var(--text-muted)] shrink-0">{label}:</span>
      <span className={`text-sm text-[var(--text-main)] ${multiline ? 'block whitespace-pre-wrap' : ''}`}>{value}</span>
    </div>
  )
}

function ErrBanner({ msg }: { msg: string }) {
  return <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">{msg}</div>
}

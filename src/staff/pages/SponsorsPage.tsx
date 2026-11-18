/**
 * SponsorsPage.tsx — /staff/sponsors and /admin/content/sponsors
 *
 * Real sponsor manager:
 *  - List by tier with logo thumbnails
 *  - Add / Edit form: name, logo upload (PNG/WebP/JPEG max 2 MB, sponsor-logos bucket, no SVG),
 *    website (https only, optional), tier, sort order
 *  - "Publish immediately" ON by default
 *  - Drag to reorder (sort_order field)
 *  - Publish / Unpublish per row
 *  - Delete admin only
 *  - Public Sponsors page and Home strip already hide when empty (no change needed there)
 */

import React, { useRef, useState } from 'react'
import {
  Handshake, Eye, EyeOff, Trash2, Pencil, PlusCircle, UploadCloud, X, GripVertical,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePortal } from '../context/PortalContext'
import { useToast } from '../components/Toast'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ContentStateBadge } from '../components/StatusBadge'
import { FullPageSpinner } from '../components/Loading'
import { Label, TextInput, SelectField, FormError } from '../components/StaffForm'
import { formatError } from '../services/helpers'
import { scheduleDeploy } from '../lib/deployScheduler'
import type { Sponsor, ContentState, SponsorTier } from '../../types/database'

const TIERS: SponsorTier[] = ['title', 'gold', 'silver', 'partner']
const TIER_LABELS: Record<SponsorTier, string> = {
  title: 'Title', gold: 'Gold', silver: 'Silver', partner: 'Partner',
}
const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const LOGO_MAX   = 2 * 1024 * 1024

// ─── Queries ──────────────────────────────────────────────────────────────────

function useSponsors() {
  const { client } = usePortal()
  return useQuery({
    queryKey: ['staff', 'sponsors'],
    queryFn: async () => {
      const { data, error } = await client
        .from('sponsors')
        .select('*')
        .order('tier')
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as Sponsor[]
    },
  })
}

function useSponsorMutations() {
  const { client } = usePortal()
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['staff', 'sponsors'] })

  const createMut = useMutation({
    mutationFn: async (input: Omit<Sponsor, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await client.from('sponsors').insert(input)
      if (error) throw error
      scheduleDeploy()
    },
    onSuccess: inv,
  })

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Sponsor> }) => {
      const { error } = await client.from('sponsors').update(patch).eq('id', id)
      if (error) throw error
      scheduleDeploy()
    },
    onSuccess: inv,
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.from('sponsors').delete().eq('id', id)
      if (error) throw error
      scheduleDeploy()
    },
    onSuccess: inv,
  })

  return { createMut, updateMut, deleteMut }
}

// ─── Logo upload ──────────────────────────────────────────────────────────────

async function uploadLogo(
  client: ReturnType<typeof usePortal>['client'],
  file: File,
): Promise<string> {
  if (!LOGO_TYPES.includes(file.type)) throw new Error('Only PNG, WebP and JPEG are accepted. No SVG.')
  if (file.size > LOGO_MAX) throw new Error('Logo file must be 2 MB or smaller.')

  const id  = crypto.randomUUID()
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${id}.${ext}`

  const { error } = await (client.storage as unknown as {
    from: (b: string) => {
      upload: (p: string, f: File, o: Record<string, unknown>) => Promise<{ error: unknown }>
      getPublicUrl: (p: string) => { data: { publicUrl: string } }
    }
  }).from('sponsor-logos').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(formatError(error))

  return (client.storage as unknown as {
    from: (b: string) => { getPublicUrl: (p: string) => { data: { publicUrl: string } } }
  }).from('sponsor-logos').getPublicUrl(path).data.publicUrl
}

// ─── Sponsor form dialog ──────────────────────────────────────────────────────

interface FormState {
  name:       string
  website:    string
  tier:       SponsorTier
  sortOrder:  string
  publishNow: boolean
}

function SponsorFormDialog({
  initial,
  onSave,
  onClose,
}: {
  initial?: Sponsor
  onSave: (data: Partial<Sponsor> & { logo_url?: string | null }) => Promise<void>
  onClose: () => void
}) {
  const isEdit = !!initial
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { client } = usePortal()

  const [form, setForm] = useState<FormState>({
    name:       initial?.name ?? '',
    website:    initial?.website_url ?? '',
    tier:       initial?.tier ?? 'gold',
    sortOrder:  String(initial?.sort_order ?? 999),
    publishNow: initial ? initial.state === 'published' : true,
  })
  const [logoFile,    setLogoFile]    = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(initial?.logo_url ?? null)
  const [errors,      setErrors]      = useState<Record<string, string>>({})
  const [saving,      setSaving]      = useState(false)

  const up = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }))

  const handleFile = (file: File) => {
    if (!LOGO_TYPES.includes(file.type)) { setErrors(e => ({ ...e, logo: 'Only PNG, WebP or JPEG allowed. No SVG.' })); return }
    if (file.size > LOGO_MAX) { setErrors(e => ({ ...e, logo: 'File must be 2 MB or smaller.' })); return }
    setErrors(e => { const n = { ...e }; delete n.logo; return n })
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Name is required.'
    if (form.website && !form.website.startsWith('https://')) errs.website = 'Website must start with https://'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      let logoUrl = initial?.logo_url ?? null
      if (logoFile) logoUrl = await uploadLogo(client, logoFile)
      await onSave({
        name:       form.name.trim(),
        website_url: form.website.trim() || null,
        tier:       form.tier,
        sort_order: parseInt(form.sortOrder, 10) || 999,
        state:      form.publishNow ? 'published' : 'draft',
        logo_url:   logoUrl,
      })
      onClose()
    } catch (err) {
      setErrors(e => ({ ...e, _form: formatError(err) }))
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-[var(--text-main)]">
            {isEdit ? 'Edit sponsor' : 'Add sponsor'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)]">
            <X size={18} />
          </button>
        </div>

        {errors._form && (
          <div className="px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {errors._form}
          </div>
        )}

        {/* Logo */}
        <div className="space-y-2">
          <Label htmlFor="logo-upload">Logo (PNG, WebP or JPEG · max 2 MB)</Label>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-section-alt)] flex items-center justify-center overflow-hidden shrink-0">
              {logoPreview
                ? <img src={logoPreview} alt="logo preview" className="w-full h-full object-contain" />
                : <Handshake size={24} className="text-[var(--text-muted)]" />}
            </div>
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-main)] hover:bg-[var(--bg-section-alt)]">
              <UploadCloud size={14} />
              {logoPreview ? 'Change logo' : 'Upload logo'}
            </button>
            <input ref={fileInputRef} type="file" accept={LOGO_TYPES.join(',')} hidden
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
          {errors.logo && <FormError message={errors.logo} />}
        </div>

        {/* Name */}
        <div>
          <Label htmlFor="sp-name" required>Name</Label>
          <TextInput id="sp-name" value={form.name} onChange={e => up('name', e.target.value)} />
          {errors.name && <FormError message={errors.name} />}
        </div>

        {/* Website */}
        <div>
          <Label htmlFor="sp-web" hint="optional">Website (https://…)</Label>
          <TextInput id="sp-web" value={form.website} onChange={e => up('website', e.target.value)} placeholder="https://example.com" />
          {errors.website && <FormError message={errors.website} />}
        </div>

        {/* Tier + sort order */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="sp-tier">Tier</Label>
            <SelectField id="sp-tier" value={form.tier} onChange={e => up('tier', e.target.value as SponsorTier)}>
              {TIERS.map(t => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
            </SelectField>
          </div>
          <div>
            <Label htmlFor="sp-sort">Sort order</Label>
            <TextInput id="sp-sort" type="number" value={form.sortOrder} onChange={e => up('sortOrder', e.target.value)} />
          </div>
        </div>

        {/* Publish immediately */}
        <label className="inline-flex items-center gap-2 text-sm text-[var(--text-main)] cursor-pointer">
          <input type="checkbox" checked={form.publishNow} onChange={e => up('publishNow', e.target.checked)}
            className="w-4 h-4 rounded accent-[#0F3D2E]" />
          Publish immediately
        </label>

        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-main)] hover:bg-[var(--bg-section-alt)]">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold disabled:opacity-50 hover:bg-[#0A2A20]">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add sponsor'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SponsorsPage() {
  const { t } = useTranslation()
  const { canDelete } = usePortal()
  const { showToast } = useToast()

  const { data: sponsors, isLoading } = useSponsors()
  const { createMut, updateMut, deleteMut } = useSponsorMutations()

  const [formOpen,     setFormOpen]    = useState(false)
  const [editTarget,   setEditTarget]  = useState<Sponsor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Sponsor | null>(null)

  // drag-to-reorder state
  const [dragId, setDragId] = useState<string | null>(null)
  const { client } = usePortal()
  const qc = useQueryClient()

  const handleSave = async (data: Partial<Sponsor>) => {
    if (editTarget) {
      await updateMut.mutateAsync({ id: editTarget.id, patch: data })
      showToast({ type: 'success', message: 'Sponsor updated.' })
    } else {
      await createMut.mutateAsync(data as Omit<Sponsor, 'id' | 'created_at' | 'updated_at'>)
      showToast({ type: 'success', message: 'Sponsor added.' })
    }
    setFormOpen(false); setEditTarget(null)
  }

  const handleToggle = async (s: Sponsor) => {
    const newState: ContentState = s.state === 'published' ? 'draft' : 'published'
    try {
      await updateMut.mutateAsync({ id: s.id, patch: { state: newState } })
      showToast({ type: 'success', message: `Sponsor ${newState === 'published' ? 'published' : 'unpublished'}.` })
    } catch (err) { showToast({ type: 'error', message: formatError(err) }) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMut.mutateAsync(deleteTarget.id)
      showToast({ type: 'success', message: 'Sponsor deleted.' })
    } catch (err) { showToast({ type: 'error', message: formatError(err) }) }
    finally { setDeleteTarget(null) }
  }

  // Drag reorder helpers
  const handleDrop = async (overSponsor: Sponsor) => {
    if (!dragId || dragId === overSponsor.id || !sponsors) { setDragId(null); return }
    const dragItem = sponsors.find(s => s.id === dragId)
    if (!dragItem) { setDragId(null); return }

    // Reorder: swap sort_order values
    try {
      await Promise.all([
        client.from('sponsors').update({ sort_order: overSponsor.sort_order }).eq('id', dragId),
        client.from('sponsors').update({ sort_order: dragItem.sort_order }).eq('id', overSponsor.id),
      ])
      qc.invalidateQueries({ queryKey: ['staff', 'sponsors'] })
    } catch (err) { showToast({ type: 'error', message: formatError(err) }) }
    setDragId(null)
  }

  if (isLoading) return <FullPageSpinner label={t('staff.common.loading')} />

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0F3D2E] text-[#D9A441]">
            <Handshake size={20} />
          </div>
          <h1 className="font-display text-xl font-bold text-[var(--text-main)]">Sponsors</h1>
        </div>
        <button
          onClick={() => { setEditTarget(null); setFormOpen(true) }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20]"
        >
          <PlusCircle size={16} /> Add sponsor
        </button>
      </div>

      {/* Empty state */}
      {(!sponsors || sponsors.length === 0) && (
        <div className="flex flex-col items-center gap-4 py-16">
          <Handshake size={48} className="text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-muted)]">No sponsors yet.</p>
          <button onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20]">
            <PlusCircle size={16} /> Add first sponsor
          </button>
        </div>
      )}

      {/* Tier groups */}
      {sponsors && sponsors.length > 0 && (
        <div className="space-y-6">
          {TIERS.map(tier => {
            const group = sponsors.filter(s => s.tier === tier)
            if (group.length === 0) return null
            return (
              <div key={tier} className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] px-1">
                  {TIER_LABELS[tier]}
                </h2>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] overflow-hidden">
                  <div className="divide-y divide-[var(--border-subtle)]">
                    {group.map(s => (
                      <div
                        key={s.id}
                        draggable
                        onDragStart={() => setDragId(s.id)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => handleDrop(s)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-section-alt)] cursor-grab active:cursor-grabbing"
                      >
                        {/* Drag handle */}
                        <GripVertical size={16} className="text-[var(--text-muted)] shrink-0" />

                        {/* Logo thumbnail */}
                        <div className="w-10 h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-section-alt)] flex items-center justify-center shrink-0 overflow-hidden">
                          {s.logo_url
                            ? <img src={s.logo_url} alt={s.name} className="w-full h-full object-contain" />
                            : <Handshake size={18} className="text-[var(--text-muted)]" />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text-main)] truncate">{s.name}</p>
                          {s.website_url && (
                            <a href={s.website_url} target="_blank" rel="noreferrer"
                              className="text-xs text-[var(--text-muted)] hover:underline truncate block" onClick={e => e.stopPropagation()}>
                              {s.website_url}
                            </a>
                          )}
                        </div>

                        <ContentStateBadge state={s.state as ContentState} />

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => handleToggle(s)} title={s.state === 'published' ? 'Unpublish' : 'Publish'}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] hover:text-[var(--text-main)] transition-colors">
                            {s.state === 'published' ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                          <button onClick={() => { setEditTarget(s); setFormOpen(true) }} title="Edit"
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] hover:text-[var(--text-main)] transition-colors">
                            <Pencil size={15} />
                          </button>
                          {canDelete && (
                            <button onClick={() => setDeleteTarget(s)} title="Delete"
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Form dialog */}
      {formOpen && (
        <SponsorFormDialog
          initial={editTarget ?? undefined}
          onSave={handleSave}
          onClose={() => { setFormOpen(false); setEditTarget(null) }}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete sponsor?"
        message={`"${deleteTarget?.name ?? ''}" will be permanently deleted.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

/**
 * CommitteePage.tsx — /staff/committee and /admin/content/committee
 *
 * Five fixed committees (registry in code, names in EN / AM / OM).
 * Each section: leader card first, then members.
 * Features: Add leader / Add member, Edit, Make leader (swaps old leader to member),
 * photo upload (committee bucket, JPEG/PNG/WebP/AVIF, max 5 MB, resized to 480 px),
 * role title in 3 languages (English required), drag to reorder, "Publish immediately" ON,
 * delete admin only.
 * Removes the "forms are planned for a future phase" notice.
 */

import React, { useRef, useState } from 'react'
import {
  Users2, PlusCircle, Pencil, Trash2, Eye, EyeOff,
  Crown, UserPlus, GripVertical, X, UploadCloud,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePortal } from '../context/PortalContext'
import { useToast } from '../components/Toast'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ContentStateBadge } from '../components/StatusBadge'
import { FullPageSpinner } from '../components/Loading'
import { Label, TextInput, FormError } from '../components/StaffForm'
import { formatError } from '../services/helpers'
import { scheduleDeploy } from '../lib/deployScheduler'
import type { CommitteeMember, ContentState } from '../../types/database'

// ─── Committee registry ───────────────────────────────────────────────────────

type CommitteeKey =
  | 'publicity_promotion'
  | 'technical_physical'
  | 'sponsorship_fundraising'
  | 'award_beauty_contest'
  | 'documentation'

interface CommitteeInfo {
  key:   CommitteeKey
  nameEn: string
  nameAm: string   // draft — needs native review
  nameOm: string   // draft — needs native review
}

const COMMITTEES: CommitteeInfo[] = [
  {
    key: 'publicity_promotion',
    nameEn: 'Publicity & Promotion Committee',
    nameAm: 'የህዝብ ግንኙነት እና ማስተዋወቅ ኮሚቴ',           // draft
    nameOm: 'Koree Beeksisaa fi Fooyyessuu (needs native review)',
  },
  {
    key: 'technical_physical',
    nameEn: 'Technical & Physical Arrangement Committee',
    nameAm: 'ቴክኒካዊ እና አካላዊ ዝግጅት ኮሚቴ',               // draft
    nameOm: 'Koree Qophii Tekniikaa fi Qaamaa (needs native review)',
  },
  {
    key: 'sponsorship_fundraising',
    nameEn: 'Sponsorship / Fundraising Committee',
    nameAm: 'ስፖንሰርሺፕ / ፈንድ ማሰባሰቢያ ኮሚቴ',             // draft
    nameOm: 'Koree Ispansarashippii / Maallaqa Walitti Qabuu (needs native review)',
  },
  {
    key: 'award_beauty_contest',
    nameEn: 'Award & Beauty Contest Committee',
    nameAm: 'ሽልማት እና ቁንጅና ውድድር ኮሚቴ',                // draft
    nameOm: 'Koree Badhaasaa fi Dorgommii Bareedinaa (needs native review)',
  },
  {
    key: 'documentation',
    nameEn: 'Documentation Committee',
    nameAm: 'ሰነድ አፈሪ ኮሚቴ',                             // draft
    nameOm: 'Koree Galmee (needs native review)',
  },
]

// ─── Extended DB row (migration 015 columns) ──────────────────────────────────

interface CommitteeMemberExtended extends CommitteeMember {
  committee_key: CommitteeKey | null
  is_leader:     boolean
  edition_id:    string | null
}

// ─── Photo resize + upload ────────────────────────────────────────────────────

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const PHOTO_MAX   = 5 * 1024 * 1024
const PHOTO_SIZE  = 480

function resizeToWebP(file: File, maxPx: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.round(img.naturalWidth * scale)
      const h = Math.round(img.naturalHeight * scale)
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d')!.drawImage(img, 0, 0, w, h)
      c.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/webp', 0.88)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

async function uploadPhoto(
  client: ReturnType<typeof usePortal>['client'],
  file: File,
): Promise<string> {
  if (!PHOTO_TYPES.includes(file.type)) throw new Error('Only JPEG, PNG, WebP or AVIF allowed.')
  if (file.size > PHOTO_MAX) throw new Error('File must be 5 MB or smaller.')
  const blob = await resizeToWebP(file, PHOTO_SIZE)
  const path = `${crypto.randomUUID()}.webp`
  const { error } = await (client.storage as unknown as {
    from: (b: string) => { upload: (p: string, b: Blob, o: Record<string, unknown>) => Promise<{ error: unknown }>; getPublicUrl: (p: string) => { data: { publicUrl: string } } }
  }).from('committee').upload(path, blob, { contentType: 'image/webp', upsert: false })
  if (error) throw new Error(formatError(error))
  return (client.storage as unknown as {
    from: (b: string) => { getPublicUrl: (p: string) => { data: { publicUrl: string } } }
  }).from('committee').getPublicUrl(path).data.publicUrl
}

// ─── Queries ──────────────────────────────────────────────────────────────────

function useCommitteeMembers() {
  const { client } = usePortal()
  return useQuery({
    queryKey: ['staff', 'committee'],
    queryFn: async () => {
      const { data, error } = await client
        .from('committee_members')
        .select('*')
        .order('is_leader', { ascending: false })
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as CommitteeMemberExtended[]
    },
  })
}

function useCommitteeMutations() {
  const { client } = usePortal()
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['staff', 'committee'] })

  const createMut = useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { error } = await client.from('committee_members').insert(input)
      if (error) throw error
      scheduleDeploy()
    },
    onSuccess: inv,
  })

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await client.from('committee_members').update(patch).eq('id', id)
      if (error) throw error
      scheduleDeploy()
    },
    onSuccess: inv,
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.from('committee_members').delete().eq('id', id)
      if (error) throw error
      scheduleDeploy()
    },
    onSuccess: inv,
  })

  // Make leader: set target to leader, demote old leader to member
  const makeLeaderMut = useMutation({
    mutationFn: async ({ targetId, oldLeaderId }: { targetId: string; oldLeaderId?: string }) => {
      const ops = []
      if (oldLeaderId) ops.push(client.from('committee_members').update({ is_leader: false }).eq('id', oldLeaderId))
      ops.push(client.from('committee_members').update({ is_leader: true }).eq('id', targetId))
      await Promise.all(ops)
      scheduleDeploy()
    },
    onSuccess: inv,
  })

  return { createMut, updateMut, deleteMut, makeLeaderMut }
}

// ─── Member form dialog ───────────────────────────────────────────────────────

interface MemberFormState {
  fullName:    string
  roleEn:      string
  roleAm:      string
  roleOm:      string
  bioEn:       string
  bioAm:       string
  bioOm:       string
  department:  string
  isLeader:    boolean
  sortOrder:   string
  publishNow:  boolean
}

function MemberFormDialog({
  committeeKey,
  initial,
  onSave,
  onClose,
}: {
  committeeKey: CommitteeKey
  initial?: CommitteeMemberExtended
  onSave: (data: Record<string, unknown>) => Promise<void>
  onClose: () => void
}) {
  const { client } = usePortal()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isEdit = !!initial

  const roleI18n = initial?.role_i18n as { en?: string; am?: string; om?: string } | null ?? {}
  const bioI18n  = (initial as any)?.bio_i18n as { en?: string; am?: string; om?: string } | null ?? {}
  const [form, setForm] = useState<MemberFormState>({
    fullName:   initial?.full_name ?? '',
    roleEn:     roleI18n.en ?? '',
    roleAm:     roleI18n.am ?? '',
    roleOm:     roleI18n.om ?? '',
    bioEn:      bioI18n.en  ?? '',
    bioAm:      bioI18n.am  ?? '',
    bioOm:      bioI18n.om  ?? '',
    department: (initial as any)?.department ?? '',
    isLeader:   initial?.is_leader ?? false,
    sortOrder:  String(initial?.sort_order ?? 999),
    publishNow: initial ? initial.state === 'published' : true,
  })
  const [photoFile,    setPhotoFile]    = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial?.photo_url ?? null)
  const [errors,       setErrors]       = useState<Record<string, string>>({})
  const [saving,       setSaving]       = useState(false)

  const up = <K extends keyof MemberFormState>(k: K, v: MemberFormState[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const handleFile = (file: File) => {
    if (!PHOTO_TYPES.includes(file.type)) { setErrors(e => ({ ...e, photo: 'Only JPEG, PNG, WebP or AVIF allowed.' })); return }
    if (file.size > PHOTO_MAX) { setErrors(e => ({ ...e, photo: 'File must be 5 MB or smaller.' })); return }
    setErrors(e => { const n = { ...e }; delete n.photo; return n })
    setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file))
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.fullName.trim()) errs.fullName = 'Full name is required.'
    if (!form.roleEn.trim())   errs.roleEn   = 'English role title is required.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      let photoUrl = initial?.photo_url ?? null
      if (photoFile) photoUrl = await uploadPhoto(client, photoFile)

      const { data: edition } = await client.from('edition_public').select('id').eq('is_current', true).single()

      await onSave({
        full_name:     form.fullName.trim(),
        role_i18n:     { en: form.roleEn.trim(), ...(form.roleAm ? { am: form.roleAm.trim() } : {}), ...(form.roleOm ? { om: form.roleOm.trim() } : {}) },
        bio_i18n:      form.bioEn.trim() ? { en: form.bioEn.trim(), ...(form.bioAm ? { am: form.bioAm.trim() } : {}), ...(form.bioOm ? { om: form.bioOm.trim() } : {}) } : null,
        department:    form.department.trim() || null,
        photo_url:     photoUrl,
        is_leader:     form.isLeader,
        committee_key: committeeKey,
        edition_id:    edition?.id ?? null,
        sort_order:    parseInt(form.sortOrder, 10) || 999,
        state:         form.publishNow ? 'published' : 'draft',
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
            {isEdit ? 'Edit member' : form.isLeader ? 'Add leader' : 'Add member'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)]"><X size={18} /></button>
        </div>

        {errors._form && (
          <div className="px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 text-sm text-red-700 dark:text-red-300">
            {errors._form}
          </div>
        )}

        {/* Photo */}
        <div className="space-y-2">
          <Label htmlFor="mem-photo">Photo (JPEG, PNG, WebP or AVIF · max 5 MB)</Label>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-section-alt)] overflow-hidden flex items-center justify-center shrink-0">
              {photoPreview
                ? <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                : <span className="text-xl font-bold text-[var(--text-muted)]">{form.fullName.charAt(0) || '?'}</span>}
            </div>
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-main)] hover:bg-[var(--bg-section-alt)]">
              <UploadCloud size={14} /> {photoPreview ? 'Change' : 'Upload'} photo
            </button>
            <input ref={fileInputRef} type="file" accept={PHOTO_TYPES.join(',')} hidden
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
          {errors.photo && <FormError message={errors.photo} />}
        </div>

        {/* Full name */}
        <div>
          <Label htmlFor="mem-name" required>Full name</Label>
          <TextInput id="mem-name" value={form.fullName} onChange={e => up('fullName', e.target.value)} />
          {errors.fullName && <FormError message={errors.fullName} />}
        </div>

        {/* Role in 3 languages */}
        <div>
          <Label htmlFor="mem-role-en" required>Role (English)</Label>
          <TextInput id="mem-role-en" value={form.roleEn} onChange={e => up('roleEn', e.target.value)} placeholder="e.g. Committee Chair" />
          {errors.roleEn && <FormError message={errors.roleEn} />}
        </div>
        <div>
          <Label htmlFor="mem-role-am" hint="optional">Role (Amharic)</Label>
          <TextInput id="mem-role-am" value={form.roleAm} onChange={e => up('roleAm', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="mem-role-om" hint="optional">Role (Afaan Oromo)</Label>
          <TextInput id="mem-role-om" value={form.roleOm} onChange={e => up('roleOm', e.target.value)} />
        </div>

        {/* Department */}
        <div>
          <Label htmlFor="mem-dept" hint="optional">Department / unit</Label>
          <TextInput id="mem-dept" value={form.department} onChange={e => up('department', e.target.value)} placeholder="e.g. Tourism & Hotel Management" />
        </div>

        {/* Bio in 3 languages */}
        <div>
          <Label htmlFor="mem-bio-en" hint="optional">Short bio (English)</Label>
          <textarea id="mem-bio-en" rows={2} value={form.bioEn} onChange={e => up('bioEn', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A441]" />
        </div>
        <div>
          <Label htmlFor="mem-bio-am" hint="optional">Short bio (Amharic)</Label>
          <textarea id="mem-bio-am" rows={2} value={form.bioAm} onChange={e => up('bioAm', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A441]" />
        </div>
        <div>
          <Label htmlFor="mem-bio-om" hint="optional">Short bio (Afaan Oromo)</Label>
          <textarea id="mem-bio-om" rows={2} value={form.bioOm} onChange={e => up('bioOm', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A441]" />
        </div>

        {/* Leader / sort */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="mem-sort">Sort order</Label>
            <TextInput id="mem-sort" type="number" value={form.sortOrder} onChange={e => up('sortOrder', e.target.value)} />
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-[var(--text-main)] cursor-pointer">
          <input type="checkbox" checked={form.publishNow} onChange={e => up('publishNow', e.target.checked)}
            className="w-4 h-4 rounded accent-[#0F3D2E]" />
          Publish immediately
        </label>

        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-sm hover:bg-[var(--bg-section-alt)]">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold disabled:opacity-50 hover:bg-[#0A2A20]">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Single committee section ─────────────────────────────────────────────────

function CommitteeSection({
  info,
  members,
  canDelete,
  onAddLeader,
  onAddMember,
  onEdit,
  onMakeLeader,
  onToggle,
  onDelete,
  onDrop,
  onDragStart,
}: {
  info:        CommitteeInfo
  members:     CommitteeMemberExtended[]
  canDelete:   boolean
  onAddLeader: () => void
  onAddMember: () => void
  onEdit:      (m: CommitteeMemberExtended) => void
  onMakeLeader:(m: CommitteeMemberExtended) => void
  onToggle:    (m: CommitteeMemberExtended) => void
  onDelete:    (m: CommitteeMemberExtended) => void
  onDrop:      (over: CommitteeMemberExtended) => void
  onDragStart: (m: CommitteeMemberExtended) => void
}) {
  const leader  = members.find(m => m.is_leader)
  const others  = members.filter(m => !m.is_leader)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-bold text-[var(--text-main)] flex items-center gap-2">
          {info.nameEn}
          <span className="text-[10px] font-normal text-[var(--text-muted)] normal-case">{info.nameAm}</span>
        </h2>
        <div className="flex items-center gap-1.5">
          {!leader && (
            <button onClick={onAddLeader}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#D9A441] text-[#D9A441] text-xs font-semibold hover:bg-[#D9A441]/10 transition-colors">
              <Crown size={12} /> Add leader
            </button>
          )}
          <button onClick={onAddMember}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] transition-colors">
            <UserPlus size={12} /> Add member
          </button>
        </div>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] italic px-1">No members yet — add a leader to get started.</p>
      ) : (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] overflow-hidden">
          <div className="divide-y divide-[var(--border-subtle)]">
            {/* Leader first */}
            {[...(leader ? [leader] : []), ...others].map(m => {
              const role = (m.role_i18n as { en?: string } | null)?.en ?? ''
              const dept = (m as any)?.department ?? ''
              return (
                <div
                  key={m.id}
                  draggable
                  onDragStart={() => onDragStart(m)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => onDrop(m)}
                  className={[
                    'flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-section-alt)] cursor-grab',
                    m.is_leader ? 'bg-[#D9A441]/5' : '',
                  ].join(' ')}
                >
                  <GripVertical size={15} className="text-[var(--text-muted)] shrink-0" />

                  {/* Photo */}
                  <div className="w-10 h-10 rounded-full bg-[var(--bg-section-alt)] border border-[var(--border-subtle)] overflow-hidden flex items-center justify-center shrink-0">
                    {m.photo_url
                      ? <img src={m.photo_url} alt={m.full_name} className="w-full h-full object-cover" />
                      : <span className="text-sm font-bold text-[var(--text-muted)]">{m.full_name.charAt(0)}</span>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-[var(--text-main)] truncate">{m.full_name}</p>
                      {m.is_leader && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[#D9A441]/20 text-[#C59132] dark:text-[#D9A441]">
                          <Crown size={9} /> Leader
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] truncate">{role}</p>
                    {dept && <p className="text-[10px] text-[var(--text-muted)] truncate">{dept}</p>}
                  </div>

                  <ContentStateBadge state={m.state as ContentState} />

                  <div className="flex items-center gap-1 shrink-0">
                    {!m.is_leader && (
                      <button onClick={() => onMakeLeader(m)} title="Make leader"
                        className="p-1.5 rounded-lg text-[#D9A441] hover:bg-[#D9A441]/10 transition-colors">
                        <Crown size={14} />
                      </button>
                    )}
                    <button onClick={() => onToggle(m)} title={m.state === 'published' ? 'Unpublish' : 'Publish'}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] transition-colors">
                      {m.state === 'published' ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button onClick={() => onEdit(m)} title="Edit"
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] transition-colors">
                      <Pencil size={14} />
                    </button>
                    {canDelete && (
                      <button onClick={() => onDelete(m)} title="Delete"
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CommitteePage() {
  const { t } = useTranslation()
  const { canDelete } = usePortal()
  const { showToast } = useToast()
  const { client } = usePortal()
  const qc = useQueryClient()

  const { data: members, isLoading } = useCommitteeMembers()
  const { createMut, updateMut, deleteMut, makeLeaderMut } = useCommitteeMutations()

  // Form state
  const [formOpen,       setFormOpen]       = useState(false)
  const [formCommittee,  setFormCommittee]  = useState<CommitteeKey>('publicity_promotion')
  const [formAsLeader,   setFormAsLeader]   = useState(false)
  const [editTarget,     setEditTarget]     = useState<CommitteeMemberExtended | null>(null)
  const [deleteTarget,   setDeleteTarget]   = useState<CommitteeMemberExtended | null>(null)
  const [dragId,         setDragId]         = useState<string | null>(null)

  const getMembersOf = (key: CommitteeKey) =>
    (members ?? []).filter(m => m.committee_key === key)

  const handleSave = async (data: Record<string, unknown>) => {
    if (editTarget) {
      await updateMut.mutateAsync({ id: editTarget.id, patch: data })
      showToast({ type: 'success', message: 'Member updated.' })
    } else {
      await createMut.mutateAsync(data)
      showToast({ type: 'success', message: 'Member added.' })
    }
    setFormOpen(false); setEditTarget(null)
  }

  const handleToggle = async (m: CommitteeMemberExtended) => {
    const newState: ContentState = m.state === 'published' ? 'draft' : 'published'
    try {
      await updateMut.mutateAsync({ id: m.id, patch: { state: newState } })
      showToast({ type: 'success', message: `Member ${newState === 'published' ? 'published' : 'unpublished'}.` })
    } catch (err) { showToast({ type: 'error', message: formatError(err) }) }
  }

  const handleMakeLeader = async (m: CommitteeMemberExtended) => {
    const existing = (members ?? []).find(x => x.committee_key === m.committee_key && x.is_leader && x.id !== m.id)
    try {
      await makeLeaderMut.mutateAsync({ targetId: m.id, oldLeaderId: existing?.id })
      showToast({ type: 'success', message: `${m.full_name} is now the leader.` })
    } catch (err) { showToast({ type: 'error', message: formatError(err) }) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMut.mutateAsync(deleteTarget.id)
      showToast({ type: 'success', message: 'Member deleted.' })
    } catch (err) { showToast({ type: 'error', message: formatError(err) }) }
    finally { setDeleteTarget(null) }
  }

  const handleDrop = async (over: CommitteeMemberExtended) => {
    if (!dragId || dragId === over.id || !members) { setDragId(null); return }
    const dragItem = members.find(m => m.id === dragId)
    if (!dragItem) { setDragId(null); return }
    try {
      await Promise.all([
        client.from('committee_members').update({ sort_order: over.sort_order }).eq('id', dragId),
        client.from('committee_members').update({ sort_order: dragItem.sort_order }).eq('id', over.id),
      ])
      qc.invalidateQueries({ queryKey: ['staff', 'committee'] })
    } catch (err) { showToast({ type: 'error', message: formatError(err) }) }
    setDragId(null)
  }

  if (isLoading) return <FullPageSpinner label={t('staff.common.loading')} />

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0F3D2E] text-[#D9A441]">
          <Users2 size={20} />
        </div>
        <h1 className="font-display text-xl font-bold text-[var(--text-main)]">Organizing Committees</h1>
      </div>

      {/* One section per committee */}
      {COMMITTEES.map(info => (
        <CommitteeSection
          key={info.key}
          info={info}
          members={getMembersOf(info.key)}
          canDelete={canDelete}
          onAddLeader={() => { setFormCommittee(info.key); setFormAsLeader(true); setEditTarget(null); setFormOpen(true) }}
          onAddMember={() => { setFormCommittee(info.key); setFormAsLeader(false); setEditTarget(null); setFormOpen(true) }}
          onEdit={m => { setEditTarget(m); setFormCommittee(info.key); setFormOpen(true) }}
          onMakeLeader={handleMakeLeader}
          onToggle={handleToggle}
          onDelete={setDeleteTarget}
          onDrop={handleDrop}
          onDragStart={m => setDragId(m.id)}
        />
      ))}

      {/* Member form dialog */}
      {formOpen && (
        <MemberFormDialog
          committeeKey={formCommittee}
          initial={editTarget ?? undefined}
          onSave={handleSave}
          onClose={() => { setFormOpen(false); setEditTarget(null) }}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete committee member?"
        message={`"${deleteTarget?.full_name ?? ''}" will be permanently deleted.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

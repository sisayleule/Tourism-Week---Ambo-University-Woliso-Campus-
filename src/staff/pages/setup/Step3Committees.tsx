/**
 * Step3Committees.tsx — Committees
 *
 * Five committees. Each has:
 *  - Leader form: full name, title (3 langs), photo, department, bio (3 langs)
 *  - Contact: email, phone, telegram + "Show on website" toggle (OFF default)
 *  - Members: name, role (3 langs), photo (optional)
 */

import React, { useRef, useState } from 'react'
import {
  Crown, UserPlus, Pencil, Trash2, Loader2,
  Eye, EyeOff, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react'
import { usePortal } from '../../context/PortalContext'
import { useToast } from '../../components/Toast'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { I18nTabs, type I18nLang } from '../../components/I18nTabs'
import { Label, TextInput, TextArea, FormError } from '../../components/StaffForm'
import { formatError } from '../../services/helpers'
import { FullPageSpinner } from '../../components/Loading'
import {
  useSetupCommittee,
  useCreateSetupCommitteeMember,
  useUpdateSetupCommitteeMember,
  useDeleteSetupCommitteeMember,
  useUpsertMemberContact,
} from '../../hooks/useSetupQueries'
import type {
  CommitteeMember,
  CommitteeMemberContact,
  CommitteeKey,
  I18nJson,
} from '../../../types/database'
import type { SetupCommitteeMemberFull } from '../../services/setupService'

// ─── Committee registry ───────────────────────────────────────────────────────

const COMMITTEES: { key: CommitteeKey; name: string }[] = [
  { key: 'publicity_promotion',     name: 'Publicity & Promotion' },
  { key: 'technical_physical',      name: 'Technical & Physical Arrangement' },
  { key: 'sponsorship_fundraising', name: 'Sponsorship / Fundraising' },
  { key: 'award_beauty_contest',    name: 'Award & Beauty Contest' },
  { key: 'documentation',           name: 'Documentation' },
]

// ─── Photo upload ─────────────────────────────────────────────────────────────

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const PHOTO_MAX   = 5 * 1024 * 1024
const PHOTO_SIZE  = 480

function resizePhoto(file: File): Promise<Blob> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file)
    const img  = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, PHOTO_SIZE / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.round(img.naturalWidth * scale)
      const h = Math.round(img.naturalHeight * scale)
      const c = document.createElement('canvas'); c.width = w; c.height = h
      c.getContext('2d')!.drawImage(img, 0, 0, w, h)
      c.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/webp', 0.88)
    }
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Image load failed')) }
    img.src = url
  })
}

async function uploadMemberPhoto(
  client: ReturnType<typeof usePortal>['client'],
  memberId: string,
  file: File
): Promise<string> {
  if (!PHOTO_TYPES.includes(file.type)) throw new Error('Only JPEG, PNG, WebP or AVIF allowed.')
  if (file.size > PHOTO_MAX) throw new Error('File must be 5 MB or smaller.')
  const blob = await resizePhoto(file)
  const path = `committee/${memberId}.webp`
  const { error } = await client.storage.from('committee').upload(path, blob, { upsert: true, contentType: 'image/webp' })
  if (error) throw new Error(error.message)
  const { data } = client.storage.from('committee').getPublicUrl(path)
  return data.publicUrl
}

// ─── Member form ──────────────────────────────────────────────────────────────

interface MemberFormProps {
  committeeKey: CommitteeKey
  editionId:    string
  initial?:     SetupCommitteeMemberFull
  isLeader?:    boolean
  onDone:       () => void
}

function MemberForm({ committeeKey, editionId, initial, isLeader, onDone }: MemberFormProps) {
  const { client, canDelete } = usePortal()
  const { showToast } = useToast()
  const isEdit = !!initial

  const createMut  = useCreateSetupCommitteeMember(client, editionId)
  const updateMut  = useUpdateSetupCommitteeMember(client, editionId)
  const contactMut = useUpsertMemberContact(client, editionId)

  const [lang,       setLang]       = useState<I18nLang>('en')
  const [fullName,   setFullName]   = useState(initial?.full_name ?? '')
  const [roleEn,     setRoleEn]     = useState(initial?.role_i18n?.en ?? '')
  const [roleAm,     setRoleAm]     = useState(initial?.role_i18n?.am ?? '')
  const [roleOm,     setRoleOm]     = useState(initial?.role_i18n?.om ?? '')
  const [bioEn,      setBioEn]      = useState((initial?.bio_i18n as any)?.en ?? '')
  const [bioAm,      setBioAm]      = useState((initial?.bio_i18n as any)?.am ?? '')
  const [bioOm,      setBioOm]      = useState((initial?.bio_i18n as any)?.om ?? '')
  const [department, setDepartment] = useState((initial as any)?.department ?? '')
  const [photoFile,  setPhotoFile]  = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial?.photo_url ?? null)
  const [email,      setEmail]      = useState(initial?.contact?.email ?? '')
  const [phone,      setPhone]      = useState(initial?.contact?.phone ?? '')
  const [telegram,   setTelegram]   = useState(initial?.contact?.telegram ?? '')
  const [showPublic, setShowPublic] = useState(initial?.contact?.show_public ?? false)
  const [saving,     setSaving]     = useState(false)
  const [errors,     setErrors]     = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!fullName.trim()) errs.fullName = 'Full name is required.'
    if (!roleEn.trim())   errs.roleEn   = 'English role title is required.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      let photoUrl = initial?.photo_url ?? null
      let memberId = initial?.id ?? ''

      const payload = {
        full_name:     fullName,
        role_i18n:     { en: roleEn, am: roleAm || undefined, om: roleOm || undefined } as I18nJson,
        bio_i18n:      bioEn ? { en: bioEn, am: bioAm || undefined, om: bioOm || undefined } as I18nJson : null,
        department:    department || null,
        committee_key: committeeKey,
        edition_id:    editionId,
        // For new members: use the isLeader prop passed by the parent button click.
        // For edits: preserve whatever is_leader value is already in DB.
        is_leader:     isEdit ? (initial?.is_leader ?? false) : (isLeader ?? false),
        sort_order:    initial?.sort_order ?? 999,
        state:         (initial?.state ?? 'published') as 'draft' | 'published',
        photo_url:     photoUrl,
      }

      if (isEdit) {
        // Upload photo first if changed
        if (photoFile) {
          photoUrl = await uploadMemberPhoto(client, initial!.id, photoFile)
        }
        await updateMut.mutateAsync({ memberId: initial!.id, patch: { ...payload, photo_url: photoUrl } })
        memberId = initial!.id
      } else {
        const created = await createMut.mutateAsync(payload as any)
        memberId = created.id
        if (photoFile) {
          photoUrl = await uploadMemberPhoto(client, memberId, photoFile)
          await updateMut.mutateAsync({ memberId, patch: { photo_url: photoUrl } })
        }
      }

      // Save contact
      if (email || phone || telegram || showPublic) {
        await contactMut.mutateAsync({
          memberId,
          patch: { email: email || null, phone: phone || null, telegram: telegram || null, show_public: showPublic },
        })
      }

      showToast({ type: 'success', message: isEdit ? 'Member updated.' : 'Member added.' })
      onDone()
    } catch (err) {
      showToast({ type: 'error', message: formatError(err) })
    } finally {
      setSaving(false)
    }
  }

  const cls = 'w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A441]'

  return (
    <div className="space-y-5 py-4">
      <I18nTabs value={lang} onChange={setLang} />

      <div className="space-y-1.5">
        <Label htmlFor="fullName" required>Full name</Label>
        <TextInput id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} />
        {errors.fullName && <FormError message={errors.fullName} />}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="role" required={lang === 'en'}>
          {lang === 'en' ? 'Role / title' : lang === 'am' ? 'ሚና (Amharic)' : 'Gahee (Oromo)'}
        </Label>
        <TextInput id="role"
          value={lang === 'en' ? roleEn : lang === 'am' ? roleAm : roleOm}
          onChange={e => { const v = e.target.value; if (lang === 'en') setRoleEn(v); else if (lang === 'am') setRoleAm(v); else setRoleOm(v) }}
        />
        {errors.roleEn && lang === 'en' && <FormError message={errors.roleEn} />}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bio">Short bio</Label>
        <textarea id="bio" rows={3} className={cls}
          value={lang === 'en' ? bioEn : lang === 'am' ? bioAm : bioOm}
          onChange={e => { const v = e.target.value; if (lang === 'en') setBioEn(v); else if (lang === 'am') setBioAm(v); else setBioOm(v) }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dept">Department / unit</Label>
        <TextInput id="dept" value={department} onChange={e => setDepartment(e.target.value)} />
      </div>

      {/* Photo */}
      <div className="space-y-2">
        <Label htmlFor="photo">Photo</Label>
        {photoPreview && (
          <img src={photoPreview} alt="Preview" className="w-20 h-20 rounded-full object-cover border border-[var(--border-subtle)]" />
        )}
        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] cursor-pointer transition-colors">
          📷 {photoPreview ? 'Replace photo' : 'Upload photo'}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only"
            onChange={e => {
              const f = e.target.files?.[0]
              if (!f) return
              if (!PHOTO_TYPES.includes(f.type)) { showToast({ type: 'error', message: 'Only JPEG, PNG, WebP or AVIF.' }); return }
              if (f.size > PHOTO_MAX) { showToast({ type: 'error', message: '5 MB max.' }); return }
              setPhotoFile(f)
              setPhotoPreview(URL.createObjectURL(f))
            }} />
        </label>
      </div>

      {/* Contact */}
      <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
        <p className="text-sm font-semibold text-[var(--text-main)]">Contact details (optional)</p>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <TextInput id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <TextInput id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="telegram">Telegram username</Label>
          <TextInput id="telegram" value={telegram} onChange={e => setTelegram(e.target.value)} />
        </div>

        {/* Show on website toggle */}
        <div className={`flex items-start gap-3 p-3 rounded-xl border ${showPublic ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20' : 'border-[var(--border-subtle)] bg-[var(--bg-section-alt)]'}`}>
          <div className="flex-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                role="switch"
                aria-checked={showPublic}
                onClick={() => setShowPublic(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none cursor-pointer ${showPublic ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-600'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showPublic ? 'translate-x-4' : 'translate-x-1'}`} />
              </div>
              <span className="text-sm font-medium text-[var(--text-main)]">Show on website</span>
            </label>
            {showPublic && (
              <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <AlertTriangle size={11} />
                This contact info will appear publicly on the About page.
              </p>
            )}
            {!showPublic && (
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">Off by default — contact details are private.</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pt-2">
        <button type="button" onClick={onDone}
          className="w-full sm:w-auto px-4 py-3 min-h-[44px] rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] transition-colors">
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={saving}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A1E] disabled:opacity-40 transition-colors">
          {saving && <Loader2 size={14} className="animate-spin" />}
          Save
        </button>
      </div>
    </div>
  )
}

// ─── Committee section ────────────────────────────────────────────────────────

function CommitteeSection({
  committeeKey,
  name,
  editionId,
  members,
}: {
  committeeKey: CommitteeKey
  name:         string
  editionId:    string
  members:      SetupCommitteeMemberFull[]
}) {
  const { client, canDelete } = usePortal()
  const { showToast } = useToast()
  const deleteMut    = useDeleteSetupCommitteeMember(client, editionId)
  const updateMut    = useUpdateSetupCommitteeMember(client, editionId)
  const [open,       setOpen]       = useState(false)
  const [formOpen,   setFormOpen]   = useState(false)
  const [formLeader, setFormLeader] = useState(false)
  const [editTarget, setEditTarget] = useState<SetupCommitteeMemberFull | null>(null)
  const [delTarget,  setDelTarget]  = useState<SetupCommitteeMemberFull | null>(null)

  const leader = members.find(m => m.is_leader)
  const others = members.filter(m => !m.is_leader)

  // ── Make leader: sets target to is_leader=true, demotes old leader ──────────
  const handleMakeLeader = async (m: SetupCommitteeMemberFull) => {
    try {
      // Demote existing leader first
      if (leader && leader.id !== m.id) {
        await updateMut.mutateAsync({ memberId: leader.id, patch: { is_leader: false } })
      }
      await updateMut.mutateAsync({ memberId: m.id, patch: { is_leader: true } })
      showToast({ type: 'success', message: `${m.full_name} is now the leader.` })
    } catch (err) {
      showToast({ type: 'error', message: formatError(err) })
    }
  }

  const handleDelete = async () => {
    if (!delTarget) return
    try {
      await deleteMut.mutateAsync(delTarget.id)
      showToast({ type: 'success', message: 'Member deleted.' })
    } catch (err) {
      showToast({ type: 'error', message: formatError(err) })
    } finally {
      setDelTarget(null)
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[var(--bg-section-alt)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D9A441]"
      >
        <div className="flex items-center gap-3">
          <span className="font-display text-sm font-bold text-[var(--text-main)]">{name}</span>
          <span className="text-[11px] text-[var(--text-muted)]">{members.length} member{members.length !== 1 ? 's' : ''}</span>
          {leader
            ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400"><Crown size={10} /> {leader.full_name}</span>
            : <span className="text-[10px] text-red-500 font-medium">No leader set</span>
          }
        </div>
        {open ? <ChevronUp size={16} className="text-[var(--text-muted)]" /> : <ChevronDown size={16} className="text-[var(--text-muted)]" />}
      </button>

      {open && (
        <div className="border-t border-[var(--border-subtle)] px-5 py-4 space-y-4">
          {/* Member list */}
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 py-2">
              {m.photo_url
                ? <img src={m.photo_url} alt={m.full_name} className="w-9 h-9 rounded-full object-cover shrink-0 border border-[var(--border-subtle)]" />
                : <div className="w-9 h-9 rounded-full bg-[var(--bg-section-alt)] flex items-center justify-center shrink-0 text-sm font-bold text-[var(--text-muted)]">{m.full_name[0]}</div>
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[var(--text-main)] truncate">{m.full_name}</span>
                  {m.is_leader && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                      <Crown size={9} /> Leader
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[var(--text-muted)]">{m.role_i18n?.en}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Make leader button — shown for non-leaders */}
                {!m.is_leader && (
                  <button
                    onClick={() => handleMakeLeader(m)}
                    className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                    title="Make committee leader"
                  >
                    <Crown size={13} />
                  </button>
                )}
                <button onClick={() => { setEditTarget(m); setFormOpen(true) }}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] transition-colors" title="Edit">
                  <Pencil size={13} />
                </button>
                {canDelete && (
                  <button onClick={() => setDelTarget(m)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Add buttons */}
          {!formOpen && (
            <div className="flex gap-2 pt-1">
              {!leader && (
                <button onClick={() => { setEditTarget(null); setFormLeader(true); setFormOpen(true) }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-400 text-amber-700 dark:text-amber-400 text-xs font-semibold hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                  <Crown size={12} /> Add leader
                </button>
              )}
              <button onClick={() => { setEditTarget(null); setFormLeader(false); setFormOpen(true) }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-semibold hover:bg-[var(--bg-section-alt)] transition-colors">
                <UserPlus size={12} /> Add member
              </button>
            </div>
          )}

          {/* Form */}
          {formOpen && (
            <div className="border-t border-[var(--border-subtle)] mt-2 -mx-5 px-5">
              <MemberForm
                committeeKey={committeeKey}
                editionId={editionId}
                initial={editTarget ?? undefined}
                isLeader={!editTarget && formLeader}
                onDone={() => { setFormOpen(false); setEditTarget(null) }}
              />
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!delTarget}
        title="Delete committee member?"
        message={`"${delTarget?.full_name ?? ''}" will be permanently deleted.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  )
}

// ─── Main step ────────────────────────────────────────────────────────────────

interface Props {
  edition: { id: string }
}

export function Step3Committees({ edition }: Props) {
  const { client } = usePortal()
  const { data: members, isLoading } = useSetupCommittee(client, edition.id)

  if (isLoading) return <FullPageSpinner label="Loading committees…" />

  const getMembersOf = (key: CommitteeKey) =>
    (members ?? []).filter(m => m.committee_key === key)

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-muted)]">
        Set up each committee's leader and members. Contact details are private by default.
      </p>
      {COMMITTEES.map(c => (
        <CommitteeSection
          key={c.key}
          committeeKey={c.key}
          name={c.name}
          editionId={edition.id}
          members={getMembersOf(c.key)}
        />
      ))}
    </div>
  )
}

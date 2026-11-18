/**
 * AnnouncementFormPage.tsx — /staff/announcements/new and /staff/announcements/:id
 *
 * Create and edit announcements:
 *  - Message in EN / AM / OM (English required, max 280 chars)
 *  - Type: normal or urgent
 *  - Start: now or scheduled
 *  - Expiry presets: 6h, 24h, 3d, no expiry, custom
 *  - Optional link
 *  - Publish is instant (state defaults to published)
 *  - Preview of the banner
 */

import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Eye } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  useAnnouncement,
  useCreateAnnouncement,
  useUpdateAnnouncement,
} from '../../hooks/useStaffQueries'
import { useToast } from '../../components/Toast'
import { I18nTabs, type I18nLang, LANG_NOTE } from '../../components/I18nTabs'
import { FullPageSpinner, EmptyState } from '../../components/Loading'
import { Label, TextInput, TextArea, SelectField, FormError } from '../../components/StaffForm'
import { UNREACHABLE_MSG } from '../../services/helpers'
import { formatError } from '../../services/helpers'
import type { I18nJson, AnnouncementType, ContentState } from '../../../types/database'

const MAX_CHARS = 280

type ExpiryPreset = '6h' | '24h' | '3d' | 'never' | 'custom'

interface FormState {
  message_en:  string
  message_am:  string
  message_om:  string
  type:        AnnouncementType
  link:        string
  startsNow:   boolean
  startsAt:    string  // datetime-local
  expiryPreset: ExpiryPreset
  expiresAt:   string  // datetime-local
}

export function AnnouncementFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const isEdit = !!id
  const { data: existing, isLoading } = useAnnouncement(isEdit ? id : null)
  const createMut = useCreateAnnouncement()
  const updateMut = useUpdateAnnouncement()

  const [form, setForm] = useState<FormState>({
    message_en: '', message_am: '', message_om: '',
    type: 'normal',
    link: '',
    startsNow: true,
    startsAt: '',
    expiryPreset: '24h',
    expiresAt: '',
  })
  const [activeLang, setActiveLang] = useState<I18nLang>('en')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ── Load existing ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (existing) {
      const starts = new Date(existing.starts_at)
      const expires = existing.expires_at ? new Date(existing.expires_at) : null
      setForm({
        message_en:  existing.message_i18n.en,
        message_am:  existing.message_i18n.am ?? '',
        message_om:  existing.message_i18n.om ?? '',
        type:        existing.type,
        link:        existing.link ?? '',
        startsNow:   starts.getTime() <= Date.now(),
        startsAt:    toLocalDateTimeInput(starts),
        expiryPreset: 'custom',
        expiresAt:   expires ? toLocalDateTimeInput(expires) : '',
      })
    }
  }, [existing])

  const update = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(f => {
      const next = { ...f, [key]: val }
      // When switching to custom expiry, pre-fill tomorrow if empty
      if (key === 'expiryPreset' && val === 'custom' && !f.expiresAt) {
        const tomorrow = new Date(Date.now() + 86_400_000)
        const offset = tomorrow.getTimezoneOffset() * 60000
        next.expiresAt = new Date(tomorrow.getTime() - offset).toISOString().slice(0, 16)
      }
      return next
    })
  }

  // ── Build i18n ──────────────────────────────────────────────────────────────
  const buildI18n = (): I18nJson => {
    const obj: I18nJson = { en: form.message_en.trim() }
    if (form.message_am.trim()) obj.am = form.message_am.trim()
    if (form.message_om.trim()) obj.om = form.message_om.trim()
    return obj
  }

  // ── Compute start timestamp ─────────────────────────────────────────────────
  const computeStartsAt = (): string => {
    if (form.startsNow) return new Date().toISOString()
    return new Date(form.startsAt).toISOString()
  }

  // ── Compute expiry timestamp ────────────────────────────────────────────────
  const computeExpiresAt = (): string | null => {
    if (form.expiryPreset === 'never') return null
    if (form.expiryPreset === 'custom') return form.expiresAt ? new Date(form.expiresAt).toISOString() : null
    const now = Date.now()
    const start = form.startsNow ? now : new Date(form.startsAt).getTime()
    const presets: Record<string, number> = {
      '6h':  6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '3d':  3 * 24 * 60 * 60 * 1000,
    }
    return new Date(start + (presets[form.expiryPreset] ?? 0)).toISOString()
  }

  // ── Validate ────────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.message_en.trim()) errs.message_en = t('staff.announcements.englishRequired')
    if (form.message_en.length > MAX_CHARS) errs.message_en = t('staff.announcements.maxChars')
    if (!form.startsNow && !form.startsAt) errs.startsAt = 'Start time is required'

    const now = Date.now()
    const startMs = form.startsNow
      ? now
      : form.startsAt ? new Date(form.startsAt).getTime() : NaN

    if (!form.startsNow && form.startsAt) {
      if (isNaN(startMs) || startMs < now - 60_000) {
        errs.startsAt = 'Start time cannot be in the past.'
      }
    }

    if (form.expiryPreset === 'custom') {
      if (!form.expiresAt) {
        errs.expiresAt = 'Expiry time is required when custom is selected.'
      } else {
        const expMs = new Date(form.expiresAt).getTime()
        if (isNaN(expMs) || expMs <= now) {
          errs.expiresAt = 'Expiry time must be in the future.'
        } else if (!isNaN(startMs) && expMs <= startMs) {
          errs.expiresAt = 'Expiry must be after the start time.'
        }
      }
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return

    const payload = {
      message_i18n: buildI18n(),
      type:         form.type,
      link:         form.link.trim() || null,
      starts_at:    computeStartsAt(),
      expires_at:   computeExpiresAt(),
      state:        'published' as ContentState,
    }

    try {
      if (isEdit && existing) {
        await updateMut.mutateAsync({ id: existing.id, patch: payload })
        showToast({ type: 'success', message: t('staff.announcements.saved') })
      } else {
        await createMut.mutateAsync(payload)
        showToast({ type: 'success', message: t('staff.announcements.published') })
      }
      navigate('/staff/announcements')
    } catch (err) {
      const msg = err instanceof Error ? err.message : formatError(err)
      if (msg === UNREACHABLE_MSG) {
        showToast({ type: 'error', message: t('staff.common.unreachable') })
      } else {
        showToast({ type: 'error', message: msg })
      }
    }
  }

  if (isEdit && isLoading) return <FullPageSpinner label={t('staff.common.loading')} />
  if (isEdit && !existing) return <EmptyState title={t('staff.common.noResults')} />

  const charCount = form.message_en.length

  return (
    <div className="space-y-5 max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/staff/announcements')}
          className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] transition-colors shrink-0"
          aria-label={t('staff.common.back')}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h1 className="font-display text-xl font-bold text-[var(--text-main)]">
          {isEdit ? t('staff.announcements.editTitle') : t('staff.announcements.newTitle')}
        </h1>
      </div>

      {/* Message (i18n) */}
      <section className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
        <div>
          <I18nTabs value={activeLang} onChange={setActiveLang} />
          <p className="text-[11px] text-[var(--text-muted)] mt-1.5">{LANG_NOTE[activeLang]}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="message" required>{t('staff.announcements.fieldMessage')}</Label>
          <TextArea
            id="message"
            value={form[`message_${activeLang}`]}
            onChange={e => update(`message_${activeLang}` as keyof FormState, e.target.value)}
            rows={3}
            maxLength={activeLang === 'en' ? MAX_CHARS : undefined}
            aria-invalid={activeLang === 'en' && !!errors.message_en}
          />
          {activeLang === 'en' && (
            <p className={`text-[11px] ${charCount > MAX_CHARS ? 'text-red-600' : 'text-[var(--text-muted)]'}`}>
              {t('staff.announcements.charCount', { count: charCount })}
            </p>
          )}
          {activeLang === 'en' && errors.message_en && <FormError message={errors.message_en} />}
        </div>
      </section>

      {/* Type + link */}
      <section className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="type" required>{t('staff.announcements.fieldType')}</Label>
          <SelectField id="type" value={form.type} onChange={e => update('type', e.target.value as AnnouncementType)}>
            <option value="normal">{t('staff.announcements.typeNormal')}</option>
            <option value="urgent">{t('staff.announcements.typeUrgent')}</option>
          </SelectField>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="link" hint={t('staff.common.optional')}>{t('staff.announcements.fieldLink')}</Label>
          <TextInput
            id="link"
            value={form.link}
            onChange={e => update('link', e.target.value)}
            placeholder="/schedule"
          />
        </div>
      </section>

      {/* Schedule + expiry */}
      <section className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
        {/* Start */}
        <div className="space-y-2">
          <Label htmlFor="ann-starts">{t('staff.announcements.fieldStarts')}</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="flex items-center gap-2 text-sm text-[var(--text-main)] cursor-pointer">
              <input
                type="radio"
                name="starts"
                checked={form.startsNow}
                onChange={() => update('startsNow', true)}
                className="accent-[#0F3D2E]"
              />
              Now
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--text-main)] cursor-pointer">
              <input
                type="radio"
                name="starts"
                checked={!form.startsNow}
                onChange={() => update('startsNow', false)}
                className="accent-[#0F3D2E]"
              />
              Schedule for later
            </label>
          </div>
          {!form.startsNow && (
            <TextInput
              type="datetime-local"
              value={form.startsAt}
              onChange={e => update('startsAt', e.target.value)}
              aria-invalid={!!errors.startsAt}
            />
          )}
          {errors.startsAt && <FormError message={errors.startsAt} />}
        </div>

        {/* Expiry */}
        <div className="space-y-2">
          <Label htmlFor="ann-expires">{t('staff.announcements.fieldExpires')}</Label>
          <div className="flex flex-wrap gap-1.5">
            {([
              ['6h',    t('staff.announcements.expiry6h')],
              ['24h',   t('staff.announcements.expiry24h')],
              ['3d',    t('staff.announcements.expiry3d')],
              ['never', t('staff.announcements.expiryNever')],
              ['custom',t('staff.announcements.expiryCustom')],
            ] as [ExpiryPreset, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => update('expiryPreset', value)}
                className={[
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  form.expiryPreset === value
                    ? 'bg-[#0F3D2E] text-white'
                    : 'border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)]',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
          {form.expiryPreset === 'custom' && (
            <TextInput
              type="datetime-local"
              value={form.expiresAt}
              onChange={e => update('expiresAt', e.target.value)}
              aria-invalid={!!errors.expiresAt}
            />
          )}
          {errors.expiresAt && <FormError message={errors.expiresAt} />}
        </div>
      </section>

      {/* Preview */}
      {form.message_en && (
        <section className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-1.5">
            <Eye size={14} aria-hidden="true" />
            {t('staff.announcements.preview')}
          </p>
          <div
            className={[
              'px-4 py-3 rounded-xl',
              form.type === 'urgent'
                ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-l-red-500'
                : 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500',
            ].join(' ')}
          >
            <p className="text-sm text-[var(--text-main)]">
              {form.type === 'urgent' && (
                <span className="inline-flex items-center mr-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-600 text-white">Urgent</span>
              )}
              {form.message_en}
            </p>
          </div>
        </section>
      )}

      {/* Actions */}
      <div className="flex gap-2.5 pb-8">
        <button
          onClick={handleSave}
          disabled={createMut.isPending || updateMut.isPending}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2"
        >
          <Save size={16} aria-hidden="true" />
          {createMut.isPending || updateMut.isPending
            ? t('staff.announcements.saving')
            : t('staff.announcements.publish')}
        </button>
        <button
          onClick={() => navigate('/staff/announcements')}
          className="px-5 py-2.5 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-section-alt)] transition-colors"
        >
          {t('staff.common.cancel')}
        </button>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalDateTimeInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000
  const local = new Date(date.getTime() - offset)
  return local.toISOString().slice(0, 16)
}

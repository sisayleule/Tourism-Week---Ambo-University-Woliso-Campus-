/**
 * EventFormPage.tsx — /staff/events/new and /staff/events/:id
 *
 * Create and edit form with:
 *  - Title and description in EN / AM / OM tabs
 *  - Day (limited to edition's number of days)
 *  - Session (morning / afternoon), optional start and end time
 *  - Category, venue type, optional venue name (3 languages)
 *  - Featured toggle, image upload (resize + WebP)
 *  - Slug: auto-generated from English title, editable only while draft
 *  - Actions:
 *      · Published item → "Save changes" (keeps state=published) + "Unpublish"
 *      · Draft item     → "Save draft" (keeps state=draft) + "Publish"
 *    "Save draft" never downgrades a published item.
 *  - Admin-only: Delete with confirmation
 *  - Status line: "Live on the website" or "Draft: not visible to visitors"
 *  - Post-save feedback: "Saved. Visitors see it within a few seconds" with
 *    public URL link + "Verify on website" button
 *  - Zod validation, unsaved-changes warning, toasts, optimistic concurrency
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Save, Trash2, Eye, EyeOff, Send,
  CheckCircle2, ExternalLink, Loader2, AlertCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { useCurrentEdition, useEvent, useCreateEvent, useUpdateEvent, useDeleteEvent } from '../../hooks/useStaffQueries'
import { useAuth } from '../../auth/AuthProvider'
import { useToast } from '../../components/Toast'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { I18nTabs, type I18nLang, LANG_NOTE } from '../../components/I18nTabs'
import { ImageUpload } from '../../components/ImageUpload'
import { FullPageSpinner, EmptyState } from '../../components/Loading'
import { Label, TextInput, TextArea, SelectField, Toggle, FormError } from '../../components/StaffForm'
import { slugify, CONFLICT_MSG, UNREACHABLE_MSG } from '../../services/helpers'
import type { I18nJson, EventCategory, VenueType, SessionType, EventStatus } from '../../../types/database'
import { fetchLiveContent } from '../../../lib/liveContent'
import { buildEditionDays } from '../../../lib/editionDays'

// ─── Environment ──────────────────────────────────────────────────────────────

const PUBLIC_SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? '').replace(/\/$/, '')

function publicEventUrl(slug: string): string | null {
  if (!slug) return null
  if (PUBLIC_SITE_URL) return `${PUBLIC_SITE_URL}/events/${slug}`
  return null
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const i18nStringSchema = z.object({
  en: z.string().min(1, 'English is required'),
  am: z.string().optional(),
  om: z.string().optional(),
})

const eventSchema = z.object({
  day:      z.number().int().min(1).max(7),
  session:  z.enum(['morning', 'afternoon', 'evening']),
  category: z.enum(['culture', 'sports', 'academic', 'competition', 'community']),
  venue_type: z.enum(['campus', 'town', 'both']),
  title_i18n: i18nStringSchema,
})

type FormState = {
  slug:             string
  day:              number
  session:          SessionType
  start_time:       string
  end_time:         string
  sort_order:       number
  title_en:          string
  title_am:          string
  title_om:          string
  desc_en:           string
  desc_am:           string
  desc_om:           string
  venue_en:          string
  venue_am:          string
  venue_om:          string
  category:         EventCategory
  venue_type:       VenueType
  image_url:        string | null
  featured:         boolean
  status:           EventStatus
  status_note_en:    string
  status_note_am:    string
  status_note_om:    string
}

type PostSaveFeedback = {
  state: 'published' | 'draft'
  slug: string
  verifying: boolean
  verifyResult: 'visible' | 'not-yet' | null
  verifyReason: string | null
}

export function EventFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const isEdit = !!id
  const { data: edition } = useCurrentEdition()
  const { data: existingEvent, isLoading } = useEvent(isEdit ? id : null)

  const createMut = useCreateEvent()
  const updateMut = useUpdateEvent(edition?.id ?? '')
  const deleteMut = useDeleteEvent(edition?.id ?? '')

  // maxDay from actual calendar days so editions of any length work (up to 31)
  const maxDay = useMemo(() => {
    if (edition?.start_date && edition?.end_date) {
      return buildEditionDays(edition.start_date, edition.end_date).length
    }
    return edition?.stats?.daysCount ?? 5
  }, [edition])
  const loadedUpdatedAtRef = useRef<string>('')

  // ── Post-save feedback state ─────────────────────────────────────────────────
  const [feedback, setFeedback] = useState<PostSaveFeedback | null>(null)

  // ── Form state ──────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>({
    slug: '',
    day: 1,
    session: 'morning',
    start_time: '',
    end_time: '',
    sort_order: 0,
    title_en: '', title_am: '', title_om: '',
    desc_en: '', desc_am: '', desc_om: '',
    venue_en: '', venue_am: '', venue_om: '',
    category: 'culture',
    venue_type: 'campus',
    image_url: null,
    featured: false,
    status: 'scheduled',
    status_note_en: '', status_note_am: '', status_note_om: '',
  })

  const [activeLang, setActiveLang] = useState<I18nLang>('en')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [confirmUnpublish, setConfirmUnpublish] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // ── Load existing event into form state ──────────────────────────────────────
  useEffect(() => {
    if (existingEvent) {
      loadedUpdatedAtRef.current = existingEvent.updated_at
      setForm({
        slug:             existingEvent.slug,
        day:              existingEvent.day,
        session:          existingEvent.session,
        start_time:       existingEvent.start_time?.slice(0, 5) ?? '',
        end_time:         existingEvent.end_time?.slice(0, 5) ?? '',
        sort_order:       existingEvent.sort_order,
        title_en:          existingEvent.title_i18n.en,
        title_am:          existingEvent.title_i18n.am ?? '',
        title_om:          existingEvent.title_i18n.om ?? '',
        desc_en:           existingEvent.description_i18n?.en ?? '',
        desc_am:           existingEvent.description_i18n?.am ?? '',
        desc_om:           existingEvent.description_i18n?.om ?? '',
        venue_en:          existingEvent.venue_name_i18n?.en ?? '',
        venue_am:          existingEvent.venue_name_i18n?.am ?? '',
        venue_om:          existingEvent.venue_name_i18n?.om ?? '',
        category:         existingEvent.category,
        venue_type:       existingEvent.venue_type,
        image_url:        existingEvent.image_url,
        featured:         existingEvent.featured,
        status:           existingEvent.status,
        status_note_en:    existingEvent.status_note_i18n?.en ?? '',
        status_note_am:    existingEvent.status_note_i18n?.am ?? '',
        status_note_om:    existingEvent.status_note_i18n?.om ?? '',
      })
      setDirty(false)
      setFeedback(null)
    }
  }, [existingEvent])

  // ── Auto-generate slug from English title (only when creating) ───────────────
  useEffect(() => {
    if (!isEdit && form.title_en && !form.slug) {
      setForm(f => ({ ...f, slug: slugify(f.title_en) }))
    }
  }, [form.title_en, form.slug, isEdit])

  // ── Unsaved changes warning ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const update = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(f => ({ ...f, [key]: val }))
    setDirty(true)
    setFeedback(null)
  }

  // ── Build i18n objects from form state ──────────────────────────────────────
  const buildI18n = (en: string, am: string, om: string): I18nJson => {
    const obj: I18nJson = { en }
    if (am.trim()) obj.am = am.trim()
    if (om.trim()) obj.om = om.trim()
    return obj
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.title_en.trim()) errs.title_en = t('staff.events.englishRequired')
    if (form.day < 1 || form.day > maxDay) errs.day = `Day must be 1–${maxDay}`
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Build payload ───────────────────────────────────────────────────────────
  /**
   * Build the DB patch. For "save" (not publish/unpublish) we pass the
   * CURRENT state through — never downgrade a published item to draft.
   * The desired state is passed explicitly only for Publish / Unpublish actions.
   */
  const buildPayload = (targetState: 'draft' | 'published') => {
    const titleI18n = buildI18n(form.title_en, form.title_am, form.title_om)
    const descI18n = (form.desc_en.trim() || form.desc_am.trim() || form.desc_om.trim())
      ? buildI18n(form.desc_en, form.desc_am, form.desc_om)
      : null
    const venueI18n = (form.venue_en.trim() || form.venue_am.trim() || form.venue_om.trim())
      ? buildI18n(form.venue_en, form.venue_am, form.venue_om)
      : null
    const statusNoteI18n = (form.status_note_en.trim() || form.status_note_am.trim() || form.status_note_om.trim())
      ? buildI18n(form.status_note_en, form.status_note_am, form.status_note_om)
      : null

    return {
      edition_id:       edition?.id ?? '',
      slug:             form.slug || slugify(form.title_en),
      day:              form.day,
      session:          form.session,
      start_time:       form.start_time ? form.start_time + ':00' : null,
      end_time:         form.end_time ? form.end_time + ':00' : null,
      sort_order:       form.sort_order,
      title_i18n:       titleI18n,
      description_i18n: descI18n,
      venue_name_i18n:  venueI18n,
      category:         form.category,
      venue_type:       form.venue_type,
      image_url:        form.image_url,
      featured:         form.featured,
      status:           form.status,
      status_note_i18n: statusNoteI18n,
      state:            targetState,
    }
  }

  // ── Verify on website ───────────────────────────────────────────────────────
  const verifyOnWebsite = async (slug: string, expectedTitle: string) => {
    setFeedback(prev => prev ? { ...prev, verifying: true, verifyResult: null, verifyReason: null } : null)
    try {
      const snap = await fetchLiveContent()
      if (!snap) {
        setFeedback(prev => prev
          ? { ...prev, verifying: false, verifyResult: 'not-yet', verifyReason: 'Could not reach the live site.' }
          : null)
        return
      }
      const liveEvent = snap.events.find(e => e.slug === slug)
      if (!liveEvent) {
        setFeedback(prev => prev
          ? { ...prev, verifying: false, verifyResult: 'not-yet', verifyReason: 'Event not found on the live site — it may still be a draft.' }
          : null)
        return
      }
      const titlesMatch = liveEvent.titleI18n.en === expectedTitle
      setFeedback(prev => prev
        ? {
            ...prev,
            verifying: false,
            verifyResult: titlesMatch ? 'visible' : 'not-yet',
            verifyReason: titlesMatch ? null : `Live title is "${liveEvent.titleI18n.en}" — the update may still be propagating.`,
          }
        : null)
    } catch {
      setFeedback(prev => prev
        ? { ...prev, verifying: false, verifyResult: 'not-yet', verifyReason: 'Could not reach the live site.' }
        : null)
    }
  }

  // ── Core save ───────────────────────────────────────────────────────────────
  const doSave = async (targetState: 'draft' | 'published') => {
    if (!validate()) return false
    if (!edition?.id) {
      showToast({ type: 'error', message: t('staff.dashboard.noEdition') })
      return false
    }

    try {
      const payload = buildPayload(targetState)

      if (isEdit && existingEvent) {
        await updateMut.mutateAsync({
          id: existingEvent.id,
          loadedUpdatedAt: loadedUpdatedAtRef.current,
          patch: payload,
        })
        loadedUpdatedAtRef.current = ''
      } else {
        await createMut.mutateAsync(payload)
        navigate('/staff/events')
        return true
      }

      setDirty(false)
      setFeedback({
        state: targetState,
        slug: payload.slug,
        verifying: false,
        verifyResult: null,
        verifyReason: null,
      })
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === CONFLICT_MSG) {
        showToast({ type: 'error', message: t('staff.common.conflict') })
      } else if (msg === UNREACHABLE_MSG) {
        showToast({ type: 'error', message: t('staff.common.unreachable') })
      } else {
        showToast({ type: 'error', message: msg })
      }
      return false
    }
  }

  // ── Button handlers ─────────────────────────────────────────────────────────

  /**
   * "Save changes" (published item) — keeps state=published.
   * "Save draft" (draft item)       — keeps state=draft.
   * Never downgrades published → draft.
   */
  const handleSave = async () => {
    const currentState = isEdit && existingEvent ? existingEvent.state : 'draft'
    // Guard: never send state=draft for a currently-published item
    const targetState: 'draft' | 'published' = currentState === 'published' ? 'published' : 'draft'
    await doSave(targetState)
  }

  /** "Publish" — sets state=published (with confirmation). */
  const handlePublish = () => setConfirmPublish(true)

  /** "Unpublish" — sets state=draft (with confirmation). */
  const handleUnpublish = () => setConfirmUnpublish(true)

  const confirmUnpublishAction = async () => {
    setConfirmUnpublish(false)
    if (!existingEvent) return
    try {
      await updateMut.mutateAsync({
        id: existingEvent.id,
        loadedUpdatedAt: loadedUpdatedAtRef.current,
        patch: { state: 'draft' },
      })
      showToast({ type: 'success', message: t('staff.events.unpublished') })
      setFeedback({ state: 'draft', slug: form.slug, verifying: false, verifyResult: null, verifyReason: null })
      setDirty(false)
    } catch {
      showToast({ type: 'error', message: t('staff.common.errorTitle') })
    }
  }

  const confirmDeleteAction = async () => {
    setConfirmDelete(false)
    if (!existingEvent) return
    try {
      await deleteMut.mutateAsync(existingEvent.id)
      showToast({ type: 'success', message: t('staff.events.deleted') })
      navigate('/staff/events')
    } catch {
      showToast({ type: 'error', message: t('staff.events.deletedError') })
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (isEdit && isLoading) return <FullPageSpinner label={t('staff.events.loadingEvent')} />

  if (isEdit && !existingEvent) {
    return <EmptyState title={t('staff.events.eventNotFound')} action={
      <Link to="/staff/events" className="text-sm text-[#0F3D2E] dark:text-[#D9A441] hover:underline">
        {t('staff.events.backToEvents')}
      </Link>
    } />
  }

  const isPublished = isEdit ? existingEvent?.state === 'published' : false
  const saveButtonLabel = isPublished ? 'Save changes' : t('staff.events.saveDraft')
  const isSaving = createMut.isPending || updateMut.isPending

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/staff/events"
            className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] transition-colors shrink-0"
            aria-label={t('staff.events.backToEvents')}
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
          <h1 className="font-display text-xl font-bold text-[var(--text-main)] truncate">
            {isEdit ? t('staff.events.editEvent') : t('staff.events.newEvent')}
          </h1>
        </div>
      </div>

      {/* ── Status line ── */}
      {isEdit && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border ${
          isPublished
            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400'
            : 'bg-stone-100 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400'
        }`}>
          {isPublished
            ? <><CheckCircle2 size={13} className="shrink-0" aria-hidden="true" /> Live on the website</>
            : <><EyeOff size={13} className="shrink-0" aria-hidden="true" /> Draft — not visible to visitors</>
          }
        </div>
      )}

      {/* ── Post-save feedback ── */}
      {feedback && (
        <div className={`rounded-xl border px-4 py-3 text-xs space-y-2 ${
          feedback.state === 'published'
            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900'
            : 'bg-stone-100 dark:bg-stone-900 border-stone-200 dark:border-stone-800'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <p className={feedback.state === 'published' ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-stone-500'}>
              {feedback.state === 'published'
                ? 'Saved. Visitors see it within a few seconds.'
                : 'Saved as draft. Not visible to visitors.'}
            </p>
            {feedback.state === 'published' && publicEventUrl(feedback.slug) && (
              <a
                href={publicEventUrl(feedback.slug)!}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                View on website <ExternalLink size={11} aria-hidden="true" />
              </a>
            )}
          </div>

          {/* Verify button */}
          {feedback.state === 'published' && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => verifyOnWebsite(feedback.slug, form.title_en)}
                disabled={feedback.verifying}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 disabled:opacity-60 transition-colors font-medium"
              >
                {feedback.verifying
                  ? <><Loader2 size={11} className="animate-spin" /> Checking…</>
                  : 'Verify on website'}
              </button>

              {feedback.verifyResult === 'visible' && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 size={12} aria-hidden="true" /> Visible on the website
                </span>
              )}
              {feedback.verifyResult === 'not-yet' && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertCircle size={12} aria-hidden="true" />
                  {feedback.verifyReason ?? 'Not visible yet — may still be propagating.'}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Title (i18n tabs) */}
      <section className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
        <div>
          <I18nTabs value={activeLang} onChange={setActiveLang} />
          <p className="text-[11px] text-[var(--text-muted)] mt-1.5">{LANG_NOTE[activeLang]}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="title" required>{t('staff.events.fieldTitle')}</Label>
          <TextInput
            id="title"
            value={form[`title_${activeLang}`]}
            onChange={e => update(`title_${activeLang}` as keyof FormState, e.target.value)}
            placeholder={activeLang === 'en' ? 'Event title' : ''}
            aria-invalid={activeLang === 'en' && !!errors.title_en}
          />
          {activeLang === 'en' && errors.title_en && <FormError message={errors.title_en} />}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="desc">{t('staff.events.fieldDescription')}</Label>
          <TextArea
            id="desc"
            value={form[`desc_${activeLang}`]}
            onChange={e => update(`desc_${activeLang}` as keyof FormState, e.target.value)}
            rows={3}
          />
        </div>
      </section>

      {/* Schedule */}
      <section className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="day" required>{t('staff.events.fieldDay')}</Label>
            <SelectField id="day" value={form.day} onChange={e => update('day', Number(e.target.value))}>
              {Array.from({ length: maxDay }).map((_, i) => (
                <option key={i + 1} value={i + 1}>{t('staff.agenda.dayPrefix')} {i + 1}</option>
              ))}
            </SelectField>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="session" required>{t('staff.events.fieldSession')}</Label>
            <SelectField
              id="session"
              value={form.session}
              onChange={e => update('session', e.target.value as SessionType)}
            >
              <option value="morning">{t('staff.events.sessionMorning')}</option>
              <option value="afternoon">{t('staff.events.sessionAfternoon')}</option>
              <option value="evening">Evening</option>
            </SelectField>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="start-time" hint={t('staff.common.optional')}>{t('staff.events.fieldStartTime')}</Label>
            <TextInput
              id="start-time"
              type="time"
              value={form.start_time}
              onChange={e => update('start_time', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="end-time" hint={t('staff.common.optional')}>{t('staff.events.fieldEndTime')}</Label>
            <TextInput
              id="end-time"
              type="time"
              value={form.end_time}
              onChange={e => update('end_time', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Categorisation */}
      <section className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="category" required>{t('staff.events.fieldCategory')}</Label>
            <SelectField id="category" value={form.category} onChange={e => update('category', e.target.value as EventCategory)}>
              <option value="culture">{t('staff.events.catCulture')}</option>
              <option value="sports">{t('staff.events.catSports')}</option>
              <option value="academic">{t('staff.events.catAcademic')}</option>
              <option value="competition">{t('staff.events.catCompetition')}</option>
              <option value="community">{t('staff.events.catCommunity')}</option>
            </SelectField>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="venue-type" required>{t('staff.events.fieldVenueType')}</Label>
            <SelectField id="venue-type" value={form.venue_type} onChange={e => update('venue_type', e.target.value as VenueType)}>
              <option value="campus">{t('staff.events.venueCampus')}</option>
              <option value="town">{t('staff.events.venueTown')}</option>
              <option value="both">{t('staff.events.venueBoth')}</option>
            </SelectField>
          </div>
        </div>

        {/* Venue name (i18n) */}
        <div className="space-y-1.5">
          <Label htmlFor="venue-name" hint={t('staff.common.optional')}>{t('staff.events.fieldVenueName')} ({activeLang.toUpperCase()})</Label>
          <TextInput
            id="venue-name"
            value={form[`venue_${activeLang}`]}
            onChange={e => update(`venue_${activeLang}` as keyof FormState, e.target.value)}
          />
        </div>
      </section>

      {/* Slug + image + featured */}
      <section className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
        {/* Slug */}
        <div className="space-y-1.5">
          <Label htmlFor="slug">{t('staff.events.fieldSlug')}</Label>
          <TextInput
            id="slug"
            value={form.slug}
            onChange={e => update('slug', e.target.value)}
            disabled={isPublished}
            className={isPublished ? 'opacity-60 cursor-not-allowed' : ''}
          />
          <p className="text-[11px] text-[var(--text-muted)]">{t('staff.events.slugHint')}</p>
        </div>

        {/* Image */}
        <ImageUpload
          value={form.image_url}
          onChange={url => { update('image_url', url); setDirty(true) }}
          namePrefix={form.slug || 'event'}
          altText={form.title_en}
        />

        {/* Featured toggle */}
        <Toggle
          id="featured"
          checked={form.featured}
          onChange={v => { update('featured', v); setDirty(true) }}
          label={t('staff.events.fieldFeatured')}
        />
      </section>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2.5 pb-8">
        {/* Primary save — label changes based on current state */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save size={16} aria-hidden="true" />
          {isSaving ? t('staff.events.saving') : saveButtonLabel}
        </button>

        {/* Publish / Unpublish — only shown when editing */}
        {isEdit && (
          isPublished ? (
            <button
              onClick={handleUnpublish}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-main)] text-sm font-medium hover:bg-[var(--bg-section-alt)] transition-colors"
            >
              <EyeOff size={16} aria-hidden="true" />
              {t('staff.events.unpublish')}
            </button>
          ) : (
            <button
              onClick={handlePublish}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#D9A441] text-[#0F3D2E] text-sm font-semibold hover:bg-[#C59132] transition-colors"
            >
              <Send size={16} aria-hidden="true" />
              {t('staff.events.publish')}
            </button>
          )
        )}

        {/* Publish button also shown for new items */}
        {!isEdit && (
          <button
            onClick={handlePublish}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#D9A441] text-[#0F3D2E] text-sm font-semibold hover:bg-[#C59132] transition-colors"
          >
            <Send size={16} aria-hidden="true" />
            {t('staff.events.publish')}
          </button>
        )}

        {/* Delete (admin only) */}
        {isEdit && isAdmin && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors ml-auto"
          >
            <Trash2 size={16} aria-hidden="true" />
            {t('staff.events.delete')}
          </button>
        )}
      </div>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirmPublish}
        title={t('staff.events.publishConfirmTitle')}
        message={t('staff.events.publishConfirmMsg')}
        confirmLabel={t('staff.events.publish')}
        onConfirm={() => { setConfirmPublish(false); doSave('published') }}
        onCancel={() => setConfirmPublish(false)}
      />

      <ConfirmDialog
        open={confirmUnpublish}
        title={t('staff.events.unpublish')}
        message={t('staff.events.unpublishConfirmMsg')}
        confirmLabel={t('staff.events.unpublish')}
        onConfirm={confirmUnpublishAction}
        onCancel={() => setConfirmUnpublish(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={t('staff.events.deleteConfirmTitle')}
        message={t('staff.events.deleteConfirmMsg')}
        confirmLabel={t('staff.events.delete')}
        variant="danger"
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}


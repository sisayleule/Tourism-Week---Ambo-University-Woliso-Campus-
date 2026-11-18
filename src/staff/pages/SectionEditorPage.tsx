/**
 * SectionEditorPage.tsx — /staff/site/:key and /admin/content/site/:key
 *
 * Generated from the section registry entry for the given key.
 * Features:
 *   - 3-language tabs (English required)
 *   - Image upload to site-content bucket
 *   - Cards editor (add / remove / reorder up to registry max)
 *   - Save draft / Publish / Unpublish / Reset to default
 *   - Live preview panel (renders the actual public section component)
 *   - See on website link
 *
 * Rules enforced:
 *   - English is always required for title / theme text
 *   - CTA URL must start with / or https://
 *   - Cards limited to registry maxCards
 *   - Icons limited to registry allowedIcons
 */

import React, { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  ExternalLink,
  GripVertical,
  Info,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { usePortal } from '../context/PortalContext'
import { useToast } from '../components/Toast'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { I18nTabs, type I18nLang } from '../components/I18nTabs'
import { ImageUpload } from '../components/ImageUpload'
import {
  useSectionByKey,
  useSectionItems,
  useUpsertSection,
  usePublishSection,
  useUnpublishSection,
  useResetSection,
  useReplaceSectionItems,
} from '../hooks/useSectionsQueries'
import {
  getSectionEntry,
  type SectionRegistryEntry,
  type CardDefault,
} from '../../lib/sectionRegistry'
import type { PageSection, PageSectionItem } from '../../types/database'
import { processAndUploadSiteImage } from '../services/sectionsService'

// ─── Types ────────────────────────────────────────────────────────────────────

interface I18nFieldValue {
  en: string
  am: string
  om: string
}

function emptyI18n(): I18nFieldValue {
  return { en: '', am: '', om: '' }
}

function toI18n(v: I18nFieldValue | null | undefined): { en: string; am?: string; om?: string } | null {
  if (!v || (!v.en && !v.am && !v.om)) return null
  return { en: v.en, am: v.am || undefined, om: v.om || undefined }
}

function fromI18n(raw: { en?: string; am?: string; om?: string } | null | undefined): I18nFieldValue {
  return { en: raw?.en ?? '', am: raw?.am ?? '', om: raw?.om ?? '' }
}

interface CardDraft {
  id: string   // temp id for list key
  titleI18n: I18nFieldValue
  bodyI18n:  I18nFieldValue
  badgeI18n: I18nFieldValue
  icon:      string
  imageUrl:  string
  linkUrl:   string
}

function newCard(defaults?: CardDefault): CardDraft {
  return {
    id:       crypto.randomUUID(),
    titleI18n: defaults?.title ? fromI18n(defaults.title) : emptyI18n(),
    bodyI18n:  defaults?.body  ? fromI18n(defaults.body)  : emptyI18n(),
    badgeI18n: defaults?.badge ? fromI18n(defaults.badge) : emptyI18n(),
    icon:      defaults?.icon  ?? '',
    imageUrl:  '',
    linkUrl:   defaults?.link  ?? '',
  }
}

function itemToCardDraft(item: PageSectionItem): CardDraft {
  return {
    id:        item.id,
    titleI18n: fromI18n(item.title_i18n),
    bodyI18n:  fromI18n(item.body_i18n),
    badgeI18n: fromI18n(item.badge_i18n),
    icon:      item.icon ?? '',
    imageUrl:  item.image_url ?? '',
    linkUrl:   item.link_url ?? '',
  }
}

// ─── Field helpers ────────────────────────────────────────────────────────────

function TextField({
  label,
  value,
  onChange,
  required,
  maxLength,
  multiline = false,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  maxLength?: number
  multiline?: boolean
  error?: string
}) {
  const cls = `w-full rounded-xl border ${error ? 'border-red-400' : 'border-[var(--border-subtle)]'} bg-[var(--bg-panel)] px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[#D9A441] resize-none`
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-[var(--text-muted)]">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        {maxLength && <span className="ml-1 text-stone-400">({value.length}/{maxLength})</span>}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          rows={4}
          className={cls}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          className={cls}
        />
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SectionEditorPage() {
  const { key = '' } = useParams<{ key: string }>()
  const { client, basePath } = usePortal()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const entry = getSectionEntry(key)
  const { data: dbSection, isLoading: sectionLoading } = useSectionByKey(client, key)
  const { data: dbItems,   isLoading: itemsLoading   } = useSectionItems(client, dbSection?.id ?? null)

  const upsertMut   = useUpsertSection(client)
  const publishMut  = usePublishSection(client)
  const unpublishMut= useUnpublishSection(client)
  const resetMut    = useResetSection(client)
  const replaceItems= useReplaceSectionItems(client)

  // ── Form state ─────────────────────────────────────────────────────────────
  const [lang, setLang] = useState<I18nLang>('en')
  const [titleI18n,     setTitle    ] = useState<I18nFieldValue>(emptyI18n())
  const [subtitleI18n,  setSubtitle ] = useState<I18nFieldValue>(emptyI18n())
  const [bodyI18n,      setBody     ] = useState<I18nFieldValue>(emptyI18n())
  const [ctaLabelI18n,  setCtaLabel ] = useState<I18nFieldValue>(emptyI18n())
  const [ctaUrl,        setCtaUrl   ] = useState('')
  const [imageUrl,      setImageUrl ] = useState<string | null>(null)
  const [cards,         setCards    ] = useState<CardDraft[]>([])
  const [isDirty,       setIsDirty  ] = useState(false)

  // ── Dialogs ────────────────────────────────────────────────────────────────
  const [showPublishConfirm,   setShowPublishConfirm  ] = useState(false)
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false)
  const [showResetConfirm,     setShowResetConfirm    ] = useState(false)

  // ── Errors ──────────────────────────────────────────────────────────────────
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // ── Load DB data into form ─────────────────────────────────────────────────
  useEffect(() => {
    if (sectionLoading || itemsLoading) return
    if (dbSection) {
      setTitle(fromI18n(dbSection.title_i18n))
      setSubtitle(fromI18n(dbSection.subtitle_i18n))
      setBody(fromI18n(dbSection.body_i18n))
      setCtaLabel(fromI18n(dbSection.cta_label_i18n))
      setCtaUrl(dbSection.cta_url ?? '')
      setImageUrl(dbSection.image_url ?? null)
    } else if (entry) {
      // No DB row yet — seed with registry defaults
      const d = entry.defaultContent
      setTitle(fromI18n(d.title))
      setSubtitle(fromI18n(d.subtitle))
      setBody(fromI18n(d.body))
      setCtaLabel(fromI18n(d.cta_label))
      setCtaUrl(d.cta_url ?? '')
    }

    if (dbItems && dbItems.length > 0) {
      setCards(dbItems.map(itemToCardDraft))
    } else if (entry?.hasCards && entry.defaultContent.cards) {
      setCards(entry.defaultContent.cards.map(newCard))
    }
    setIsDirty(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbSection, dbItems, sectionLoading, itemsLoading])

  const markDirty = useCallback(() => setIsDirty(true), [])

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate(): boolean {
    const errs: Record<string, string> = {}
    const ml = entry?.maxLengths
    if (entry?.fields.includes('title') && !titleI18n.en.trim()) {
      errs.title_en = 'English title is required.'
    }
    if (ml?.title && titleI18n.en.length > ml.title) {
      errs.title_en = `Too long (max ${ml.title})`
    }
    if (ctaUrl && !ctaUrl.startsWith('/') && !ctaUrl.startsWith('https://')) {
      errs.cta_url = 'URL must start with / or https://'
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Build input from form state ────────────────────────────────────────────
  function buildInput(state: 'draft' | 'published' = 'draft') {
    return {
      key,
      title_i18n:     entry?.fields.includes('title')     ? toI18n(titleI18n)    : null,
      subtitle_i18n:  entry?.fields.includes('subtitle')  ? toI18n(subtitleI18n) : null,
      body_i18n:      entry?.fields.includes('body')      ? toI18n(bodyI18n)     : null,
      image_url:      entry?.fields.includes('image')     ? imageUrl             : null,
      cta_label_i18n: entry?.fields.includes('cta_label') ? toI18n(ctaLabelI18n): null,
      cta_url:        entry?.fields.includes('cta_url')   ? ctaUrl || null       : null,
      state,
      needs_review:   false,
    }
  }

  function buildItemInputs() {
    return cards.map((c, i) => ({
      title_i18n:  toI18n(c.titleI18n),
      body_i18n:   toI18n(c.bodyI18n),
      badge_i18n:  toI18n(c.badgeI18n),
      icon:        c.icon || null,
      image_url:   c.imageUrl || null,
      link_url:    c.linkUrl || null,
      sort_order:  i,
      state:       'published' as const,
    }))
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleSaveDraft() {
    if (!validate()) return
    try {
      const saved = await upsertMut.mutateAsync({
        input: buildInput('draft'),
        loadedUpdatedAt: dbSection?.updated_at,
      })
      if (entry?.hasCards) {
        await replaceItems.mutateAsync({ sectionId: saved.id, items: buildItemInputs() })
      }
      showToast({ type: 'success', message: 'Draft saved.' })
      setIsDirty(false)
    } catch (err) {
      showToast({ type: 'error', message: (err as Error).message })
    }
  }

  async function handlePublish() {
    if (!validate()) return
    try {
      // Save latest content first, then flip to published
      const saved = await upsertMut.mutateAsync({
        input: buildInput('published'),
        loadedUpdatedAt: dbSection?.updated_at,
      })
      if (entry?.hasCards) {
        await replaceItems.mutateAsync({ sectionId: saved.id, items: buildItemInputs() })
      }
      setIsDirty(false)
      setShowPublishConfirm(false)
      showToast({ type: 'success', message: 'Section published. Website update queued.' })
    } catch (err) {
      setShowPublishConfirm(false)
      showToast({ type: 'error', message: (err as Error).message })
    }
  }

  async function handleUnpublish() {
    if (!dbSection) return
    try {
      await unpublishMut.mutateAsync({ key, loadedUpdatedAt: dbSection.updated_at })
      setShowUnpublishConfirm(false)
      showToast({ type: 'success', message: 'Section unpublished. Website update queued.' })
    } catch (err) {
      setShowUnpublishConfirm(false)
      showToast({ type: 'error', message: (err as Error).message })
    }
  }

  async function handleReset() {
    if (!entry) return
    const d = entry.defaultContent
    const defaultInput = {
      key,
      title_i18n:     d.title    ? { en: d.title.en, am: d.title.am ?? '', om: d.title.om ?? '' } : null,
      subtitle_i18n:  d.subtitle ? { en: d.subtitle.en, am: d.subtitle.am ?? '', om: d.subtitle.om ?? '' } : null,
      body_i18n:      d.body     ? { en: d.body.en, am: d.body.am ?? '', om: d.body.om ?? '' } : null,
      image_url:      null,
      cta_label_i18n: d.cta_label ? { en: d.cta_label.en, am: d.cta_label.am ?? '', om: d.cta_label.om ?? '' } : null,
      cta_url:        d.cta_url ?? null,
      state:          'published' as const,
      needs_review:   false,
    }
    try {
      const saved = await resetMut.mutateAsync({ key, defaultInput })
      if (entry.hasCards && d.cards) {
        const defCards = d.cards.map((c, i) => ({
          title_i18n:  c.title ? { en: c.title.en, am: c.title.am ?? '', om: c.title.om ?? '' } : null,
          body_i18n:   c.body  ? { en: c.body.en,  am: c.body.am  ?? '', om: c.body.om  ?? '' } : null,
          badge_i18n:  c.badge ? { en: c.badge.en, am: c.badge.am ?? '', om: c.badge.om ?? '' } : null,
          icon:        c.icon ?? null,
          image_url:   null as null,
          link_url:    c.link ?? null,
          sort_order:  i,
          state:       'published' as const,
        }))
        await replaceItems.mutateAsync({ sectionId: saved.id, items: defCards })
      }
      setShowResetConfirm(false)
      showToast({ type: 'success', message: 'Reset to default text. Website update queued.' })
    } catch (err) {
      setShowResetConfirm(false)
      showToast({ type: 'error', message: (err as Error).message })
    }
  }

  // ── Card helpers ──────────────────────────────────────────────────────────
  function addCard() {
    if (entry && cards.length >= entry.maxCards && entry.maxCards > 0) return
    setCards((prev) => [...prev, newCard()])
    markDirty()
  }

  function removeCard(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id))
    markDirty()
  }

  function moveCard(id: string, dir: 'up' | 'down') {
    setCards((prev) => {
      const idx = prev.findIndex((c) => c.id === id)
      if (idx < 0) return prev
      const next = [...prev]
      const swap = dir === 'up' ? idx - 1 : idx + 1
      if (swap < 0 || swap >= next.length) return prev
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
    markDirty()
  }

  function updateCard(id: string, patch: Partial<CardDraft>) {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c))
    markDirty()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (!entry) {
    return (
      <div className="max-w-2xl space-y-4 py-8">
        <Link to={`${basePath}/site`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F3D2E] dark:text-[#D9A441] hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Website Content
        </Link>
        <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          Section <code className="font-mono">{key}</code> is not registered. Only registered sections can be edited.
        </div>
      </div>
    )
  }

  const isPublished   = dbSection?.state === 'published'
  const isBusy        = upsertMut.isPending || publishMut.isPending || unpublishMut.isPending || resetMut.isPending || replaceItems.isPending
  const usesField     = (f: SectionRegistryEntry['fields'][number]) => entry.fields.includes(f)

  return (
    <div className="max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link to={`${basePath}/site`} className="inline-flex items-center gap-1 font-semibold text-[#0F3D2E] dark:text-[#D9A441] hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Website Content
        </Link>
        <span className="text-stone-400">/</span>
        <span className="text-stone-700 dark:text-stone-300">{entry.label}</span>
      </div>

      {/* Title row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100">{entry.label}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-stone-400 font-mono">{entry.key}</span>
            <a
              href={entry.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#0F3D2E] dark:text-[#D9A441] hover:underline"
            >
              See on website <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </div>
        {isPublished && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Published
          </span>
        )}
      </div>

      {/* Fallback info */}
      {entry.fallbackBehaviour === 'default' && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
          <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>When no published row exists, the public site shows the built-in default text. Saving as draft hides this section only if the fallback behaviour is "hide".</span>
        </div>
      )}

      {/* Language tabs */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#0F1E19] p-6 space-y-6">
        <I18nTabs value={lang} onChange={setLang} />

        {/* Title */}
        {usesField('title') && (
          <TextField
            label="Title"
            value={titleI18n[lang]}
            onChange={(v) => { setTitle((p) => ({ ...p, [lang]: v })); markDirty() }}
            required={lang === 'en'}
            maxLength={entry.maxLengths?.title}
            error={lang === 'en' ? fieldErrors.title_en : undefined}
          />
        )}

        {/* Subtitle */}
        {usesField('subtitle') && (
          <TextField
            label="Subtitle / Overline"
            value={subtitleI18n[lang]}
            onChange={(v) => { setSubtitle((p) => ({ ...p, [lang]: v })); markDirty() }}
            maxLength={entry.maxLengths?.subtitle}
          />
        )}

        {/* Body */}
        {usesField('body') && (
          <TextField
            label="Body text (Markdown supported)"
            value={bodyI18n[lang]}
            onChange={(v) => { setBody((p) => ({ ...p, [lang]: v })); markDirty() }}
            maxLength={entry.maxLengths?.body}
            multiline
          />
        )}

        {/* CTA label */}
        {usesField('cta_label') && (
          <TextField
            label="Button label"
            value={ctaLabelI18n[lang]}
            onChange={(v) => { setCtaLabel((p) => ({ ...p, [lang]: v })); markDirty() }}
            maxLength={entry.maxLengths?.cta_label}
          />
        )}

        {/* CTA URL — only shown on English tab */}
        {usesField('cta_url') && lang === 'en' && (
          <TextField
            label="Button URL (/ or https:// only)"
            value={ctaUrl}
            onChange={(v) => { setCtaUrl(v); markDirty() }}
            maxLength={entry.maxLengths?.cta_url}
            error={fieldErrors.cta_url}
          />
        )}

        {/* Image */}
        {usesField('image') && lang === 'en' && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Section image</label>
            <ImageUpload
              value={imageUrl}
              onChange={(url) => { setImageUrl(url); markDirty() }}
              namePrefix={`section-${key}`}
            />
          </div>
        )}
      </div>

      {/* Cards editor */}
      {entry.hasCards && (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#0F1E19] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-base text-stone-900 dark:text-stone-100">
              Cards
              <span className="ml-2 text-xs text-stone-400 font-normal">
                ({cards.length}{entry.maxCards > 0 ? ` / ${entry.maxCards} max` : ''})
              </span>
            </h2>
            <button
              type="button"
              onClick={addCard}
              disabled={entry.maxCards > 0 && cards.length >= entry.maxCards}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F3D2E] text-white text-xs font-semibold hover:bg-[#0A2A20] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add card
            </button>
          </div>

          {cards.length === 0 && (
            <p className="text-sm text-stone-400 text-center py-4">No cards yet. Click "Add card" to start.</p>
          )}

          <div className="space-y-4">
            {cards.map((card, idx) => (
              <div
                key={card.id}
                className="rounded-xl border border-stone-200 dark:border-stone-700 p-4 space-y-3 bg-stone-50 dark:bg-[#12221C]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-stone-400">
                    <GripVertical className="h-4 w-4" aria-hidden="true" />
                    <span className="font-semibold text-stone-600 dark:text-stone-300">Card {idx + 1}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveCard(card.id, 'up')}
                      disabled={idx === 0}
                      aria-label="Move up"
                      className="p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 transition-colors"
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCard(card.id, 'down')}
                      disabled={idx === cards.length - 1}
                      aria-label="Move down"
                      className="p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 transition-colors"
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCard(card.id)}
                      aria-label="Remove card"
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Card title */}
                <TextField
                  label={`Title (${lang})`}
                  value={card.titleI18n[lang]}
                  onChange={(v) => updateCard(card.id, { titleI18n: { ...card.titleI18n, [lang]: v } })}
                />

                {/* Card body */}
                <TextField
                  label={`Description (${lang})`}
                  value={card.bodyI18n[lang]}
                  onChange={(v) => updateCard(card.id, { bodyI18n: { ...card.bodyI18n, [lang]: v } })}
                  multiline
                />

                {/* Badge */}
                <TextField
                  label={`Badge label (${lang}) — e.g. distance or category`}
                  value={card.badgeI18n[lang]}
                  onChange={(v) => updateCard(card.id, { badgeI18n: { ...card.badgeI18n, [lang]: v } })}
                />

                {/* Icon — only on en tab */}
                {lang === 'en' && entry.allowedIcons.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[var(--text-muted)]">Icon</label>
                    <select
                      value={card.icon}
                      onChange={(e) => updateCard(card.id, { icon: e.target.value })}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A441]"
                    >
                      <option value="">— None —</option>
                      {entry.allowedIcons.map((ic) => (
                        <option key={ic} value={ic}>{ic}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Link URL — only on en tab */}
                {lang === 'en' && (
                  <TextField
                    label="Link URL (/ or https:// only, optional)"
                    value={card.linkUrl}
                    onChange={(v) => updateCard(card.id, { linkUrl: v })}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={isBusy || !isDirty}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-sm font-semibold hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-40 transition-colors"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          Save draft
        </button>

        <button
          type="button"
          onClick={() => setShowPublishConfirm(true)}
          disabled={isBusy}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] disabled:opacity-40 transition-colors shadow-sm"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Publish
        </button>

        {isPublished && (
          <button
            type="button"
            onClick={() => setShowUnpublishConfirm(true)}
            disabled={isBusy}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-sm font-semibold hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-40 transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Unpublish
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          disabled={isBusy}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-sm font-semibold hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-40 transition-colors"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Reset to default text
        </button>
      </div>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={showPublishConfirm}
        title="Publish section?"
        message="This will make the section visible to the public immediately after the next website update."
        confirmLabel="Publish"
        variant="default"
        onConfirm={handlePublish}
        onCancel={() => setShowPublishConfirm(false)}
      />
      <ConfirmDialog
        open={showUnpublishConfirm}
        title="Unpublish section?"
        message={`This section will be hidden from the public site. ${entry.fallbackBehaviour === 'default' ? 'The built-in default text will be shown instead.' : 'The section will disappear from the page.'}`}
        confirmLabel="Unpublish"
        variant="danger"
        onConfirm={handleUnpublish}
        onCancel={() => setShowUnpublishConfirm(false)}
      />
      <ConfirmDialog
        open={showResetConfirm}
        title="Reset to default text?"
        message="All content in this section will be replaced with the original hard-coded text. This cannot be undone."
        confirmLabel="Reset"
        variant="danger"
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  )
}

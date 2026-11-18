/**
 * NewsFormPage.tsx — /staff/news/new, /staff/news/:id
 *                    /admin/content/news/new, /admin/content/news/:id
 *
 * Create / edit a news article:
 *  - Title, summary, body in EN / AM / OM (English required)
 *  - Category (department | sports_community | academic | general)
 *  - Cover image upload (news-covers bucket, resized to 1200×630 WebP) — no empty box when missing
 *  - Pinned toggle
 *  - Slug (auto-generated from EN title, editable)
 *  - Markdown body with preview (sanitised with a simple allowlist)
 *  - "Publish immediately" checkbox ON by default
 *  - Save changes / Unpublish / Delete (admin only)
 *  - Removes from public site immediately on unpublish/delete
 */

import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Save, Eye, EyeOff, Trash2, UploadCloud, Pin, X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePortal } from '../../context/PortalContext'
import { useToast } from '../../components/Toast'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FullPageSpinner } from '../../components/Loading'
import { Label, TextInput, TextArea, SelectField, FormError } from '../../components/StaffForm'
import { I18nTabs, type I18nLang, LANG_NOTE } from '../../components/I18nTabs'
import { formatError } from '../../services/helpers'
import { scheduleDeploy } from '../../lib/deployScheduler'
import { renderMarkdown } from '../../../lib/renderMarkdown'
import type { News, ContentState, NewsCategory } from '../../../types/database'

// ─── Image resize ──────────────────────────────────────────────────────────────

function resizeToWebP(file: File, maxW: number, maxH: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight)
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

// ─── Slugify ───────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 80)
}

// ─── Image categories accepted ─────────────────────────────────────────────────

const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const IMG_MAX   = 5 * 1024 * 1024

// ─── News form page ────────────────────────────────────────────────────────────

interface FormState {
  titleEn:    string; titleAm: string; titleOm: string
  summaryEn:  string; summaryAm: string; summaryOm: string
  bodyEn:     string; bodyAm: string; bodyOm: string
  category:   NewsCategory
  slug:       string
  pinned:     boolean
  publishNow: boolean
}

const CATEGORIES: { value: NewsCategory; label: string }[] = [
  { value: 'department',       label: 'Department Announcement' },
  { value: 'sports_community', label: 'Sports & Community' },
  { value: 'academic',         label: 'Academic' },
  { value: 'general',          label: 'General' },
]

export function NewsFormPage() {
  const { t }       = useTranslation()
  const { id }      = useParams()
  const navigate    = useNavigate()
  const { showToast } = useToast()
  const { client, basePath, canDelete } = usePortal()
  const qc          = useQueryClient()
  const isEdit      = !!id
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load existing article
  const { data: existing, isLoading } = useQuery({
    queryKey: ['staff', 'news-article', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await client.from('news').select('*').eq('id', id).single()
      if (error) throw error
      return data as unknown as News
    },
    enabled: isEdit,
  })

  const [activeLang, setActiveLang] = useState<I18nLang>('en')
  const [previewTab,  setPreviewTab] = useState<'edit' | 'preview'>('edit')
  const [form, setForm] = useState<FormState>({
    titleEn: '', titleAm: '', titleOm: '',
    summaryEn: '', summaryAm: '', summaryOm: '',
    bodyEn: '', bodyAm: '', bodyOm: '',
    category: 'general',
    slug: '',
    pinned: false,
    publishNow: true,
  })
  const [coverFile,    setCoverFile]    = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [errors,       setErrors]       = useState<Record<string, string>>({})
  const [saving,       setSaving]       = useState(false)
  const [deleteOpen,   setDeleteOpen]   = useState(false)

  // Auto-generate slug from EN title
  const [slugTouched, setSlugTouched] = useState(false)
  useEffect(() => {
    if (!slugTouched && form.titleEn) {
      setForm(f => ({ ...f, slug: slugify(f.titleEn) }))
    }
  }, [form.titleEn, slugTouched])

  // Load existing data into form
  useEffect(() => {
    if (!existing) return
    const t_ = (existing.title_i18n as { en?: string; am?: string; om?: string }) ?? {}
    const s_ = (existing.summary_i18n as { en?: string; am?: string; om?: string } | null) ?? {}
    const b_ = (existing.body_i18n as { en?: string; am?: string; om?: string } | null) ?? {}
    setForm({
      titleEn: t_.en ?? '', titleAm: t_.am ?? '', titleOm: t_.om ?? '',
      summaryEn: s_.en ?? '', summaryAm: s_.am ?? '', summaryOm: s_.om ?? '',
      bodyEn: b_.en ?? '', bodyAm: b_.am ?? '', bodyOm: b_.om ?? '',
      category: existing.category ?? 'general',
      slug: existing.slug ?? '',
      pinned: existing.pinned ?? false,
      publishNow: existing.state === 'published',
    })
    setSlugTouched(true)
    if (existing.cover_image_url) setCoverPreview(existing.cover_image_url)
  }, [existing])

  const up = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const handleCoverFile = (file: File) => {
    if (!IMG_TYPES.includes(file.type)) { setErrors(e => ({ ...e, cover: 'Only JPEG, PNG, WebP or AVIF allowed.' })); return }
    if (file.size > IMG_MAX) { setErrors(e => ({ ...e, cover: 'File must be 5 MB or smaller.' })); return }
    setErrors(e => { const n = { ...e }; delete n.cover; return n })
    setCoverFile(file); setCoverPreview(URL.createObjectURL(file))
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.titleEn.trim()) errs.titleEn = 'English title is required.'
    if (!form.slug.trim())    errs.slug    = 'Slug is required.'
    if (!/^[a-z0-9-]+$/.test(form.slug)) errs.slug = 'Slug may only contain lowercase letters, numbers and hyphens.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const uploadCover = async (): Promise<string | null> => {
    if (!coverFile) return existing?.cover_image_url ?? null
    const blob = await resizeToWebP(coverFile, 1200, 630)
    const path = `${crypto.randomUUID()}.webp`
    const { error } = await (client.storage as unknown as {
      from: (b: string) => { upload: (p: string, b: Blob, o: Record<string, unknown>) => Promise<{ error: unknown }>; getPublicUrl: (p: string) => { data: { publicUrl: string } } }
    }).from('news-covers').upload(path, blob, { contentType: 'image/webp', upsert: false })
    if (error) throw new Error(formatError(error))
    return (client.storage as unknown as { from: (b: string) => { getPublicUrl: (p: string) => { data: { publicUrl: string } } } }).from('news-covers').getPublicUrl(path).data.publicUrl
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const coverUrl = await uploadCover()
      const payload = {
        title_i18n:   { en: form.titleEn.trim(), ...(form.titleAm ? { am: form.titleAm } : {}), ...(form.titleOm ? { om: form.titleOm } : {}) },
        summary_i18n: form.summaryEn ? { en: form.summaryEn, ...(form.summaryAm ? { am: form.summaryAm } : {}), ...(form.summaryOm ? { om: form.summaryOm } : {}) } : null,
        body_i18n:    form.bodyEn    ? { en: form.bodyEn,    ...(form.bodyAm    ? { am: form.bodyAm    } : {}), ...(form.bodyOm    ? { om: form.bodyOm    } : {}) } : null,
        category:     form.category,
        slug:         form.slug.trim(),
        pinned:       form.pinned,
        state:        (form.publishNow ? 'published' : 'draft') as ContentState,
        cover_image_url: coverUrl,
        published_at: form.publishNow ? (existing?.published_at ?? new Date().toISOString()) : null,
      }

      if (isEdit && existing) {
        const { error } = await client.from('news').update(payload).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await client.from('news').insert(payload)
        if (error) throw error
      }
      qc.invalidateQueries({ queryKey: ['staff', 'news'] })
      scheduleDeploy()
      showToast({ type: 'success', message: isEdit ? 'Article saved.' : 'Article created.' })
      navigate(`${basePath}${basePath.startsWith('/admin') ? '/content' : ''}/news`)
    } catch (err) {
      setErrors(e => ({ ...e, _form: formatError(err) }))
    } finally { setSaving(false) }
  }

  const handleUnpublish = async () => {
    if (!existing) return
    try {
      const { error } = await client.from('news').update({ state: 'draft' }).eq('id', existing.id)
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['staff', 'news'] })
      scheduleDeploy()
      showToast({ type: 'success', message: 'Article unpublished.' })
      navigate(`${basePath}${basePath.startsWith('/admin') ? '/content' : ''}/news`)
    } catch (err) { showToast({ type: 'error', message: formatError(err) }) }
  }

  const handleDelete = async () => {
    if (!existing) return
    try {
      const { error } = await client.from('news').delete().eq('id', existing.id)
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['staff', 'news'] })
      scheduleDeploy()
      showToast({ type: 'success', message: 'Article deleted.' })
      navigate(`${basePath}${basePath.startsWith('/admin') ? '/content' : ''}/news`)
    } catch (err) { showToast({ type: 'error', message: formatError(err) }) }
  }

  if (isEdit && isLoading) return <FullPageSpinner label={t('staff.common.loading')} />

  const newsRoute = `${basePath}${basePath.startsWith('/admin') ? '/content' : ''}/news`

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(newsRoute)}
          className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] transition-colors shrink-0"
          aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-xl font-bold text-[var(--text-main)]">
          {isEdit ? 'Edit article' : 'New article'}
        </h1>
      </div>

      {errors._form && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {errors._form}
        </div>
      )}

      {/* Title (i18n) */}
      <section className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
        <I18nTabs value={activeLang} onChange={setActiveLang} />
        <p className="text-[11px] text-[var(--text-muted)]">{LANG_NOTE[activeLang]}</p>
        <div>
          <Label htmlFor="news-title" required>Title</Label>
          <TextInput id="news-title" value={form[`title${activeLang.charAt(0).toUpperCase()}${activeLang.slice(1)}` as keyof FormState] as string}
            onChange={e => up(`title${activeLang.charAt(0).toUpperCase()}${activeLang.slice(1)}` as keyof FormState, e.target.value)}
            aria-invalid={activeLang === 'en' && !!errors.titleEn ? 'true' : undefined} />
          {activeLang === 'en' && errors.titleEn && <FormError message={errors.titleEn} />}
        </div>
        <div>
          <Label htmlFor="news-summary" hint="optional">Summary / excerpt</Label>
          <TextArea id="news-summary" rows={2}
            value={form[`summary${activeLang.charAt(0).toUpperCase()}${activeLang.slice(1)}` as keyof FormState] as string}
            onChange={e => up(`summary${activeLang.charAt(0).toUpperCase()}${activeLang.slice(1)}` as keyof FormState, e.target.value)} />
        </div>
      </section>

      {/* Cover image */}
      <section className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-3">
        <Label htmlFor="news-cover" hint="optional">Cover image (JPEG/PNG/WebP/AVIF · max 5 MB)</Label>
        {coverPreview && (
          <div className="relative">
            <img src={coverPreview} alt="cover preview" className="w-full h-40 object-cover rounded-xl" />
            <button onClick={() => { setCoverFile(null); setCoverPreview(null) }}
              className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80">
              <X size={14} />
            </button>
          </div>
        )}
        <button onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-main)] hover:bg-[var(--bg-section-alt)]">
          <UploadCloud size={14} /> {coverPreview ? 'Change cover' : 'Upload cover'}
        </button>
        <input ref={fileInputRef} type="file" accept={IMG_TYPES.join(',')} hidden
          onChange={e => e.target.files?.[0] && handleCoverFile(e.target.files[0])} />
        {errors.cover && <FormError message={errors.cover} />}
      </section>

      {/* Body with preview */}
      <section className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="news-body" hint="optional">Body (Markdown)</Label>
          <div className="ml-auto flex items-center rounded-lg border border-[var(--border-subtle)] overflow-hidden text-xs">
            <button onClick={() => setPreviewTab('edit')}
              className={`px-3 py-1.5 transition-colors ${previewTab === 'edit' ? 'bg-[#0F3D2E] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)]'}`}>
              Edit
            </button>
            <button onClick={() => setPreviewTab('preview')}
              className={`px-3 py-1.5 transition-colors ${previewTab === 'preview' ? 'bg-[#0F3D2E] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)]'}`}>
              <Eye size={12} className="inline mr-1" />Preview
            </button>
          </div>
        </div>
        {previewTab === 'edit' ? (
          <TextArea id="news-body" rows={12}
            value={form[`body${activeLang.charAt(0).toUpperCase()}${activeLang.slice(1)}` as keyof FormState] as string}
            onChange={e => up(`body${activeLang.charAt(0).toUpperCase()}${activeLang.slice(1)}` as keyof FormState, e.target.value)}
            placeholder="Write in Markdown. **Bold**, *italic*, ## Heading, - list items, [text](url)" />
        ) : (
          <div
            className="min-h-[200px] p-4 rounded-xl bg-[var(--bg-section-alt)] text-sm text-[var(--text-main)] leading-relaxed prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(
              form[`body${activeLang.charAt(0).toUpperCase()}${activeLang.slice(1)}` as keyof FormState] as string,
              { h1: 'font-bold text-xl mt-6 mb-2', h2: 'font-bold text-lg mt-5 mb-1.5', h3: 'font-bold text-base mt-4 mb-1', p: 'mb-2', li: 'ml-4 list-disc', ul: 'space-y-0.5 my-2' }
            ) }}
          />
        )}
      </section>

      {/* Category, slug, pinned */}
      <section className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
        <div>
          <Label htmlFor="news-cat">Category</Label>
          <SelectField id="news-cat" value={form.category} onChange={e => up('category', e.target.value as NewsCategory)}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </SelectField>
        </div>
        <div>
          <Label htmlFor="news-slug" required>Slug (URL path)</Label>
          <TextInput id="news-slug" value={form.slug}
            onChange={e => { setSlugTouched(true); up('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')) }}
            aria-invalid={!!errors.slug ? 'true' : undefined} />
          {errors.slug && <FormError message={errors.slug} />}
          <p className="text-[11px] text-[var(--text-muted)] mt-1">Public URL: /news/{form.slug || '…'}</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-[var(--text-main)] cursor-pointer">
          <input type="checkbox" checked={form.pinned} onChange={e => up('pinned', e.target.checked)}
            className="w-4 h-4 rounded accent-[#D9A441]" />
          <Pin size={14} className="text-[#D9A441]" />
          Pinned (shows first on /news and Home)
        </label>
      </section>

      {/* Visibility */}
      <section className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-5">
        <label className="inline-flex items-center gap-2 text-sm text-[var(--text-main)] cursor-pointer">
          <input type="checkbox" checked={form.publishNow} onChange={e => up('publishNow', e.target.checked)}
            className="w-4 h-4 rounded accent-[#0F3D2E]" />
          Publish immediately (visible on public site)
        </label>
      </section>

      {/* Actions */}
      <div className="flex flex-wrap gap-2.5 pb-8">
        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]">
          <Save size={16} />
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create article'}
        </button>
        {isEdit && existing?.state === 'published' && (
          <button onClick={handleUnpublish}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-main)] hover:bg-[var(--bg-section-alt)]">
            <EyeOff size={15} /> Unpublish
          </button>
        )}
        {isEdit && canDelete && (
          <button onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 ml-auto">
            <Trash2 size={15} /> Delete
          </button>
        )}
        <button onClick={() => navigate(newsRoute)}
          className="px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-main)] hover:bg-[var(--bg-section-alt)]">
          Cancel
        </button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete article?"
        message={`"${existing?.title_i18n?.en ?? ''}" will be permanently deleted and removed from the public site.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  )
}

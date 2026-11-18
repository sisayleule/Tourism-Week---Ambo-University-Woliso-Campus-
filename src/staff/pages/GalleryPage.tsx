/**
 * GalleryPage.tsx — /staff/gallery and /admin/content/gallery
 *
 * Real gallery manager:
 *  - Upload photos (JPEG/PNG/WebP/AVIF, ≤5 MB each)
 *  - Browser-side resize: image_url ≤1600 px wide WebP, thumb_url ≤480 px wide WebP
 *  - Upload to gallery storage bucket; create gallery_items rows
 *  - "Publish immediately" checkbox (ON by default)
 *  - Progress bar + per-file error messages
 *  - Grid with thumbnails + Draft/Published badges
 *  - Select mode: bulk Publish / Unpublish
 *  - Edit dialog: caption in 3 languages, year, sort order
 *  - Add video link (https URL only)
 *  - Delete admin only
 */

import React, { useCallback, useRef, useState } from 'react'
import {
  Images, UploadCloud, Trash2, Eye, EyeOff, Pencil,
  CheckSquare, Square, X, Link as LinkIcon, Check,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePortal } from '../context/PortalContext'
import { useToast } from '../components/Toast'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ContentStateBadge } from '../components/StatusBadge'
import { FullPageSpinner } from '../components/Loading'
import { Label, TextInput, TextArea, FormError } from '../components/StaffForm'
import { formatError } from '../services/helpers'
import { scheduleDeploy } from '../lib/deployScheduler'
import type { GalleryItem, ContentState } from '../../types/database'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const MAX_BYTES = 5 * 1024 * 1024
const MAX_FULL  = 1600
const MAX_THUMB = 480

// ─── Browser-side image resize to WebP ───────────────────────────────────────

function resizeToWebP(file: File, maxWidth: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = img.naturalWidth > maxWidth ? maxWidth / img.naturalWidth : 1
      const w = Math.round(img.naturalWidth * scale)
      const h = Math.round(img.naturalHeight * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null')),
        'image/webp',
        0.88,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

// ─── Queries / mutations ──────────────────────────────────────────────────────

function useGallery() {
  const { client } = usePortal()
  return useQuery({
    queryKey: ['staff', 'gallery'],
    queryFn: async () => {
      const { data, error } = await client
        .from('gallery_items')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as GalleryItem[]
    },
  })
}

function useGalleryMutations() {
  const { client } = usePortal()
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['staff', 'gallery'] })

  const setStateMut = useMutation({
    mutationFn: async ({ ids, state }: { ids: string[]; state: ContentState }) => {
      const { error } = await client.from('gallery_items').update({ state }).in('id', ids)
      if (error) throw error
      scheduleDeploy()
    },
    onSuccess: inv,
  })

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }: {
      id: string
      patch: { caption_i18n?: Record<string, string>; year?: number; sort_order?: number }
    }) => {
      const { error } = await client.from('gallery_items').update(patch).eq('id', id)
      if (error) throw error
      scheduleDeploy()
    },
    onSuccess: inv,
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.from('gallery_items').delete().eq('id', id)
      if (error) throw error
      scheduleDeploy()
    },
    onSuccess: inv,
  })

  const videoMut = useMutation({
    mutationFn: async ({ url, state }: { url: string; state: ContentState }) => {
      const { data: edition } = await client.from('edition_public').select('id').eq('is_current', true).single()
      const { error } = await client.from('gallery_items').insert({
        edition_id: edition?.id,
        media_type: 'video',
        image_url: '',
        video_url: url,
        state,
        sort_order: 999,
        year: new Date().getFullYear(),
        category: 'highlights',
      })
      if (error) throw error
      scheduleDeploy()
    },
    onSuccess: inv,
  })

  return { setStateMut, updateMut, deleteMut, videoMut }
}

// ─── Upload logic ─────────────────────────────────────────────────────────────

interface UploadResult {
  fileName: string
  status: 'uploading' | 'done' | 'error'
  error?: string
  progress: number
}

async function uploadPhoto(
  client: ReturnType<typeof usePortal>['client'],
  file: File,
  publishImmediately: boolean,
  onProgress: (p: number) => void,
): Promise<void> {
  onProgress(10)

  // Resize both sizes
  const [fullBlob, thumbBlob] = await Promise.all([
    resizeToWebP(file, MAX_FULL),
    resizeToWebP(file, MAX_THUMB),
  ])
  onProgress(40)

  const id = crypto.randomUUID()
  const baseName = `${id}`

  // Upload full
  const { error: err1 } = await (client.storage as unknown as {
    from: (b: string) => {
      upload: (p: string, b: Blob, o: Record<string, unknown>) => Promise<{ error: unknown }>
    }
  }).from('gallery').upload(`${baseName}.webp`, fullBlob, { contentType: 'image/webp', upsert: false })
  if (err1) throw new Error(formatError(err1))
  onProgress(65)

  // Upload thumb
  const { error: err2 } = await (client.storage as unknown as {
    from: (b: string) => {
      upload: (p: string, b: Blob, o: Record<string, unknown>) => Promise<{ error: unknown }>
      getPublicUrl: (p: string) => { data: { publicUrl: string } }
    }
  }).from('gallery').upload(`${baseName}_thumb.webp`, thumbBlob, { contentType: 'image/webp', upsert: false })
  if (err2) throw new Error(formatError(err2))
  onProgress(80)

  // Get public URLs
  const st = client.storage as unknown as {
    from: (b: string) => { getPublicUrl: (p: string) => { data: { publicUrl: string } } }
  }
  const imageUrl = st.from('gallery').getPublicUrl(`${baseName}.webp`).data.publicUrl
  const thumbUrl = st.from('gallery').getPublicUrl(`${baseName}_thumb.webp`).data.publicUrl

  // Get current edition
  const { data: edition } = await client.from('edition_public').select('id').eq('is_current', true).single()

  const { error: dbErr } = await client.from('gallery_items').insert({
    edition_id: edition?.id,
    media_type: 'photo',
    image_url: imageUrl,
    thumb_url: thumbUrl,
    state: publishImmediately ? 'published' : 'draft',
    sort_order: 999,
    year: new Date().getFullYear(),
    category: 'culture',
  })
  if (dbErr) throw new Error(formatError(dbErr))
  onProgress(100)
}

// ─── Edit dialog ──────────────────────────────────────────────────────────────

function EditDialog({
  item,
  onSave,
  onClose,
}: {
  item: GalleryItem
  onSave: (patch: { caption_i18n: Record<string, string>; year: number; sort_order: number }) => Promise<void>
  onClose: () => void
}) {
  const cap = (item.caption_i18n as Record<string, string> | null) ?? {}
  const [en, setEn] = useState(cap.en ?? '')
  const [am, setAm] = useState(cap.am ?? '')
  const [om, setOm] = useState(cap.om ?? '')
  const [year, setYear] = useState(String(item.year))
  const [sort, setSort] = useState(String(item.sort_order))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        caption_i18n: { en: en.trim(), ...(am.trim() ? { am: am.trim() } : {}), ...(om.trim() ? { om: om.trim() } : {}) },
        year: parseInt(year, 10) || new Date().getFullYear(),
        sort_order: parseInt(sort, 10) || 999,
      })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-[var(--text-main)]">Edit gallery item</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)]"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div><Label htmlFor="cap-en">Caption (English)</Label><TextArea id="cap-en" value={en} onChange={e => setEn(e.target.value)} rows={2} /></div>
          <div><Label htmlFor="cap-am">Caption (Amharic)</Label><TextArea id="cap-am" value={am} onChange={e => setAm(e.target.value)} rows={2} /></div>
          <div><Label htmlFor="cap-om">Caption (Afaan Oromo)</Label><TextArea id="cap-om" value={om} onChange={e => setOm(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="year">Year</Label><TextInput id="year" type="number" value={year} onChange={e => setYear(e.target.value)} /></div>
            <div><Label htmlFor="sort">Sort order</Label><TextInput id="sort" type="number" value={sort} onChange={e => setSort(e.target.value)} /></div>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-main)] hover:bg-[var(--bg-section-alt)]">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function GalleryPage() {
  const { t } = useTranslation()
  const { canDelete } = usePortal()
  const { showToast } = useToast()

  const { data: items, isLoading } = useGallery()
  const { setStateMut, updateMut, deleteMut, videoMut } = useGalleryMutations()

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [publishImmediately, setPublishImmediately] = useState(true)
  const [uploads, setUploads] = useState<UploadResult[]>([])
  const [isDragOver, setIsDragOver] = useState(false)

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)

  // Edit / delete
  const [editItem, setEditItem] = useState<GalleryItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GalleryItem | null>(null)

  // Video link dialog
  const [videoOpen, setVideoOpen] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [videoErr, setVideoErr] = useState('')

  const { client } = usePortal()
  const qc = useQueryClient()

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    const valid = arr.filter(f => {
      if (!ACCEPTED.includes(f.type)) { showToast({ type: 'error', message: `${f.name}: unsupported format. Use JPEG, PNG, WebP or AVIF.` }); return false }
      if (f.size > MAX_BYTES) { showToast({ type: 'error', message: `${f.name}: file too large (max 5 MB).` }); return false }
      return true
    })
    if (!valid.length) return

    const newUploads: UploadResult[] = valid.map(f => ({ fileName: f.name, status: 'uploading', progress: 0 }))
    setUploads(prev => [...prev, ...newUploads])

    await Promise.all(valid.map(async (file, i) => {
      const idx = uploads.length + i
      try {
        await uploadPhoto(client, file, publishImmediately, (p) => {
          setUploads(prev => prev.map((u, j) => j === idx ? { ...u, progress: p } : u))
        })
        setUploads(prev => prev.map((u, j) => j === idx ? { ...u, status: 'done', progress: 100 } : u))
      } catch (err) {
        setUploads(prev => prev.map((u, j) => j === idx ? { ...u, status: 'error', error: formatError(err) } : u))
      }
    }))
    qc.invalidateQueries({ queryKey: ['staff', 'gallery'] })
  }, [client, publishImmediately, uploads.length, qc, showToast])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false)
    processFiles(e.dataTransfer.files)
  }

  const toggleSelect = (id: string) => setSelected(prev => {
    const s = new Set(prev)
    s.has(id) ? s.delete(id) : s.add(id)
    return s
  })

  const handleBulkState = async (state: ContentState) => {
    if (!selected.size) return
    try {
      await setStateMut.mutateAsync({ ids: [...selected], state })
      showToast({ type: 'success', message: `${selected.size} items ${state === 'published' ? 'published' : 'unpublished'}.` })
      setSelected(new Set())
    } catch (err) { showToast({ type: 'error', message: formatError(err) }) }
  }

  const handleSingleToggle = async (item: GalleryItem) => {
    const newState: ContentState = item.state === 'published' ? 'draft' : 'published'
    try {
      await setStateMut.mutateAsync({ ids: [item.id], state: newState })
      showToast({ type: 'success', message: `Item ${newState === 'published' ? 'published' : 'unpublished'}.` })
    } catch (err) { showToast({ type: 'error', message: formatError(err) }) }
  }

  const handleSaveEdit = async (patch: { caption_i18n: Record<string, string>; year: number; sort_order: number }) => {
    if (!editItem) return
    await updateMut.mutateAsync({ id: editItem.id, patch })
    showToast({ type: 'success', message: 'Gallery item saved.' })
    setEditItem(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMut.mutateAsync(deleteTarget.id)
      showToast({ type: 'success', message: 'Gallery item deleted.' })
    } catch (err) { showToast({ type: 'error', message: formatError(err) }) }
    finally { setDeleteTarget(null) }
  }

  const handleAddVideo = async () => {
    setVideoErr('')
    if (!videoUrl.startsWith('https://')) { setVideoErr('URL must start with https://'); return }
    try {
      await videoMut.mutateAsync({ url: videoUrl, state: publishImmediately ? 'published' : 'draft' })
      showToast({ type: 'success', message: 'Video link added.' })
      setVideoUrl(''); setVideoOpen(false)
    } catch (err) { setVideoErr(formatError(err)) }
  }

  if (isLoading) return <FullPageSpinner label={t('staff.common.loading')} />

  const activeUploads = uploads.filter(u => u.status === 'uploading')

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0F3D2E] text-[#D9A441]"><Images size={20} /></div>
          <h1 className="font-display text-xl font-bold text-[var(--text-main)]">Gallery</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setVideoOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)]">
            <LinkIcon size={15} /> Add video link
          </button>
          {items && items.length > 0 && (
            <button onClick={() => setSelectMode(v => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)]">
              {selectMode ? 'Cancel select' : 'Select'}
            </button>
          )}
          <button onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20]">
            <UploadCloud size={16} /> Upload photos
          </button>
          <input ref={fileInputRef} type="file" accept={ACCEPTED.join(',')} multiple hidden
            onChange={e => e.target.files && processFiles(e.target.files)} />
        </div>
      </div>

      {/* Publish immediately toggle */}
      <label className="inline-flex items-center gap-2 text-sm text-[var(--text-main)] cursor-pointer">
        <input type="checkbox" checked={publishImmediately} onChange={e => setPublishImmediately(e.target.checked)}
          className="w-4 h-4 rounded accent-[#0F3D2E]" />
        Publish immediately
      </label>

      {/* Drop zone (shown when no uploads in progress) */}
      {activeUploads.length === 0 && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={[
            'flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-colors',
            isDragOver
              ? 'border-[#0F3D2E] bg-[#0F3D2E]/5'
              : 'border-[var(--border-subtle)] hover:border-[#0F3D2E]/40 hover:bg-[var(--bg-section-alt)]',
          ].join(' ')}
        >
          <UploadCloud size={32} className="text-[var(--text-muted)]" />
          <p className="text-sm font-medium text-[var(--text-main)]">Drop photos here or click to browse</p>
          <p className="text-xs text-[var(--text-muted)]">JPEG, PNG, WebP, AVIF · max 5 MB per file · resized automatically</p>
        </div>
      )}

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((u, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-[var(--text-main)]">{u.fileName}</p>
                {u.status === 'uploading' && (
                  <div className="mt-1 h-1.5 rounded-full bg-[var(--bg-section-alt)] overflow-hidden">
                    <div className="h-full bg-[#0F3D2E] rounded-full transition-all" style={{ width: `${u.progress}%` }} />
                  </div>
                )}
                {u.status === 'error' && <p className="text-xs text-red-600 mt-0.5">{u.error}</p>}
              </div>
              {u.status === 'done' && <Check size={16} className="text-emerald-600 shrink-0" />}
              {u.status === 'uploading' && <span className="text-xs text-[var(--text-muted)] shrink-0">{u.progress}%</span>}
            </div>
          ))}
          <button onClick={() => setUploads(prev => prev.filter(u => u.status !== 'done'))}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)]">Clear completed</button>
        </div>
      )}

      {/* Bulk actions bar */}
      {selectMode && selected.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
          <span className="text-sm text-[var(--text-main)]">{selected.size} selected</span>
          <button onClick={() => handleBulkState('published')}
            className="ml-auto px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold">Publish all</button>
          <button onClick={() => handleBulkState('draft')}
            className="px-3 py-1.5 rounded-lg bg-stone-500 text-white text-xs font-semibold">Unpublish all</button>
          <button onClick={() => setSelected(new Set())} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)]"><X size={15} /></button>
        </div>
      )}

      {/* Empty state */}
      {(!items || items.length === 0) && uploads.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16">
          <Images size={48} className="text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-muted)]">No gallery items yet.</p>
          <button onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20]">
            <UploadCloud size={16} /> Upload photos
          </button>
        </div>
      )}

      {/* Grid */}
      {items && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map(item => {
            const caption = (item.caption_i18n as Record<string, string> | null)?.en ?? ''
            const thumbSrc = (item as GalleryItem & { thumb_url?: string }).thumb_url ?? item.image_url
            const isSelected = selected.has(item.id)
            return (
              <div key={item.id}
                className={['relative group rounded-xl overflow-hidden border bg-[var(--surface-card)] transition-all',
                  isSelected ? 'border-[#0F3D2E] ring-2 ring-[#0F3D2E]' : 'border-[var(--border-subtle)]'
                ].join(' ')}
                onClick={() => selectMode && toggleSelect(item.id)}
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-[var(--bg-section-alt)] overflow-hidden">
                  {thumbSrc ? (
                    <img src={thumbSrc} alt={caption} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Images size={28} className="text-[var(--text-muted)]" /></div>
                  )}
                </div>

                {/* Select checkbox */}
                {selectMode && (
                  <div className="absolute top-1.5 left-1.5">
                    {isSelected
                      ? <CheckSquare size={18} className="text-[#0F3D2E] drop-shadow" />
                      : <Square size={18} className="text-white drop-shadow" />}
                  </div>
                )}

                {/* Hover overlay controls */}
                {!selectMode && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                    <button onClick={e => { e.stopPropagation(); handleSingleToggle(item) }}
                      className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/40" title={item.state === 'published' ? 'Unpublish' : 'Publish'}>
                      {item.state === 'published' ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button onClick={e => { e.stopPropagation(); setEditItem(item) }}
                      className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/40" title="Edit">
                      <Pencil size={14} />
                    </button>
                    {canDelete && (
                      <button onClick={e => { e.stopPropagation(); setDeleteTarget(item) }}
                        className="p-1.5 rounded-lg bg-red-500/60 text-white hover:bg-red-500/80" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}

                {/* Info bar */}
                <div className="px-2 py-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <ContentStateBadge state={item.state as ContentState} />
                    <span className="text-[10px] text-[var(--text-muted)]">{item.year}</span>
                  </div>
                  {caption && <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">{caption}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add video dialog */}
      {videoOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setVideoOpen(false)}>
          <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-bold text-lg text-[var(--text-main)]">Add video link</h2>
            <div>
              <Label htmlFor="video-url">Video URL (https only)</Label>
              <TextInput id="video-url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." />
              {videoErr && <FormError message={videoErr} />}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setVideoOpen(false)} className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-sm">Cancel</button>
              <button onClick={handleAddVideo} className="px-4 py-2 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit dialog */}
      {editItem && (
        <EditDialog item={editItem} onSave={handleSaveEdit} onClose={() => setEditItem(null)} />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete gallery item?"
        message="This item will be permanently deleted."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

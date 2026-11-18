/**
 * Step1Identity.tsx — Slogan & Identity
 *
 * Fields: edition number, title (3 langs), slogan/theme (3 langs),
 * highlight word (3 langs, must appear inside slogan),
 * supporting text (sub-theme, 3 langs), logo upload (png/webp ≤2 MB),
 * venue (3 langs), summary (1 paragraph, 3 langs).
 */

import React, { useEffect, useRef, useState } from 'react'
import { Loader2, Eye } from 'lucide-react'
import { usePortal } from '../../context/PortalContext'
import { useToast } from '../../components/Toast'
import { I18nTabs, type I18nLang } from '../../components/I18nTabs'
import { Label, TextInput, FormError } from '../../components/StaffForm'
import { formatError } from '../../services/helpers'
import { useUpdateSetupEdition } from '../../hooks/useSetupQueries'
import type { EditionPublic } from '../../../types/database'

interface Props {
  edition: EditionPublic
  onSaved: (updated: EditionPublic) => void
}

// Logo upload helpers (edition-logos bucket)
const LOGO_TYPES  = ['image/png', 'image/webp']
const LOGO_MAX    = 2 * 1024 * 1024
const LOGO_BUCKET = 'edition-logos'

async function uploadEditionLogo(
  client: ReturnType<typeof usePortal>['client'],
  editionId: string,
  file: File
): Promise<string> {
  if (!LOGO_TYPES.includes(file.type)) throw new Error('Only PNG or WebP allowed for the logo.')
  if (file.size > LOGO_MAX) throw new Error('Logo must be 2 MB or smaller.')
  const ext  = file.type === 'image/png' ? 'png' : 'webp'
  const path = `${editionId}/logo.${ext}`

  const { error } = await client.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw new Error(`Logo upload failed: ${error.message}`)

  const { data } = client.storage.from(LOGO_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export function Step1Identity({ edition, onSaved }: Props) {
  const { client } = usePortal()
  const { showToast } = useToast()
  const updateMut = useUpdateSetupEdition(client)
  const loadedRef = useRef(edition.updated_at)

  const [lang, setLang] = useState<I18nLang>('en')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [logoFile,    setLogoFile]    = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>((edition as any).logo_url ?? null)
  const [logoUploading, setLogoUploading] = useState(false)

  // Form fields
  const [number,     setNumber]     = useState(String(edition.number))
  const [titleEn,    setTitleEn]    = useState(edition.title_i18n?.en ?? '')
  const [titleAm,    setTitleAm]    = useState(edition.title_i18n?.am ?? '')
  const [titleOm,    setTitleOm]    = useState(edition.title_i18n?.om ?? '')
  const [themeEn,    setThemeEn]    = useState(edition.theme_i18n?.en ?? '')
  const [themeAm,    setThemeAm]    = useState(edition.theme_i18n?.am ?? '')
  const [themeOm,    setThemeOm]    = useState(edition.theme_i18n?.om ?? '')
  const [hlEn,       setHlEn]       = useState((edition.theme_highlight_i18n as any)?.en ?? '')
  const [hlAm,       setHlAm]       = useState((edition.theme_highlight_i18n as any)?.am ?? '')
  const [hlOm,       setHlOm]       = useState((edition.theme_highlight_i18n as any)?.om ?? '')
  const [subEn,      setSubEn]      = useState(edition.sub_theme_i18n?.en ?? '')
  const [subAm,      setSubAm]      = useState(edition.sub_theme_i18n?.am ?? '')
  const [subOm,      setSubOm]      = useState(edition.sub_theme_i18n?.om ?? '')
  const [venueEn,    setVenueEn]    = useState(edition.venue_i18n?.en ?? '')
  const [venueAm,    setVenueAm]    = useState(edition.venue_i18n?.am ?? '')
  const [venueOm,    setVenueOm]    = useState(edition.venue_i18n?.om ?? '')
  const [summaryEn,  setSummaryEn]  = useState(edition.summary_i18n?.en ?? '')
  const [summaryAm,  setSummaryAm]  = useState(edition.summary_i18n?.am ?? '')
  const [summaryOm,  setSummaryOm]  = useState(edition.summary_i18n?.om ?? '')

  // Sync if edition prop changes
  useEffect(() => {
    loadedRef.current = edition.updated_at
  }, [edition.updated_at])

  const mark = () => setDirty(true)

  // Live gold-word preview
  const highlightPreview = (() => {
    const hl = lang === 'en' ? hlEn : lang === 'am' ? hlAm : hlOm
    const theme = lang === 'en' ? themeEn : lang === 'am' ? themeAm : themeOm
    if (!hl || !theme) return null
    const idx = theme.indexOf(hl)
    if (idx === -1) return <span className="text-amber-600 text-xs">⚠ Highlight word not found in slogan</span>
    return (
      <span className="text-xs text-[var(--text-muted)]">
        {theme.slice(0, idx)}
        <em className="text-[#D9A441] not-italic font-bold">{hl}</em>
        {theme.slice(idx + hl.length)}
      </span>
    )
  })()

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!titleEn.trim())  errs.titleEn  = 'English title is required.'
    if (!themeEn.trim())  errs.themeEn  = 'English slogan is required.'
    if (!venueEn.trim())  errs.venueEn  = 'English venue is required.'
    if (hlEn.trim() && !themeEn.includes(hlEn))
      errs.hlEn = 'Highlight word (EN) must appear inside the English slogan.'
    if (hlAm.trim() && themeAm.trim() && !themeAm.includes(hlAm))
      errs.hlAm = 'Highlight word (AM) must appear inside the Amharic slogan.'
    if (hlOm.trim() && themeOm.trim() && !themeOm.includes(hlOm))
      errs.hlOm = 'Highlight word (OM) must appear inside the Oromo slogan.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleLogoFile = async (file: File) => {
    if (!LOGO_TYPES.includes(file.type)) { showToast({ type: 'error', message: 'Only PNG or WebP allowed.' }); return }
    if (file.size > LOGO_MAX)             { showToast({ type: 'error', message: 'Logo must be 2 MB or smaller.' }); return }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    mark()
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      let logoUrl = (edition as any).logo_url ?? null
      if (logoFile) {
        setLogoUploading(true)
        logoUrl = await uploadEditionLogo(client, edition.id, logoFile)
        setLogoUploading(false)
      }
      const updated = await updateMut.mutateAsync({
        editionId:       edition.id,
        loadedUpdatedAt: loadedRef.current,
        patch: {
          number:                parseInt(number, 10) || edition.number,
          title_i18n:            { en: titleEn, am: titleAm || undefined, om: titleOm || undefined },
          edition_name_i18n:     { en: titleEn, am: titleAm || undefined, om: titleOm || undefined },
          theme_i18n:            { en: themeEn, am: themeAm || undefined, om: themeOm || undefined },
          theme_highlight_i18n:  hlEn ? { en: hlEn, am: hlAm || undefined, om: hlOm || undefined } : null,
          sub_theme_i18n:        subEn ? { en: subEn, am: subAm || undefined, om: subOm || undefined } : null,
          venue_i18n:            { en: venueEn, am: venueAm || undefined, om: venueOm || undefined },
          summary_i18n:          summaryEn ? { en: summaryEn, am: summaryAm || undefined, om: summaryOm || undefined } : null,
          logo_url:              logoUrl,
        } as any,
      })
      loadedRef.current = updated.updated_at
      setDirty(false)
      setLogoFile(null)
      onSaved(updated)
      showToast({ type: 'success', message: 'Identity saved.' })
    } catch (err) {
      showToast({ type: 'error', message: formatError(err) })
    } finally {
      setSaving(false)
      setLogoUploading(false)
    }
  }

  const fieldRow = (label: string, required: boolean, enVal: string, setEn: (v: string) => void,
    amVal: string, setAm: (v: string) => void, omVal: string, setOm: (v: string) => void,
    errKey: string, multiline = false
  ) => {
    const val = lang === 'en' ? enVal : lang === 'am' ? amVal : omVal
    const setVal = lang === 'en' ? setEn : lang === 'am' ? setAm : setOm
    const cls = 'w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A441] border-[var(--border-subtle)]'
    return (
      <div className="space-y-1.5">
        <Label htmlFor={errKey} required={required && lang === 'en'}>{label}</Label>
        {multiline
          ? <textarea id={errKey} value={val} onChange={e => { setVal(e.target.value); mark() }} rows={3} className={cls} />
          : <input    id={errKey} type="text" value={val} onChange={e => { setVal(e.target.value); mark() }} className={cls} />
        }
        {errors[errKey] && lang === 'en' && <FormError message={errors[errKey]!} />}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <I18nTabs value={lang} onChange={setLang} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Edition number */}
        <div className="space-y-1.5">
          <Label htmlFor="number" required>Edition number</Label>
          <TextInput id="number" type="number" min="1" value={number}
            onChange={e => { setNumber(e.target.value); mark() }} />
        </div>
      </div>

      {fieldRow('Title', true, titleEn, setTitleEn, titleAm, setTitleAm, titleOm, setTitleOm, 'titleEn')}
      {fieldRow('Slogan (theme)', true, themeEn, setThemeEn, themeAm, setThemeAm, themeOm, setThemeOm, 'themeEn')}

      {/* Gold highlight word */}
      <div className="space-y-1.5">
        <Label htmlFor={`hl${lang}`}>
          Gold highlight word
          <span className="ml-2 text-[10px] text-[var(--text-muted)] font-normal">Must appear inside the slogan</span>
        </Label>
        <TextInput
          id={`hl${lang}`}
          value={lang === 'en' ? hlEn : lang === 'am' ? hlAm : hlOm}
          onChange={e => { const v = e.target.value; if (lang === 'en') setHlEn(v); else if (lang === 'am') setHlAm(v); else setHlOm(v); mark() }}
        />
        {errors[`hl${lang}`] && <FormError message={errors[`hl${lang}`]!} />}
        {highlightPreview && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-section-alt)] text-xs">
            <Eye size={12} className="text-[var(--text-muted)] shrink-0" />
            {highlightPreview}
          </div>
        )}
      </div>

      {fieldRow('Supporting text (sub-theme)', false, subEn, setSubEn, subAm, setSubAm, subOm, setSubOm, 'subEn', true)}
      {fieldRow('Venue', true, venueEn, setVenueEn, venueAm, setVenueAm, venueOm, setVenueOm, 'venueEn')}
      {fieldRow('One-paragraph summary (for Past Editions Timeline)', false, summaryEn, setSummaryEn, summaryAm, setSummaryAm, summaryOm, setSummaryOm, 'summaryEn', true)}

      {/* Logo upload */}
      <div className="space-y-2">
        <Label htmlFor="logo">Edition logo (PNG or WebP, max 2 MB)</Label>
        <p className="text-[11px] text-[var(--text-muted)]">A transparent background works best — the logo will appear on both light and dark backgrounds.</p>
        {logoPreview && (
          <div className="relative inline-block rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-stone-100 dark:bg-stone-800 p-3">
            <img src={logoPreview} alt="Logo preview" className="h-20 w-auto object-contain block" />
            <button type="button"
              onClick={() => { setLogoPreview(null); setLogoFile(null); mark() }}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs hover:bg-black/80 transition-colors">
              ×
            </button>
          </div>
        )}
        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] cursor-pointer transition-colors">
          {logoUploading ? <Loader2 size={15} className="animate-spin" /> : '📁'}
          {logoPreview ? 'Replace logo' : 'Upload logo'}
          <input type="file" accept="image/png,image/webp" className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f) }} />
        </label>
      </div>

      {/* Save */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A1E] disabled:opacity-40 transition-colors">
          {saving && <Loader2 size={14} className="animate-spin" />}
          Save &amp; continue
        </button>
      </div>
    </div>
  )
}

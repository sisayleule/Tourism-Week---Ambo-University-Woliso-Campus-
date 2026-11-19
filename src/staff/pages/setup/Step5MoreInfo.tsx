/**
 * Step5MoreInfo.tsx — More information
 *
 * Fields:
 *  - About this edition (Markdown, 3 langs, sanitised preview)
 *  - Expected participants (optional)
 *  - Exhibitors count (optional)
 *  - Hero poster URL (blank → NULL → default hero poster plays)
 *  - Hero video URL  (blank → NULL → default video plays)
 *  - Cover image URL (for Past Editions Timeline)
 */

import React, { useRef, useState } from 'react'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { usePortal } from '../../context/PortalContext'
import { useToast } from '../../components/Toast'
import { I18nTabs, type I18nLang } from '../../components/I18nTabs'
import { Label, TextInput } from '../../components/StaffForm'
import { formatError } from '../../services/helpers'
import { useUpdateSetupEdition } from '../../hooks/useSetupQueries'
import type { EditionPublic } from '../../../types/database'

interface Props {
  edition: EditionPublic
  onSaved: (updated: EditionPublic) => void
}

/** Minimal Markdown → plain-text preview (no DOMParser needed). */
function markdownPreview(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
}

export function Step5MoreInfo({ edition, onSaved }: Props) {
  const { client } = usePortal()
  const { showToast } = useToast()
  const updateMut = useUpdateSetupEdition(client)
  const loadedRef = useRef(edition.updated_at)

  const [lang,       setLang]       = useState<I18nLang>('en')
  const [aboutEn,    setAboutEn]    = useState((edition as any).about_i18n?.en ?? '')
  const [aboutAm,    setAboutAm]    = useState((edition as any).about_i18n?.am ?? '')
  const [aboutOm,    setAboutOm]    = useState((edition as any).about_i18n?.om ?? '')
  const [previewMd,  setPreviewMd]  = useState(false)
  const [participants, setParticipants] = useState(edition.stats?.expectedParticipants ?? '')
  const [exhibitors,   setExhibitors]   = useState(edition.stats?.exhibitorsCount ?? '')
  const [heroPoster,   setHeroPoster]   = useState(edition.hero_poster_url ?? '')
  const [heroVideo,    setHeroVideo]    = useState(edition.hero_video_url ?? '')
  const [coverImage,   setCoverImage]   = useState(edition.cover_image_url ?? '')
  const [dirty,        setDirty]        = useState(false)
  const [saving,       setSaving]       = useState(false)

  const mark = () => setDirty(true)

  const aboutVal = lang === 'en' ? aboutEn : lang === 'am' ? aboutAm : aboutOm
  const setAbout = (v: string) => {
    if (lang === 'en') setAboutEn(v); else if (lang === 'am') setAboutAm(v); else setAboutOm(v)
    mark()
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateMut.mutateAsync({
        editionId:       edition.id,
        loadedUpdatedAt: loadedRef.current,
        patch: {
          about_i18n:    aboutEn ? { en: aboutEn, am: aboutAm || undefined, om: aboutOm || undefined } : null,
          hero_poster_url: heroPoster.trim() || null,
          hero_video_url:  heroVideo.trim()  || null,
          cover_image_url: coverImage.trim() || null,
          stats: {
            ...(edition.stats ?? {}),
            expectedParticipants: participants.trim() || null,
            exhibitorsCount:      exhibitors.trim()   || null,
          },
        } as any,
      })
      loadedRef.current = updated.updated_at
      setDirty(false)
      onSaved(updated)
      showToast({ type: 'success', message: 'More info saved.' })
    } catch (err) {
      showToast({ type: 'error', message: formatError(err) })
    } finally {
      setSaving(false)
    }
  }

  const cls = 'w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A441]'

  return (
    <div className="space-y-6">
      {/* About text */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="about">About this edition (Markdown)</Label>
          <button
            type="button"
            onClick={() => setPreviewMd(v => !v)}
            className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          >
            {previewMd ? <EyeOff size={12} /> : <Eye size={12} />}
            {previewMd ? 'Edit' : 'Preview'}
          </button>
        </div>

        <I18nTabs value={lang} onChange={setLang} />

        {previewMd ? (
          <div className="min-h-[120px] px-4 py-3 rounded-xl bg-[var(--bg-section-alt)] border border-[var(--border-subtle)] text-sm text-[var(--text-main)] whitespace-pre-wrap leading-relaxed">
            {markdownPreview(aboutVal) || <span className="text-[var(--text-muted)] italic">Nothing to preview yet.</span>}
          </div>
        ) : (
          <textarea
            id="about" rows={8} className={cls}
            value={aboutVal}
            placeholder="Write about this edition in Markdown…"
            onChange={e => setAbout(e.target.value)}
          />
        )}
        <p className="text-[11px] text-[var(--text-muted)]">Markdown is rendered on the public About page. No raw HTML is shown.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="participants">Expected participants (optional)</Label>
          <TextInput id="participants" value={participants}
            onChange={e => { setParticipants(e.target.value); mark() }}
            placeholder="e.g. 2,000+" />
          <p className="text-[11px] text-[var(--text-muted)]">Shown on website only when filled.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exhibitors">Exhibitors count (optional)</Label>
          <TextInput id="exhibitors" value={exhibitors}
            onChange={e => { setExhibitors(e.target.value); mark() }}
            placeholder="e.g. 30+" />
        </div>
      </div>

      {/* Hero media */}
      <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
        <p className="text-sm font-semibold text-[var(--text-main)]">Hero media overrides</p>
        <p className="text-[11px] text-[var(--text-muted)]">Leave blank to keep the default hero video and poster image.</p>

        <div className="space-y-1.5">
          <Label htmlFor="heroPoster">Hero poster image URL</Label>
          <TextInput id="heroPoster" type="url" value={heroPoster}
            onChange={e => { setHeroPoster(e.target.value); mark() }}
            placeholder="https://… or leave blank for default" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="heroVideo">Hero background video URL</Label>
          <TextInput id="heroVideo" type="url" value={heroVideo}
            onChange={e => { setHeroVideo(e.target.value); mark() }}
            placeholder="https://… or leave blank for default" />
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
            Use a short loop (10 to 12 seconds), 720p or smaller, under 5 MB, no sound.
            Large videos stutter on phones.{' '}
            <strong className="text-amber-600 dark:text-amber-400">Do not host videos in Supabase Storage</strong>{' '}
            — use a CDN or leave blank to use the default.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="coverImage">Cover image URL (Past Editions Timeline)</Label>
          <TextInput id="coverImage" type="url" value={coverImage}
            onChange={e => { setCoverImage(e.target.value); mark() }}
            placeholder="https://… or leave blank" />
        </div>
      </div>

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

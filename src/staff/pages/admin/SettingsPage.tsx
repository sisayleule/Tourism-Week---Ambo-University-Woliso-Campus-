/**
 * SettingsPage.tsx — /admin/settings
 *
 * Edits the single site_settings row: contact email, phone, address (3 langs),
 * social links (Facebook, Telegram, WhatsApp, YouTube, Instagram, TikTok),
 * footer text (3 langs). Zod validation, unsaved-changes warning, concurrency
 * check, scheduleDeploy() after save.
 */

import React, { useEffect, useState } from 'react'
import { SlidersHorizontal, Save, AlertTriangle } from 'lucide-react'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { usePortal } from '../../context/PortalContext'
import { useToast } from '../../components/Toast'
import { FullPageSpinner } from '../../components/Loading'
import { useSiteSettings, useUpdateSiteSettings } from '../../hooks/useAdminQueries'
import type { I18nJson } from '../../../types/database'

// ─── Zod schema ───────────────────────────────────────────────────────────────

const httpsUrl = z.string().url().refine(v => v.startsWith('https://'), 'Must start with https://').or(z.literal(''))

const schema = z.object({
  contact_email: z.string().email('Enter a valid email address').max(320).or(z.literal('')),
  phone:         z.string().max(30).regex(/^[+]?[\d\s()-]*$/, 'Invalid phone format').or(z.literal('')),
  address_en: z.string().max(1000).or(z.literal('')),
  address_am: z.string().max(1000).or(z.literal('')),
  address_om: z.string().max(1000).or(z.literal('')),
  facebook:  httpsUrl,
  telegram:  httpsUrl,
  whatsapp:  httpsUrl,
  youtube:   httpsUrl,
  instagram: httpsUrl,
  tiktok:    httpsUrl,
  footer_en: z.string().max(500).or(z.literal('')),
  footer_am: z.string().max(500).or(z.literal('')),
  footer_om: z.string().max(500).or(z.literal('')),
})

type FormData = z.infer<typeof schema>

// ─── Component ────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { t } = useTranslation()
  const { client } = usePortal()
  const { showToast } = useToast()
  const { data: settings, isLoading, error } = useSiteSettings(client)
  const updateMut = useUpdateSiteSettings(client)

  const [form, setForm]               = useState<FormData | null>(null)
  const [loadedUpdatedAt, setLoaded]  = useState('')
  const [dirty, setDirty]             = useState(false)
  const [errors, setErrors]           = useState<Record<string, string>>({})

  useEffect(() => {
    if (!settings) return
    setForm({
      contact_email: settings.contact_email ?? '',
      phone:         settings.phone ?? '',
      address_en: settings.address_i18n?.en ?? '',
      address_am: settings.address_i18n?.am ?? '',
      address_om: settings.address_i18n?.om ?? '',
      facebook:  settings.social?.facebook  ?? '',
      telegram:  settings.social?.telegram  ?? '',
      whatsapp:  settings.social?.whatsapp  ?? '',
      youtube:   settings.social?.youtube   ?? '',
      instagram: settings.social?.instagram ?? '',
      tiktok:    settings.social?.tiktok    ?? '',
      footer_en: settings.footer_text_i18n?.en ?? '',
      footer_am: settings.footer_text_i18n?.am ?? '',
      footer_om: settings.footer_text_i18n?.om ?? '',
    })
    setLoaded(settings.updated_at)
    setDirty(false)
  }, [settings])

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  if (isLoading) return <FullPageSpinner label={t('staff.common.loading')} />
  if (error || !form) {
    return (
      <div className="max-w-3xl space-y-4">
        <Header />
        <ErrBanner msg={error?.message ?? 'Failed to load settings.'} />
      </div>
    )
  }

  const set = (key: keyof FormData, value: string) => {
    setForm(prev => prev ? { ...prev, [key]: value } : prev)
    setDirty(true)
    setErrors(prev => { const c = { ...prev }; delete c[key]; return c })
  }

  const validate = (): boolean => {
    const result = schema.safeParse(form)
    if (result.success) { setErrors({}); return true }
    const errs: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string
      if (!errs[key]) {
        if (['facebook','telegram','whatsapp','youtube','instagram','tiktok'].includes(key))
          errs[key] = t('staff.admin.settings.errUrl', { field: key })
        else if (key === 'contact_email')
          errs[key] = t('staff.admin.settings.errEmail')
        else
          errs[key] = issue.message
      }
    }
    setErrors(errs)
    return false
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) { showToast({ type: 'error', message: 'Please fix the errors before saving.' }); return }
    try {
      await updateMut.mutateAsync({
        loadedUpdatedAt,
        input: {
          contact_email: form.contact_email,
          phone: form.phone || null,
          address_i18n: { en: form.address_en, am: form.address_am || undefined, om: form.address_om || undefined } as I18nJson,
          social: {
            ...(form.facebook  && { facebook:  form.facebook }),
            ...(form.telegram  && { telegram:  form.telegram }),
            ...(form.whatsapp  && { whatsapp:  form.whatsapp }),
            ...(form.youtube   && { youtube:   form.youtube }),
            ...(form.instagram && { instagram: form.instagram }),
            ...(form.tiktok    && { tiktok:    form.tiktok }),
          },
          footer_text_i18n: { en: form.footer_en, am: form.footer_am || undefined, om: form.footer_om || undefined } as I18nJson,
        },
      })
      setDirty(false)
      showToast({ type: 'success', message: t('staff.admin.settings.savedMsg') })
    } catch (err) {
      showToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save' })
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Header />

      {dirty && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle size={14} /> {t('staff.admin.settings.unsavedWarn')}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Contact */}
        <Card legend="Contact">
          <FormField label={t('staff.admin.settings.contactEmail')} id="email" error={errors.contact_email}>
            <input id="email" type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} className={ic(errors.contact_email)} placeholder="department@example.edu" />
          </FormField>
          <FormField label={t('staff.admin.settings.phone')} id="phone" hint={t('staff.admin.settings.phoneHint')} error={errors.phone}>
            <input id="phone" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} className={ic(errors.phone)} placeholder="+251 11 234 5678" />
          </FormField>
        </Card>

        {/* Address */}
        <Card legend="Address">
          <FormField label={t('staff.admin.settings.addressEn')} id="addr-en">
            <textarea id="addr-en" rows={2} value={form.address_en} onChange={e => set('address_en', e.target.value)} className={tc} />
          </FormField>
          <FormField label={t('staff.admin.settings.addressAm')} id="addr-am">
            <textarea id="addr-am" rows={2} value={form.address_am} onChange={e => set('address_am', e.target.value)} className={tc} />
          </FormField>
          <FormField label={t('staff.admin.settings.addressOm')} id="addr-om">
            <textarea id="addr-om" rows={2} value={form.address_om} onChange={e => set('address_om', e.target.value)} className={tc} />
          </FormField>
        </Card>

        {/* Social links */}
        <Card legend={t('staff.admin.settings.socialLinks')}>
          <p className="text-xs text-[var(--text-muted)]">{t('staff.admin.settings.socialHint')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['facebook','telegram','whatsapp','youtube','instagram','tiktok'] as const).map(key => (
              <FormField key={key} label={t(`staff.admin.settings.${key}`)} id={`social-${key}`} error={errors[key]}>
                <input id={`social-${key}`} type="url" value={form[key]} onChange={e => set(key, e.target.value)} className={ic(errors[key])} placeholder="https://" />
              </FormField>
            ))}
          </div>
        </Card>

        {/* Footer */}
        <Card legend="Footer text">
          <FormField label={t('staff.admin.settings.footerEn')} id="foot-en">
            <textarea id="foot-en" rows={2} value={form.footer_en} onChange={e => set('footer_en', e.target.value)} className={tc} />
          </FormField>
          <FormField label={t('staff.admin.settings.footerAm')} id="foot-am">
            <textarea id="foot-am" rows={2} value={form.footer_am} onChange={e => set('footer_am', e.target.value)} className={tc} />
          </FormField>
          <FormField label={t('staff.admin.settings.footerOm')} id="foot-om">
            <textarea id="foot-om" rows={2} value={form.footer_om} onChange={e => set('footer_om', e.target.value)} className={tc} />
          </FormField>
        </Card>

        <div className="flex justify-end">
          <button type="submit" disabled={updateMut.isPending || !dirty}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-sm font-semibold hover:bg-[#0A2A20] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2">
            <Save size={16} />
            {updateMut.isPending ? t('staff.admin.settings.saving') : t('staff.admin.settings.save')}
          </button>
        </div>
      </form>
    </div>
  )
}

function Header() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0F3D2E] text-[#D9A441]"><SlidersHorizontal size={20} /></div>
      <h1 className="font-display text-xl font-bold text-[var(--text-main)]">{t('staff.admin.settings.title')}</h1>
    </div>
  )
}

function Card({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
      <legend className="text-sm font-semibold text-[var(--text-main)] px-1">{legend}</legend>
      {children}
    </fieldset>
  )
}

function FormField({ label, id, hint, error, children }: { label: string; id: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-[var(--text-main)]">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}
    </div>
  )
}

function ErrBanner({ msg }: { msg: string }) {
  return <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">{msg}</div>
}

function ic(err?: string) {
  return `w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[#D9A441] focus:border-transparent transition ${err ? 'border-red-400 dark:border-red-700' : 'border-[var(--border-subtle)]'}`
}
const tc = 'w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[#D9A441] focus:border-transparent transition resize-y'

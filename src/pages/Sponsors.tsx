import React, { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, Award, CheckCircle2, Handshake, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useSection, useSponsors, useSiteSettings, useSubmitSponsorInquiry } from '../hooks/useTourismQueries';
import { getSectionEntry } from '../lib/sectionRegistry';
import { Language, SponsorTier } from '../types';

const sponsorFormSchema = z.object({
  name: z.string().min(2, 'Please enter your contact name'),
  organization: z.string().min(2, 'Please enter your organization or business name'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(6, 'Please enter a valid phone number'),
  tierInterest: z.enum(['platinum', 'gold', 'silver', 'partner', 'custom']),
  message: z.string().min(10, 'Please share a brief message or proposal (at least 10 characters)'),
  website: z.string().optional(), // honeypot — must be empty
});

type SponsorFormValues = z.infer<typeof sponsorFormSchema>;

export const Sponsors: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language as Language) || 'en';
  const { data: sponsors } = useSponsors();
  const { data: siteSettings } = useSiteSettings();
  const { data: introSection } = useSection('sponsors.intro');
  const { mutateAsync: submitSponsor, isPending } = useSubmitSponsorInquiry();

  const reg = getSectionEntry('sponsors.intro');
  const badge   = introSection?.titleI18n?.[currentLang] ?? introSection?.titleI18n?.en
    ?? reg?.defaultContent?.title?.[currentLang] ?? reg?.defaultContent?.title?.en
    ?? 'Institutional Alliances';
  const pageTitle = introSection?.subtitleI18n?.[currentLang] ?? introSection?.subtitleI18n?.en
    ?? reg?.defaultContent?.subtitle?.[currentLang] ?? reg?.defaultContent?.subtitle?.en
    ?? t('sponsors.becomeSponsorTitle');
  const [submittedData, setSubmittedData] = useState<{ id: string; name: string } | null>(null);
  const [submitError, setSubmitError] = useState(false);
  const formRenderedAt = useRef(Date.now());

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SponsorFormValues>({
    defaultValues: {
      name: '',
      organization: '',
      email: '',
      phone: '',
      tierInterest: 'gold',
      message: '',
      website: '', // honeypot
    },
  });

  const onSubmit = async (values: SponsorFormValues) => {
    setSubmitError(false);
    // Honeypot: if the hidden field is filled, it's a bot
    if (values.website) {
      setSubmitError(true);
      return;
    }
    // Under-3-seconds: reject submissions faster than 3 seconds
    if (formRenderedAt.current && Date.now() - formRenderedAt.current < 3000) {
      setSubmitError(true);
      return;
    }
    try {
      const res = await submitSponsor({
        ...values,
        formRenderedAt: formRenderedAt.current,
      });
      setSubmittedData({ id: res.proposalId, name: values.organization });
      reset();
    } catch (err) {
      console.error(err);
      setSubmitError(true);
    }
  };

  const platinum = sponsors?.filter((s) => (s.tier as string) === 'title' || (s.tier as string) === 'platinum') || [];
  const gold     = sponsors?.filter((s) => s.tier === 'gold') || [];
  const silver   = sponsors?.filter((s) => s.tier === 'silver') || [];
  const partner  = sponsors?.filter((s) => s.tier === 'partner') || [];

  // Hide the entire sponsors section when there are none published
  const hasAny = platinum.length + gold.length + silver.length + partner.length > 0;

  // The live layer may supply logo_url / website_url from the DB row.
  // The snapshot type uses logoPlaceholder / sectorI18n.
  // Use a union-compatible helper to read either.
  type DbSponsor = typeof sponsors extends (infer S)[] | undefined ? S & { logo_url?: string | null; website_url?: string | null } : never;
  const logoUrl = (s: DbSponsor) => (s as { logo_url?: string | null }).logo_url ?? null;
  const siteUrl = (s: DbSponsor) => (s as { website_url?: string | null }).website_url ?? (s as unknown as { website?: string }).website ?? null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-16">
      {/* Header */}
      <div className="border-b border-stone-200 dark:border-stone-800 pb-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#0F3D2E] dark:text-[#D9A441] mb-2 uppercase tracking-wider">
          <Award className="h-4 w-4" />
          <span>{badge}</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-stone-100">
          {t('sponsors.title')}
        </h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 max-w-2xl">
          {t('sponsors.subtitle')}
        </p>
      </div>

      {/* Tier Sections — hidden when no published sponsors */}
      {hasAny && (
      <div className="space-y-12">
        {/* Title / Platinum — hidden when empty */}
        {platinum.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
              {t('sponsors.platinum')}
            </h2>
            <div className="flex-1 h-px bg-stone-200 dark:border-stone-800" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {platinum.map((sp) => {
              const logo = logoUrl(sp as DbSponsor); const site = siteUrl(sp as DbSponsor);
              return (
              <div
                key={sp.id}
                className="p-6 rounded-2xl bg-white dark:bg-[#12221C] border-2 border-[#D9A441]/50 dark:border-[#D9A441]/30 flex flex-col justify-between"
              >
                <div className="flex items-center gap-4">
                  {logo && (
                    <img src={logo} alt={sp.name} className="h-14 w-14 object-contain rounded-xl border border-stone-100 dark:border-stone-800 bg-white p-1 shrink-0" />
                  )}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#D9A441] block mb-0.5">Title Partner</span>
                    <h3 className="font-display font-bold text-lg text-stone-900 dark:text-stone-100">{sp.name}</h3>
                  </div>
                </div>
                {site && (
                  <a href={site} target="_blank" rel="noreferrer"
                    className="mt-3 text-xs text-[#0F3D2E] dark:text-[#D9A441] hover:underline truncate">
                    {site}
                  </a>
                )}
              </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Gold */}
        {gold.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">{t('sponsors.gold')}</h2>
            <div className="flex-1 h-px bg-stone-200 dark:border-stone-800" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gold.map((sp) => {
              const logo = logoUrl(sp as DbSponsor); const site = siteUrl(sp as DbSponsor);
              return (
              <div key={sp.id} className="p-5 rounded-2xl bg-white dark:bg-[#12221C] border border-stone-200 dark:border-stone-800 flex items-center gap-4">
                {logo && (
                  <img src={logo} alt={sp.name} className="h-12 w-12 object-contain rounded-xl border border-stone-100 dark:border-stone-800 bg-white p-1 shrink-0" />
                )}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-0.5">Gold Sponsor</span>
                  <h3 className="font-display font-bold text-base text-stone-900 dark:text-stone-100">{sp.name}</h3>
                  {site && <a href={site} target="_blank" rel="noreferrer" className="text-xs text-[var(--text-muted)] hover:underline truncate block">{site}</a>}
                </div>
              </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Silver & Partner */}
        {(silver.length > 0 || partner.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
              {t('sponsors.silver')} &amp; {t('sponsors.community')}
            </h2>
            <div className="flex-1 h-px bg-stone-200 dark:border-stone-800" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[...silver, ...partner].map((sp) => {
              const logo = logoUrl(sp as DbSponsor); const site = siteUrl(sp as DbSponsor);
              return (
              <div key={sp.id} className="p-4 rounded-xl bg-white dark:bg-[#12221C] border border-stone-200 dark:border-stone-800 text-center flex flex-col items-center gap-2">
                {logo && (
                  <img src={logo} alt={sp.name} className="h-10 w-10 object-contain" />
                )}
                <h3 className="font-display font-semibold text-xs text-stone-900 dark:text-stone-100">{sp.name}</h3>
                {site && <a href={site} target="_blank" rel="noreferrer" className="text-[11px] text-[var(--text-muted)] hover:underline truncate block w-full">{site}</a>}
              </div>
              );
            })}
          </div>
        </div>
        )}
      </div>
      )}

      {/* Become a Sponsor Form */}
      <div className="rounded-3xl bg-[#F4EFE6] dark:bg-[#101F1A] border border-stone-200 dark:border-stone-800 p-6 sm:p-10">
        <div className="max-w-2xl space-y-2 mb-8">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D2E] dark:text-[#D9A441]">
            Partnership Opportunities
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            {t('sponsors.becomeSponsorTitle')}
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">
            {t('sponsors.becomeSponsorDesc')}
          </p>
        </div>

        {submittedData ? (
          <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
            <h3 className="font-display font-bold text-lg text-emerald-900 dark:text-emerald-100">
              Inquiry Registered Successfully
            </h3>
            <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 max-w-md mx-auto">
              {t('sponsors.submitSuccess')} (Reference ID: {submittedData.id})
            </p>
            <button
              type="button"
              onClick={() => setSubmittedData(null)}
              className="mt-2 text-xs font-semibold underline text-emerald-800 dark:text-emerald-300"
            >
              Submit another partnership proposal
            </button>
          </div>
        ) : submitError ? (
          <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-red-600 mx-auto" />
            <h3 className="font-display font-bold text-lg text-red-900 dark:text-red-100">
              We could not send your message. Please try again later
            </h3>
            <p className="text-xs sm:text-sm text-red-800 dark:text-red-200 max-w-md mx-auto">
              {siteSettings?.contactEmail && (
                <a
                  href={`mailto:${siteSettings.contactEmail}`}
                  className="underline font-semibold"
                >
                  Or email us directly
                </a>
              )}
            </p>
            <button
              type="button"
              onClick={() => { setSubmitError(false); formRenderedAt.current = Date.now(); }}
              className="mt-2 text-xs font-semibold underline text-red-800 dark:text-red-300"
            >
              Try again
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  {t('sponsors.formName')} *
                </label>
                <input
                  type="text"
                  {...register('name')}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0F3D2E]"
                />
                {errors.name && (
                  <span className="text-[11px] text-red-600 mt-1 block">
                    {errors.name.message}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  {t('sponsors.formOrg')} *
                </label>
                <input
                  type="text"
                  {...register('organization')}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0F3D2E]"
                />
                {errors.organization && (
                  <span className="text-[11px] text-red-600 mt-1 block">
                    {errors.organization.message}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  {t('sponsors.formEmail')} *
                </label>
                <input
                  type="email"
                  {...register('email')}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0F3D2E]"
                />
                {errors.email && (
                  <span className="text-[11px] text-red-600 mt-1 block">
                    {errors.email.message}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  {t('sponsors.formPhone')} *
                </label>
                <input
                  type="tel"
                  {...register('phone')}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0F3D2E]"
                />
                {errors.phone && (
                  <span className="text-[11px] text-red-600 mt-1 block">
                    {errors.phone.message}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                {t('sponsors.formTier')}
              </label>
              <select
                {...register('tierInterest')}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0F3D2E]"
              >
                <option value="platinum">Platinum Partnership</option>
                <option value="gold">Gold Sponsorship</option>
                <option value="silver">Silver Support</option>
                <option value="partner">Community / Artisan Ally</option>
                <option value="custom">Custom In-Kind or Award Support</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                {t('sponsors.formMessage')} *
              </label>
              <textarea
                rows={4}
                {...register('message')}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0F3D2E]"
                placeholder="Describe your organization, proposed support (financial, awards, supplies, or promotion), and objectives."
              />
              {errors.message && (
                <span className="text-[11px] text-red-600 mt-1 block">
                  {errors.message.message}
                </span>
              )}
            </div>

            {/* Honeypot — visually hidden, bots fill it */}
            <input
              type="text"
              {...register('website')}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              title="Leave this field empty"
              className="absolute opacity-0 pointer-events-none"
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }}
            />

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0F3D2E] text-white font-semibold text-xs sm:text-sm hover:bg-[#0A2A20] transition-colors disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              <span>{isPending ? 'Submitting proposal...' : t('sponsors.submitButton')}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

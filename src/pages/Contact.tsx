import React, { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  Mail,
  MapPin,
  Phone,
  Send,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useFAQs, useSection, useSiteSettings, useSubmitContact } from '../hooks/useTourismQueries';
import { getSectionEntry } from '../lib/sectionRegistry';
import { Language } from '../types';

const contactFormSchema = z.object({
  name: z.string().min(2, 'Please enter your name'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  subject: z.string().min(3, 'Please enter a subject'),
  message: z.string().min(10, 'Please write your message (at least 10 characters)'),
  website: z.string().optional(), // honeypot — must be empty
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export const Contact: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language as Language) || 'en';
  const { data: faqs } = useFAQs();
  const { data: siteSettings } = useSiteSettings();
  const { data: introSection } = useSection('contact.intro');
  const { mutateAsync: submitContact, isPending } = useSubmitContact();

  const reg = getSectionEntry('contact.intro');
  const badge   = introSection?.titleI18n?.[currentLang] ?? introSection?.titleI18n?.en
    ?? reg?.defaultContent?.title?.[currentLang] ?? reg?.defaultContent?.title?.en
    ?? 'Secretariat & Inquiries';
  const subLabel = introSection?.subtitleI18n?.[currentLang] ?? introSection?.subtitleI18n?.en
    ?? reg?.defaultContent?.subtitle?.[currentLang] ?? reg?.defaultContent?.subtitle?.en
    ?? 'Department Office & Secretariat';
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState(false);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const formRenderedAt = useRef(Date.now());

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormValues>({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: '',
      website: '', // honeypot
    },
  });

  const onSubmit = async (values: ContactFormValues) => {
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
      const res = await submitContact({
        ...values,
        formRenderedAt: formRenderedAt.current,
      });
      setSubmittedId(res.inquiryId);
      reset();
    } catch (err) {
      console.error(err);
      setSubmitError(true);
    }
  };

  const toggleFaq = (id: string) => {
    setOpenFaq((prev) => (prev === id ? null : id));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-16">
      {/* Header */}
      <div className="border-b border-stone-200 dark:border-stone-800 pb-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#0F3D2E] dark:text-[#D9A441] mb-2 uppercase tracking-wider">
          <Phone className="h-4 w-4" />
          <span>{badge}</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-stone-100">
          {t('contact.title')}
        </h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 max-w-2xl">
          {t('contact.subtitle')}
        </p>
      </div>

      {/* Contact Grid: Form & Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Contact Form */}
        <div className="rounded-3xl bg-white dark:bg-[#12221C] border border-stone-200 dark:border-stone-800 p-6 sm:p-8 shadow-xs">
          <h2 className="font-display font-bold text-xl text-stone-900 dark:text-stone-100 mb-6">
            {t('contact.formTitle')}
          </h2>

          {submittedId ? (
            <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
              <h3 className="font-display font-bold text-lg text-emerald-900 dark:text-emerald-100">
                Message Dispatched
              </h3>
              <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 max-w-md mx-auto">
                {t('contact.contactSuccess')} (Ref: {submittedId})
              </p>
              <button
                type="button"
                onClick={() => setSubmittedId(null)}
                className="mt-2 text-xs font-semibold underline text-emerald-800 dark:text-emerald-300"
              >
                Send another message
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
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

              {/* Name */}
              <div>
                <label htmlFor="cf-name" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  {t('contact.formName')} <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  id="cf-name"
                  type="text"
                  autoComplete="name"
                  {...register('name')}
                  className="w-full px-4 py-3 rounded-xl bg-[#FAF7F0] dark:bg-stone-900 border border-stone-300 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0F3D2E] dark:focus:ring-[#D9A441]"
                  style={{ fontSize: '16px' }}
                />
                {errors.name && (
                  <span role="alert" className="text-xs text-red-600 mt-1.5 block">{errors.name.message}</span>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="cf-email" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  {t('contact.formEmail')} <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  id="cf-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  {...register('email')}
                  className="w-full px-4 py-3 rounded-xl bg-[#FAF7F0] dark:bg-stone-900 border border-stone-300 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0F3D2E] dark:focus:ring-[#D9A441]"
                  style={{ fontSize: '16px' }}
                />
                {errors.email && (
                  <span role="alert" className="text-xs text-red-600 mt-1.5 block">{errors.email.message}</span>
                )}
              </div>

              {/* Phone — full-width single column */}
              <div>
                <label htmlFor="cf-phone" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  Phone <span className="text-stone-400 font-normal text-xs">(Optional)</span>
                </label>
                <input
                  id="cf-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  {...register('phone')}
                  className="w-full px-4 py-3 rounded-xl bg-[#FAF7F0] dark:bg-stone-900 border border-stone-300 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0F3D2E] dark:focus:ring-[#D9A441]"
                  style={{ fontSize: '16px' }}
                />
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="cf-subject" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  {t('contact.formSubject')} <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  id="cf-subject"
                  type="text"
                  autoComplete="off"
                  {...register('subject')}
                  className="w-full px-4 py-3 rounded-xl bg-[#FAF7F0] dark:bg-stone-900 border border-stone-300 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0F3D2E] dark:focus:ring-[#D9A441]"
                  style={{ fontSize: '16px' }}
                />
                {errors.subject && (
                  <span role="alert" className="text-xs text-red-600 mt-1.5 block">{errors.subject.message}</span>
                )}
              </div>

              {/* Message */}
              <div>
                <label htmlFor="cf-message" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  {t('contact.formMessage')} <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <textarea
                  id="cf-message"
                  rows={5}
                  {...register('message')}
                  className="w-full px-4 py-3 rounded-xl bg-[#FAF7F0] dark:bg-stone-900 border border-stone-300 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0F3D2E] dark:focus:ring-[#D9A441] resize-y"
                  style={{ fontSize: '16px' }}
                />
                {errors.message && (
                  <span role="alert" className="text-xs text-red-600 mt-1.5 block">{errors.message.message}</span>
                )}
              </div>

              {/* Honeypot */}
              <input
                type="text"
                {...register('website')}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }}
              />

              {/* Submit — full-width on phones, auto on sm+ */}
              <button
                type="submit"
                disabled={isPending}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 min-h-[52px] rounded-xl bg-[#0F3D2E] text-white font-semibold text-sm hover:bg-[#0A2A20] transition-colors disabled:opacity-60 shadow-sm"
              >
                <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{isPending ? 'Sending…' : t('contact.submitContact')}</span>
              </button>
            </form>
          )}
        </div>

        {/* Location & Department Office Info */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-[#12221C] border border-stone-200 dark:border-stone-800 space-y-4">
            <h3 className="font-display font-bold text-lg text-stone-900 dark:text-stone-100">
              Department Office & Secretariat
            </h3>

            <div className="space-y-3 text-xs sm:text-sm text-stone-600 dark:text-stone-300">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-[#0F3D2E] dark:text-[#D9A441] shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-stone-900 dark:text-stone-100">
                    Physical Campus
                  </strong>
                  <span>{t('contact.campusLocation')}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-[#0F3D2E] dark:text-[#D9A441] shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-stone-900 dark:text-stone-100">
                    {t('contact.phoneLabel')}
                  </strong>
                  <span>
                    {siteSettings?.phone
                      ? siteSettings.phone
                      : 'Available upon request'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-[#0F3D2E] dark:text-[#D9A441] shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-stone-900 dark:text-stone-100">
                    {t('contact.emailLabel')}
                  </strong>
                  <span>tourism.dept@ambou.edu.et / woliso.campus@ambou.edu.et</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Map Visual Slot */}
          <div className="p-8 rounded-3xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center space-y-3">
            <MapPin className="h-10 w-10 text-[#0F3D2E] dark:text-[#D9A441] mx-auto" />
            <h4 className="font-display font-bold text-base text-stone-900 dark:text-stone-100">
              Woliso Campus & Town Map
            </h4>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
              [MAP SLOT: Woliso Campus Main Gate, Central Boulevard, Cultural Square, and Negash Resort corridor]
            </p>
          </div>
        </div>
      </div>

      {/* FAQ Accordion — hidden when empty */}
      {faqs && faqs.length > 0 && (
      <section className="space-y-6 pt-6">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-[#0F3D2E] dark:text-[#D9A441]" />
          <h2 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100">
            {t('contact.faqTitle')}
          </h2>
        </div>

        <div className="space-y-3">
          {faqs?.map((faq) => {
            const isOpen = openFaq === faq.id;
            return (
              <div
                key={faq.id}
                className="rounded-2xl bg-white dark:bg-[#12221C] border border-stone-200 dark:border-stone-800 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(faq.id)}
                  aria-expanded={isOpen}
                  className="w-full px-6 py-4 min-h-[52px] text-left flex items-center justify-between gap-4 font-display font-semibold text-sm sm:text-base text-stone-900 dark:text-stone-100 hover:text-[#0F3D2E] dark:hover:text-[#D9A441] transition-colors"
                >
                  <span>{faq.questionI18n[currentLang] || faq.questionI18n.en}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#0F3D2E] dark:text-[#D9A441]' : 'text-stone-400'
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-4 pt-1 text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed border-t border-stone-100 dark:border-stone-800/80">
                    <p>{faq.answerI18n[currentLang] || faq.answerI18n.en}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      )}
    </div>
  );
};

import React from 'react';
import { NavLink } from 'react-router-dom';
import { Mail, MapPin, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../../lib/i18n';
import { Language } from '../../types';
import { TiletDivider } from '../common/TiletDivider';
import { LOGO_FULL, CREST_AMBOU } from './Navbar';
import { useEdition, useSiteSettings } from '../../hooks/useTourismQueries';

/* ── Phone guard: hide until a real number replaces the placeholder ── */
const phoneIsReal = (p: string | null | undefined): boolean => {
  if (!p) return false;
  return !p.includes('XXXX') && !p.startsWith('[');
};

export const Footer: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { data: siteSettings } = useSiteSettings();
  const { data: edition }      = useEdition();
  const deptPhone  = siteSettings?.phone ?? null;
  const currentLang = (i18n.language as Language) || 'en';

  return (
    <footer className="bg-[#071510] text-stone-300 pb-safe">
      <TiletDivider variant="bold" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">

          {/* Col 1: Logos + contact */}
          <div className="space-y-6 lg:col-span-1">
            {/* Two logos — stack vertically on very narrow phones, side-by-side on sm+ */}
            <div className="flex flex-col xs:flex-row items-start xs:items-center gap-4 flex-wrap">
              <div className="bg-white rounded-xl px-3 py-2 shrink-0">
                <img
                  src={LOGO_FULL}
                  alt="Tourism Week, Ambo University Woliso Campus"
                  style={{ height: 56, width: 'auto', display: 'block' }}
                />
              </div>
              <div className="w-px h-14 bg-white/15 shrink-0 hidden xs:block" aria-hidden="true" />
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="bg-white/10 rounded-xl p-2 border border-white/10">
                  <img
                    src={CREST_AMBOU}
                    alt="Ambo University Official Crest"
                    className="h-10 w-auto object-contain"
                  />
                </div>
                <p className="text-[9px] font-bold text-stone-400 uppercase tracking-wider text-center leading-tight">
                  Ambo<br />University
                </p>
              </div>
            </div>

            <p className="text-sm text-stone-400 leading-relaxed max-w-xs">
              Department of Tourism and Hotel Management — championing regional heritage, community hospitality, and sustainable tourism education in South West Shewa.
            </p>

            {/* Contact */}
            <div className="space-y-3 text-sm text-stone-400">
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 shrink-0 text-[#D9A441] mt-0.5" aria-hidden="true" />
                <span>Woliso Campus, South West Shewa Zone, Oromia, Ethiopia</span>
              </div>
              {phoneIsReal(deptPhone) && (
                <div className="flex items-center gap-2.5">
                  <span className="h-4 w-4 shrink-0 text-[#D9A441] text-sm" aria-hidden="true">📞</span>
                  <span>{deptPhone}</span>
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-[#D9A441]" aria-hidden="true" />
                <span>tourism.dept@ambou.edu.et</span>
              </div>
            </div>
          </div>

          {/* Col 2: Programme */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#D9A441] mb-5">Programme</h4>
            <ul className="space-y-1">
              {[
                { to: '/schedule', label: t('schedule.title') },
                { to: '/events',   label: t('events.title')   },
                { to: '/gallery',  label: t('gallery.title')  },
                { to: '/news',     label: t('news.title')     },
              ].map((l) => (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    className="inline-flex items-center min-h-[44px] text-sm text-stone-400 hover:text-white transition-colors"
                  >
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: About */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#D9A441] mb-5">{t('nav.about')}</h4>
            <ul className="space-y-1">
              {[
                { to: '/about',    label: t('nav.about')                       },
                { to: '/sponsors', label: t('sponsors.becomeSponsorTitle')      },
                { to: '/contact',  label: t('contact.faqTitle')                 },
                { to: '/legal',    label: 'Terms & Privacy Notice'              },
              ].map((l) => (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    className="inline-flex items-center min-h-[44px] text-sm text-stone-400 hover:text-white transition-colors"
                  >
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Language + public badge */}
          <div className="space-y-5">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#D9A441]">{t('common.language')}</h4>
            <div className="flex flex-wrap items-center gap-2">
              {(['en', 'am', 'om'] as Language[]).map((lang) => {
                const labels: Record<Language, string> = { en: 'English', am: 'አማርኛ', om: 'Afaan Oromoo' };
                const active = currentLang === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setAppLanguage(lang)}
                    className={`min-h-[44px] px-4 py-2 text-sm rounded-lg border font-medium transition-all
                      ${lang === 'am' ? 'font-ethiopic' : ''}
                      ${active
                        ? 'border-[#D9A441] bg-[#D9A441] text-[#0A2A20]'
                        : 'border-stone-700 text-stone-400 hover:border-stone-500 hover:text-white'
                      }`}
                  >
                    {labels[lang]}
                  </button>
                );
              })}
            </div>
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-white/5 border border-white/10 text-stone-400 text-xs">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#D9A441] mt-0.5" aria-hidden="true" />
              <span>{t('common.freePublicEvent')}</span>
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <hr className="hairline mt-14 mb-8" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <p>
            © {new Date().getFullYear()} Ambo University Woliso Campus Tourism Week
            <span className="mx-2 text-stone-700" aria-hidden="true">·</span>
            Developed by <span className="text-stone-400 font-medium">Sisay Leule</span>
          </p>
          <p className="text-stone-600 hidden sm:block">
            {edition
              ? `${edition.editionNameI18n[currentLang] ?? edition.editionNameI18n.en} · ${edition.dateRangeDisplayI18n[currentLang] ?? edition.dateRangeDisplayI18n.en}`
              : '5th Annual Tourism Celebration · Megabit 29 – Miyazya 04, 2017 E.C.'}
          </p>
        </div>
      </div>
    </footer>
  );
};

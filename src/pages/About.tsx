import React from 'react';
import { Award, BookOpen, GraduationCap, Heart, History, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TiletDivider } from '../components/common/TiletDivider';
import { useCommittee, useEdition, usePastEditions, useSection } from '../hooks/useTourismQueries';
import { getSectionEntry } from '../lib/sectionRegistry';
import { resolveImage } from '../lib/resolveImage';
import { Language } from '../types';
import type { SectionItemSnapshot } from '../lib/snapshot';
import { LOGO_FULL, CREST_AMBOU } from '../components/layout/Navbar';

// ─── MemberCard component ─────────────────────────────────────────────────────

type AnyMember = {
  id: string
  full_name?: string
  nameI18n?: { en: string; am: string; om: string }
  role_i18n?: { en: string; am?: string; om?: string } | Record<string, string>
  roleI18n?: { en: string; am: string; om: string }
  photo_url?: string | null
  photoPlaceholder?: string
  is_leader?: boolean
  // Migration 017 additions
  bio_i18n?: { en: string; am?: string; om?: string } | null
  department?: string | null
  contact?: { email?: string | null; phone?: string | null; telegram?: string | null } | null
}

function MemberCard({ member, lang, isLeader }: { member: AnyMember; lang: Language; isLeader?: boolean }) {
  // Support both old public type (nameI18n/roleI18n) and new DB row (full_name/role_i18n)
  const name = member.full_name ?? member.nameI18n?.[lang] ?? member.nameI18n?.en ?? ''
  const roleObj = member.role_i18n as { en?: string; am?: string; om?: string } | undefined
  const role = roleObj?.[lang] ?? roleObj?.en
    ?? member.roleI18n?.[lang]
    ?? member.roleI18n?.en
    ?? ''
  const photo    = member.photo_url
    ?? (member.photoPlaceholder && member.photoPlaceholder !== '[PHOTO]' ? member.photoPlaceholder : null)
  const bioObj   = member.bio_i18n as { en?: string; am?: string; om?: string } | null | undefined
  const bio      = bioObj?.[lang] ?? bioObj?.en ?? ''
  const dept     = member.department ?? ''
  const contact  = member.contact

  return (
    <div className={[
      'p-5 rounded-2xl bg-white dark:bg-[#12221C] border flex flex-col',
      isLeader ? 'border-[#D9A441]/40 dark:border-[#D9A441]/30' : 'border-stone-200 dark:border-stone-800',
    ].join(' ')}>
      {/* Photo */}
      <div className="aspect-square rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 overflow-hidden mb-3 flex items-center justify-center">
        {photo ? (() => { const ri = resolveImage(photo); return (
          <img
            src={ri.src}
            srcSet={ri.srcSet || undefined}
            sizes={ri.srcSet ? '(min-width: 1024px) 200px, (min-width: 640px) 25vw, 50vw' : undefined}
            alt={name}
            loading="lazy"
            decoding="async"
            width={200} height={200}
            className="w-full h-full object-cover"
          />
        ); })()
        : <span className="text-2xl font-bold text-stone-400">{name.charAt(0)}</span>}
      </div>
      {isLeader && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-[#C59132] dark:text-[#D9A441] mb-1">
          ★ Leader
        </span>
      )}
      <h3 className="font-display font-bold text-sm text-stone-900 dark:text-stone-100">{name}</h3>
      {role && <p className="text-xs font-semibold text-[#0F3D2E] dark:text-[#D9A441] mt-0.5">{role}</p>}
      {dept && <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">{dept}</p>}
      {bio && <p className="text-[11px] text-stone-600 dark:text-stone-300 mt-1.5 leading-relaxed line-clamp-3">{bio}</p>}
      {contact && (contact.email || contact.phone || contact.telegram) && (
        <div className="mt-2 space-y-0.5">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="block text-[11px] text-[#0F3D2E] dark:text-[#D9A441] hover:underline truncate">
              ✉ {contact.email}
            </a>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="block text-[11px] text-stone-500 dark:text-stone-400 hover:underline">
              ☎ {contact.phone}
            </a>
          )}
          {contact.telegram && (
            <a href={`https://t.me/${contact.telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-stone-500 dark:text-stone-400 hover:underline">
              Telegram: {contact.telegram}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export const About: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language as Language) || 'en';
  const { data: committee } = useCommittee();

  // Phase 6B: past editions from DB, section headings from DB
  const { data: pastEditions = [] } = usePastEditions();
  const { data: introSection    } = useSection('about.intro');
  const { data: heritageSection } = useSection('about.heritage');
  // Edition logo + about text (migration 017)
  const { data: editionData } = useEdition();
  const editionLogoUrl = (editionData as any)?.logoUrl ?? null;
  const editionAbout   = (editionData as any)?.aboutI18n as { en: string; am?: string; om?: string } | null;

  // Helper to resolve section text with registry fallback
  function secText(
    section: typeof introSection,
    field: 'titleI18n' | 'subtitleI18n' | 'bodyI18n',
    registryKey: string,
    registryField: 'title' | 'subtitle' | 'body',
  ): string {
    const dbVal = section?.[field];
    const reg = getSectionEntry(registryKey)?.defaultContent?.[registryField];
    return dbVal?.[currentLang] ?? dbVal?.en ?? reg?.[currentLang] ?? reg?.en ?? '';
  }

  // Cards for the department stat grid: use DB items or registry defaults
  const introCards = (
    introSection?.items?.length
      ? introSection.items
      : (getSectionEntry('about.intro')?.defaultContent?.cards ?? [])
  ) as Array<SectionItemSnapshot | Record<string, unknown>>;

  const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    BookOpen, Heart, Award, Users,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-16">
      {/* Page Header */}
      <div className="border-b border-stone-200 dark:border-stone-800 pb-8">
        <div className="mb-6 flex items-center gap-4">
          <img
            src={editionLogoUrl ?? LOGO_FULL}
            alt="Tourism Week, Ambo University Woliso Campus"
            style={{ height: 80, width: 'auto', display: 'block', mixBlendMode: editionLogoUrl ? undefined : 'multiply' }}
          />
          <div className="w-px h-16 bg-stone-300 dark:bg-white/20 shrink-0" aria-hidden="true" />
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <div className="bg-white dark:bg-[#FAF7F0]/95 rounded-xl p-2 border border-stone-200 dark:border-white/10">
              <img
                src={CREST_AMBOU}
                alt="Ambo University Official Crest"
                className="h-12 w-auto object-contain"
              />
            </div>
            <p className="text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider text-center leading-tight">
              Ambo<br />University
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#0F3D2E] dark:text-[#D9A441] mb-2 uppercase tracking-wider">
          <GraduationCap className="h-4 w-4" aria-hidden="true" />
          <span>Ambo University · Woliso Campus</span>
        </div>
        <h1 className="font-editorial text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-stone-100">
          {t('about.title')}
        </h1>
        <p className="mt-2 text-base text-stone-600 dark:text-stone-400 max-w-2xl">
          {t('about.subtitle')}
        </p>
      </div>

      {/* Mission & Department Profile */}
      <section id="intro" className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 w-fit">
              <img
                src={CREST_AMBOU}
                alt="Ambo University Official Crest"
                className="h-14 sm:h-16 w-auto object-contain"
              />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D2E] dark:text-[#D9A441] block">
                Official University Department
              </span>
              <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                Established 1947 · Oromia, Ethiopia
              </span>
            </div>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            {secText(introSection, 'titleI18n', 'about.intro', 'title') ||
              'Pioneering Tourism & Hotel Leadership in Ethiopia'}
          </h2>
          <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
            {secText(introSection, 'subtitleI18n', 'about.intro', 'subtitle') ||
              "The Department of Tourism and Hotel Management at Ambo University Woliso Campus is one of the nation's foremost academic bodies dedicated to hospitality development, eco-tourism stewardship, and heritage preservation."}
          </p>
          <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
            {secText(introSection, 'bodyI18n', 'about.intro', 'body') ||
              "Our annual Tourism Week is the department's signature experiential learning initiative. Rather than confining hospitality studies to textbooks, our students actively manage public logistics, curate cultural exhibitions, liaise with municipal leaders, and lead field research tours."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {introCards.map((card, idx) => {
            const isSnap = 'titleI18n' in card;
            const heading = isSnap
              ? (card as SectionItemSnapshot).titleI18n?.[currentLang] ?? (card as SectionItemSnapshot).titleI18n?.en ?? ''
              : ((card as Record<string, Record<string, string>>).title)?.[currentLang] ?? ((card as Record<string, Record<string, string>>).title)?.en ?? '';
            const body = isSnap
              ? (card as SectionItemSnapshot).bodyI18n?.[currentLang] ?? (card as SectionItemSnapshot).bodyI18n?.en ?? ''
              : ((card as Record<string, Record<string, string>>).body)?.[currentLang] ?? ((card as Record<string, Record<string, string>>).body)?.en ?? '';
            const iconName = isSnap
              ? (card as SectionItemSnapshot).icon
              : (card as Record<string, string>).icon;
            const IconComp = ICON_MAP[iconName ?? ''];
            return (
              <div key={idx} className="p-5 rounded-2xl bg-white dark:bg-[#12221C] border border-stone-200 dark:border-stone-800 shadow-xs">
                {IconComp && <IconComp className="h-6 w-6 text-[#0F3D2E] dark:text-[#D9A441] mb-2" />}
                <h3 className="font-display font-bold text-base text-stone-900 dark:text-stone-100">{heading}</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">{body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* About this edition (migration 017 about_i18n) */}
      {editionAbout?.en && (
        <section className="rounded-2xl bg-white dark:bg-[#12221C] border border-stone-200 dark:border-stone-800 p-6 sm:p-8 space-y-3">
          <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
            {t('about.aboutEditionTitle') || 'About This Edition'}
          </h2>
          <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">
            {(editionAbout as any)?.[currentLang] ?? editionAbout.en}
          </p>
        </section>
      )}

      {/* Organizing Committees — grouped by committee_key, leader first, hidden when empty */}
      {committee && committee.length > 0 && (() => {
        // Type the extended fields from migration 015
        type Ext = typeof committee[number] & { committee_key?: string; is_leader?: boolean }
        const COMMITTEE_NAMES: Record<string, string> = {
          publicity_promotion:    'Publicity & Promotion Committee',
          technical_physical:     'Technical & Physical Arrangement Committee',
          sponsorship_fundraising:'Sponsorship / Fundraising Committee',
          award_beauty_contest:   'Award & Beauty Contest Committee',
          documentation:          'Documentation Committee',
        }
        const KEYS = Object.keys(COMMITTEE_NAMES)

        // Members that have a committee_key (migration 015+); fall back to flat list for older data
        const keyed = (committee as Ext[]).filter(m => m.committee_key)
        const unkeyed = (committee as Ext[]).filter(m => !m.committee_key)

        return (
          <section className="space-y-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D2E] dark:text-[#D9A441]">Leadership</span>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
                {t('about.committeeTitle')}
              </h2>
            </div>

            {/* Grouped sections */}
            {keyed.length > 0 && KEYS.map(key => {
              const group = keyed.filter(m => m.committee_key === key)
              if (group.length === 0) return null
              const leader = group.find(m => m.is_leader)
              const others = group.filter(m => !m.is_leader)
              const ordered = [...(leader ? [leader] : []), ...others]
              return (
                <div key={key} className="space-y-3">
                  <h3 className="font-display font-semibold text-base text-stone-900 dark:text-stone-100 border-b border-stone-100 dark:border-stone-800 pb-2">
                    {COMMITTEE_NAMES[key]}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {ordered.map(member => (
                      <MemberCard key={member.id} member={member as unknown as AnyMember} lang={currentLang} isLeader={!!member.is_leader} />
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Fallback: members without committee_key (pre-migration 015 data) */}
            {unkeyed.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {unkeyed.map(member => (
                  <MemberCard key={member.id} member={member as unknown as AnyMember} lang={currentLang} />
                ))}
              </div>
            )}
          </section>
        )
      })()}

      {/* Past Editions Timeline — DB-driven; hidden when empty */}
      {pastEditions.length > 0 && (
        <section id="past-editions" className="space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D2E] dark:text-[#D9A441]">
              {secText(heritageSection, 'subtitleI18n', 'about.heritage', 'subtitle') || 'Heritage & Precedents'}
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
              {secText(heritageSection, 'titleI18n', 'about.heritage', 'title') || t('about.historyTitle')}
            </h2>
          </div>

          <div className="space-y-4">
            {pastEditions.map((ed) => {
              const edExt = ed as typeof ed & {
                summaryI18n?: Record<string, string> | null;
                coverImageUrl?: string | null;
              };
              const editionLabel = ed.editionNameI18n[currentLang] ?? ed.editionNameI18n.en;
              const theme        = ed.themeI18n[currentLang] ?? ed.themeI18n.en;
              const summary      = edExt.summaryI18n?.[currentLang] ?? edExt.summaryI18n?.en ?? '';
              const dateRange    = ed.dateRangeDisplayI18n[currentLang] ?? ed.dateRangeDisplayI18n.en;
              return (
                <div
                  key={ed.id}
                  className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#12221C] border border-stone-200 dark:border-stone-800"
                >
                  {/* Cover image — no empty box when missing */}
                  {edExt.coverImageUrl && (() => { const ri = resolveImage(edExt.coverImageUrl); return (
                    <img
                      src={ri.src}
                      srcSet={ri.srcSet || undefined}
                      sizes={ri.srcSet ? '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw' : undefined}
                      alt={editionLabel}
                      loading="lazy"
                      decoding="async"
                      width={480} height={160}
                      className="w-full h-40 object-cover rounded-xl mb-4"
                    />
                  ); })()}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <h3 className="font-display font-bold text-base text-stone-900 dark:text-stone-100">
                      {editionLabel}
                    </h3>
                    <span className="text-xs font-medium text-[#0F3D2E] dark:text-[#D9A441]">
                      {dateRange}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1 italic">
                    &ldquo;{theme}&rdquo;
                  </p>
                  {summary && (
                    <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                      {summary}
                    </p>
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

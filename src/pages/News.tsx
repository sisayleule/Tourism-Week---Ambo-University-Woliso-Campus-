import React, { useState } from 'react';
import { Calendar, FileText, Pin, ArrowRight } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState, LoadingSkeleton } from '../components/common/StateViews';
import { useNews, useSection } from '../hooks/useTourismQueries';
import { getSectionEntry } from '../lib/sectionRegistry';
import { resolveImage } from '../lib/resolveImage';
import { Language } from '../types';

export const News: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language as Language) || 'en';
  const { data: newsItems, isLoading } = useNews();
  const { data: introSection } = useSection('home.news');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const reg = getSectionEntry('home.news');
  const badge = introSection?.subtitleI18n?.[currentLang] ?? introSection?.subtitleI18n?.en
    ?? reg?.defaultContent?.subtitle?.[currentLang] ?? reg?.defaultContent?.subtitle?.en
    ?? 'Press & Campus Notices';
  const heading = introSection?.titleI18n?.[currentLang] ?? introSection?.titleI18n?.en
    ?? reg?.defaultContent?.title?.[currentLang] ?? reg?.defaultContent?.title?.en
    ?? t('news.title');

  const CATEGORIES = [
    { key: 'all',              label: 'All' },
    { key: 'department',       label: 'Department' },
    { key: 'sports_community', label: 'Sports & Community' },
    { key: 'academic',         label: 'Academic' },
    { key: 'general',          label: 'General' },
  ];

  const filtered = (newsItems ?? []).filter(n =>
    selectedCategory === 'all' || (n.categoryI18n?.en ?? '').toLowerCase().replace(/[^a-z_]/g, '') === selectedCategory ||
    (n as unknown as { category?: string }).category === selectedCategory
  );

  // Pinned first, then newest
  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-8">
      {/* Header */}
      <div className="border-b border-stone-200 dark:border-stone-800 pb-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#0F3D2E] dark:text-[#D9A441] mb-2 uppercase tracking-wider">
          <FileText className="h-4 w-4" />
          <span>{badge}</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-stone-100">{heading}</h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 max-w-2xl">{t('news.subtitle')}</p>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {CATEGORIES.map(cat => (
          <button key={cat.key} onClick={() => setSelectedCategory(cat.key)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === cat.key
                ? 'bg-[#0F3D2E] text-white dark:bg-[#D9A441] dark:text-[#0A2A20]'
                : 'bg-white dark:bg-[#12221C] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 hover:border-stone-400'
            }`}>
            {cat.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : sorted.length === 0 ? (
        <EmptyState title="No notices currently published." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sorted.map((item) => (
            <NavLink
              key={item.id}
              to={`/news/${item.slug}`}
              className="group flex flex-col justify-between rounded-2xl bg-white dark:bg-[#12221C] border border-stone-200 dark:border-stone-800 hover:shadow-md transition-all overflow-hidden"
            >
              {/* Cover image — no empty box when missing */}
              {item.image && (
                <div className="aspect-video overflow-hidden bg-stone-100 dark:bg-stone-900">
                  {(() => { const ri = resolveImage(item.image); return (
                  <img
                    src={ri.src}
                    srcSet={ri.srcSet || undefined}
                    sizes={ri.srcSet ? '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw' : undefined}
                    alt={item.titleI18n[currentLang] || item.titleI18n.en}
                    loading="lazy"
                    decoding="async"
                    width={640} height={360}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />); })()}
                </div>
              )}
              <div className="p-6 space-y-3 flex-1 flex flex-col">
                <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                  <span className="font-semibold text-[#0F3D2E] dark:text-[#D9A441] uppercase tracking-wider text-[11px]">
                    {item.categoryI18n[currentLang] || item.categoryI18n.en}
                  </span>
                  {item.pinned && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                      <Pin className="h-3 w-3" />{t('news.pinned')}
                    </span>
                  )}
                </div>
                <h3 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100 group-hover:text-[#0F3D2E] dark:group-hover:text-[#D9A441] transition-colors leading-snug">
                  {item.titleI18n[currentLang] || item.titleI18n.en}
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 line-clamp-3 leading-relaxed flex-1">
                  {item.excerptI18n[currentLang] || item.excerptI18n.en}
                </p>
                <div className="pt-3 mt-auto border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{item.publishedAtEC} E.C.</span>
                  </span>
                  <span className="font-semibold text-[#0F3D2E] dark:text-[#D9A441] flex items-center gap-1">
                    {t('news.readMore')} <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
};

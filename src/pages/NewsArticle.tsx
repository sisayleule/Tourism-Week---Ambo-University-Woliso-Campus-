/**
 * NewsArticle.tsx — /news/:slug
 *
 * Individual news article: cover, title, category, date, author,
 * sanitised Markdown body, share buttons.
 * Shows 404-style empty state when the article is unpublished/deleted.
 */

import React from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { ArrowLeft, Calendar, User, Twitter, Link as LinkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNewsArticle } from '../hooks/useTourismQueries';
import { LoadingSkeleton, EmptyState } from '../components/common/StateViews';
import { resolveImage } from '../lib/resolveImage';
import { renderMarkdown } from '../lib/renderMarkdown';
import { Language } from '../types';

export const NewsArticle: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { i18n } = useTranslation();
  const lang = (i18n.language as Language) || 'en';

  const { data: article, isLoading } = useNewsArticle(slug ?? '');

  if (isLoading) return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12"><LoadingSkeleton rows={6} /></div>
  );

  if (!article) return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-6">
      <EmptyState title="Article not found." description="This article may have been removed or unpublished." />
      <NavLink to="/news" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F3D2E] dark:text-[#D9A441] hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to News
      </NavLink>
    </div>
  );

  const title    = article.titleI18n[lang]    || article.titleI18n.en;
  const excerpt  = article.excerptI18n[lang]  || article.excerptI18n.en;
  const body     = article.contentI18n[lang]  || article.contentI18n.en;
  const author   = article.authorI18n[lang]   || article.authorI18n.en;
  const category = article.categoryI18n[lang] || article.categoryI18n.en;

  const shareTwitter = () => {
    const url  = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(title);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener');
  };
  const copyLink = () => navigator.clipboard?.writeText(window.location.href).catch(() => {});

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
      <NavLink to="/news" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F3D2E] dark:text-[#D9A441] hover:underline mb-6">
        <ArrowLeft className="h-4 w-4" /> All News
      </NavLink>

      {/* Cover — no empty box when missing */}
      {article.image && (
        <div className="rounded-2xl overflow-hidden aspect-video mb-8 bg-stone-100 dark:bg-stone-900">
          {(() => { const ri = resolveImage(article.image); return (
          <img
            src={ri.src}
            srcSet={ri.srcSet || undefined}
            sizes={ri.srcSet ? '(min-width: 768px) 672px, 100vw' : undefined}
            alt={title}
            fetchPriority="high"
            decoding="async"
            width={672} height={378}
            className="w-full h-full object-cover"
          />); })()}
        </div>
      )}

      {/* Category + meta */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 dark:text-stone-400 mb-4">
        <span className="font-bold uppercase tracking-wider text-[#0F3D2E] dark:text-[#D9A441]">{category}</span>
        <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {article.publishedAtEC} E.C.</span>
        {author && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {author}</span>}
      </div>

      <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-stone-100 leading-tight mb-4">
        {title}
      </h1>

      {excerpt && (
        <p className="text-base sm:text-lg font-semibold text-stone-600 dark:text-stone-400 mb-6 leading-relaxed border-l-4 border-[#D9A441] pl-4">
          {excerpt}
        </p>
      )}

      {body && (
        <div
          className="prose prose-sm sm:prose dark:prose-invert max-w-none text-stone-700 dark:text-stone-300"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
        />
      )}

      {/* Share buttons */}
      <div className="mt-10 pt-6 border-t border-stone-200 dark:border-stone-800 flex items-center gap-3">
        <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Share:</span>
        <button onClick={shareTwitter}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
          <Twitter className="h-3.5 w-3.5" /> Twitter / X
        </button>
        <button onClick={copyLink}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
          <LinkIcon className="h-3.5 w-3.5" /> Copy link
        </button>
      </div>
    </article>
  );
};

import React from 'react';
import { AlertCircle, CalendarX, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LOGO_FULL } from '../layout/Navbar';

export const LoadingSkeleton: React.FC<{ rows?: number; className?: string; fullPage?: boolean }> = ({
  rows = 3,
  className = '',
  fullPage = false,
}) => {
  if (fullPage) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-[#FAF7F0] dark:bg-[#0B1612]" aria-live="polite" aria-busy="true">
        <div className="bg-white dark:bg-[#FAF7F0]/95 rounded-2xl px-8 py-6 border border-stone-200 dark:border-white/10 animate-pulse">
          <img
            src={LOGO_FULL}
            alt="Tourism Week, Ambo University Woliso Campus"
            className="h-28 w-auto object-contain"
          />
        </div>
        <p className="text-sm text-stone-500 dark:text-stone-400 animate-pulse">Loading…</p>
      </div>
    );
  }
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      className={`w-full animate-pulse space-y-4 ${className}`}
    >
      <div className="h-8 bg-stone-200 dark:bg-stone-800 rounded-xl w-1/3" />
      <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded-lg w-2/3" />
      <div className="space-y-3 pt-2">
        {Array.from({ length: rows }).map((_, idx) => (
          <div
            key={idx}
            className="h-24 bg-stone-100 dark:bg-stone-900/60 border border-stone-200/60 dark:border-stone-800/80 rounded-2xl"
          />
        ))}
      </div>
    </div>
  );
};

export const ErrorState: React.FC<{
  message?: string;
  onRetry?: () => void;
  className?: string;
}> = ({ message, onRetry, className = '' }) => {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className={`rounded-2xl border border-red-200 bg-red-50/50 p-8 text-center dark:border-red-900/40 dark:bg-red-950/20 ${className}`}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-stone-900 dark:text-stone-100">
        {message || t('common.errorLoading')}
      </h3>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0F3D2E] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0A2A20] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F3D2E]"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span>{t('common.retry')}</span>
        </button>
      )}
    </div>
  );
};

export const EmptyState: React.FC<{
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}> = ({ title, description, action, className = '' }) => {
  const { t } = useTranslation();
  return (
    <div
      className={`rounded-2xl border border-dashed border-stone-300 bg-white/50 p-10 text-center dark:border-stone-800 dark:bg-stone-900/30 ${className}`}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400">
        <CalendarX className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-stone-900 dark:text-stone-100">
        {title || t('common.noItems')}
      </h3>
      {description && (
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

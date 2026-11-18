import React from 'react';
import { CheckCircle2, Clock, Radio, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EventStatus } from '../../types';

interface StatusBadgeProps {
  status: EventStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const { t } = useTranslation();

  switch (status) {
    case 'live':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-600/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-600/30 dark:border-emerald-500/30 ${className}`}
        >
          <Radio className="h-3 w-3 animate-pulse text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span>{t('common.liveNow')}</span>
        </span>
      );
    case 'delayed':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-500/15 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200 border border-amber-500/30 ${className}`}
        >
          <Clock className="h-3 w-3 text-amber-700 dark:text-amber-400" aria-hidden="true" />
          <span>{t('common.delayed')}</span>
        </span>
      );
    case 'cancelled':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-rose-500/15 text-rose-900 dark:bg-rose-400/20 dark:text-rose-200 border border-rose-500/30 ${className}`}
        >
          <XCircle className="h-3 w-3 text-rose-700 dark:text-rose-400" aria-hidden="true" />
          <span>{t('common.cancelled')}</span>
        </span>
      );
    case 'scheduled':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border border-stone-200 dark:border-stone-700 ${className}`}
        >
          <CheckCircle2 className="h-3 w-3 text-stone-500 dark:text-stone-400" aria-hidden="true" />
          <span>{t('common.scheduled')}</span>
        </span>
      );
  }
};

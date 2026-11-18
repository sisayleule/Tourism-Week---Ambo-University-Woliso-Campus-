/**
 * I18nTabs.tsx — EN / AM / OM tab switcher for multilingual form fields.
 *
 * Mobile fix: the tab strip is a horizontally-scrollable flex row with
 * scroll-snap so it works at 320 px without wrapping or clipping.
 * Each tab is min-w-fit so it never truncates its label.
 * Min tap target height: 44 px.
 */

import React from 'react'

export type I18nLang = 'en' | 'am' | 'om'

interface I18nTabsProps {
  value:        I18nLang
  onChange:     (lang: I18nLang) => void
  requiredLang?: I18nLang
}

const LANG_LABELS: Record<I18nLang, { label: string; note: string }> = {
  en: { label: 'English',      note: 'Required'                            },
  am: { label: 'Amharic',      note: 'Optional — English shown if empty'   },
  om: { label: 'Afaan Oromo',  note: 'Optional — English shown if empty'   },
}

export function I18nTabs({ value, onChange, requiredLang = 'en' }: I18nTabsProps) {
  const tabs: I18nLang[] = ['en', 'am', 'om']

  return (
    /*
     * -mx-px compensates for the bottom border so the scrollbar doesn't
     * appear below the border line.  overflow-x-auto + no-scrollbar keeps
     * it clean on phones.
     */
    <div
      className="flex items-end gap-0 overflow-x-auto no-scrollbar border-b border-[var(--border-subtle)]"
      role="tablist"
      aria-label="Language"
    >
      {tabs.map(lang => {
        const isActive = value === lang
        const isReq    = lang === requiredLang
        return (
          <button
            key={lang}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(lang)}
            className={[
              /* Sizing: min-h 44 px for tap target, shrink-0 so text never wraps */
              'shrink-0 px-4 min-h-[44px] text-sm font-medium transition-colors border-b-2 -mb-px',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] rounded-t-lg',
              isActive
                ? 'border-[#D9A441] text-[var(--text-main)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]',
            ].join(' ')}
          >
            {LANG_LABELS[lang].label}
            {isReq && (
              <span className="ml-1 text-[10px] text-red-500 font-normal" aria-label="Required">*</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export const LANG_NOTE: Record<I18nLang, string> = {
  en: 'English is shown to visitors when other languages are empty.',
  am: 'Optional — English is shown to visitors when this is empty.',
  om: 'Optional — English is shown to visitors when this is empty.',
}

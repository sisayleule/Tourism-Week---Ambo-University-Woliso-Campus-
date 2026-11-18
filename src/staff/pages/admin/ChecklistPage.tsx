/**
 * ChecklistPage.tsx — /admin/checklist
 *
 * Static, printable yearly handover checklist.
 * Client-side checkboxes (not persisted). Print button.
 */

import React, { useState } from 'react'
import { BookCheck, Printer, CheckSquare, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function ChecklistPage() {
  const { t } = useTranslation()

  const steps = [
    { key: 'step1', title: t('staff.admin.checklist.step1Title'), desc: t('staff.admin.checklist.step1Desc') },
    { key: 'step2', title: t('staff.admin.checklist.step2Title'), desc: t('staff.admin.checklist.step2Desc') },
    { key: 'step3', title: t('staff.admin.checklist.step3Title'), desc: t('staff.admin.checklist.step3Desc') },
    { key: 'step4', title: t('staff.admin.checklist.step4Title'), desc: t('staff.admin.checklist.step4Desc') },
    { key: 'step5', title: t('staff.admin.checklist.step5Title'), desc: t('staff.admin.checklist.step5Desc') },
    { key: 'step6', title: t('staff.admin.checklist.step6Title'), desc: t('staff.admin.checklist.step6Desc') },
    { key: 'step7', title: t('staff.admin.checklist.step7Title'), desc: t('staff.admin.checklist.step7Desc') },
    { key: 'step8', title: t('staff.admin.checklist.step8Title'), desc: t('staff.admin.checklist.step8Desc') },
  ]

  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const toggle = (key: string) => setChecked(p => ({ ...p, [key]: !p[key] }))

  return (
    <div className="max-w-2xl space-y-6 print:max-w-none print:space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0F3D2E] text-[#D9A441] print:hidden">
            <BookCheck size={20} />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-[var(--text-main)]">{t('staff.admin.checklist.title')}</h1>
            <p className="text-sm text-[var(--text-muted)]">{t('staff.admin.checklist.subtitle')}</p>
          </div>
        </div>
        <button onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-section-alt)] transition-colors print:hidden">
          <Printer size={16} /> {t('staff.admin.checklist.print')}
        </button>
      </div>

      <ol className="space-y-4" aria-label="Yearly checklist">
        {steps.map((step, i) => {
          const done = !!checked[step.key]
          return (
            <li key={step.key} className="flex gap-4">
              <button onClick={() => toggle(step.key)}
                className="mt-0.5 shrink-0 print:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"
                aria-pressed={done} aria-label={`Step ${i + 1}`}>
                {done
                  ? <CheckSquare size={22} className="text-emerald-600 dark:text-emerald-400" />
                  : <Square size={22} className="text-[var(--text-muted)]" />
                }
              </button>
              <span className="hidden print:inline-block w-5 h-5 border-2 border-stone-500 rounded mt-0.5 shrink-0" aria-hidden="true" />
              <div className="flex-1 space-y-1">
                <p className={`text-sm font-semibold ${done ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-main)]'}`}>
                  {i + 1}. {step.title}
                </p>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{step.desc}</p>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="px-4 py-3 rounded-xl bg-[var(--bg-section-alt)] text-xs text-[var(--text-muted)] leading-relaxed">
        This checklist is for guidance only. Steps may vary. Adapt as needed.
      </div>
    </div>
  )
}

/**
 * StaffForm.tsx — Shared form primitives for the staff portal.
 *
 * Label, TextInput, TextArea, SelectField, Toggle, ErrorMessage.
 * Consistent styling, accessible labels, focus rings.
 */

import React from 'react'

// ─── Label ────────────────────────────────────────────────────────────────────

export function Label({
  htmlFor,
  children,
  required,
  hint,
}: {
  htmlFor:  string
  children:  React.ReactNode
  required?: boolean
  hint?:     string
}) {
  return (
    <div className="flex items-baseline justify-between">
      <label htmlFor={htmlFor} className="text-sm font-medium text-[var(--text-main)]">
        {children}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {hint && (
        <span className="text-[11px] text-[var(--text-muted)]">{hint}</span>
      )}
    </div>
  )
}

// ─── TextInput ────────────────────────────────────────────────────────────────

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        'w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm',
        'placeholder:text-[var(--text-muted)] transition',
        'focus:outline-none focus:ring-2 focus:ring-[#D9A441] focus:border-transparent',
        props.className ?? '',
        props['aria-invalid'] === 'true'
          ? 'border-red-400 dark:border-red-700'
          : 'border-[var(--border-subtle)]',
      ].join(' ')}
    />
  )
}

// ─── TextArea ─────────────────────────────────────────────────────────────────

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        'w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm',
        'placeholder:text-[var(--text-muted)] transition resize-y min-h-[80px]',
        'focus:outline-none focus:ring-2 focus:ring-[#D9A441] focus:border-transparent',
        props.className ?? '',
      ].join(' ')}
    />
  )
}

// ─── SelectField ──────────────────────────────────────────────────────────────

export function SelectField({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        'w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-main)] text-sm',
        'focus:outline-none focus:ring-2 focus:ring-[#D9A441] focus:border-transparent transition',
        props.className ?? '',
      ].join(' ')}
    >
      {children}
    </select>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

export function Toggle({
  checked,
  onChange,
  label,
  id,
}: {
  checked:  boolean
  onChange: (checked: boolean) => void
  label:    string
  id:       string
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 cursor-pointer">
      <span className="relative">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <span className="block w-11 h-6 rounded-full bg-[var(--border-subtle)] peer-checked:bg-[#0F3D2E] transition-colors" />
        <span className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
      <span className="text-sm text-[var(--text-main)] select-none">{label}</span>
    </label>
  )
}

// ─── ErrorMessage ──────────────────────────────────────────────────────────────

export function FormError({ message }: { message: string }) {
  return (
    <p className="text-xs text-red-600 dark:text-red-400 mt-1" role="alert">
      {message}
    </p>
  )
}

/**
 * Toast.tsx — Lightweight toast notification system for the staff portal.
 *
 * Usage:
 *   const { showToast } = useToast()
 *   showToast({ type: 'success', message: 'Event published' })
 *
 * Uses a simple context + portal. Toasts auto-dismiss after 4 s.
 * aria-live="polite" for screen readers.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id:      string
  type:    ToastType
  message: string
  undoFn?: () => void
}

interface ToastContextValue {
  showToast: (toast: Omit<Toast, 'id'>) => string
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${++counter.current}`
    setToasts(prev => [...prev, { ...toast, id }])
    setTimeout(() => dismissToast(id), 5000)
    return id
  }, [dismissToast])

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      {/* Toast container — fixed bottom-center on mobile, bottom-right on desktop */}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0 z-[150] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 size={18} className="text-emerald-500" aria-hidden="true" />,
    error:   <AlertCircle  size={18} className="text-red-500"    aria-hidden="true" />,
    info:    <Info          size={18} className="text-blue-500"    aria-hidden="true" />,
  }

  const borders: Record<ToastType, string> = {
    success: 'border-l-4 border-l-emerald-500',
    error:   'border-l-4 border-l-red-500',
    info:    'border-l-4 border-l-blue-500',
  }

  return (
    <div
      role="status"
      className={[
        'flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg',
        'bg-[var(--surface-card)] border border-[var(--border-subtle)]',
        borders[toast.type],
        'animate-[fadeRise_0.3s_ease-out_both]',
      ].join(' ')}
    >
      <span className="mt-0.5 shrink-0">{icons[toast.type]}</span>
      <p className="flex-1 text-sm text-[var(--text-main)] leading-snug">
        {toast.message}
      </p>
      {toast.undoFn && (
        <button
          onClick={() => { toast.undoFn!(); onDismiss() }}
          className="text-xs font-semibold text-[#0F3D2E] dark:text-[#D9A441] hover:underline shrink-0 ml-1"
        >
          Undo
        </button>
      )}
      <button
        onClick={onDismiss}
        className="text-[var(--text-muted)] hover:text-[var(--text-main)] shrink-0"
        aria-label="Dismiss notification"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

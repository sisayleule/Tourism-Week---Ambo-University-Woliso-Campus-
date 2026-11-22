/**
 * saveEvents.ts — Tiny pub/sub for "content saved" events.
 *
 * Portal mutations call notifySaved() in their onSuccess.
 * The SaveConfirmationToast (via useLiveSaveConfirmation) subscribes
 * to these events and starts polling content_version() automatically.
 *
 * Zero external dependencies — a simple Set of callbacks.
 */

type SaveListener = () => void

const listeners = new Set<SaveListener>()

/** Call from any mutation's onSuccess after a content change. */
export function notifySaved(): void {
  for (const fn of listeners) {
    try { fn() } catch { /* ignore */ }
  }
}

/** Subscribe to save events. Returns an unsubscribe function. */
export function onSaved(fn: SaveListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

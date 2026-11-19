/**
 * heroVideoDebugStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tiny module-level store that lets HeroVideo push its debug snapshot without
 * prop-drilling, and lets ContentDebugView poll it.
 *
 * Not a React context — avoids any re-render cascade.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { HeroVideoDebugSnapshot } from '../components/hero/HeroVideo';

let _snapshot: HeroVideoDebugSnapshot | null = null;
let _getSnapshot: (() => HeroVideoDebugSnapshot) | null = null;

/** Called by HeroVideo to register its imperative getter. */
export function registerHeroVideoDebug(getter: () => HeroVideoDebugSnapshot): void {
  _getSnapshot = getter;
}

/** Called by HeroVideo on unmount. */
export function unregisterHeroVideoDebug(): void {
  _getSnapshot = null;
  _snapshot    = null;
}

/**
 * Called by ContentDebugView (on a poll interval).
 * Returns the latest snapshot, or null when no video is mounted.
 */
export function getHeroVideoDebugSnapshot(): HeroVideoDebugSnapshot | null {
  if (_getSnapshot) {
    try { _snapshot = _getSnapshot(); } catch { /* component unmounting */ }
  }
  return _snapshot;
}

/**
 * theme-init.js — loaded synchronously in <head> before first paint.
 *
 * Reads the visitor's saved theme preference from localStorage and applies
 * the "dark" class to <html> immediately so there is no flash of the wrong
 * colour scheme.
 *
 * Rules:
 *   - saved === 'dark'  → add class="dark"
 *   - anything else     → light mode (no class)
 *   - device prefers-color-scheme is intentionally NOT consulted on first
 *     visit; the user's explicit toggle choice always wins.
 *
 * Loaded via:  <script src="/theme-init.js"></script>  (no defer/async)
 * This keeps Content-Security-Policy script-src to 'self' — no 'unsafe-inline'.
 */
(function () {
  var saved = localStorage.getItem('tourism_theme');
  if (saved === 'dark') {
    document.documentElement.classList.add('dark');
  }
})();

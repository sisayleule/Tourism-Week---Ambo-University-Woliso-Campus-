/**
 * renderMarkdown.ts — shared, hardened Markdown-to-HTML renderer.
 *
 * Used in:
 *   - src/pages/NewsArticle.tsx  (public article body)
 *   - src/staff/pages/news/NewsFormPage.tsx  (editor preview)
 *   - Any other place that renders Markdown with dangerouslySetInnerHTML.
 *
 * Security model
 * ──────────────
 * 1. All raw input is HTML-entity-escaped FIRST (& < >), so no injected
 *    HTML can survive as tags.
 * 2. The regex patterns then re-introduce a small, explicit allowlist of
 *    HTML elements (headings, strong, em, a, li, ul, p).
 * 3. Link URLs are validated against an allowlist of safe schemes before
 *    being re-inserted. Anything else is replaced with "#invalid-url".
 * 4. Image src URLs are similarly restricted to https:// or /-started
 *    internal paths.
 * 5. All external links get rel="noopener noreferrer nofollow" and
 *    target="_blank".
 * 6. Internal links (starting / or #) stay in-tab with no rel override.
 *
 * Supported syntax
 * ────────────────
 *   # H1   ## H2   ### H3
 *   **bold**   *italic*
 *   [text](url)         — links
 *   ![alt](url)         — inline images (https or / only)
 *   - list item
 *   blank line → paragraph break
 */

/** Allowed link schemes for href attributes. */
const SAFE_HREF_RE = /^(https?:\/\/|mailto:|tel:|\/|#)/i

/** Allowed image src: https or internal paths only. */
const SAFE_IMG_SRC_RE = /^(https?:\/\/|\/)/i

/** Sanitize a URL for use in an href attribute. */
function sanitizeHref(raw: string): string {
  const trimmed = raw.trim()
  // Decode common HTML entity tricks before checking scheme
  const decoded = trimmed
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g,          (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
  if (SAFE_HREF_RE.test(decoded)) return trimmed  // return original (already entity-safe from earlier escaping)
  return '#invalid-url'
}

/** Sanitize a URL for use in an img src attribute. */
function sanitizeImgSrc(raw: string): string {
  const trimmed = raw.trim()
  const decoded = trimmed
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g,          (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
  if (SAFE_IMG_SRC_RE.test(decoded)) return trimmed
  return '/invalid-image'
}

/** Escape a string for safe use as an HTML attribute value. */
function escAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/**
 * Render a Markdown string to a safe HTML string.
 *
 * @param md        - Raw Markdown input (untrusted).
 * @param classes   - Optional CSS class overrides for block elements.
 * @returns         - Safe HTML string ready for dangerouslySetInnerHTML.
 */
export function renderMarkdown(
  md: string,
  classes?: {
    h1?: string; h2?: string; h3?: string
    p?: string;  li?: string; ul?: string
    a?: string
  }
): string {
  if (!md) return ''

  const c = {
    h1: classes?.h1 ?? 'font-bold text-2xl mt-6 mb-3',
    h2: classes?.h2 ?? 'font-bold text-xl mt-6 mb-2',
    h3: classes?.h3 ?? 'font-bold text-base mt-4 mb-1',
    p:  classes?.p  ?? 'mb-4 leading-relaxed',
    li: classes?.li ?? 'ml-5 list-disc',
    ul: classes?.ul ?? 'space-y-1 my-3',
    a:  classes?.a  ?? 'underline text-[#0F3D2E] dark:text-[#D9A441]',
  }

  // Step 1: entity-escape ALL input — this neutralises every raw HTML tag.
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Step 2: inline images  ![alt](src)  — before links so it doesn't match [
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_, alt, src) => {
      const safeSrc = escAttr(sanitizeImgSrc(src))
      const safeAlt = escAttr(alt)
      return `<img src="${safeSrc}" alt="${safeAlt}" class="max-w-full rounded my-2" loading="lazy" decoding="async" />`
    }
  )

  // Step 3: links  [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, text, href) => {
      const safeHref = escAttr(sanitizeHref(href))
      const isExternal = /^https?:\/\//i.test(href.trim())
      const rel = isExternal ? ' rel="noopener noreferrer nofollow"' : ''
      const target = isExternal ? ' target="_blank"' : ''
      return `<a href="${safeHref}" class="${c.a}"${target}${rel}>${text}</a>`
    }
  )

  // Step 4: headings (must come before bold/italic to avoid mis-matching **)
  html = html
    .replace(/^### (.+)$/gm, `<h3 class="${c.h3}">$1</h3>`)
    .replace(/^## (.+)$/gm,  `<h2 class="${c.h2}">$1</h2>`)
    .replace(/^# (.+)$/gm,   `<h1 class="${c.h1}">$1</h1>`)

  // Step 5: bold and italic
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')

  // Step 6: unordered list items
  html = html
    .replace(/^- (.+)$/gm, `<li class="${c.li}">$1</li>`)
    .replace(/(<li[^>]*>[\s\S]*?<\/li>\n?)+/g, m => `<ul class="${c.ul}">${m}</ul>`)

  // Step 7: paragraph breaks
  html = html.replace(/\n\n/g, `</p><p class="${c.p}">`)

  return `<p class="${c.p}">${html}</p>`
}

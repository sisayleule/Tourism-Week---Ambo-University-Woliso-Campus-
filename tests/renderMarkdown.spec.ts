/**
 * tests/renderMarkdown.spec.ts
 *
 * Unit tests for src/lib/renderMarkdown.ts
 *
 * Run:  npx tsx --test tests/renderMarkdown.spec.ts
 *   or: node --experimental-vm-modules node_modules/.bin/jest tests/renderMarkdown.spec.ts
 *
 * These tests use Node's built-in test runner (node:test) + assert — no extra
 * dependencies.  The file is ESM (package.json has "type":"module").
 */

import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { renderMarkdown } from '../src/lib/renderMarkdown.js'

// ─── helper ───────────────────────────────────────────────────────────────────
/** Returns true if the rendered HTML contains no executable JS payload. */
function isSafe(html: string): boolean {
  // Must not contain un-escaped <script> tags (entity-encoded &lt;script is fine)
  if (/<script/i.test(html)) return false
  // Must not contain live event handler attributes (e.g. onerror=, onclick=)
  // A live attribute looks like: space + on<word> + optional-space + =
  // Entity-encoded versions like &lt;img onerror are fine — they're just text.
  // We check for the pattern only when preceded by a real < (not &lt;)
  if (/<[^>]*\bon\w+\s*=/i.test(html)) return false
  // javascript: href must not appear as a live attribute value
  if (/href\s*=\s*["']?\s*javascript:/i.test(html)) return false
  // data: URI in href
  if (/href\s*=\s*["']?\s*data:/i.test(html)) return false
  // vbscript:
  if (/href\s*=\s*["']?\s*vbscript:/i.test(html)) return false
  return true
}

// ─── XSS attack strings ───────────────────────────────────────────────────────

describe('renderMarkdown — XSS prevention', () => {

  it('strips javascript: link (lowercase)', () => {
    const out = renderMarkdown('[a](javascript:alert(1))')
    assert.ok(isSafe(out), `unsafe output: ${out}`)
    assert.ok(out.includes('#invalid-url'), `expected #invalid-url, got: ${out}`)
  })

  it('strips javascript: link (mixed case)', () => {
    const out = renderMarkdown('[a](JaVaScRiPt:alert(1))')
    assert.ok(isSafe(out), `unsafe output: ${out}`)
    assert.ok(out.includes('#invalid-url'), `expected #invalid-url, got: ${out}`)
  })

  it('strips javascript: link (HTML entity encoded &#106;)', () => {
    const out = renderMarkdown('[a](&#106;avascript:alert(1))')
    assert.ok(isSafe(out), `unsafe output: ${out}`)
  })

  it('strips data: URI link', () => {
    const out = renderMarkdown('[a](data:text/html;base64,PHNjcmlwdD4=)')
    assert.ok(isSafe(out), `unsafe output: ${out}`)
    assert.ok(out.includes('#invalid-url'), `expected #invalid-url, got: ${out}`)
  })

  it('strips onerror from inline image', () => {
    const out = renderMarkdown('![x](x" onerror="alert(1))')
    assert.ok(isSafe(out), `unsafe output: ${out}`)
    // The injected attribute must be escaped, not executed
    assert.ok(!out.includes('onerror="alert'), `onerror attribute leaked: ${out}`)
  })

  it('neutralises raw <script> tag', () => {
    const out = renderMarkdown('<script>alert(1)</script>')
    assert.ok(isSafe(out), `unsafe output: ${out}`)
    assert.ok(!out.includes('<script'), `script tag leaked: ${out}`)
  })

  it('neutralises raw <img onerror>', () => {
    const out = renderMarkdown('<img src=x onerror=alert(1)>')
    assert.ok(isSafe(out), `unsafe output: ${out}`)
    // The raw tag must have been entity-encoded, not passed through as a live tag
    assert.ok(!out.includes('<img '), `raw img tag leaked as live element: ${out}`)
    assert.ok(out.includes('&lt;img'), `entity-encoded form expected: ${out}`)
  })

  it('strips vbscript: link', () => {
    const out = renderMarkdown('[click](vbscript:msgbox(1))')
    assert.ok(isSafe(out), `unsafe output: ${out}`)
    assert.ok(out.includes('#invalid-url'), `expected #invalid-url, got: ${out}`)
  })

  it('strips nested payload in link text', () => {
    const out = renderMarkdown('[<img src=x onerror=alert(1)>](https://example.com)')
    assert.ok(isSafe(out), `unsafe output: ${out}`)
    // The link text angle brackets must be entity-encoded — no live element
    assert.ok(!out.includes('<img '), `raw img in link text leaked as live element: ${out}`)
    assert.ok(out.includes('&lt;img'), `entity-encoded form expected: ${out}`)
  })

  it('handles entity-encoded javascript: (&#x6A;avascript:)', () => {
    const out = renderMarkdown('[x](&#x6A;avascript:alert(1))')
    assert.ok(isSafe(out), `unsafe output: ${out}`)
  })

  it('strips data: image src', () => {
    const out = renderMarkdown('![x](data:image/svg+xml,<svg onload=alert(1)>)')
    assert.ok(isSafe(out), `unsafe output: ${out}`)
    assert.ok(!out.includes('data:image'), `data URI in img src leaked: ${out}`)
  })

})

// ─── Positive rendering tests ─────────────────────────────────────────────────

describe('renderMarkdown — correct rendering', () => {

  it('renders external https link with rel and target', () => {
    const out = renderMarkdown('[Visit](https://example.com)')
    assert.ok(out.includes('href="https://example.com"'), `href missing: ${out}`)
    assert.ok(out.includes('target="_blank"'), `target missing: ${out}`)
    assert.ok(out.includes('rel="noopener noreferrer nofollow"'), `rel missing: ${out}`)
  })

  it('renders internal / link without target or rel', () => {
    const out = renderMarkdown('[Home](/home)')
    assert.ok(out.includes('href="/home"'), `href missing: ${out}`)
    assert.ok(!out.includes('target="_blank"'), `target must not be on internal link: ${out}`)
  })

  it('renders mailto: link', () => {
    const out = renderMarkdown('[Email](mailto:test@example.com)')
    assert.ok(out.includes('href="mailto:test@example.com"'), `mailto href missing: ${out}`)
  })

  it('renders tel: link', () => {
    const out = renderMarkdown('[Call](tel:+251911000000)')
    assert.ok(out.includes('href="tel:+251911000000"'), `tel href missing: ${out}`)
  })

  it('renders # anchor link', () => {
    const out = renderMarkdown('[Top](#top)')
    assert.ok(out.includes('href="#top"'), `anchor href missing: ${out}`)
  })

  it('renders headings h1 h2 h3', () => {
    const out = renderMarkdown('# Title\n## Sub\n### Minor')
    assert.ok(out.includes('<h1'), `h1 missing: ${out}`)
    assert.ok(out.includes('<h2'), `h2 missing: ${out}`)
    assert.ok(out.includes('<h3'), `h3 missing: ${out}`)
  })

  it('renders bold and italic', () => {
    const out = renderMarkdown('**bold** and *italic*')
    assert.ok(out.includes('<strong>bold</strong>'), `bold missing: ${out}`)
    assert.ok(out.includes('<em>italic</em>'), `italic missing: ${out}`)
  })

  it('renders bullet list', () => {
    const out = renderMarkdown('- item one\n- item two')
    assert.ok(out.includes('<ul'), `ul missing: ${out}`)
    assert.ok(out.includes('<li'), `li missing: ${out}`)
    assert.ok(out.includes('item one'), `item text missing: ${out}`)
  })

  it('renders safe https image', () => {
    const out = renderMarkdown('![Photo](https://example.com/photo.jpg)')
    assert.ok(out.includes('src="https://example.com/photo.jpg"'), `img src missing: ${out}`)
    assert.ok(out.includes('alt="Photo"'), `img alt missing: ${out}`)
  })

  it('renders safe internal image', () => {
    const out = renderMarkdown('![Logo](/assets/logo.png)')
    assert.ok(out.includes('src="/assets/logo.png"'), `img src missing: ${out}`)
  })

  it('empty input returns empty string', () => {
    assert.strictEqual(renderMarkdown(''), '')
    assert.strictEqual(renderMarkdown('   '.trim()), '')
  })

})

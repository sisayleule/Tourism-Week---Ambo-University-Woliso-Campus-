/**
 * scripts/measure-hero.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Throwaway diagnostic: opens the home page at 390×844 and 360×640 and dumps
 * geometry + computed styles for the hero section, media wrapper, <video> and
 * poster <img> to stdout (and writes audit/responsive/hero/measure-before.json).
 *
 * Usage:
 *   node scripts/measure-hero.mjs [--after]
 *   (The --after flag writes measure-after.json instead.)
 *
 * Requires Playwright to be installed (it's already in devDependencies).
 * Assumes the dev server is running on http://localhost:3000.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.resolve(__dirname, '../audit/responsive/hero');
const PHASE     = process.argv.includes('--after') ? 'after' : 'before';
const OUT_FILE  = path.join(OUT_DIR, `measure-${PHASE}.json`);
const BASE_URL  = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '360x640', width: 360, height: 640 },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

/** Collect all computed style properties relevant to sizing */
const PROPS = [
  'position', 'top', 'bottom', 'left', 'right',
  'display', 'width', 'height', 'minHeight', 'maxHeight',
  'aspectRatio', 'objectFit', 'objectPosition',
  'transform', 'zIndex', 'overflow',
];

async function measureViewport(page, vpName) {
  const result = await page.evaluate((props) => {
    function rectOf(el) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
    }
    function styleOf(el) {
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      const out = {};
      for (const p of props) out[p] = cs[p];
      return out;
    }
    function infoOf(el) {
      if (!el) return null;
      return {
        tag:       el.tagName.toLowerCase(),
        className: el.className,
        id:        el.id || undefined,
        rect:      rectOf(el),
        computed:  styleOf(el),
      };
    }

    const hero       = document.querySelector('[aria-label="Festival hero"]');
    const mediaWrap  = hero?.querySelector('[data-media-wrap]') ?? null;  // may not exist yet
    const video      = hero?.querySelector('video');
    const img        = hero?.querySelector('img');
    const h1         = hero?.querySelector('h1');

    // Collect stylesheet rules that set height / max-height / aspect-ratio / object-fit
    // on video, img, or any class used by the hero media
    const matchedRules = [];
    try {
      for (const sheet of Array.from(document.styleSheets)) {
        let rules;
        try { rules = Array.from(sheet.cssRules ?? []); } catch { continue; }
        for (const rule of rules) {
          if (!(rule instanceof CSSStyleRule)) continue;
          const sel = rule.selectorText ?? '';
          const txt = rule.cssText ?? '';
          const relevant = /video|img|\.absolute|inset-0|h-full|object-cover|object-contain|max-h|aspect/.test(sel + txt);
          const hasHeightProp = /\b(height|max-height|aspect-ratio|object-fit)\s*:/.test(txt);
          if (relevant && hasHeightProp) {
            matchedRules.push({ selector: sel, cssText: txt.slice(0, 300) });
          }
        }
      }
    } catch (e) {
      matchedRules.push({ error: String(e) });
    }

    return {
      viewport:    { width: window.innerWidth, height: window.innerHeight },
      hero:        infoOf(hero),
      mediaWrap:   infoOf(mediaWrap),
      video:       infoOf(video),
      posterImg:   infoOf(img),
      h1:          infoOf(h1),
      matchedRules,
    };
  }, PROPS);

  return { viewport: vpName, ...result };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const allResults = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page    = await context.newPage();

    try {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      await page.waitForSelector('[aria-label="Festival hero"]', { timeout: 15_000 });
      await page.waitForTimeout(600); // let React finish

      const data = await measureViewport(page, vp.name);
      allResults.push(data);

      // Key numbers to stderr so they're visible in the terminal
      const heroH   = data.hero?.rect?.height   ?? 'N/A';
      const videoH  = data.video?.rect?.height  ?? 'N/A';
      const imgH    = data.posterImg?.rect?.height ?? 'N/A';
      const videoCS = data.video?.computed ?? {};
      process.stderr.write(
        `\n[${vp.name}] hero.height=${heroH}  video.height=${videoH}  img.height=${imgH}\n` +
        `         video computed: height=${videoCS.height}  maxHeight=${videoCS.maxHeight}  objectFit=${videoCS.objectFit}  position=${videoCS.position}\n`
      );
    } catch (err) {
      allResults.push({ viewport: vp.name, error: String(err) });
      process.stderr.write(`\n[${vp.name}] ERROR: ${err}\n`);
    }

    await context.close();
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(allResults, null, 2));
  console.log(OUT_FILE);
  await browser.close();
})();

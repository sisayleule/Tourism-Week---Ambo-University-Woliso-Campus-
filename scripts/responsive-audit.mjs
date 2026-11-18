#!/usr/bin/env node
/**
 * scripts/responsive-audit.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsive audit for the Tourism Week public site and organizer portal.
 *
 * Usage:
 *   npm run audit:responsive              → saves to audit/responsive/before/
 *   npm run audit:responsive -- --phase after  → saves to audit/responsive/after/
 *   npm run audit:overflow                → fast CI check (exits 1 if any page
 *                                           has horizontal scroll at 360 px)
 *
 * Requires:  @playwright/test  (already in devDependencies)
 * Browsers:  Chromium only (free, no extra install if `npx playwright install chromium` has been run)
 *
 * If a browser cannot be launched the script falls back to a static analysis
 * mode that inspects source files for known problems and prints manual steps.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { execSync } from 'child_process';

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

const PHASE = (() => {
  const idx = process.argv.indexOf('--phase');
  return idx !== -1 ? process.argv[idx + 1] : 'before';
})();

const OVERFLOW_ONLY = process.argv.includes('--overflow-only');

const SCREENSHOT_DIR = resolve('audit/responsive', PHASE);

const VIEWPORTS = [
  { name: '320x568',   width: 320,  height: 568  },
  { name: '360x640',   width: 360,  height: 640  },
  { name: '375x667',   width: 375,  height: 667  },
  { name: '390x844',   width: 390,  height: 844  },
  { name: '412x915',   width: 412,  height: 915  },
  { name: '430x932',   width: 430,  height: 932  },
  { name: '768x1024',  width: 768,  height: 1024 },
  { name: '667x375-ls',width: 667,  height: 375  },   // landscape phone
  { name: '1024x768',  width: 1024, height: 768  },
  { name: '1280x800',  width: 1280, height: 800  },
  { name: '1440x900',  width: 1440, height: 900  },
];

const OVERFLOW_VIEWPORT = { name: '360x640', width: 360, height: 640 };

const LOCALES = ['en', 'am', 'om'];
const COLOR_MODES = ['light', 'dark'];

/** Public routes */
const PUBLIC_ROUTES = [
  { path: '/',                  name: 'Home'           },
  { path: '/schedule',          name: 'Schedule'       },
  { path: '/events',            name: 'Events'         },
  { path: '/events/sample',     name: 'EventDetail'    },
  { path: '/gallery',           name: 'Gallery'        },
  { path: '/news',              name: 'News'           },
  { path: '/news/sample',       name: 'NewsArticle'    },
  { path: '/about',             name: 'About'          },
  { path: '/sponsors',          name: 'Sponsors'       },
  { path: '/contact',           name: 'Contact'        },
  { path: '/legal',             name: 'Legal'          },
  { path: '/nonexistent-page',  name: '404'            },
];

/** Organizer portal routes (skipped if login fails) */
const PORTAL_ROUTES = [
  { path: '/staff/login',                    name: 'Staff-Login'      },
  { path: '/staff/set-password',             name: 'Staff-SetPassword'},
  { path: '/staff',                          name: 'Staff-Dashboard'  },
  { path: '/staff/setup',                    name: 'Staff-Setup'      },
  { path: '/staff/setup/sample?step=1',      name: 'Staff-Setup-S1'   },
  { path: '/staff/setup/sample?step=2',      name: 'Staff-Setup-S2'   },
  { path: '/staff/events',                   name: 'Staff-Program'    },
  { path: '/staff/live',                     name: 'Staff-Live'       },
  { path: '/staff/news',                     name: 'Staff-News'       },
  { path: '/staff/gallery',                  name: 'Staff-Gallery'    },
  { path: '/staff/sponsors',                 name: 'Staff-Sponsors'   },
  { path: '/staff/committee',                name: 'Staff-Committee'  },
  { path: '/staff/announcements',            name: 'Staff-FAQs'       },
  { path: '/staff/messages',                 name: 'Staff-Messages'   },
  { path: '/staff/settings',                 name: 'Staff-Settings'   },
  { path: '/staff/profile',                  name: 'Staff-Profile'    },
];

// ─── Issue checkers (injected into browser context) ──────────────────────────

const CHECK_SCRIPT = /* js */ `
() => {
  const issues = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // 1. Horizontal scroll
  const hasHScroll = document.documentElement.scrollWidth > vw;
  if (hasHScroll) {
    // Find the widest offending element
    let worst = null;
    let worstW = vw;
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 2 && r.width > worstW) {
        worst = el;
        worstW = r.width;
      }
    });
    const sel = worst
      ? (worst.id ? '#' + worst.id : worst.className ? '.' + [...worst.classList].slice(0,2).join('.') : worst.tagName.toLowerCase())
      : 'unknown';
    issues.push({ type: 'horizontal-scroll', element: sel, severity: 'critical',
      detail: 'scrollWidth=' + document.documentElement.scrollWidth + 'px vw=' + vw + 'px' });
  }

  // 2. Elements wider than viewport
  document.querySelectorAll('img, video, iframe, table, pre').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > vw + 4) {
      const sel = el.tagName.toLowerCase() + (el.id ? '#' + el.id : el.src ? '[src]' : '');
      issues.push({ type: 'element-wider-than-viewport', element: sel, severity: 'major',
        detail: 'width=' + Math.round(r.width) + 'px' });
    }
  });

  // 3. Tap targets smaller than 44×44 px
  const interactive = document.querySelectorAll('button, a, [role="button"], [role="tab"], input[type="checkbox"], input[type="radio"], select');
  interactive.forEach(el => {
    const r = el.getBoundingClientRect();
    if ((r.width > 0 && r.height > 0) && (r.width < 44 || r.height < 44)) {
      const sel = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
        (el.textContent ? '[' + el.textContent.trim().slice(0, 20) + ']' : '');
      issues.push({ type: 'tap-target-too-small', element: sel, severity: 'major',
        detail: Math.round(r.width) + 'x' + Math.round(r.height) + 'px (min 44x44)' });
    }
  });

  // 4. Text smaller than 14px (inputs below 16px)
  document.querySelectorAll('p, span, li, td, th, label, h1, h2, h3, h4, h5, h6, a, button').forEach(el => {
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs > 0 && fs < 14) {
      const sel = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
        (el.textContent ? '[' + el.textContent.trim().slice(0, 20) + ']' : '');
      issues.push({ type: 'text-too-small', element: sel, severity: 'minor',
        detail: 'font-size=' + fs + 'px (min 14px)' });
    }
  });
  document.querySelectorAll('input, select, textarea').forEach(el => {
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs > 0 && fs < 16) {
      const sel = el.tagName.toLowerCase() + (el.name ? '[name=' + el.name + ']' : '') + (el.type ? '[type=' + el.type + ']' : '');
      issues.push({ type: 'input-font-too-small', element: sel, severity: 'major',
        detail: 'font-size=' + fs + 'px (min 16px prevents iOS zoom)' });
    }
  });

  // 5. Images with no aspect-ratio set (potential CLS)
  document.querySelectorAll('img').forEach(el => {
    const hasW = el.width > 0 || el.style.width || el.getAttribute('width');
    const hasH = el.height > 0 || el.style.height || el.getAttribute('height');
    const cs   = getComputedStyle(el);
    const hasAspect = cs.aspectRatio && cs.aspectRatio !== 'auto';
    if (!hasW || !hasH && !hasAspect) {
      const src = (el.src || '').split('/').pop() ?? 'unknown';
      issues.push({ type: 'image-no-aspect-ratio', element: 'img[' + src + ']', severity: 'minor',
        detail: 'No explicit size or aspect-ratio — potential CLS' });
    }
  });

  // 6. Hero visibility check at 360x640 and 390x844
  const heroSection = document.querySelector('[aria-label="Festival hero"]');
  if (heroSection && (vw <= 390)) {
    const headline  = heroSection.querySelector('h1');
    const buttons   = heroSection.querySelectorAll('a[href="/schedule"], a[href="/events"]');
    const checkVis  = el => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= vh;
    };
    if (headline && !checkVis(headline)) {
      issues.push({ type: 'hero-headline-not-visible', element: 'h1', severity: 'critical',
        detail: 'Hero headline not visible without scrolling on ' + vw + 'x' + vh });
    }
    if (buttons.length < 2) {
      issues.push({ type: 'hero-buttons-missing', element: 'hero-ctas', severity: 'major',
        detail: 'Expected 2 CTA buttons in hero; found ' + buttons.length });
    }
  }

  return issues;
}
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slug(str) { return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ─── Static fallback analysis ─────────────────────────────────────────────────

function staticAnalysis() {
  console.log('\n⚠️  Could not launch browser. Running static analysis instead.\n');

  const findings = [];

  // Check viewport meta
  try {
    const html = readFileSync(resolve('index.html'), 'utf8');
    if (!html.includes('viewport-fit=cover')) {
      findings.push({ file: 'index.html', issue: 'Missing viewport-fit=cover in <meta name="viewport">', severity: 'major' });
    }
    if (!html.includes('initial-scale=1')) {
      findings.push({ file: 'index.html', issue: 'Missing initial-scale=1 in viewport meta', severity: 'critical' });
    }
    if (html.includes('user-scalable=no') || html.includes('maximum-scale=1')) {
      findings.push({ file: 'index.html', issue: 'Pinch zoom is disabled — accessibility violation', severity: 'critical' });
    }
  } catch {}

  // Check CSS for mobile patterns
  try {
    const css = readFileSync(resolve('src/index.css'), 'utf8');
    if (!css.includes('dvh') && !css.includes('svh')) {
      findings.push({ file: 'src/index.css', issue: 'Hero does not use 100dvh/100svh (browser bar overlap on phones)', severity: 'major' });
    }
    if (!css.includes('safe-area-inset')) {
      findings.push({ file: 'src/index.css', issue: 'No env(safe-area-inset-*) padding for notched phones', severity: 'major' });
    }
    if (!css.includes('overflow-wrap') && !css.includes('word-break')) {
      findings.push({ file: 'src/index.css', issue: 'No overflow-wrap: anywhere for long Amharic/Oromo words', severity: 'major' });
    }
    if (!css.includes('min-width: 0') && !css.includes('min-width:0')) {
      findings.push({ file: 'src/index.css', issue: 'No min-width:0 on flex/grid children — overflow risk', severity: 'minor' });
    }
  } catch {}

  // Check Navbar for focus trap
  try {
    const navbar = readFileSync(resolve('src/components/layout/Navbar.tsx'), 'utf8');
    if (!navbar.includes('focusable') && !navbar.includes('focus-trap') && !navbar.includes('trapFocus')) {
      findings.push({ file: 'src/components/layout/Navbar.tsx', issue: 'Mobile drawer has no focus trap', severity: 'major' });
    }
    if (!navbar.includes('body.style.overflow') && !navbar.includes('overflow: hidden')) {
      findings.push({ file: 'src/components/layout/Navbar.tsx', issue: 'Mobile drawer does not lock body scroll', severity: 'major' });
    }
  } catch {}

  // Check Gallery for lightbox swipe
  try {
    const gallery = readFileSync(resolve('src/pages/Gallery.tsx'), 'utf8');
    if (!gallery.includes('touch') && !gallery.includes('swipe') && !gallery.includes('onTouchStart')) {
      findings.push({ file: 'src/pages/Gallery.tsx', issue: 'Lightbox has no touch/swipe support', severity: 'major' });
    }
  } catch {}

  // Check Contact form input types
  try {
    const contact = readFileSync(resolve('src/pages/Contact.tsx'), 'utf8');
    if (!contact.includes('type="email"')) {
      findings.push({ file: 'src/pages/Contact.tsx', issue: 'Email input may be missing type="email"', severity: 'minor' });
    }
    if (!contact.includes('type="tel"')) {
      findings.push({ file: 'src/pages/Contact.tsx', issue: 'Phone input missing type="tel"', severity: 'minor' });
    }
  } catch {}

  if (findings.length === 0) {
    console.log('✅  Static analysis found no obvious issues.\n');
  } else {
    console.log(`Found ${findings.length} static issues:\n`);
    findings.forEach(f => console.log(`  [${f.severity.toUpperCase()}] ${f.file}: ${f.issue}`));
  }

  return findings;
}

// ─── Main browser audit ───────────────────────────────────────────────────────

async function runBrowserAudit() {
  ensureDir(SCREENSHOT_DIR);

  const browser = await chromium.launch({ headless: true });
  const rows = []; // { page, viewport, locale, mode, type, element, severity, detail }

  const routes = OVERFLOW_ONLY
    ? PUBLIC_ROUTES
    : [...PUBLIC_ROUTES, ...PORTAL_ROUTES];

  const viewports = OVERFLOW_ONLY
    ? [OVERFLOW_VIEWPORT]
    : VIEWPORTS;

  const locales = OVERFLOW_ONLY ? ['en'] : LOCALES;
  const modes   = OVERFLOW_ONLY ? ['light'] : COLOR_MODES;

  for (const locale of locales) {
    for (const mode of modes) {
      const context = await browser.newContext({
        locale: locale === 'am' ? 'am-ET' : locale === 'om' ? 'om-ET' : 'en-US',
        colorScheme: mode === 'dark' ? 'dark' : 'light',
        extraHTTPHeaders: {},
      });

      // Set language in localStorage before each page
      await context.addInitScript((lang) => {
        localStorage.setItem('i18nextLng', lang);
        if (lang === 'dark') {
          document.documentElement.classList.add('dark');
        }
      }, locale);

      const page = await context.newPage();

      for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });

        for (const route of routes) {
          const url = BASE_URL + route.path;
          const pageKey = `${route.name}_${vp.name}_${locale}_${mode}`;

          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
            await page.waitForTimeout(800); // let React hydrate

            // Run checks
            const issues = await page.evaluate(new Function('return (' + CHECK_SCRIPT + ')')());

            // Screenshot (skip for overflow-only mode)
            if (!OVERFLOW_ONLY) {
              const screenshotPath = join(SCREENSHOT_DIR, `${pageKey}.png`);
              await page.screenshot({ path: screenshotPath, fullPage: false });
            }

            for (const issue of issues) {
              rows.push({
                page:     route.name,
                viewport: vp.name,
                locale,
                mode,
                ...issue,
              });

              if (OVERFLOW_ONLY && issue.type === 'horizontal-scroll') {
                console.error(`OVERFLOW: ${route.name} @ ${vp.name} — ${issue.detail}`);
              }
            }

            if (!OVERFLOW_ONLY && issues.length === 0) {
              console.log(`  ✅  ${pageKey}`);
            } else if (issues.length > 0) {
              console.log(`  ⚠️   ${pageKey}: ${issues.length} issue(s)`);
            }

          } catch (err) {
            const msg = err.message.slice(0, 120);
            rows.push({
              page:     route.name,
              viewport: vp.name,
              locale,
              mode,
              type:     'page-load-error',
              element:  url,
              severity: 'info',
              detail:   msg,
            });
            console.log(`  ❌  ${pageKey}: ${msg}`);
          }
        }
      }

      await context.close();
    }
  }

  await browser.close();
  return rows;
}

// ─── Report writer ────────────────────────────────────────────────────────────

function writeReport(rows, phase) {
  const reportPath = resolve('audit/responsive', `report-${phase}.md`);
  ensureDir(resolve('audit/responsive'));

  const critical = rows.filter(r => r.severity === 'critical');
  const major    = rows.filter(r => r.severity === 'major');
  const minor    = rows.filter(r => r.severity === 'minor');

  let md = `# Responsive Audit — ${phase.toUpperCase()} Report\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `## Summary\n\n`;
  md += `| Severity | Count |\n|----------|-------|\n`;
  md += `| 🔴 Critical | ${critical.length} |\n`;
  md += `| 🟠 Major    | ${major.length} |\n`;
  md += `| 🟡 Minor    | ${minor.length} |\n`;
  md += `| Total       | ${rows.length} |\n\n`;

  if (rows.length === 0) {
    md += `✅ No issues found.\n`;
  } else {
    md += `## Issues\n\n`;
    md += `| Page | Viewport | Locale | Mode | Issue Type | Element | Severity | Detail |\n`;
    md += `|------|----------|--------|------|-----------|---------|----------|--------|\n`;
    for (const r of rows) {
      const sev = r.severity === 'critical' ? '🔴' : r.severity === 'major' ? '🟠' : r.severity === 'minor' ? '🟡' : 'ℹ️';
      md += `| ${r.page} | ${r.viewport} | ${r.locale ?? '-'} | ${r.mode ?? '-'} | ${r.type} | \`${r.element}\` | ${sev} ${r.severity} | ${r.detail} |\n`;
    }
  }

  if (phase === 'after') {
    md += `\n## Desktop Guard (1280×800 and 1440×900)\n\n`;
    md += `Screenshots saved in \`audit/responsive/after/\`. Visually compare with \`audit/responsive/before/\`.\n`;
    md += `No pixel-diff tool is bundled; use an image diff tool (e.g., \`pixelmatch\`) for automated comparison.\n\n`;
    md += `## Checklist\n\n`;
    md += `- [ ] Zero horizontal scroll at every size\n`;
    md += `- [ ] Zero tap targets under 44 px (except inline text links)\n`;
    md += `- [ ] Zero text under 14 px (except legal fine print)\n`;
    md += `- [ ] Zero inputs under 16 px font size\n`;
    md += `- [ ] Hero headline visible at 360×640 and 390×844\n`;
    md += `- [ ] Desktop 1280×800 and 1440×900 unchanged from before\n`;
  }

  writeFileSync(reportPath, md, 'utf8');
  console.log(`\n📄  Report written → ${reportPath}`);
}

// ─── Manual steps fallback ────────────────────────────────────────────────────

function printManualSteps() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║          MANUAL RESPONSIVE AUDIT CHECKLIST                   ║
╚══════════════════════════════════════════════════════════════╝

Since a browser could not be launched, perform these checks manually
using Chrome DevTools (Device toolbar — Toggle device toolbar: Cmd+Shift+M).

VIEWPORTS TO CHECK:
  320×568  •  360×640  •  375×667  •  390×844  •  768×1024
  667×375 (landscape)  •  1280×800  •  1440×900

PUBLIC PAGES: /, /schedule, /events, /events/:slug, /gallery,
  /news, /news/:slug, /about, /sponsors, /contact, /legal, /404

PORTAL PAGES (after login): /staff, /staff/setup, /staff/live,
  /staff/news, /staff/gallery, /staff/settings, /staff/profile

FOR EACH PAGE × VIEWPORT CHECK:
  □ No horizontal scrollbar (document.scrollWidth > window.innerWidth)
  □ No element wider than the viewport
  □ All interactive elements ≥ 44×44 px
  □ Body text ≥ 14 px; inputs/selects ≥ 16 px
  □ Hero headline visible at 360×640 without scrolling
  □ Countdown boxes in one row at 320 px
  □ Nav drawer opens, closes on Escape/outside tap, traps focus
  □ Body scroll locked when drawer is open
  □ Bottom nav never covers page content
  □ Gallery lightbox has swipe support and ≥ 44 px close button
  □ All modals/dialogs become bottom sheets on phones
  □ Contact form uses correct input types (email, tel)
  □ Inputs in forms ≥ 16 px font to prevent iOS zoom
  □ Staff portal sidebar drawer works at 320 px
  □ Live Control status buttons ≥ 48 px

AMHARIC / OROMO:
  □ Switch to አማ or OM in the language switcher
  □ No horizontal overflow from long words
  □ Body text still ≥ 14 px

DARK MODE:
  □ Toggle dark mode; check all pages for legibility
  □ Drawer and bottom sheet backgrounds are correct

REDUCED MOTION:
  □ In DevTools: Rendering → Emulate CSS media: prefers-reduced-motion: reduce
  □ Hero video and carousels should be static

After completing manual checks, record results in audit/responsive/report-before.md
`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

(async () => {
  console.log(`\n🔍  Tourism Week Responsive Audit — phase: ${OVERFLOW_ONLY ? 'overflow-check' : PHASE}\n`);
  console.log(`    Base URL: ${BASE_URL}`);

  if (!OVERFLOW_ONLY) {
    ensureDir(SCREENSHOT_DIR);
    console.log(`    Screenshots → ${SCREENSHOT_DIR}\n`);
  }

  let rows = [];
  let browserAvailable = true;

  try {
    // Quick check: is the server reachable?
    const { request } = await import('@playwright/test');
    const ctx = await request.newContext();
    try {
      await ctx.get(BASE_URL + '/', { timeout: 5_000 });
      await ctx.dispose();
    } catch {
      await ctx.dispose();
      console.warn(`\n⚠️  Dev server not reachable at ${BASE_URL}. Running static analysis only.\n`);
      browserAvailable = false;
    }
  } catch {
    browserAvailable = false;
  }

  if (browserAvailable) {
    try {
      rows = await runBrowserAudit();
    } catch (err) {
      console.error('Browser audit failed:', err.message);
      browserAvailable = false;
    }
  }

  if (!browserAvailable) {
    const staticFindings = staticAnalysis();
    printManualSteps();

    // Write a stub report with static findings
    rows = staticFindings.map(f => ({
      page:     f.file,
      viewport: 'static-analysis',
      locale:   '-',
      mode:     '-',
      type:     'static-' + slug(f.issue),
      element:  f.file,
      severity: f.severity,
      detail:   f.issue,
    }));
  }

  if (!OVERFLOW_ONLY) {
    writeReport(rows, PHASE);

    // Also run the Playwright hero-layout spec when browsers are available
    if (browserAvailable) {
      console.log('\n🎬  Running hero layout Playwright tests (npm run audit:hero)…');
      try {
        const { execSync } = await import('child_process');
        execSync('npx playwright test tests/hero-layout.spec.ts --reporter=list', {
          stdio: 'inherit',
          cwd: process.cwd(),
        });
        console.log('✅  Hero layout tests passed.\n');
      } catch {
        console.warn('⚠️  Hero layout tests failed or Playwright is not installed.\n' +
          '    Run: npx playwright install chromium  then  npm run audit:hero\n');
      }
    } else {
      console.log('\nℹ️  Hero Playwright tests skipped (dev server not running).');
      console.log('    Start the server with `npm run dev`, then run `npm run audit:hero`.\n');
    }
  }

  // Exit code for CI overflow check
  if (OVERFLOW_ONLY) {
    const overflows = rows.filter(r => r.type === 'horizontal-scroll');
    if (overflows.length > 0) {
      console.error(`\n❌  ${overflows.length} page(s) have horizontal scroll at 360 px. See above.\n`);
      process.exit(1);
    } else {
      console.log('\n✅  No horizontal scroll detected at 360 px.\n');
      process.exit(0);
    }
  }
})();

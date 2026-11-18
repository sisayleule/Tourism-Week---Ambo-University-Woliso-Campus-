/**
 * seed-snapshot.ts — Generates src/data/generated/seed-snapshot.json from
 * the TypeScript seed data. Run once (npm run snapshot:seed) to create the
 * committed seed fallback that build-content.mjs uses when Supabase and the
 * last-good snapshot are both unavailable.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CURRENT_EDITION,
  SEED_EVENTS,
  SEED_NEWS,
  SEED_GALLERY,
  SEED_SPONSORS,
  SEED_COMMITTEE,
  SEED_FAQS,
  SEED_ANNOUNCEMENTS,
} from '../src/data/seedData';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'src', 'data', 'generated', 'seed-snapshot.json');

// Seed fallback must NOT include unverified sections: sponsors, committee,
// news, gallery and FAQs are empty so the UI hides those sections.
const snapshot = {
  generatedAt: new Date().toISOString(),
  source: 'seed',
  edition: { ...CURRENT_EDITION },
  events: [...SEED_EVENTS],
  news: [],
  gallery: [],
  sponsors: [],
  committee: [],
  faqs: [],
  announcements: [],
  siteSettings: null,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(snapshot, null, 2), 'utf-8');
console.log(`  ✓ Seed snapshot written to src/data/generated/seed-snapshot.json`);
console.log(`    ${snapshot.events.length} events, edition #${snapshot.edition.number}`);

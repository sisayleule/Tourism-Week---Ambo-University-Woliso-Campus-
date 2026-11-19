import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let fail = 0

function check(label, pass) {
  if (pass) console.log(`  ✓ ${label}`)
  else      { console.log(`  ✗ FAIL: ${label}`); fail++ }
}
function info(label) { console.log(`    ${label}`) }

console.log('\n=== Hero video/poster verification ===\n')

// 1. New versioned video files (hero-720-v2.mp4, hero-480-v2.mp4)
const src720 = join(ROOT, 'public/videos/hero-720-v2.mp4')
const src480 = join(ROOT, 'public/videos/hero-480-v2.mp4')
check('public/videos/hero-720-v2.mp4 exists (desktop)', existsSync(src720))
if (existsSync(src720)) info(`size: ${Math.round(statSync(src720).size/1024/1024 * 100)/100} MB`)
check('public/videos/hero-480-v2.mp4 exists (mobile)', existsSync(src480))
if (existsSync(src480)) info(`size: ${Math.round(statSync(src480).size/1024/1024 * 100)/100} MB`)

// 2. Dist video files
const dst720 = join(ROOT, 'dist/videos/hero-720-v2.mp4')
const dst480 = join(ROOT, 'dist/videos/hero-480-v2.mp4')
check('dist/videos/hero-720-v2.mp4 exists (Vite copies public/ → dist/)', existsSync(dst720))
check('dist/videos/hero-480-v2.mp4 exists (Vite copies public/ → dist/)', existsSync(dst480))

// 3. Scan largest JS bundle
const assetsDir = join(ROOT, 'dist/assets')
const bundles = existsSync(assetsDir)
  ? readdirSync(assetsDir)
      .filter(f => f.endsWith('.js') && statSync(join(assetsDir,f)).size > 500*1024)
      .map(f => readFileSync(join(assetsDir,f), 'utf-8'))
  : []

const bundleText = bundles.join('')
check('Bundle references /videos/hero-720-v2.mp4', bundleText.includes('/videos/hero-720-v2.mp4'))
check('Bundle references /videos/hero-480-v2.mp4', bundleText.includes('/videos/hero-480-v2.mp4'))
const mainBundle = bundles.find(b => b.includes('/videos/hero-720-v2.mp4')) ?? ''
check('Main bundle has NO /public/videos',         !mainBundle.includes('/public/videos'))
check('Main bundle has NO /src/assets string',     !mainBundle.includes("'/src/assets"))
check('Main bundle has NO old /videos/video.mp4',  !mainBundle.includes("'/videos/video.mp4'"))

// 4. Vite-hashed poster JPG
const jpgs = existsSync(assetsDir)
  ? readdirSync(assetsDir).filter(f => f.endsWith('.jpg'))
  : []
check('Vite-hashed poster .jpg in dist/assets/', jpgs.length > 0)
jpgs.forEach(j => info(`/assets/${j}  ${Math.round(statSync(join(assetsDir,j)).size/1024)}KB`))

// 5. heroMedia.ts source check
const heroMedia = join(ROOT, 'src/lib/heroMedia.ts')
check('src/lib/heroMedia.ts exists', existsSync(heroMedia))
if (existsSync(heroMedia)) {
  const hm = readFileSync(heroMedia, 'utf-8')
  check("heroMedia.ts: exports DEFAULT_HERO_720 = '/videos/hero-720-v2.mp4'", hm.includes('/videos/hero-720-v2.mp4'))
  check("heroMedia.ts: exports DEFAULT_HERO_480 = '/videos/hero-480-v2.mp4'", hm.includes('/videos/hero-480-v2.mp4'))
}

// 6. Home.tsx source check
const home = readFileSync(join(ROOT, 'src/pages/Home.tsx'), 'utf-8')
check("Home.tsx: imports from '../lib/heroMedia'",        home.includes("from '../lib/heroMedia'"))
check("Home.tsx: imports HeroVideo component",            home.includes("from '../components/hero/HeroVideo'"))
check("Home.tsx: imports HeroCountdown component",        home.includes("from '../components/hero/HeroCountdown'"))
check("Home.tsx: NO old DEFAULT_HERO_VIDEO constant",    !home.includes("DEFAULT_HERO_VIDEO"))
check("Home.tsx: NO old '/videos/video.mp4' literal",    !home.includes("'/videos/video.mp4'"))
check("Home.tsx: NO '/public/videos' string",            !home.includes("'/public/videos"))
check("Home.tsx: NO broken /videos/hero.webm source",    !home.includes('/videos/hero.webm'))
check("Home.tsx: imports wonchiImg from ../assets/images/",  home.includes("from '../assets/images/wonchi"))
check("Home.tsx: imports coffeeImg from ../assets/images/",  home.includes("from '../assets/images/ethiopian_coffee"))

console.log(fail === 0 ? '\nAll checks passed ✓\n' : `\n${fail} check(s) FAILED ✗\n`)
process.exit(fail > 0 ? 1 : 0)

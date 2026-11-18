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

// 1. Source video
const srcVideo = join(ROOT, 'public/videos/video.mp4')
check('public/videos/video.mp4 exists', existsSync(srcVideo))
if (existsSync(srcVideo)) info(`size: ${Math.round(statSync(srcVideo).size/1024/1024)} MB`)

// 2. Dist video
const dstVideo = join(ROOT, 'dist/videos/video.mp4')
check('dist/videos/video.mp4 exists (Vite copies public/ → dist/)', existsSync(dstVideo))

// 3. Scan largest JS bundle
const assetsDir = join(ROOT, 'dist/assets')
const bundles = existsSync(assetsDir)
  ? readdirSync(assetsDir)
      .filter(f => f.endsWith('.js') && statSync(join(assetsDir,f)).size > 500*1024)
      .map(f => readFileSync(join(assetsDir,f), 'utf-8'))
  : []

const bundleText = bundles.join('')
check('Bundle references /videos/video.mp4',  bundleText.includes('/videos/video.mp4'))
// Note: /videos/hero.mp4 appears in StaffRouter bundle as a placeholder string
// in Step5MoreInfo.tsx — that is correct UI copy, not a broken video src.
// We only need the main app bundle to use the correct path.
const mainBundle = bundles.find(b => b.includes('/videos/video.mp4')) ?? ''
check('Main bundle has NO /public/videos',         !mainBundle.includes('/public/videos'))
check('Main bundle has NO /src/assets string',     !mainBundle.includes("'/src/assets"))

// 4. Vite-hashed poster JPG
const jpgs = existsSync(assetsDir)
  ? readdirSync(assetsDir).filter(f => f.endsWith('.jpg'))
  : []
check('Vite-hashed poster .jpg in dist/assets/', jpgs.length > 0)
jpgs.forEach(j => info(`/assets/${j}  ${Math.round(statSync(join(assetsDir,j)).size/1024)}KB`))

// 5. Home.tsx source check
const home = readFileSync(join(ROOT, 'src/pages/Home.tsx'), 'utf-8')
check("Home.tsx: DEFAULT_HERO_VIDEO = '/videos/video.mp4'", home.includes("'/videos/video.mp4'"))
check("Home.tsx: NO '/public/videos' string",               !home.includes("'/public/videos"))
check("Home.tsx: NO '/src/assets/images' string path",     !home.includes("'/src/assets/images"))
check("Home.tsx: NO broken /videos/hero.webm source",      !home.includes('/videos/hero.webm'))
check("Home.tsx: imports heroPosterImg from ../assets/images/", home.includes('from \'../assets/images/lalibela'))
check("Home.tsx: imports wonchiImg from ../assets/images/",     home.includes('from \'../assets/images/wonchi'))
check("Home.tsx: imports coffeeImg from ../assets/images/",     home.includes('from \'../assets/images/ethiopian_coffee'))

console.log(fail === 0 ? '\nAll checks passed ✓\n' : `\n${fail} check(s) FAILED ✗\n`)
process.exit(fail > 0 ? 1 : 0)

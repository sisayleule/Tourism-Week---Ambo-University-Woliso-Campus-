const AISTUDIO_RE = /^\/assets\/aistudio\/(image_[0-9a-f]+)\.png$/i
const path = '/assets/aistudio/image_fe8a90e0.png'
console.log('match:', AISTUDIO_RE.exec(path))
// Also test the full resolveShareImageUrl logic
function resolveShareImageUrl(p, siteUrl) {
  if (!p) return `${siteUrl}/assets/share/default.jpg`
  const m = AISTUDIO_RE.exec(p)
  if (m) return `${siteUrl}/assets/share/${m[1]}.jpg`
  if (p.startsWith('https://') || p.startsWith('http://')) return p
  return `${siteUrl}${p}`
}
console.log('resolved:', resolveShareImageUrl(path, 'https://example.com'))

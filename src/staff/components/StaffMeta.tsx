/**
 * StaffMeta.tsx — Injects <meta name="robots" content="noindex,nofollow">
 * into the document <head> for every staff page.
 *
 * This is a client-side complement to the server-level X-Robots-Tag header
 * set in vercel.json.  Both are needed: the header covers all HTTP responses,
 * the meta tag covers cached/CSR renders.
 */

import { useEffect } from 'react'

export function StaffMeta() {
  useEffect(() => {
    // Inject (or update) the robots meta tag
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'robots'
      document.head.appendChild(meta)
    }
    const prev = meta.content
    meta.content = 'noindex,nofollow'

    return () => {
      // Restore previous value when navigating back to a public page
      if (meta) meta.content = prev
    }
  }, [])

  return null
}

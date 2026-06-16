import { useEffect, useState } from 'react'

/**
 * Tracks whether the viewport is below the `md` breakpoint (768px). Used to
 * switch between desktop (sidebar / popovers / inline chips) and mobile
 * (bottom tabs / bottom sheets / drawers) presentations (issue #47).
 */
export function useIsMobile(breakpoint = 768): boolean {
  const query = `(max-width: ${breakpoint - 1}px)`
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    setIsMobile(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return isMobile
}

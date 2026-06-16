import { useCallback, useEffect, useState } from 'react'

export interface UseFullscreen {
  isFullscreen: boolean
  enter: () => void
  exit: () => void
  toggle: () => void
}

/**
 * Thin wrapper over the Fullscreen API scoped to a container element
 * (issue #46). Keeps `isFullscreen` in sync with `fullscreenchange` so the UI
 * reflects fullscreen toggled by the browser (e.g. Esc).
 */
export function useFullscreen(ref: React.RefObject<HTMLElement>): UseFullscreen {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const enter = useCallback(() => {
    const el = ref.current
    if (el && !document.fullscreenElement) {
      void el.requestFullscreen?.().catch(() => undefined)
    }
  }, [ref])

  const exit = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined)
    }
  }, [])

  const toggle = useCallback(() => {
    if (document.fullscreenElement) exit()
    else enter()
  }, [enter, exit])

  return { isFullscreen, enter, exit, toggle }
}

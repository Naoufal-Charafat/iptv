import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseOverlayVisibilityOptions {
  /** Inactivity timeout before hiding, in ms. Default 3500. */
  timeout?: number
  /** Start visible. Default true. */
  initiallyVisible?: boolean
  /** When true, never auto-hide (e.g. a menu/sheet is open). */
  keepVisible?: boolean
}

export interface OverlayVisibility {
  /** Whether overlays should currently be shown. */
  visible: boolean
  /** Call on pointer/touch/keyboard activity to reveal + restart the timer. */
  show: () => void
  /** Hide immediately. */
  hide: () => void
}

/**
 * Controls player-overlay visibility (issue #44): overlays appear on activity
 * (mouse move / touch / keyboard) and auto-hide after a period of inactivity.
 * They stay visible while `keepVisible` is set (e.g. a control menu is open) and
 * are always reachable by keyboard (any key reveals them).
 */
export function useOverlayVisibility(options: UseOverlayVisibilityOptions = {}): OverlayVisibility {
  const { timeout = 3500, initiallyVisible = true, keepVisible = false } = options
  const [visible, setVisible] = useState(initiallyVisible)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const show = useCallback(() => {
    setVisible(true)
    clear()
    if (keepVisible) return
    timerRef.current = setTimeout(() => setVisible(false), timeout)
  }, [clear, keepVisible, timeout])

  const hide = useCallback(() => {
    clear()
    setVisible(false)
  }, [clear])

  // While `keepVisible` is true, stay shown and cancel any pending hide.
  useEffect(() => {
    if (keepVisible) {
      clear()
      setVisible(true)
    } else {
      show()
    }
    return clear
  }, [keepVisible, clear, show])

  return { visible, show, hide }
}

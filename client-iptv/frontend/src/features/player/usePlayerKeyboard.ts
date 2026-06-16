import { useEffect } from 'react'

export interface PlayerKeyboardHandlers {
  togglePlay: () => void
  toggleFullscreen: () => void
  toggleMuted: () => void
  /** Nudge volume by +/- a step (0..1). */
  adjustVolume?: (delta: number) => void
  /** Any activity should reveal the overlays. */
  onActivity?: () => void
}

/**
 * Global keyboard shortcuts for the player (issue #46):
 *   Space / K  -> play/pause
 *   F          -> toggle fullscreen
 *   M          -> mute/unmute
 *   ArrowUp/Down -> volume
 * Ignores keystrokes while typing in inputs. Esc is left to the browser /
 * Fullscreen API.
 */
export function usePlayerKeyboard(handlers: PlayerKeyboardHandlers): void {
  const { togglePlay, toggleFullscreen, toggleMuted, adjustVolume, onActivity } = handlers

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return
      }

      switch (event.key) {
        case ' ':
        case 'k':
        case 'K':
          event.preventDefault()
          togglePlay()
          break
        case 'f':
        case 'F':
          event.preventDefault()
          toggleFullscreen()
          break
        case 'm':
        case 'M':
          event.preventDefault()
          toggleMuted()
          break
        case 'ArrowUp':
          event.preventDefault()
          adjustVolume?.(0.1)
          break
        case 'ArrowDown':
          event.preventDefault()
          adjustVolume?.(-0.1)
          break
        default:
          break
      }

      onActivity?.()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePlay, toggleFullscreen, toggleMuted, adjustVolume, onActivity])
}

import { useNavigate } from 'react-router-dom'

import { MaterialIcon } from '@/components/icons/MaterialIcon'
import { cn } from '@/lib/utils'

export interface PlayerTopBarProps {
  /** Channel name (brand shows generic when absent). */
  channelName?: string
  /** Whether overlays are currently visible (drives fade + pointer events). */
  visible: boolean
  /** Toggle fullscreen (settings shortcut is wired by the page). */
  onToggleFullscreen?: () => void
  className?: string
}

/**
 * Top overlay bar of the player (issue #44): back button (history/Home), brand
 * "CineView IPTV / LIVE TV", and settings/help shortcuts. Fades with the rest
 * of the overlays on inactivity but stays keyboard-reachable.
 */
export function PlayerTopBar({
  channelName,
  visible,
  onToggleFullscreen,
  className
}: PlayerTopBarProps) {
  const navigate = useNavigate()

  const goBack = () => {
    // Prefer history; fall back to Home if there is nowhere to go back to.
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  return (
    <header
      className={cn(
        'pt-safe pl-safe pr-safe absolute inset-x-0 top-0 z-30 flex items-center gap-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent px-4 py-4 transition-opacity duration-300 md:gap-4 md:px-8 md:py-6',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
        className
      )}
    >
      <button
        type="button"
        onClick={goBack}
        aria-label="Volver"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/40 text-on-surface backdrop-blur-sm transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MaterialIcon name="arrow_back" size={24} />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-body-lg font-extrabold tracking-tight text-primary md:text-headline-md">
          CineView IPTV
        </h1>
        <p className="flex items-center gap-2 truncate text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary-container" />
          <span className="truncate">LIVE TV{channelName ? ` · ${channelName}` : ''}</span>
        </p>
      </div>

      <button
        type="button"
        onClick={onToggleFullscreen}
        aria-label="Pantalla completa"
        className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-black/40 hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MaterialIcon name="settings" size={22} />
      </button>
      <button
        type="button"
        aria-label="Ayuda"
        className="hidden h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-black/40 hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
      >
        <MaterialIcon name="help" size={22} />
      </button>
    </header>
  )
}

import * as React from 'react'

import { MaterialIcon } from '@/components/icons/MaterialIcon'
import { useFavorites } from '@/features/favorites/useFavorites'
import { cn } from '@/lib/utils'
import type { ChannelSummary } from '@client-iptv/shared'

export interface FavoriteButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> {
  /** Channel to favorite/unfavorite. */
  channel: ChannelSummary
  /** Visual size. */
  size?: 'sm' | 'md' | 'lg'
  /** Render a translucent circular backdrop (for use over imagery). */
  withBackdrop?: boolean
}

const dims = {
  sm: { box: 'h-8 w-8', glyph: 18 },
  md: { box: 'h-10 w-10', glyph: 22 },
  lg: { box: 'h-12 w-12', glyph: 26 }
} as const

/**
 * Reusable favorite (heart) toggle. Reads/writes the shared favorites store, so
 * its active state stays in sync wherever it is rendered (cards, player bar,
 * favorites page).
 */
export const FavoriteButton = React.forwardRef<HTMLButtonElement, FavoriteButtonProps>(
  ({ channel, size = 'md', withBackdrop = true, className, ...props }, ref) => {
    const { isFavorite, toggleFavorite } = useFavorites()
    const active = isFavorite(channel.id)
    const { box, glyph } = dims[size]

    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={active}
        aria-label={
          active ? `Quitar ${channel.name} de favoritos` : `Añadir ${channel.name} a favoritos`
        }
        title={active ? 'Quitar de favoritos' : 'Añadir a favoritos'}
        onClick={event => {
          // Prevent activating a wrapping Link/card click.
          event.preventDefault()
          event.stopPropagation()
          toggleFavorite(channel)
        }}
        className={cn(
          'inline-flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          box,
          withBackdrop && 'bg-black/40 backdrop-blur-sm hover:bg-black/60',
          active ? 'text-primary-container' : 'text-white hover:text-primary',
          className
        )}
        {...props}
      >
        <MaterialIcon name="favorite" filled={active} size={glyph} />
      </button>
    )
  }
)
FavoriteButton.displayName = 'FavoriteButton'

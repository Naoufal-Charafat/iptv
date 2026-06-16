import { Link } from 'react-router-dom'

import { MaterialIcon } from '@/components/icons/MaterialIcon'
import { FavoriteButton } from '@/components/media/FavoriteButton'
import { cn } from '@/lib/utils'
import type { ChannelSummary } from '@client-iptv/shared'

export type MediaCardAspect = '16:9' | '2:3' | 'square'
export type MediaCardVariant = 'default' | 'compact' | 'hero'

export interface MediaCardProps {
  /** Channel data (the card never fetches by itself). */
  channel: ChannelSummary
  /** Thumbnail aspect ratio. */
  aspect?: MediaCardAspect
  /** Layout variant: default shelf card, dense `compact`, large `hero`/landscape. */
  variant?: MediaCardVariant
  /** Optional eyebrow label shown above the title (e.g. category). */
  eyebrow?: string
  /** Show the favorite (heart) button on hover/focus. Default true. */
  showFavorite?: boolean
  /** Override the link destination (defaults to the player route). */
  to?: string
  /** Click handler (used instead of a Link when provided). */
  onSelect?: (channel: ChannelSummary) => void
  className?: string
}

const aspectClass: Record<MediaCardAspect, string> = {
  '16:9': 'aspect-video',
  '2:3': 'aspect-[2/3]',
  square: 'aspect-square'
}

const widthClass: Record<MediaCardVariant, string> = {
  default: 'w-64',
  compact: 'w-40',
  hero: 'w-80'
}

/**
 * Reusable channel card per DESIGN.md > Media Cards and the Home mockup
 * carousels. 16px radius, top rim border, bottom gradient for title legibility,
 * LIVE/quality badges, logo fallback, and a hover state that scales up and
 * reveals a glassmorphic Play overlay (mirrors `.glass-card:hover`).
 */
export function MediaCard({
  channel,
  aspect = '16:9',
  variant = 'default',
  eyebrow,
  showFavorite = true,
  to,
  onSelect,
  className
}: MediaCardProps) {
  const href = to ?? `/reproductor/${encodeURIComponent(channel.id)}`

  const inner = (
    <>
      <div
        className={cn(
          'relative w-full overflow-hidden bg-surface-container-high',
          aspectClass[aspect]
        )}
      >
        {channel.logo ? (
          <img
            src={channel.logo}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-container-high to-surface-container">
            <MaterialIcon name="tv" size={40} className="text-on-surface-variant" />
          </div>
        )}

        {/* Bottom gradient for title legibility. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Badges (top-left). */}
        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          {channel.hasStream && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-container px-2 py-0.5 text-label-sm font-bold uppercase text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Live
            </span>
          )}
          {channel.quality && (
            <span className="rounded-full bg-black/60 px-2 py-0.5 text-label-sm font-semibold uppercase text-white backdrop-blur-sm">
              {channel.quality}
            </span>
          )}
        </div>

        {/* Favorite (top-right). */}
        {showFavorite && (
          <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <FavoriteButton channel={channel} size="sm" />
          </div>
        )}

        {/* Glass Play overlay revealed on hover/focus. */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md">
            <MaterialIcon name="play_arrow" filled size={32} className="text-white" />
          </span>
        </div>

        {/* Title overlaid on the gradient (default/hero). */}
        {variant !== 'compact' && (
          <div className="absolute inset-x-0 bottom-0 p-3">
            {eyebrow && (
              <p className="text-label-sm font-semibold uppercase tracking-wide text-primary">
                {eyebrow}
              </p>
            )}
            <p className="truncate text-body-md font-bold text-white">{channel.name}</p>
          </div>
        )}
      </div>

      {/* Compact metadata footer (square/list use). */}
      {variant === 'compact' && (
        <div className="p-2">
          <p className="truncate text-label-md text-on-surface">{channel.name}</p>
          <p className="text-label-sm uppercase text-on-surface-variant">{channel.country}</p>
        </div>
      )}
    </>
  )

  const classes = cn(
    'glass-card group block shrink-0 overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    widthClass[variant],
    className
  )

  if (onSelect) {
    return (
      <button type="button" onClick={() => onSelect(channel)} className={cn(classes, 'text-left')}>
        {inner}
      </button>
    )
  }

  return (
    <Link to={href} className={classes} aria-label={`Reproducir ${channel.name}`}>
      {inner}
    </Link>
  )
}

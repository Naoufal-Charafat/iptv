import { useRef } from 'react'
import { Link } from 'react-router-dom'

import { MaterialIcon } from '@/components/icons/MaterialIcon'
import { cn } from '@/lib/utils'
import type { Dimension } from '@client-iptv/shared'

/**
 * Per-dimension accent (icon color + glow tint), mirroring the Explore mockup
 * (`code.html`) where each card has its own hue.
 */
const ACCENTS: Record<Dimension, { icon: string; glow: string; border: string }> = {
  categories: {
    icon: 'text-primary',
    glow: 'bg-primary/10',
    border: 'group-hover:border-primary/30'
  },
  cities: {
    icon: 'text-tertiary',
    glow: 'bg-tertiary/10',
    border: 'group-hover:border-tertiary/30'
  },
  countries: {
    icon: 'text-secondary',
    glow: 'bg-secondary/10',
    border: 'group-hover:border-secondary/30'
  },
  languages: {
    icon: 'text-primary-container',
    glow: 'bg-primary-container/10',
    border: 'group-hover:border-primary-container/30'
  },
  regions: { icon: 'text-error', glow: 'bg-error/10', border: 'group-hover:border-error/30' },
  sources: {
    icon: 'text-tertiary-fixed',
    glow: 'bg-on-tertiary-fixed-variant/10',
    border: 'group-hover:border-on-tertiary-fixed-variant/30'
  },
  subdivisions: {
    icon: 'text-outline',
    glow: 'bg-outline/10',
    border: 'group-hover:border-outline/30'
  },
  raw: {
    icon: 'text-surface-tint',
    glow: 'bg-surface-tint/10',
    border: 'group-hover:border-surface-tint/30'
  }
}

export interface DimensionCardProps {
  dimension: Dimension
  name: string
  subtitle?: string
  /** Material Symbols icon name (falls back to a generic glyph). */
  icon?: string
}

/**
 * Glass card for a navigation dimension (issue #41). Links to
 * `/explorar/:dimension`, shows a colored icon + title + subtitle, and renders a
 * spotlight glow that follows the pointer on hover (matching the mockup script).
 */
export function DimensionCard({ dimension, name, subtitle, icon }: DimensionCardProps) {
  const cardRef = useRef<HTMLAnchorElement>(null)
  const accent = ACCENTS[dimension]

  const handleMove = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--spot-x', `${event.clientX - rect.left}px`)
    el.style.setProperty('--spot-y', `${event.clientY - rect.top}px`)
  }

  return (
    <Link
      ref={cardRef}
      to={`/explorar/${dimension}`}
      onMouseMove={handleMove}
      className="glass-card group relative flex h-36 flex-col overflow-hidden rounded-xl p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-48 sm:p-8"
    >
      {/* Pointer spotlight (revealed on hover). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(220px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(255,255,255,0.06), transparent 60%)'
        }}
      />
      {/* Corner glow tint. */}
      <div
        aria-hidden="true"
        className={cn(
          'absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl transition-colors',
          accent.glow
        )}
      />
      <div
        className={cn(
          'z-10 mb-auto flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-surface-container transition-colors sm:h-12 sm:w-12',
          accent.border
        )}
      >
        <MaterialIcon name={icon ?? 'category'} size={24} className={accent.icon} />
      </div>
      <div className="z-10 mt-3 sm:mt-4">
        <h3 className="text-body-lg font-bold text-on-surface sm:text-headline-md">{name}</h3>
        {subtitle && (
          <p className="mt-1 line-clamp-2 text-label-sm text-on-surface-variant transition-colors group-hover:text-on-surface">
            {subtitle}
          </p>
        )}
      </div>
    </Link>
  )
}

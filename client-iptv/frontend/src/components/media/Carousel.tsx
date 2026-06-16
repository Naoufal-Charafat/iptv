import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { EmptyState } from '@/components/feedback/EmptyState'
import { MaterialIcon } from '@/components/icons/MaterialIcon'
import { MediaCardSkeleton } from '@/components/media/MediaCardSkeleton'
import { cn } from '@/lib/utils'
import type { MediaCardAspect, MediaCardVariant } from './MediaCard'

export interface CarouselProps {
  /** Section heading shown above the row. */
  title?: string
  /** Optional "see all" link/action rendered next to the title. */
  action?: ReactNode
  /** Rendered items (typically `MediaCard`s). Ignored while `isLoading`. */
  children?: ReactNode
  /** Show skeletons instead of children. */
  isLoading?: boolean
  /** Number of skeletons to render while loading. */
  skeletonCount?: number
  /** Show the empty state when there are no children and not loading. */
  isEmpty?: boolean
  /** Aspect/variant used for loading skeletons (match the real cards). */
  skeletonAspect?: MediaCardAspect
  skeletonVariant?: MediaCardVariant
  className?: string
}

/**
 * Horizontal shelf per DESIGN.md > Carousels and the Home mockup. Snap scroll
 * with peek of the next item, bleeds to the screen edges on mobile and snaps to
 * the content container on desktop, and shows prev/next buttons on desktop
 * hover. Supports loading (skeletons) and empty states.
 */
export function Carousel({
  title,
  action,
  children,
  isLoading = false,
  skeletonCount = 6,
  isEmpty = false,
  skeletonAspect = '16:9',
  skeletonVariant = 'default',
  className
}: CarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanScrollLeft(scrollLeft > 4)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4)
  }, [])

  useEffect(() => {
    updateArrows()
    const el = scrollerRef.current
    if (!el) return
    el.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [updateArrows, children, isLoading])

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' })
  }, [])

  const showEmpty = !isLoading && isEmpty

  return (
    <section className={cn('group/carousel', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between px-margin-mobile md:px-0">
          {title && <h2 className="text-headline-md font-bold text-on-surface">{title}</h2>}
          {action}
        </div>
      )}

      {showEmpty ? (
        <div className="px-margin-mobile md:px-0">
          <EmptyState
            icon="tv_off"
            title="Nada por aquí"
            description="No hay canales en esta sección."
          />
        </div>
      ) : (
        <div className="relative">
          {/* Prev button (desktop). */}
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => scrollByPage(-1)}
            disabled={!canScrollLeft}
            className={cn(
              'absolute left-2 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-opacity hover:bg-black/80 disabled:pointer-events-none disabled:opacity-0 md:flex',
              'opacity-0 group-hover/carousel:opacity-100 focus-visible:opacity-100'
            )}
          >
            <MaterialIcon name="chevron_left" size={28} />
          </button>

          <div
            ref={scrollerRef}
            role="group"
            aria-roledescription="carousel"
            aria-label={title}
            tabIndex={0}
            className={cn(
              'flex gap-4 overflow-x-auto scroll-smooth pb-2',
              // Bleed to edges on mobile, snap to container on desktop.
              'snap-x snap-mandatory px-margin-mobile md:px-0',
              '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            )}
          >
            {isLoading
              ? Array.from({ length: skeletonCount }).map((_, i) => (
                  <div key={i} className="snap-start">
                    <MediaCardSkeleton aspect={skeletonAspect} variant={skeletonVariant} />
                  </div>
                ))
              : children}
          </div>

          {/* Next button (desktop). */}
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => scrollByPage(1)}
            disabled={!canScrollRight}
            className={cn(
              'absolute right-2 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-opacity hover:bg-black/80 disabled:pointer-events-none disabled:opacity-0 md:flex',
              'opacity-0 group-hover/carousel:opacity-100 focus-visible:opacity-100'
            )}
          >
            <MaterialIcon name="chevron_right" size={28} />
          </button>
        </div>
      )}
    </section>
  )
}

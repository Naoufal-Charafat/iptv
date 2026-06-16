import { MediaCardSkeleton } from '@/components/media/MediaCardSkeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { MediaCardAspect, MediaCardVariant } from './MediaCard'

export interface CarouselSkeletonProps {
  /** Number of card skeletons in the row. */
  count?: number
  /** Render a heading placeholder above the row. */
  withTitle?: boolean
  aspect?: MediaCardAspect
  variant?: MediaCardVariant
  className?: string
}

/** Standalone loading placeholder for a `Carousel` shelf. */
export function CarouselSkeleton({
  count = 6,
  withTitle = true,
  aspect = '16:9',
  variant = 'default',
  className
}: CarouselSkeletonProps) {
  return (
    <section className={className}>
      {withTitle && <Skeleton className="mb-4 h-7 w-48 rounded" />}
      <div className={cn('flex gap-4 overflow-hidden pb-2')}>
        {Array.from({ length: count }).map((_, i) => (
          <MediaCardSkeleton key={i} aspect={aspect} variant={variant} />
        ))}
      </div>
    </section>
  )
}

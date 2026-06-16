import { MediaCardSkeleton } from '@/components/media/MediaCardSkeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface ChannelListSkeletonProps {
  /** Number of card placeholders. */
  count?: number
  className?: string
}

/**
 * Responsive grid of `MediaCard` skeletons for result/list pages. Mirrors the
 * `ChannelGrid` column counts (2 on mobile → 5 on xl) so the loading state
 * lines up with the loaded grid.
 */
export function ChannelListSkeleton({ count = 12, className }: ChannelListSkeletonProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <MediaCardSkeleton key={i} aspect="16:9" variant="default" className="w-full" />
      ))}
    </div>
  )
}

export interface DimensionGridSkeletonProps {
  /** Number of tiles. */
  count?: number
  className?: string
}

/** Bento-style grid placeholder for the dimensions overview. */
export function DimensionGridSkeleton({ count = 8, className }: DimensionGridSkeletonProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-36 w-full rounded-xl sm:h-48" />
      ))}
    </div>
  )
}

export interface ChipListSkeletonProps {
  count?: number
  className?: string
}

/** Row of pill skeletons (dimension chips / trending). */
export function ChipListSkeleton({ count = 8, className }: ChipListSkeletonProps) {
  return (
    <div className={cn('flex flex-wrap gap-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-28 rounded-full" />
      ))}
    </div>
  )
}

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { MediaCardAspect, MediaCardVariant } from './MediaCard'

export interface MediaCardSkeletonProps {
  aspect?: MediaCardAspect
  variant?: MediaCardVariant
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

/** Placeholder for `MediaCard`; sized identically to avoid layout shift. */
export function MediaCardSkeleton({
  aspect = '16:9',
  variant = 'default',
  className
}: MediaCardSkeletonProps) {
  return (
    <div className={cn('shrink-0 overflow-hidden rounded-lg', widthClass[variant], className)}>
      <Skeleton className={cn('w-full rounded-lg', aspectClass[aspect])} />
      {variant === 'compact' && (
        <div className="space-y-2 p-2">
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/3 rounded" />
        </div>
      )}
    </div>
  )
}

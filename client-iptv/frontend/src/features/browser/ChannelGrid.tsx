import { ChannelListSkeleton } from '@/components/feedback/ListSkeletons'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { MediaCard } from '@/components/media/MediaCard'
import { Spinner } from '@/components/feedback/Spinner'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import type { ChannelSummary } from '@client-iptv/shared'

export interface ChannelGridProps {
  channels: ChannelSummary[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  /** Custom empty-state copy. */
  emptyTitle?: string
  emptyDescription?: string
}

/**
 * Responsive grid of channel cards with infinite scroll (issue #42). Shows a
 * skeleton on initial load, a paging spinner via the sentinel, and error/empty
 * states.
 */
export function ChannelGrid({
  channels,
  isLoading,
  isError,
  onRetry,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  emptyTitle = 'No hay canales',
  emptyDescription = 'No encontramos canales con estos filtros.'
}: ChannelGridProps) {
  const sentinelRef = useInfiniteScroll<HTMLDivElement>({
    hasNextPage,
    isFetching: isFetchingNextPage,
    fetchNextPage
  })

  if (isLoading) return <ChannelListSkeleton />
  if (isError) return <ErrorState onRetry={onRetry} />
  if (channels.length === 0) {
    return <EmptyState icon="tv_off" title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {channels.map(channel => (
          <MediaCard key={channel.id} channel={channel} className="w-full" />
        ))}
      </div>

      {/* Infinite-scroll sentinel + paging spinner. */}
      <div ref={sentinelRef} className="flex h-16 items-center justify-center">
        {isFetchingNextPage && <Spinner size={28} />}
      </div>
    </div>
  )
}

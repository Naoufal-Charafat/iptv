import { MaterialIcon } from '@/components/icons/MaterialIcon'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { useChannels } from '@/features/channels/hooks'
import { cn, dedupeById } from '@/lib/utils'

export interface ChannelSwitcherProps {
  /** Currently playing channel id (highlighted). */
  currentChannelId?: string
  /** Switch to another channel without leaving the player. */
  onSelect: (channelId: string) => void
}

/**
 * Quick channel list for the player (issue #45). Renders a compact list of
 * channels; selecting one swaps the stream in place via `onSelect`.
 */
export function ChannelSwitcher({ currentChannelId, onSelect }: ChannelSwitcherProps) {
  const { data, isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useChannels({ limit: 24 })

  const channels = dedupeById(data?.pages.flatMap(p => p.data) ?? [])

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-DEFAULT" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />
  }

  return (
    <div className="flex flex-col gap-1">
      <ul className="flex flex-col gap-1" role="menu" aria-label="Canales">
        {channels.map(channel => {
          const active = channel.id === currentChannelId
          return (
            <li key={channel.id} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => onSelect(channel.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-DEFAULT px-2 py-2 text-left transition-colors hover:bg-surface-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active && 'bg-primary-container/15'
                )}
              >
                <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-DEFAULT bg-white/90">
                  {channel.logo ? (
                    <img src={channel.logo} alt="" className="h-full w-full object-contain p-1" />
                  ) : (
                    <MaterialIcon name="tv" size={18} className="text-surface" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'truncate text-body-md font-semibold',
                      active ? 'text-primary' : 'text-on-surface'
                    )}
                  >
                    {channel.name}
                  </p>
                  <p className="truncate text-label-sm uppercase text-on-surface-variant">
                    {channel.country}
                    {channel.quality ? ` · ${channel.quality}` : ''}
                  </p>
                </div>
                {active && (
                  <span className="inline-flex items-center gap-1 text-label-sm font-bold uppercase text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-container" />
                    Now
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {hasNextPage && (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mt-2 w-full rounded-DEFAULT border border-outline-variant py-2 text-label-md text-on-surface-variant transition-colors hover:border-primary/40 hover:text-on-surface disabled:opacity-50"
        >
          {isFetchingNextPage ? 'Cargando…' : 'Ver más canales'}
        </button>
      )}
    </div>
  )
}

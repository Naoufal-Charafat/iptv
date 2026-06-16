import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { useEpg } from '@/features/epg/hooks'
import { cn } from '@/lib/utils'
import { formatTime } from './epgUtils'

export interface EpgPanelProps {
  channelId?: string
}

/**
 * Program grid for the current channel (issue #45). Lists the channel's EPG,
 * highlighting the program airing now. Degrades to an empty message when there
 * is no guide.
 */
export function EpgPanel({ channelId }: EpgPanelProps) {
  const { data, isLoading, isError, refetch } = useEpg(channelId)
  const now = Date.now()

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-DEFAULT" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />
  }

  const programs = data?.programs ?? []
  if (programs.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-label-md text-on-surface-variant">
        No hay guía de programación para este canal.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-1" aria-label="Programación">
      {programs.map((program, i) => {
        const start = new Date(program.start).getTime()
        const stop = new Date(program.stop).getTime()
        const live = now >= start && now < stop
        return (
          <li
            key={`${program.start}-${i}`}
            className={cn(
              'flex items-start gap-3 rounded-DEFAULT px-3 py-2',
              live && 'bg-primary-container/15'
            )}
          >
            <span className="w-12 shrink-0 tabular-nums text-label-md text-on-surface-variant">
              {formatTime(program.start)}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'truncate text-body-md font-semibold',
                  live ? 'text-primary' : 'text-on-surface'
                )}
              >
                {program.title}
                {live && (
                  <span className="ml-2 align-middle text-label-sm font-bold uppercase text-primary">
                    Live
                  </span>
                )}
              </p>
              {program.description && (
                <p className="truncate text-label-sm text-on-surface-variant">
                  {program.description}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

import { useEffect, useState } from 'react'

import { MaterialIcon } from '@/components/icons/MaterialIcon'
import { Skeleton } from '@/components/ui/skeleton'
import { useEpg } from '@/features/epg/hooks'
import { cn } from '@/lib/utils'
import type { ChannelSummary } from '@client-iptv/shared'
import { EpgProgress } from './EpgProgress'
import { formatTime, getNowNext } from './epgUtils'

export interface ChannelInfoOverlayProps {
  /** Current channel (drives logo + name; null while loading). */
  channel: ChannelSummary | null
  /** Optional channel "number" shown before the name (mockup-style). */
  channelNumber?: string
  /** Whether overlays are visible. */
  visible: boolean
  className?: string
}

/**
 * Bottom info overlay of the player (issue #44): channel logo + number/name,
 * the live program (LIVE label + time + title) and the next one (NEXT), plus a
 * red progress bar for the current program. Degrades gracefully when the EPG is
 * missing (shows only channel info) and shows a skeleton while it loads.
 */
export function ChannelInfoOverlay({
  channel,
  channelNumber,
  visible,
  className
}: ChannelInfoOverlayProps) {
  const epg = useEpg(channel?.id)

  // Re-render once a minute so the live/next + progress stay fresh.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const { current, next, progress } = getNowNext(epg.data, now)

  return (
    <div
      className={cn(
        'pl-safe pr-safe absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-28 pt-16 transition-opacity duration-300 md:px-8 md:pb-32',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
        className
      )}
    >
      <div className="flex items-end gap-4">
        {/* Channel logo */}
        <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-DEFAULT bg-white/90">
          {channel?.logo ? (
            <img src={channel.logo} alt="" className="h-full w-full object-contain p-1" />
          ) : (
            <MaterialIcon name="tv" size={24} className="text-surface" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Number + name */}
          <div className="mb-1 flex items-baseline gap-2">
            {channelNumber && (
              <span className="text-headline-md font-bold text-on-surface-variant">
                {channelNumber}
              </span>
            )}
            <span className="truncate text-headline-md font-bold text-on-surface">
              {channel?.name ?? '—'}
            </span>
          </div>

          {/* EPG rows */}
          {epg.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-64 rounded" />
              <Skeleton className="h-3 w-48 rounded" />
            </div>
          ) : current || next ? (
            <div className="space-y-1">
              {current && (
                <div className="flex items-center gap-3 text-body-md">
                  <span className="inline-flex shrink-0 items-center rounded-DEFAULT bg-primary-container px-2 py-0.5 text-label-sm font-bold uppercase text-white">
                    Live
                  </span>
                  <span className="shrink-0 tabular-nums text-on-surface-variant">
                    {formatTime(current.start)}
                  </span>
                  <span className="truncate font-semibold text-on-surface">{current.title}</span>
                </div>
              )}
              {next && (
                <div className="flex items-center gap-3 text-label-md text-on-surface-variant">
                  <span className="inline-flex w-[44px] shrink-0 justify-center text-label-sm font-bold uppercase">
                    Next
                  </span>
                  <span className="shrink-0 tabular-nums">{formatTime(next.start)}</span>
                  <span className="truncate">{next.title}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-label-md text-on-surface-variant">Sin guía de programación.</p>
          )}
        </div>
      </div>

      {/* Live program progress */}
      {current && <EpgProgress value={progress} className="mt-4" />}
    </div>
  )
}

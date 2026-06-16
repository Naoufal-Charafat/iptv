import { Link } from 'react-router-dom'

import { ErrorState } from '@/components/feedback/ErrorState'
import { MaterialIcon } from '@/components/icons/MaterialIcon'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { useChannel } from '@/features/channels/hooks'

export interface ChannelDetailModalProps {
  channelId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * "More Info" detail modal (issue #40) — a Level-3 glass overlay with the
 * channel logo, name, country/categories and a "Watch Now" CTA. Fetches detail
 * lazily via `useChannel` while open.
 */
export function ChannelDetailModal({ channelId, open, onOpenChange }: ChannelDetailModalProps) {
  const { data, isLoading, isError, refetch } = useChannel(
    open ? (channelId ?? undefined) : undefined
  )

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="lg" title={data?.name ?? 'Detalle'}>
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="h-4 w-1/2 rounded" />
        </div>
      ) : isError || !data ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="space-y-6">
          <div className="flex gap-6">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/90">
              {data.logo ? (
                <img src={data.logo} alt="" className="h-full w-full object-contain p-3" />
              ) : (
                <MaterialIcon name="tv" size={48} className="text-surface" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-label-md text-on-surface-variant">
                <span className="uppercase">{data.country}</span>
                {data.network && <span>· {data.network}</span>}
                {data.streamCount > 0 && <span>· {data.streamCount} stream(s)</span>}
              </div>
              {data.categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.categories.map(cat => (
                    <span
                      key={cat}
                      className="rounded-full border border-outline-variant bg-surface-container-high/80 px-3 py-1 text-label-sm capitalize text-on-surface"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}
              {data.website && (
                <a
                  href={data.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-label-md text-tertiary hover:underline"
                >
                  <MaterialIcon name="public" size={16} />
                  Sitio web
                </a>
              )}
            </div>
          </div>

          <Button asChild size="lg" iconLeft="play_arrow" className="w-full sm:w-auto">
            <Link to={`/reproductor/${encodeURIComponent(data.id)}`}>Watch Now</Link>
          </Button>
        </div>
      )}
    </Modal>
  )
}

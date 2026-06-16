import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Spinner } from '@/components/feedback/Spinner'
import { Button } from '@/components/ui/button'
import { useChannel, useChannelStreams } from '@/features/channels/hooks'
import { ChannelInfoOverlay } from '@/features/player/ChannelInfoOverlay'
import { PlayerControlBar } from '@/features/player/PlayerControlBar'
import { PlayerTopBar } from '@/features/player/PlayerTopBar'
import { VideoPlayer } from '@/features/player/VideoPlayer'
import { useFullscreen } from '@/features/player/useFullscreen'
import { useHlsPlayer } from '@/features/player/useHlsPlayer'
import { useOverlayVisibility } from '@/features/player/useOverlayVisibility'
import { usePlayerKeyboard } from '@/features/player/usePlayerKeyboard'
import type { ChannelSummary, Stream } from '@client-iptv/shared'

const QUALITY_RANK: Record<string, number> = {
  '2160p': 6,
  '1440p': 5,
  '1080p': 4,
  '720p': 3,
  '576p': 2,
  '480p': 1,
  '480i': 0
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

/**
 * Route a stream through the backend proxy so it actually plays in the browser:
 * the proxy injects the upstream User-Agent/Referer, sets permissive CORS and
 * rewrites the .m3u8 so segments flow back through it too.
 */
function proxiedStreamUrl(stream: Stream): string {
  const params = new URLSearchParams({ url: stream.url })
  if (stream.user_agent) params.set('ua', stream.user_agent)
  if (stream.referrer) params.set('referrer', stream.referrer)
  return `${API_BASE}/proxy?${params.toString()}`
}

/** Pick the best stream: highest declared quality, first valid URL as fallback. */
function pickBestStream(streams: Stream[] | undefined): Stream | undefined {
  if (!streams || streams.length === 0) return undefined
  const valid = streams.filter(s => Boolean(s.url))
  if (valid.length === 0) return undefined
  return [...valid].sort(
    (a, b) => (QUALITY_RANK[b.quality ?? ''] ?? -1) - (QUALITY_RANK[a.quality ?? ''] ?? -1)
  )[0]
}

export function PlayerPage() {
  const { channelId } = useParams<{ channelId: string }>()
  const navigate = useNavigate()

  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const channelQuery = useChannel(channelId)
  const streamsQuery = useChannelStreams(channelId)

  const stream = useMemo(() => pickBestStream(streamsQuery.data), [streamsQuery.data])
  const src = useMemo(() => (stream ? proxiedStreamUrl(stream) : undefined), [stream])

  const { state, controls } = useHlsPlayer(videoRef, src, { autoPlay: true })

  // A control panel being open keeps the overlays pinned.
  const [panelOpen, setPanelOpen] = useState(false)
  const overlay = useOverlayVisibility({ keepVisible: panelOpen || state.status === 'error' })

  const fullscreen = useFullscreen(containerRef)

  usePlayerKeyboard({
    togglePlay: controls.togglePlay,
    toggleFullscreen: fullscreen.toggle,
    toggleMuted: controls.toggleMuted,
    adjustVolume: delta => controls.setVolume(state.volume + delta),
    onActivity: overlay.show
  })

  // Reset overlay visibility whenever the channel changes.
  useEffect(() => {
    overlay.show()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId])

  const channel = channelQuery.data
  const summary: ChannelSummary | null = channel
    ? {
        id: channel.id,
        name: channel.name,
        country: channel.country,
        categories: channel.categories,
        is_nsfw: channel.is_nsfw,
        logo: channel.logo,
        quality: stream?.quality ?? null,
        hasStream: (channel.streamCount ?? 0) > 0 || Boolean(stream)
      }
    : null

  const switchChannel = (nextId: string) => {
    if (nextId === channelId) return
    navigate(`/reproductor/${encodeURIComponent(nextId)}`)
  }

  // --- Hard error / empty states (block the player) ----------------------
  // Channel does not exist.
  if (channelQuery.isError && !channelQuery.isLoading) {
    return (
      <div className="h-dvh flex w-screen items-center justify-center bg-black p-8">
        <EmptyState
          icon="tv_off"
          title="Canal no encontrado"
          description="Este canal no existe o ya no está disponible."
          action={
            <Button asChild variant="secondary" iconLeft="home">
              <Link to="/">Volver al inicio</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const resolving = streamsQuery.isLoading || channelQuery.isLoading
  const noStreams = !resolving && !stream
  const fatal = state.status === 'error'

  return (
    <div
      ref={containerRef}
      className="h-dvh relative w-screen overflow-hidden bg-black"
      onMouseMove={overlay.show}
      onTouchStart={overlay.show}
    >
      <VideoPlayer ref={videoRef} onSurfaceClick={overlay.show} />

      {/* Loading / buffering spinner */}
      {(resolving || state.status === 'loading' || state.status === 'buffering') && !fatal && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30">
          <Spinner size={56} />
        </div>
      )}

      {/* No streams for an existing channel */}
      {noStreams && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-8">
          <ErrorState
            icon="signal_disconnected"
            title="Sin streams disponibles"
            description="Este canal no tiene ninguna emisión reproducible ahora mismo."
            onRetry={() => streamsQuery.refetch()}
          />
        </div>
      )}

      {/* Fatal playback error (recoverable) */}
      {fatal && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-8">
          <ErrorState
            icon="error"
            title="No se pudo reproducir"
            description={state.error?.message ?? 'El stream no está disponible.'}
            onRetry={controls.retry}
          />
        </div>
      )}

      {/* Overlays */}
      <PlayerTopBar
        channelName={channel?.name}
        visible={overlay.visible}
        onToggleFullscreen={fullscreen.toggle}
      />

      {!fatal && !noStreams && (
        <>
          <ChannelInfoOverlay channel={summary} visible={overlay.visible} />
          <PlayerControlBar
            channel={summary}
            channelId={channelId}
            state={state}
            controls={controls}
            visible={overlay.visible}
            onSelectChannel={switchChannel}
            onOpenChange={setPanelOpen}
          />
        </>
      )}

      {/* Center play affordance when autoplay was blocked. */}
      {state.paused && !resolving && !fatal && !noStreams && (
        <button
          type="button"
          onClick={controls.play}
          aria-label="Reproducir"
          className="absolute left-1/2 top-1/2 z-20 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md transition-transform hover:scale-105"
        >
          <span className="material-symbols-outlined filled" style={{ fontSize: 44 }}>
            play_arrow
          </span>
        </button>
      )}
    </div>
  )
}

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

/**
 * Rank a channel's streams best-first (highest declared quality), dropping any
 * without a URL. The player tries them in order, falling back to the next when
 * one fails (dead / geo-blocked URLs), so a bad first stream doesn't strand the
 * channel on an endless spinner.
 */
function rankStreams(streams: Stream[] | undefined): Stream[] {
  if (!streams || streams.length === 0) return []
  return streams
    .filter(s => Boolean(s.url))
    .sort((a, b) => (QUALITY_RANK[b.quality ?? ''] ?? -1) - (QUALITY_RANK[a.quality ?? ''] ?? -1))
}

export function PlayerPage() {
  const { channelId } = useParams<{ channelId: string }>()
  const navigate = useNavigate()

  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const channelQuery = useChannel(channelId)
  const streamsQuery = useChannelStreams(channelId)

  const candidates = useMemo(() => rankStreams(streamsQuery.data), [streamsQuery.data])
  // Index of the stream currently being attempted; advances on fatal failure.
  const [attemptIndex, setAttemptIndex] = useState(0)
  // Index whose failure we've already reacted to — guards the fallback effect
  // from advancing twice for the same stream (e.g. on a background refetch).
  const failedIndex = useRef(-1)
  // Clamp so a stale index (after the channel changes) never points out of range.
  const safeIndex = candidates.length ? Math.min(attemptIndex, candidates.length - 1) : 0
  const stream = candidates[safeIndex]
  const src = useMemo(() => (stream ? proxiedStreamUrl(stream) : undefined), [stream])

  const { state, controls } = useHlsPlayer(videoRef, src, { autoPlay: true })

  // Stream-level fallback: when the current stream fails fatally, try the next
  // candidate before surfacing an error. Only the last stream's failure blocks.
  const hasNextStream = safeIndex < candidates.length - 1
  useEffect(() => {
    if (state.status === 'error' && hasNextStream && failedIndex.current !== safeIndex) {
      failedIndex.current = safeIndex
      setAttemptIndex(i => i + 1)
    }
  }, [state.status, hasNextStream, safeIndex])

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

  // Reset overlay + stream attempt whenever the channel changes.
  useEffect(() => {
    overlay.show()
    setAttemptIndex(0)
    failedIndex.current = -1
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

  // Go back to the previous view, falling back to home if there is no history.
  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  // Retry the whole channel from its best stream (re-arms the fallback chain).
  const handleRetry = () => {
    failedIndex.current = -1
    if (safeIndex !== 0) setAttemptIndex(0)
    else controls.retry()
  }

  const backButton = (
    <Button variant="secondary" iconLeft="arrow_back" onClick={goBack}>
      Volver
    </Button>
  )

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

  // Streams are still resolving while either query is in flight (and hasn't errored).
  const resolving =
    (streamsQuery.isLoading && !streamsQuery.isError) ||
    (channelQuery.isLoading && !channelQuery.isError)
  // The streams request itself failed (network / 404 from the real backend).
  const streamsError = streamsQuery.isError
  // Request succeeded but the channel has no playable stream (empty array).
  const noStreams = !resolving && !streamsError && !stream
  // Falling back to the next stream — keep showing the spinner, not an error.
  const fallingBack = state.status === 'error' && hasNextStream
  // hls.js / native playback gave up on the LAST available stream.
  const fatal = state.status === 'error' && !hasNextStream
  // Any state that replaces the player surface with a message + back button.
  const blocked = streamsError || noStreams || fatal

  return (
    <div
      ref={containerRef}
      className="h-dvh relative w-screen overflow-hidden bg-black"
      onMouseMove={overlay.show}
      onTouchStart={overlay.show}
    >
      <VideoPlayer ref={videoRef} onSurfaceClick={overlay.show} />

      {/* Loading / buffering spinner — only while genuinely resolving, never
          once we've settled into a blocked (no-streams / error) state. */}
      {(resolving ||
        fallingBack ||
        state.status === 'idle' ||
        state.status === 'loading' ||
        state.status === 'buffering') &&
        !blocked && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/30">
            <Spinner size={56} />
            {safeIndex > 0 && (
              <p className="text-sm text-white/70">
                Buscando una emisión disponible… (emisión {safeIndex + 1} de {candidates.length})
              </p>
            )}
          </div>
        )}

      {/* The streams request itself failed (distinct from "no streams"). */}
      {streamsError && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-8">
          <ErrorState
            icon="cloud_off"
            title="No se pudieron cargar los streams"
            description="Hubo un problema al obtener las emisiones de este canal."
            onRetry={() => streamsQuery.refetch()}
            action={backButton}
          />
        </div>
      )}

      {/* Request succeeded but the channel has no playable stream. */}
      {noStreams && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-8">
          <ErrorState
            icon="signal_disconnected"
            title="No hay streams disponibles para este canal"
            description="Este canal no tiene ninguna emisión reproducible ahora mismo."
            onRetry={() => streamsQuery.refetch()}
            action={backButton}
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
            onRetry={handleRetry}
            action={backButton}
          />
        </div>
      )}

      {/* Overlays */}
      <PlayerTopBar
        channelName={channel?.name}
        visible={overlay.visible}
        onToggleFullscreen={fullscreen.toggle}
      />

      {!blocked && (
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
      {state.paused && !resolving && !blocked && (
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

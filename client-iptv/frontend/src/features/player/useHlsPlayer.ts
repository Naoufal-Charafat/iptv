import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Hls, { type ErrorData, type Level, type MediaPlaylist } from 'hls.js'

import {
  AUTO_QUALITY,
  type AudioTrackInfo,
  type HlsPlayerControls,
  type HlsPlayerState,
  type PlaybackStatus,
  type PlayerError,
  type QualityLevel,
  type UseHlsPlayerOptions
} from './playerTypes'

const MAX_RECOVERY_ATTEMPTS = 3
// Watchdog ceilings. A healthy manifest proxied locally parses in 1-3s and the
// first frame follows shortly after; if either milestone is missed the source
// is treated as dead and a fatal error is surfaced so the page can fall back to
// the channel's next stream fast — instead of spinning on a geo-blocked / dead
// URL. Kept short so fallback feels responsive, not "stuck".
const MANIFEST_TIMEOUT_MS = 8000
const FIRST_FRAME_TIMEOUT_MS = 9000

function labelForLevel(level: Level): string {
  if (level.height) return `${level.height}p`
  if (level.bitrate) return `${Math.round(level.bitrate / 1000)} kbps`
  return 'Stream'
}

function buildLevels(levels: Level[]): QualityLevel[] {
  const auto: QualityLevel = { index: AUTO_QUALITY, height: null, bitrate: null, label: 'Auto' }
  const mapped = levels.map<QualityLevel>((level, index) => ({
    index,
    height: level.height ?? null,
    bitrate: level.bitrate ?? null,
    label: labelForLevel(level)
  }))
  // Highest quality first (after Auto).
  mapped.sort((a, b) => (b.height ?? 0) - (a.height ?? 0))
  return [auto, ...mapped]
}

function buildAudioTracks(tracks: MediaPlaylist[]): AudioTrackInfo[] {
  return tracks.map<AudioTrackInfo>((track, i) => ({
    id: track.id ?? i,
    name: track.name || track.lang || `Track ${i + 1}`,
    lang: track.lang ?? null,
    isDefault: Boolean(track.default)
  }))
}

function messageForError(data: ErrorData): string {
  switch (data.type) {
    case Hls.ErrorTypes.NETWORK_ERROR:
      return 'No se pudo cargar el stream (error de red).'
    case Hls.ErrorTypes.MEDIA_ERROR:
      return 'Error de reproducción del medio.'
    default:
      return 'El stream no está disponible.'
  }
}

/**
 * Core HLS playback engine (issue #43).
 *
 * Installs hls.js when the browser lacks native HLS, falls back to native HLS
 * (Safari/iOS), and cleans up the instance on unmount or source change.
 * Exposes quality levels (with an "Auto" entry), audio tracks, playback status
 * and volume/mute, plus imperative controls. Network/media errors are recovered
 * with bounded backoff; fatal/unrecoverable errors are surfaced for the UI.
 */
export function useHlsPlayer(
  videoRef: React.RefObject<HTMLVideoElement>,
  src: string | undefined,
  options: UseHlsPlayerOptions = {}
): { state: HlsPlayerState; controls: HlsPlayerControls } {
  const { autoPlay = true, muted: initialMuted = false } = options

  const hlsRef = useRef<Hls | null>(null)
  const recoveryAttempts = useRef(0)
  const recoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Load / first-frame watchdog (see MANIFEST_TIMEOUT_MS / FIRST_FRAME_TIMEOUT_MS).
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // True once this source actually played a frame (gates mid-stream recovery vs.
  // fast-fail on initial load); `dead` is set once we give up, so late hls.js
  // events can't resurrect a stream the page has already moved on from.
  const hasPlayed = useRef(false)
  const dead = useRef(false)
  // Bumped by `retry()` to force the effect to re-run.
  const [reloadToken, setReloadToken] = useState(0)

  const [status, setStatus] = useState<PlaybackStatus>('idle')
  const [levels, setLevels] = useState<QualityLevel[]>([])
  const [currentLevel, setCurrentLevel] = useState<number>(AUTO_QUALITY)
  const [activeLevel, setActiveLevel] = useState<number>(AUTO_QUALITY)
  const [audioTracks, setAudioTracks] = useState<AudioTrackInfo[]>([])
  const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(-1)
  const [paused, setPaused] = useState<boolean>(!autoPlay)
  const [muted, setMutedState] = useState<boolean>(initialMuted)
  const [volume, setVolumeState] = useState<number>(1)
  const [error, setError] = useState<PlayerError | null>(null)

  // Reset playback status synchronously when the source changes (before paint).
  // This stops a stream swap (fallback) from briefly painting the previous
  // stream's 'error' frame, and prevents the page's fallback effect from
  // advancing twice — by the time it runs, status is already 'loading' again.
  useLayoutEffect(() => {
    if (src) {
      setStatus('loading')
      setError(null)
    }
  }, [src])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) {
      setStatus('idle')
      return
    }

    setError(null)
    setStatus('loading')
    recoveryAttempts.current = 0
    hasPlayed.current = false
    dead.current = false

    video.muted = initialMuted

    const clearLoadTimer = () => {
      if (loadTimer.current) {
        clearTimeout(loadTimer.current)
        loadTimer.current = null
      }
    }
    const clearRecoveryTimer = () => {
      if (recoveryTimer.current) {
        clearTimeout(recoveryTimer.current)
        recoveryTimer.current = null
      }
    }

    // Surface a fatal error and stop touching the source. Marks it dead so any
    // late hls.js event (a manifest that parses after we gave up) is ignored and
    // the page can fall back to the channel's next stream.
    const fail = (type: string, details: string, message: string) => {
      if (dead.current) return
      dead.current = true
      clearLoadTimer()
      clearRecoveryTimer()
      hlsRef.current?.stopLoad()
      setStatus('error')
      setError({ type, details, fatal: true, message })
    }

    // Arm the load / first-frame watchdog. Fires `fail` if the milestone (a
    // parsed manifest, then the first played frame) is not reached in time.
    const armWatchdog = (ms: number) => {
      clearLoadTimer()
      loadTimer.current = setTimeout(() => {
        fail('loadTimeout', 'LOAD_TIMEOUT', 'El stream tardó demasiado en cargar.')
      }, ms)
    }

    const onPlaying = () => {
      hasPlayed.current = true
      recoveryAttempts.current = 0
      clearLoadTimer()
      setStatus('playing')
      setPaused(false)
    }
    const onPause = () => setPaused(true)
    const onWaiting = () => setStatus('buffering')
    const onVolume = () => {
      setMutedState(video.muted)
      setVolumeState(video.volume)
    }

    video.addEventListener('playing', onPlaying)
    video.addEventListener('pause', onPause)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('volumechange', onVolume)

    // Start playback once the source is ready. If autoplay is blocked by policy
    // the stream is fine — disarm the watchdog and wait for a user gesture (the
    // UI shows a play button) rather than declaring the source dead.
    const startPlayback = () => {
      if (!autoPlay) {
        clearLoadTimer()
        setStatus('paused')
        setPaused(true)
        return
      }
      void video.play().catch(() => {
        clearLoadTimer()
        setStatus('paused')
        setPaused(true)
      })
    }

    // --- Native HLS path (Safari / iOS) -----------------------------------
    if (!Hls.isSupported() && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      armWatchdog(MANIFEST_TIMEOUT_MS)
      const onLoaded = () => {
        if (dead.current) return
        clearLoadTimer()
        setStatus('buffering')
        // Manifest ready — now guard the wait for the first frame.
        armWatchdog(FIRST_FRAME_TIMEOUT_MS)
        startPlayback()
      }
      const onNativeError = () => {
        fail('nativeError', 'NATIVE_HLS_ERROR', 'El stream no está disponible.')
      }
      video.addEventListener('loadedmetadata', onLoaded)
      video.addEventListener('error', onNativeError)
      return () => {
        clearLoadTimer()
        clearRecoveryTimer()
        video.removeEventListener('loadedmetadata', onLoaded)
        video.removeEventListener('error', onNativeError)
        video.removeEventListener('playing', onPlaying)
        video.removeEventListener('pause', onPause)
        video.removeEventListener('waiting', onWaiting)
        video.removeEventListener('volumechange', onVolume)
        video.removeAttribute('src')
        video.load()
      }
    }

    // --- hls.js path ------------------------------------------------------
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        // Fail fast on dead / geo-blocked sources: short timeouts and no manifest
        // retry, so a bad URL errors quickly and the page falls back to the next
        // stream. The watchdog above is the ultimate backstop.
        manifestLoadingTimeOut: 6000,
        manifestLoadingMaxRetry: 0,
        levelLoadingTimeOut: 6000,
        levelLoadingMaxRetry: 1,
        fragLoadingTimeOut: 12000,
        fragLoadingMaxRetry: 2
      })
      hlsRef.current = hls
      armWatchdog(MANIFEST_TIMEOUT_MS)
      hls.loadSource(src)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        if (dead.current) return
        // Manifest is reachable; wait for the first frame without optimistically
        // claiming 'playing'. Re-arm the watchdog so a manifest that parses but
        // never delivers segments still falls back instead of hanging.
        clearLoadTimer()
        setLevels(buildLevels(data.levels))
        setCurrentLevel(AUTO_QUALITY)
        setStatus('buffering')
        armWatchdog(FIRST_FRAME_TIMEOUT_MS)
        startPlayback()
      })

      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        setActiveLevel(data.level)
      })

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_e, data) => {
        setAudioTracks(buildAudioTracks(data.audioTracks))
      })
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_e, data) => {
        setCurrentAudioTrack(data.id)
      })

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal || dead.current) return

        const recoverable =
          data.type === Hls.ErrorTypes.NETWORK_ERROR ||
          data.type === Hls.ErrorTypes.MEDIA_ERROR

        // Only retry a source that has already played (a transient mid-stream
        // glitch). Initial-load failures and non-recoverable error types fail
        // fast so the page can fall back to the next stream without a long spin.
        if (
          hasPlayed.current &&
          recoverable &&
          recoveryAttempts.current < MAX_RECOVERY_ATTEMPTS
        ) {
          recoveryAttempts.current += 1
          const backoff = 500 * recoveryAttempts.current
          setStatus('buffering')
          clearLoadTimer()
          clearRecoveryTimer()
          recoveryTimer.current = setTimeout(() => {
            if (dead.current) return
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad()
            else hls.recoverMediaError()
            // Backstop in case the recovery itself stalls without an event.
            armWatchdog(MANIFEST_TIMEOUT_MS)
          }, backoff)
          return
        }

        fail(data.type, data.details, messageForError(data))
      })

      return () => {
        clearLoadTimer()
        clearRecoveryTimer()
        video.removeEventListener('playing', onPlaying)
        video.removeEventListener('pause', onPause)
        video.removeEventListener('waiting', onWaiting)
        video.removeEventListener('volumechange', onVolume)
        hls.destroy()
        hlsRef.current = null
      }
    }

    // No HLS support at all.
    setStatus('error')
    setError({
      type: 'unsupported',
      details: 'HLS_UNSUPPORTED',
      fatal: true,
      message: 'Tu navegador no soporta este formato de vídeo.'
    })
    return () => {
      clearLoadTimer()
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('volumechange', onVolume)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef, src, reloadToken])

  // --- Controls ----------------------------------------------------------
  const play = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    void video.play().catch(() => undefined)
  }, [videoRef])

  const pause = useCallback(() => {
    videoRef.current?.pause()
  }, [videoRef])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) play()
    else pause()
  }, [videoRef, play, pause])

  const setQuality = useCallback((levelIndex: number) => {
    const hls = hlsRef.current
    if (!hls) return
    // hls.js: -1 enables auto level selection.
    hls.currentLevel = levelIndex
    setCurrentLevel(levelIndex)
  }, [])

  const setAudioTrack = useCallback((id: number) => {
    const hls = hlsRef.current
    if (!hls) return
    hls.audioTrack = id
    setCurrentAudioTrack(id)
  }, [])

  const setMuted = useCallback(
    (next: boolean) => {
      const video = videoRef.current
      if (!video) return
      video.muted = next
      setMutedState(next)
    },
    [videoRef]
  )

  const toggleMuted = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    setMuted(!video.muted)
  }, [videoRef, setMuted])

  const setVolume = useCallback(
    (next: number) => {
      const video = videoRef.current
      if (!video) return
      const clamped = Math.min(1, Math.max(0, next))
      video.volume = clamped
      setVolumeState(clamped)
      if (clamped > 0 && video.muted) {
        video.muted = false
        setMutedState(false)
      }
    },
    [videoRef]
  )

  const retry = useCallback(() => {
    recoveryAttempts.current = 0
    setError(null)
    setStatus('loading')
    setReloadToken(t => t + 1)
  }, [])

  const state = useMemo<HlsPlayerState>(
    () => ({
      status,
      levels,
      currentLevel,
      activeLevel,
      audioTracks,
      currentAudioTrack,
      muted,
      volume,
      paused,
      error
    }),
    [
      status,
      levels,
      currentLevel,
      activeLevel,
      audioTracks,
      currentAudioTrack,
      muted,
      volume,
      paused,
      error
    ]
  )

  const controls = useMemo<HlsPlayerControls>(
    () => ({
      play,
      pause,
      togglePlay,
      setQuality,
      setAudioTrack,
      setMuted,
      toggleMuted,
      setVolume,
      retry
    }),
    [play, pause, togglePlay, setQuality, setAudioTrack, setMuted, toggleMuted, setVolume, retry]
  )

  return { state, controls }
}

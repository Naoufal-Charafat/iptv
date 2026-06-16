import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) {
      setStatus('idle')
      return
    }

    setError(null)
    setStatus('loading')
    recoveryAttempts.current = 0

    video.muted = initialMuted

    const onPlaying = () => {
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

    const startPlayback = () => {
      if (!autoPlay) {
        setPaused(true)
        return
      }
      void video.play().catch(() => {
        // Autoplay rejected (policy): leave paused, the UI shows a play button.
        setPaused(true)
      })
    }

    // --- Native HLS path (Safari / iOS) -----------------------------------
    if (!Hls.isSupported() && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      const onLoaded = () => {
        setStatus(autoPlay ? 'playing' : 'paused')
        startPlayback()
      }
      const onNativeError = () => {
        setStatus('error')
        setError({
          type: 'nativeError',
          details: 'NATIVE_HLS_ERROR',
          fatal: true,
          message: 'El stream no está disponible.'
        })
      }
      video.addEventListener('loadedmetadata', onLoaded)
      video.addEventListener('error', onNativeError)
      return () => {
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
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        setLevels(buildLevels(data.levels))
        setCurrentLevel(AUTO_QUALITY)
        setStatus(autoPlay ? 'playing' : 'paused')
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
        if (!data.fatal) return

        // Bounded recovery with linear backoff.
        if (recoveryAttempts.current < MAX_RECOVERY_ATTEMPTS) {
          recoveryAttempts.current += 1
          const backoff = 500 * recoveryAttempts.current
          setStatus('buffering')
          if (recoveryTimer.current) clearTimeout(recoveryTimer.current)
          recoveryTimer.current = setTimeout(() => {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad()
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError()
            } else {
              // Unrecoverable type — surface immediately.
              recoveryAttempts.current = MAX_RECOVERY_ATTEMPTS
            }
          }, backoff)
          return
        }

        // Exhausted: surface a recoverable error for the UI.
        setStatus('error')
        setError({
          type: data.type,
          details: data.details,
          fatal: true,
          message: messageForError(data)
        })
      })

      return () => {
        if (recoveryTimer.current) clearTimeout(recoveryTimer.current)
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

/**
 * Player domain types shared by the HLS engine, overlays and control bar
 * (issues #43–#46).
 */

/** High-level playback lifecycle state. */
export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'error'

/** Sentinel for the automatic (adaptive) quality level. */
export const AUTO_QUALITY = -1

/** A single selectable quality level derived from the HLS manifest. */
export interface QualityLevel {
  /** hls.js level index (`-1` means Auto). */
  index: number
  /** Vertical resolution in px, when known. */
  height: number | null
  /** Bitrate in bps, when known. */
  bitrate: number | null
  /** Human-readable label, e.g. "1080p" or "Auto". */
  label: string
}

/** A selectable audio track exposed by the manifest. */
export interface AudioTrackInfo {
  /** hls.js audio track id. */
  id: number
  /** Track name. */
  name: string
  /** BCP-47 / ISO language tag, when present. */
  lang: string | null
  /** Whether this is the default track. */
  isDefault: boolean
}

/** Normalized, fatal-ish error surfaced to the UI. */
export interface PlayerError {
  /** hls.js error type (network / media / mux / other). */
  type: string
  /** hls.js error details code. */
  details: string
  /** Whether hls.js flagged it as fatal. */
  fatal: boolean
  /** Human-readable message for the UI. */
  message: string
}

/** Snapshot of the player state returned by `useHlsPlayer`. */
export interface HlsPlayerState {
  status: PlaybackStatus
  /** Available quality levels including the synthetic "Auto" entry at index 0. */
  levels: QualityLevel[]
  /** Currently selected level index (`-1` = Auto). */
  currentLevel: number
  /** Level hls.js is actually rendering (resolves "Auto" to a concrete level). */
  activeLevel: number
  audioTracks: AudioTrackInfo[]
  currentAudioTrack: number
  muted: boolean
  volume: number
  paused: boolean
  error: PlayerError | null
}

/** Imperative controls returned by `useHlsPlayer`. */
export interface HlsPlayerControls {
  play: () => void
  pause: () => void
  togglePlay: () => void
  setQuality: (levelIndex: number) => void
  setAudioTrack: (id: number) => void
  setMuted: (muted: boolean) => void
  toggleMuted: () => void
  setVolume: (volume: number) => void
  /** Re-attach and restart loading after a fatal error. */
  retry: () => void
}

export interface UseHlsPlayerOptions {
  /** Autoplay once the manifest is parsed. Default true. */
  autoPlay?: boolean
  /** Start muted (helps autoplay policies). Default false. */
  muted?: boolean
  /** Optional stream `user_agent` (forwarded by the proxy in production). */
  userAgent?: string | null
  /** Optional stream `referrer` (forwarded by the proxy in production). */
  referrer?: string | null
}

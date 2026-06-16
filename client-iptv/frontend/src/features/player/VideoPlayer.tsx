import { forwardRef } from 'react'

import { cn } from '@/lib/utils'

export interface VideoPlayerProps {
  /** Tap/click on the video surface (used to toggle overlays or play/pause). */
  onSurfaceClick?: () => void
  /** `object-fit` for the video element. Default `contain` (no cropping). */
  fit?: 'contain' | 'cover'
  className?: string
}

/**
 * Full-bleed `<video>` surface used by the player (issue #43). It is a thin,
 * controlled element: the HLS engine lives in `useHlsPlayer`, which attaches to
 * the forwarded ref. Native controls are intentionally disabled — the custom
 * overlays/control bar drive playback.
 */
export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ onSurfaceClick, fit = 'contain', className }, ref) => {
    return (
      <video
        ref={ref}
        onClick={onSurfaceClick}
        className={cn(
          'absolute inset-0 h-full w-full bg-black',
          fit === 'cover' ? 'object-cover' : 'object-contain',
          className
        )}
        playsInline
        // Custom UI handles controls; keep the native ones off.
        controls={false}
      />
    )
  }
)
VideoPlayer.displayName = 'VideoPlayer'

import { cn } from '@/lib/utils'

export interface SpinnerProps {
  /** Diameter in pixels. */
  size?: number
  className?: string
  /** Accessible label announced to screen readers. */
  label?: string
}

/** Indeterminate ring spinner for inline / point loads. */
export function Spinner({ size = 24, className, label = 'Cargando' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-on-surface-variant/40 border-t-primary-container',
        className
      )}
      style={{ width: size, height: size }}
    />
  )
}

export interface LoadingOverlayProps {
  /** Optional caption under the spinner (e.g. "Buffering…"). */
  message?: string
  /** Render absolutely over the nearest positioned ancestor. */
  absolute?: boolean
  className?: string
}

/**
 * Full-area loading overlay for transient blocking loads (e.g. initial
 * player buffering). Dims and slightly blurs whatever sits behind it.
 */
export function LoadingOverlay({ message, absolute = true, className }: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        'z-10 flex flex-col items-center justify-center gap-4 bg-black/30 backdrop-blur-sm',
        absolute ? 'absolute inset-0' : 'flex',
        className
      )}
    >
      <Spinner size={48} />
      {message && <p className="text-label-md text-on-surface-variant">{message}</p>}
    </div>
  )
}

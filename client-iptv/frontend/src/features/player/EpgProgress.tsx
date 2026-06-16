import { cn } from '@/lib/utils'

export interface EpgProgressProps {
  /** Progress 0..1 of the current program. */
  value: number
  className?: string
}

/**
 * Thin progress bar for the live program (issue #44): 4px track in grey with a
 * red fill, matching DESIGN.md > Progress Bars and the player mockup.
 */
export function EpgProgress({ value, className }: EpgProgressProps) {
  const pct = Math.min(100, Math.max(0, value * 100))
  return (
    <div
      className={cn('h-1 w-full overflow-hidden rounded-full bg-surface-variant', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label="Progreso del programa"
    >
      <div
        className="h-full rounded-full bg-primary-container transition-[width] duration-1000 ease-linear"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

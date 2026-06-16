import type { EpgGuide, EpgProgram } from '@client-iptv/shared'

export interface EpgNowNext {
  current: EpgProgram | null
  next: EpgProgram | null
  /** Progress through the current program, 0..1. */
  progress: number
}

/** Format an ISO timestamp as a short local `HH:MM`. */
export function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

/**
 * Resolve the current and next program for a guide at time `now`, plus the
 * fractional progress through the current program. Degrades gracefully: returns
 * nulls when the guide is empty or has no programs around `now`.
 */
export function getNowNext(guide: EpgGuide | undefined, now: number = Date.now()): EpgNowNext {
  if (!guide || guide.programs.length === 0) {
    return { current: null, next: null, progress: 0 }
  }

  const sorted = [...guide.programs].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  )

  let current: EpgProgram | null = null
  let next: EpgProgram | null = null

  for (let i = 0; i < sorted.length; i += 1) {
    const program = sorted[i] as EpgProgram
    const start = new Date(program.start).getTime()
    const stop = new Date(program.stop).getTime()
    if (now >= start && now < stop) {
      current = program
      next = (sorted[i + 1] as EpgProgram | undefined) ?? null
      break
    }
    if (now < start) {
      // We're before the first upcoming program: nothing live, show it as next.
      next = program
      break
    }
  }

  let progress = 0
  if (current) {
    const start = new Date(current.start).getTime()
    const stop = new Date(current.stop).getTime()
    const span = stop - start
    if (span > 0) progress = Math.min(1, Math.max(0, (now - start) / span))
  }

  return { current, next, progress }
}

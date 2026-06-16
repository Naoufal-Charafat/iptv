import type { CSSProperties } from 'react'

import { cn } from '@/lib/utils'

export interface MaterialIconProps {
  /** Material Symbols Outlined ligature name, e.g. "play_arrow", "search". */
  name: string
  /** Render the filled variant (FILL axis = 1). */
  filled?: boolean
  /** Optical size in pixels; falls back to the surrounding font-size when omitted. */
  size?: number
  className?: string
  /** Hidden from assistive tech unless `label` is provided. */
  label?: string
}

/**
 * Thin wrapper around the Material Symbols Outlined web font loaded in
 * `index.html`. Defaults to `aria-hidden` so it can be used decoratively next
 * to text; pass `label` to expose it as an icon-only control.
 */
export function MaterialIcon({ name, filled = false, size, className, label }: MaterialIconProps) {
  const style: CSSProperties | undefined = size ? { fontSize: size } : undefined
  return (
    <span
      className={cn('material-symbols-outlined', filled && 'filled', className)}
      style={style}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {name}
    </span>
  )
}

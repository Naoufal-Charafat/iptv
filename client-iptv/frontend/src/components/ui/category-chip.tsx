import * as React from 'react'

import { MaterialIcon } from '@/components/icons/MaterialIcon'
import { cn } from '@/lib/utils'

export interface CategoryChipProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  /** Chip label. */
  label: string
  /** Active (selected) state: solid white background with black text. */
  active?: boolean
  /** Optional Material Symbols icon name shown before the label. */
  icon?: string
  /** Optional trailing count (e.g. number of channels). */
  count?: number
}

/**
 * Pill-shaped category chip per DESIGN.md > Navigation & Chips and the
 * "Trending Now" row of the Explore mockup.
 *   - inactive : semi-transparent grey, hover reveals a red border
 *   - active   : solid white background, black text
 */
export const CategoryChip = React.forwardRef<HTMLButtonElement, CategoryChipProps>(
  ({ label, active = false, icon, count, className, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        aria-pressed={active}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-label-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
          active
            ? 'border-white bg-white text-on-secondary'
            : 'border-outline-variant bg-surface-container-high/80 text-on-surface hover:border-primary-container hover:bg-surface-bright',
          className
        )}
        {...props}
      >
        {icon && <MaterialIcon name={icon} size={16} />}
        <span>{label}</span>
        {typeof count === 'number' && (
          <span
            className={cn(
              'text-label-sm',
              active ? 'text-on-secondary/70' : 'text-on-surface-variant'
            )}
          >
            {count}
          </span>
        )}
      </button>
    )
  }
)
CategoryChip.displayName = 'CategoryChip'

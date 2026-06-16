import type { ReactNode } from 'react'

import { MaterialIcon } from '@/components/icons/MaterialIcon'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  /** Material Symbols icon name. */
  icon?: string
  /** Short headline, e.g. "No results". */
  title: string
  /** Optional supporting copy. */
  description?: string
  /** Optional CTA (button/link) rendered below the text. */
  action?: ReactNode
  className?: string
}

/**
 * Reusable empty state for lists / searches with no results. Configure with an
 * icon, title, description and an optional CTA.
 */
export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  className
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-outline-variant px-6 py-20 text-center',
        className
      )}
    >
      <MaterialIcon name={icon} size={48} className="text-on-surface-variant" />
      <div className="space-y-1">
        <h3 className="text-headline-md font-bold text-on-surface">{title}</h3>
        {description && (
          <p className="mx-auto max-w-md text-body-md text-on-surface-variant">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

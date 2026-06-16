import type * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Base skeleton placeholder: a glass-tinted surface with a subtle left-to-right
 * sheen (`animate-shimmer`). Compose it into shape-specific skeletons; size it
 * to match the real content so it produces no layout shift on load.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-surface-container-high/70',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer',
        'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
        className
      )}
      aria-hidden="true"
      {...props}
    />
  )
}

export { Skeleton }

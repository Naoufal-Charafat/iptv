import type * as React from 'react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export interface BottomSheetProps {
  /** Controlled open state. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Optional trigger (uncontrolled use). */
  trigger?: React.ReactNode
  title?: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

/**
 * Mobile-friendly bottom drawer for option selection (e.g. quality / audio /
 * channel pickers in the player), built on the shadcn `Sheet` (Radix Dialog).
 * Shares the Level-3 overlay and glass styling with `Modal`, slides up from the
 * bottom, and shows a grab handle. Esc / overlay / × dismiss; focus trapped.
 */
export function BottomSheet({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  className
}: BottomSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent
        side="bottom"
        className={cn(
          'max-h-[85vh] overflow-y-auto rounded-t-xl border-x-0 border-b-0 pb-8',
          className
        )}
      >
        {/* Grab handle. */}
        <div
          className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-on-surface-variant/40"
          aria-hidden="true"
        />
        {(title || description) && (
          <SheetHeader>
            {title && <SheetTitle>{title}</SheetTitle>}
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
        )}
        {children}
      </SheetContent>
    </Sheet>
  )
}

export {
  Sheet as BottomSheetRoot,
  SheetTrigger as BottomSheetTrigger,
  SheetClose as BottomSheetClose
} from '@/components/ui/sheet'

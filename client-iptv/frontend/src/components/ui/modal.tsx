import * as React from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export type ModalSize = 'md' | 'lg' | 'fullscreen'

const sizeClass: Record<ModalSize, string> = {
  md: 'max-w-lg',
  lg: 'max-w-3xl',
  fullscreen:
    'max-w-none h-screen w-screen rounded-none left-0 top-0 translate-x-0 translate-y-0 overflow-y-auto'
}

export interface ModalProps {
  /** Controlled open state. */
  open?: boolean
  /** Open-state change handler. */
  onOpenChange?: (open: boolean) => void
  /** Optional trigger element (when used uncontrolled). */
  trigger?: React.ReactNode
  /** Large title in the header. */
  title?: React.ReactNode
  /** Optional supporting description (also improves a11y). */
  description?: React.ReactNode
  /** Dialog body. */
  children?: React.ReactNode
  /** Size preset. */
  size?: ModalSize
  /** Extra classes on the content container. */
  className?: string
}

/**
 * Reusable glassmorphism modal per DESIGN.md > Modals & Details View (Level 3):
 * 70%-black overlay that blurs the background, glass container with a large
 * title and an accessible "×" close button (provided by `DialogContent`).
 * Focus trapping, Esc and click-outside dismissal come from Radix.
 */
export function Modal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  size = 'md',
  className
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={cn(sizeClass[size], className)}>
        {(title || description) && (
          <DialogHeader className={cn(size === 'fullscreen' && 'pr-12')}>
            {title && (
              <DialogTitle
                className={cn(size === 'fullscreen' ? 'text-headline-lg' : 'text-headline-md')}
              >
                {title}
              </DialogTitle>
            )}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  )
}

export {
  Dialog as ModalRoot,
  DialogTrigger as ModalTrigger,
  DialogContent as ModalContent,
  DialogHeader as ModalHeader,
  DialogTitle as ModalTitle,
  DialogDescription as ModalDescription
} from '@/components/ui/dialog'

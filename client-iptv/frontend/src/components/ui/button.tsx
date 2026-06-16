import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { MaterialIcon } from '@/components/icons/MaterialIcon'
import { cn } from '@/lib/utils'

/**
 * Action button matching DESIGN.md > Components > Buttons.
 *
 * Variants:
 *   - `default` / `primary` : solid brand red (#e50914), white text — primary CTA.
 *   - `secondary`           : glassmorphic outline, fills on hover.
 *   - `outline`             : alias of `secondary` kept for shadcn compatibility.
 *   - `ghost`               : transparent, low-priority actions ("More Info").
 *   - `destructive` / `link`: utility variants.
 *
 * Radii follow DESIGN.md (CTAs use a precise 4-8px radius => rounded-DEFAULT).
 * `iconLeft`/`iconRight` accept Material Symbols ligature names; `loading`
 * shows a centered spinner and disables the control.
 */
const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-DEFAULT text-label-md font-bold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Primary CTA: solid brand red with white text.
        default: 'bg-primary-container text-white hover:bg-inverse-primary',
        primary: 'bg-primary-container text-white hover:bg-inverse-primary',
        destructive: 'bg-error-container text-on-error-container hover:bg-error-container/90',
        // Secondary: glassmorphic outline, fills on hover.
        secondary:
          'border border-outline-variant bg-white/5 text-on-surface backdrop-blur-md hover:bg-surface-bright hover:border-primary-container/60',
        // Outline kept as an alias of secondary (shadcn naming compatibility).
        outline:
          'border border-outline-variant bg-transparent text-on-surface hover:bg-surface-bright hover:border-primary',
        // Ghost: transparent, low-priority actions.
        ghost: 'text-on-surface hover:bg-surface-bright',
        link: 'text-primary underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-10 px-4 py-2',
        md: 'h-10 px-5 py-2',
        sm: 'h-9 rounded-DEFAULT px-3 text-label-sm',
        lg: 'h-12 rounded-DEFAULT px-8 text-body-md',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

const iconSizeForButton: Record<string, number> = { sm: 16, md: 18, default: 18, lg: 20, icon: 20 }

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Material Symbols icon name shown before the label. */
  iconLeft?: string
  /** Material Symbols icon name shown after the label. */
  iconRight?: string
  /** Show a spinner and block interaction. */
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      iconLeft,
      iconRight,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'
    const glyphSize = iconSizeForButton[size ?? 'default'] ?? 18
    const hasIcons = Boolean(iconLeft || iconRight)

    // `asChild` requires exactly one child element, so spinner/icon wrapping is
    // only applied for the plain <button> path.
    const content =
      !asChild && (loading || hasIcons) ? (
        <>
          {loading && (
            <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            </span>
          )}
          <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>
            {iconLeft && <MaterialIcon name={iconLeft} size={glyphSize} />}
            {children}
            {iconRight && <MaterialIcon name={iconRight} size={glyphSize} />}
          </span>
        </>
      ) : (
        children
      )

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={Comp === 'button' ? disabled || loading : undefined}
        data-loading={loading || undefined}
        aria-busy={loading || undefined}
        {...props}
      >
        {content}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }

import { MaterialIcon } from '@/components/icons/MaterialIcon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ErrorStateProps {
  /** Material Symbols icon name. */
  icon?: string
  /** Short headline. */
  title?: string
  /** Supporting copy / error message. */
  description?: string
  /** When provided, renders a "Retry" button that calls it (e.g. TanStack `refetch`). */
  onRetry?: () => void
  /** Custom retry button label. */
  retryLabel?: string
  className?: string
}

/**
 * Reusable error state with an optional retry action. Pass a query's `refetch`
 * to `onRetry` so the user can recover without a full reload.
 */
export function ErrorState({
  icon = 'error',
  title = 'Algo salió mal',
  description = 'No se pudo cargar el contenido. Inténtalo de nuevo.',
  onRetry,
  retryLabel = 'Reintentar',
  className
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-xl border border-outline-variant/60 bg-surface-container/40 px-6 py-20 text-center',
        className
      )}
    >
      <MaterialIcon name={icon} size={48} className="text-error" />
      <div className="space-y-1">
        <h3 className="text-headline-md font-bold text-on-surface">{title}</h3>
        {description && (
          <p className="mx-auto max-w-md text-body-md text-on-surface-variant">{description}</p>
        )}
      </div>
      {onRetry && (
        <Button variant="secondary" iconLeft="refresh" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  )
}

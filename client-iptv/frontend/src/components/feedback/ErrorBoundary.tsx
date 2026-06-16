import { Component, type ErrorInfo, type ReactNode } from 'react'

import { ErrorState } from './ErrorState'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Custom fallback; receives the caught error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /** Side-effect hook for logging/telemetry. */
  onError?: (error: Error, info: ErrorInfo) => void
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render-time errors in its subtree and shows a recoverable fallback
 * instead of unmounting the whole app. Reset clears the error and re-renders
 * the children (useful after a transient failure).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info)
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, info)
    }
  }

  private reset = (): void => {
    this.setState({ error: null })
  }

  override render(): ReactNode {
    const { error } = this.state
    if (error) {
      if (this.props.fallback) return this.props.fallback(error, this.reset)
      return (
        <div className="flex min-h-[50vh] items-center justify-center p-8">
          <ErrorState
            title="Se produjo un error inesperado"
            description={error.message}
            onRetry={this.reset}
            retryLabel="Reintentar"
          />
        </div>
      )
    }
    return this.props.children
  }
}

import * as React from 'react'

import { MaterialIcon } from '@/components/icons/MaterialIcon'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/utils'

export interface SearchBarProps {
  /** Controlled value. */
  value: string
  /** Fires on every keystroke (raw value). */
  onChange: (value: string) => void
  /**
   * Fires with the debounced value once it stabilizes. Use this to trigger the
   * actual search instead of `onChange`.
   */
  onDebouncedChange?: (value: string) => void
  /** Fires on Enter / form submit. */
  onSubmit?: (value: string) => void
  /** Debounce delay for `onDebouncedChange` (ms). */
  debounceMs?: number
  placeholder?: string
  /** Compact height for mobile headers. */
  compact?: boolean
  /** Show the decorative microphone button. */
  showMic?: boolean
  /** Autofocus the input on mount. */
  autoFocus?: boolean
  className?: string
  'aria-label'?: string
}

/**
 * Glassmorphism search field per the Explore mockup: magnifier on the left,
 * red glow on `focus-within`, a clear (×) button when there is text, and an
 * optional decorative microphone. Controlled component — the search logic lives
 * in the consuming screen.
 *
 * Accessibility: `role="search"` form, labelled input, Enter submits, Esc clears.
 */
export function SearchBar({
  value,
  onChange,
  onDebouncedChange,
  onSubmit,
  debounceMs = 300,
  placeholder = 'Search channels, movies, series...',
  compact = false,
  showMic = true,
  autoFocus = false,
  className,
  'aria-label': ariaLabel = 'Buscar canales'
}: SearchBarProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const debounced = useDebouncedValue(value, debounceMs)

  // Emit the debounced value to the consumer.
  const lastEmitted = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!onDebouncedChange) return
    if (lastEmitted.current === debounced) return
    lastEmitted.current = debounced
    onDebouncedChange(debounced)
  }, [debounced, onDebouncedChange])

  const clear = React.useCallback(() => {
    onChange('')
    inputRef.current?.focus()
  }, [onChange])

  return (
    <form
      role="search"
      className={cn('group relative w-full', className)}
      onSubmit={event => {
        event.preventDefault()
        onSubmit?.(value)
      }}
    >
      {/* Red glow halo on focus. */}
      <div className="pointer-events-none absolute -inset-0.5 rounded-xl bg-gradient-to-r from-primary-container to-outline-variant opacity-0 blur transition duration-500 group-focus-within:opacity-30" />

      <div
        className={cn(
          'relative flex w-full items-center overflow-hidden rounded-xl border border-outline-variant bg-surface-container-high/80 backdrop-blur-xl transition-colors focus-within:border-primary/60'
        )}
      >
        <span className={cn('pointer-events-none flex items-center', compact ? 'pl-4' : 'pl-6')}>
          <MaterialIcon
            name="search"
            size={compact ? 20 : 24}
            className="text-on-surface-variant"
          />
        </span>

        <input
          ref={inputRef}
          value={value}
          onChange={event => onChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Escape' && value) {
              event.preventDefault()
              clear()
            }
          }}
          autoFocus={autoFocus}
          type="search"
          aria-label={ariaLabel}
          placeholder={placeholder}
          className={cn(
            'w-full border-none bg-transparent text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-0',
            // Hide the native search clear control; we render our own.
            '[&::-webkit-search-cancel-button]:appearance-none',
            compact ? 'py-3 pl-3 pr-2 text-body-md' : 'py-5 pl-4 pr-3 text-body-lg'
          )}
        />

        {value && (
          <button
            type="button"
            onClick={clear}
            aria-label="Limpiar búsqueda"
            className="flex shrink-0 items-center justify-center rounded-full p-1 text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MaterialIcon name="close" size={compact ? 18 : 20} />
          </button>
        )}

        {showMic && (
          <button
            type="button"
            aria-label="Búsqueda por voz"
            tabIndex={-1}
            className={cn(
              'flex shrink-0 items-center justify-center text-on-surface-variant transition-colors hover:text-on-surface',
              compact ? 'pr-4' : 'pr-6 pl-2'
            )}
          >
            <MaterialIcon name="mic" size={compact ? 20 : 24} />
          </button>
        )}
      </div>
    </form>
  )
}

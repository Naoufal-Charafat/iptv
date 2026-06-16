import { useEffect, useState } from 'react'

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms have
 * elapsed without a new change. Useful to avoid firing a search on every
 * keystroke.
 *
 * @param value Source value to debounce.
 * @param delay Debounce delay in milliseconds (default 300).
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  return debounced
}

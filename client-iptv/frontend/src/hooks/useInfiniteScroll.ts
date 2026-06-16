import { useEffect, useRef } from 'react'

export interface UseInfiniteScrollOptions {
  /** Whether more pages exist. */
  hasNextPage: boolean
  /** Whether a page fetch is already in flight. */
  isFetching: boolean
  /** Loads the next page. */
  fetchNextPage: () => void
  /** Root margin for the sentinel observer. Default "600px". */
  rootMargin?: string
}

/**
 * IntersectionObserver-based infinite scroll (issue #42). Attach the returned
 * ref to a sentinel element at the end of the list; when it enters the viewport
 * (within `rootMargin`) and more pages exist, `fetchNextPage` is called.
 */
export function useInfiniteScroll<T extends HTMLElement = HTMLDivElement>({
  hasNextPage,
  isFetching,
  fetchNextPage,
  rootMargin = '600px'
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<T>(null)

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasNextPage) return

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        if (entry?.isIntersecting && hasNextPage && !isFetching) {
          fetchNextPage()
        }
      },
      { rootMargin }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, isFetching, fetchNextPage, rootMargin])

  return sentinelRef
}

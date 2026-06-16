import { useInfiniteQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'
import { searchChannels } from './api'

/** Infinite search over channels. Disabled while the query is empty. */
export function useSearch(query: string, limit = 24) {
  const trimmed = query.trim()
  return useInfiniteQuery({
    queryKey: queryKeys.search({ q: trimmed, limit }),
    queryFn: ({ pageParam, signal }) =>
      searchChannels({ q: trimmed, limit, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    enabled: trimmed.length > 0
  })
}

import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'
import { getHomeContent, getTrending } from './api'

export function useHomeContent() {
  return useQuery({
    queryKey: queryKeys.home(),
    queryFn: ({ signal }) => getHomeContent(signal)
  })
}

export function useTrending() {
  return useQuery({
    queryKey: queryKeys.trending(),
    queryFn: ({ signal }) => getTrending(signal)
  })
}

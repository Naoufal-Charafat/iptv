import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'
import { getChannelEpg } from './api'

export function useEpg(channelId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.epg(channelId ?? ''),
    queryFn: ({ signal }) => getChannelEpg(channelId as string, signal),
    enabled: Boolean(channelId)
  })
}

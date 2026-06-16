import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'
import type { ChannelListParams } from '@client-iptv/shared'
import { getChannel, getChannelStreams, listChannels } from './api'

/** Infinite, cursor-paginated channel list (supports filters + search). */
export function useChannels(params: ChannelListParams = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.channelList(params),
    queryFn: ({ pageParam, signal }) => listChannels({ ...params, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined
  })
}

export function useChannel(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.channel(id ?? ''),
    queryFn: ({ signal }) => getChannel(id as string, signal),
    enabled: Boolean(id)
  })
}

export function useChannelStreams(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.channelStreams(id ?? ''),
    queryFn: ({ signal }) => getChannelStreams(id as string, signal),
    enabled: Boolean(id)
  })
}

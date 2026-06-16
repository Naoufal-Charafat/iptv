import { apiClient } from '@/lib/apiClient'
import type {
  ChannelDetail,
  ChannelListParams,
  ChannelSummary,
  Paginated,
  Stream
} from '@client-iptv/shared'

export function listChannels(
  params: ChannelListParams,
  signal?: AbortSignal
): Promise<Paginated<ChannelSummary>> {
  return apiClient.get<Paginated<ChannelSummary>>('/channels', {
    params: {
      q: params.q,
      country: params.country,
      category: params.category,
      language: params.language,
      region: params.region,
      cursor: params.cursor,
      limit: params.limit
    },
    signal
  })
}

export function getChannel(id: string, signal?: AbortSignal): Promise<ChannelDetail> {
  return apiClient.get<ChannelDetail>(`/channels/${encodeURIComponent(id)}`, { signal })
}

export function getChannelStreams(id: string, signal?: AbortSignal): Promise<Stream[]> {
  return apiClient.get<Stream[]>(`/channels/${encodeURIComponent(id)}/streams`, { signal })
}

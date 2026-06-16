import { apiClient } from '@/lib/apiClient'
import type { ChannelSummary, Paginated, SearchParams } from '@client-iptv/shared'

export function searchChannels(
  params: SearchParams,
  signal?: AbortSignal
): Promise<Paginated<ChannelSummary>> {
  return apiClient.get<Paginated<ChannelSummary>>('/search', {
    params: { q: params.q, cursor: params.cursor, limit: params.limit },
    signal
  })
}

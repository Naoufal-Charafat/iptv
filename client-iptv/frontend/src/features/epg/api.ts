import { apiClient } from '@/lib/apiClient'
import type { EpgGuide } from '@client-iptv/shared'

export function getChannelEpg(channelId: string, signal?: AbortSignal): Promise<EpgGuide> {
  return apiClient.get<EpgGuide>(`/channels/${encodeURIComponent(channelId)}/epg`, { signal })
}

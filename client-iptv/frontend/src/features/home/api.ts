import { apiClient } from '@/lib/apiClient'
import type { HomeContent, TrendingItem } from '@client-iptv/shared'

export function getHomeContent(signal?: AbortSignal): Promise<HomeContent> {
  return apiClient.get<HomeContent>('/home', { signal })
}

export function getTrending(signal?: AbortSignal): Promise<TrendingItem[]> {
  return apiClient.get<TrendingItem[]>('/trending', { signal })
}

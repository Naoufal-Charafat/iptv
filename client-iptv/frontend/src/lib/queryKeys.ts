import type { ChannelListParams, Dimension, SearchParams } from '@client-iptv/shared'

/**
 * Centralized React Query key factory. Every hook derives its `queryKey`
 * from here so cache invalidation stays consistent across the app.
 */
export const queryKeys = {
  all: ['iptv'] as const,

  home: () => [...queryKeys.all, 'home'] as const,

  trending: () => [...queryKeys.all, 'trending'] as const,

  channels: () => [...queryKeys.all, 'channels'] as const,
  channelList: (params: ChannelListParams) => [...queryKeys.channels(), 'list', params] as const,
  channel: (id: string) => [...queryKeys.channels(), 'detail', id] as const,
  channelStreams: (id: string) => [...queryKeys.channels(), 'streams', id] as const,

  search: (params: SearchParams) => [...queryKeys.all, 'search', params] as const,

  dimensions: () => [...queryKeys.all, 'dimensions'] as const,
  dimensionItems: (dimension: Dimension) => [...queryKeys.dimensions(), dimension] as const,

  epg: (channelId: string) => [...queryKeys.all, 'epg', channelId] as const
} as const

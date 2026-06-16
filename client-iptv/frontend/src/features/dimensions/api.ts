import { apiClient } from '@/lib/apiClient'
import type { Dimension, DimensionItem } from '@client-iptv/shared'

/** Metadata describing each of the 8 navigation dimensions. */
export function listDimensions(signal?: AbortSignal): Promise<DimensionItem[]> {
  return apiClient.get<DimensionItem[]>('/dimensions', { signal })
}

export function getDimensionItems(
  dimension: Dimension,
  signal?: AbortSignal
): Promise<DimensionItem[]> {
  return apiClient.get<DimensionItem[]>(`/dimensions/${dimension}`, { signal })
}

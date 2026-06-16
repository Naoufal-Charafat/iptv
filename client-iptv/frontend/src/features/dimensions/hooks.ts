import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'
import type { Dimension } from '@client-iptv/shared'
import { getDimensionItems, listDimensions } from './api'

export function useDimensions() {
  return useQuery({
    queryKey: queryKeys.dimensions(),
    queryFn: ({ signal }) => listDimensions(signal)
  })
}

export function useDimensionItems(dimension: Dimension | undefined) {
  return useQuery({
    queryKey: queryKeys.dimensionItems(dimension ?? 'categories'),
    queryFn: ({ signal }) => getDimensionItems(dimension as Dimension, signal),
    enabled: Boolean(dimension)
  })
}

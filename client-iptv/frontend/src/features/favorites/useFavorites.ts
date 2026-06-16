import { useCallback, useSyncExternalStore } from 'react'

import type { ChannelSummary } from '@client-iptv/shared'
import { favoritesStore } from './store'

export interface UseFavoritesResult {
  /** Favorite channels, most-recently-added first. */
  favorites: ChannelSummary[]
  /** Number of favorites. */
  count: number
  /** Whether the channel id is currently favorited. */
  isFavorite: (id: string) => boolean
  /** Add or remove a channel from favorites. */
  toggleFavorite: (channel: ChannelSummary) => void
  /** Remove a channel by id. */
  removeFavorite: (id: string) => void
  /** Clear all favorites. */
  clearFavorites: () => void
}

/**
 * React binding for the localStorage-backed favorites store. Stays in sync
 * across components and across browser tabs.
 */
export function useFavorites(): UseFavoritesResult {
  const favorites = useSyncExternalStore(
    favoritesStore.subscribe,
    favoritesStore.getSnapshot,
    favoritesStore.getSnapshot
  )

  const isFavorite = useCallback((id: string) => favorites.some(c => c.id === id), [favorites])
  const toggleFavorite = useCallback(
    (channel: ChannelSummary) => favoritesStore.toggle(channel),
    []
  )
  const removeFavorite = useCallback((id: string) => favoritesStore.remove(id), [])
  const clearFavorites = useCallback(() => favoritesStore.clear(), [])

  return {
    favorites,
    count: favorites.length,
    isFavorite,
    toggleFavorite,
    removeFavorite,
    clearFavorites
  }
}

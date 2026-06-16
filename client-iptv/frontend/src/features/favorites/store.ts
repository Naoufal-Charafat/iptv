import type { ChannelSummary } from '@client-iptv/shared'

/**
 * Client-only favorites store (personal use, no backend / no login).
 *
 * Implemented as a tiny observable backed by localStorage so it can be consumed
 * with React's `useSyncExternalStore` (no extra dependency). Favorites are
 * stored as full `ChannelSummary` snapshots so the `/favoritos` page can render
 * without re-fetching. Persistence is versioned and tolerant of corrupt JSON,
 * and changes propagate across tabs via the `storage` event.
 */

const STORAGE_KEY = 'client-iptv:favorites'
const SCHEMA_VERSION = 1

interface PersistedShape {
  version: number
  items: ChannelSummary[]
}

type Listener = () => void

const listeners = new Set<Listener>()

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage)
  } catch {
    return false
  }
}

function readFromStorage(): ChannelSummary[] {
  if (!hasStorage()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === 'object' &&
      'items' in parsed &&
      Array.isArray((parsed as PersistedShape).items)
    ) {
      // Future migrations would branch on `version` here.
      return (parsed as PersistedShape).items.filter(
        (item): item is ChannelSummary =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as ChannelSummary).id === 'string'
      )
    }
    return []
  } catch {
    // Corrupt JSON or unexpected shape — start clean rather than crash.
    return []
  }
}

// In-memory cache kept in sync with storage; the source of truth for snapshots.
let state: ChannelSummary[] = readFromStorage()

function emit(): void {
  for (const listener of listeners) listener()
}

function persist(next: ChannelSummary[]): void {
  state = next
  if (hasStorage()) {
    try {
      const payload: PersistedShape = { version: SCHEMA_VERSION, items: next }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Quota / private-mode errors are non-fatal; in-memory state still updates.
    }
  }
  emit()
}

export const favoritesStore = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },

  getSnapshot(): ChannelSummary[] {
    return state
  },

  isFavorite(id: string): boolean {
    return state.some(channel => channel.id === id)
  },

  add(channel: ChannelSummary): void {
    if (state.some(c => c.id === channel.id)) return
    persist([channel, ...state])
  },

  remove(id: string): void {
    if (!state.some(c => c.id === id)) return
    persist(state.filter(c => c.id !== id))
  },

  toggle(channel: ChannelSummary): void {
    if (state.some(c => c.id === channel.id)) {
      favoritesStore.remove(channel.id)
    } else {
      favoritesStore.add(channel)
    }
  },

  clear(): void {
    persist([])
  }
}

// Cross-tab synchronization: re-read storage when another tab writes the key.
if (hasStorage()) {
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) {
      state = readFromStorage()
      emit()
    }
  })
}

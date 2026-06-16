import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/feedback/EmptyState'
import { MaterialIcon } from '@/components/icons/MaterialIcon'
import { SearchBar } from '@/components/search/SearchBar'
import { ChannelGrid } from '@/features/browser/ChannelGrid'
import { FilterPanel } from '@/features/browser/FilterPanel'
import { useChannels } from '@/features/channels/hooks'
import { useDimensionItems } from '@/features/dimensions/hooks'
import { dedupeById } from '@/lib/utils'
import { DIMENSIONS, type ChannelListParams, type Dimension } from '@client-iptv/shared'

function isDimension(value: string | undefined): value is Dimension {
  return DIMENSIONS.includes(value as Dimension)
}

const DIMENSION_LABEL: Record<Dimension, string> = {
  categories: 'Categories',
  cities: 'Cities',
  countries: 'Countries',
  languages: 'Languages',
  regions: 'Regions',
  sources: 'Sources',
  subdivisions: 'Subdivisions',
  raw: 'Raw'
}

/**
 * Map a selected dimension entry to the backend channel filter param. Dimensions
 * with a first-class filter use it; the rest fall back to a free-text `q` on the
 * entry name so the list still narrows meaningfully (incl. against the mocks).
 */
function paramsForSelection(
  dimension: Dimension,
  entryId: string | null,
  entryName: string | undefined,
  q: string
): ChannelListParams {
  const base: ChannelListParams = { limit: 24 }
  if (q.trim()) base.q = q.trim()
  if (!entryId) return base

  switch (dimension) {
    case 'categories':
      return { ...base, category: entryId }
    case 'countries':
      return { ...base, country: entryId }
    case 'languages':
      return { ...base, language: entryId }
    case 'regions':
      return { ...base, region: entryId }
    default:
      // cities / subdivisions / sources / raw: no dedicated filter yet.
      return { ...base, q: (base.q ? `${base.q} ` : '') + (entryName ?? entryId) }
  }
}

export function ChannelBrowserPage() {
  const { dimension } = useParams<{ dimension: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const valid = isDimension(dimension)

  const initialQ = searchParams.get('q') ?? ''
  const [input, setInput] = useState(initialQ)
  const [query, setQuery] = useState(initialQ)
  const [activeId, setActiveId] = useState<string | null>(null)

  const itemsQuery = useDimensionItems(valid ? dimension : undefined)
  const activeItem = itemsQuery.data?.find(i => i.id === activeId)

  const params = useMemo<ChannelListParams>(
    () =>
      valid
        ? paramsForSelection(dimension, activeId, activeItem?.name, query)
        : { limit: 24, q: query.trim() || undefined },
    [valid, dimension, activeId, activeItem?.name, query]
  )

  const channels = useChannels(params)
  const items = dedupeById(channels.data?.pages.flatMap(p => p.data) ?? [])
  const total = channels.data?.pages[0]?.total

  const syncQueryParam = (value: string) => {
    setQuery(value)
    const nextParams = new URLSearchParams(searchParams)
    if (value.trim()) nextParams.set('q', value.trim())
    else nextParams.delete('q')
    setSearchParams(nextParams, { replace: true })
  }

  if (!valid) {
    return (
      <div className="p-12">
        <EmptyState
          icon="help"
          title="Dimensión desconocida"
          description={`No reconocemos “${dimension}”.`}
        />
      </div>
    )
  }

  const hasActiveFilters = Boolean(activeId) || Boolean(query.trim())

  const clearAll = () => {
    setActiveId(null)
    setInput('')
    syncQueryParam('')
  }

  return (
    <div className="mx-auto w-full max-w-container-max px-margin-mobile py-8 md:py-12 md:pb-24">
      <h1 className="mb-4 text-headline-md font-bold tracking-tight text-on-surface md:mb-6 md:text-headline-lg">
        {DIMENSION_LABEL[dimension]}
      </h1>

      {/* Search refinement */}
      <SearchBar
        className="mb-6 max-w-2xl md:mb-8"
        compact
        value={input}
        onChange={setInput}
        onDebouncedChange={syncQueryParam}
        onSubmit={syncQueryParam}
        placeholder={`Buscar en ${DIMENSION_LABEL[dimension].toLowerCase()}…`}
      />

      {/* Sub-filter chips */}
      <FilterPanel
        items={itemsQuery.data}
        isLoading={itemsQuery.isLoading}
        activeId={activeId}
        onSelect={setActiveId}
      />

      {/* Result count + active filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-headline-md font-bold text-on-surface">
          Channels
          {typeof total === 'number' && (
            <span className="ml-2 text-body-md font-normal text-on-surface-variant">
              {total} resultado{total === 1 ? '' : 's'}
            </span>
          )}
        </h2>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            {activeItem && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-3 py-1 text-label-sm text-on-surface">
                {activeItem.name}
              </span>
            )}
            {query.trim() && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-3 py-1 text-label-sm text-on-surface">
                “{query.trim()}”
              </span>
            )}
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 text-label-md text-primary transition-colors hover:text-on-surface"
            >
              <MaterialIcon name="close" size={16} />
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      <ChannelGrid
        channels={items}
        isLoading={channels.isLoading}
        isError={channels.isError}
        onRetry={() => channels.refetch()}
        hasNextPage={Boolean(channels.hasNextPage)}
        isFetchingNextPage={channels.isFetchingNextPage}
        fetchNextPage={() => channels.fetchNextPage()}
      />
    </div>
  )
}

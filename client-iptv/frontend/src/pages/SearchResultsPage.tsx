import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/feedback/EmptyState'
import { SearchBar } from '@/components/search/SearchBar'
import { ChannelGrid } from '@/features/browser/ChannelGrid'
import { useSearch } from '@/features/search/hooks'
import { dedupeById } from '@/lib/utils'

/**
 * Dedicated search results listing (`/buscar?q=`) reached from the Explore
 * search bar / trending chips (issues #41 + #42). Reuses `ChannelGrid` with
 * infinite scroll over the search results.
 */
export function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQ = searchParams.get('q') ?? ''
  const [input, setInput] = useState(initialQ)
  const [query, setQuery] = useState(initialQ)

  const search = useSearch(query)
  const results = dedupeById(search.data?.pages.flatMap(p => p.data) ?? [])
  const total = search.data?.pages[0]?.total
  const trimmed = query.trim()

  const syncQuery = (value: string) => {
    setQuery(value)
    const next = new URLSearchParams(searchParams)
    if (value.trim()) next.set('q', value.trim())
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="mx-auto w-full max-w-container-max px-margin-mobile py-8 md:py-12 md:pb-24">
      <SearchBar
        className="mb-6 max-w-2xl md:mb-8"
        autoFocus
        value={input}
        onChange={setInput}
        onDebouncedChange={syncQuery}
        onSubmit={syncQuery}
      />

      {!trimmed ? (
        <EmptyState
          icon="search"
          title="Busca canales"
          description="Escribe arriba para encontrar canales por nombre."
        />
      ) : (
        <>
          <h1 className="mb-4 text-headline-md font-bold text-on-surface">
            Resultados para “{trimmed}”
            {typeof total === 'number' && (
              <span className="ml-2 text-body-md font-normal text-on-surface-variant">
                {total} resultado{total === 1 ? '' : 's'}
              </span>
            )}
          </h1>
          <ChannelGrid
            channels={results}
            isLoading={search.isLoading}
            isError={search.isError}
            onRetry={() => search.refetch()}
            hasNextPage={Boolean(search.hasNextPage)}
            isFetchingNextPage={search.isFetchingNextPage}
            fetchNextPage={() => search.fetchNextPage()}
            emptyTitle="Sin resultados"
            emptyDescription={`No encontramos canales para “${trimmed}”.`}
          />
        </>
      )}
    </div>
  )
}

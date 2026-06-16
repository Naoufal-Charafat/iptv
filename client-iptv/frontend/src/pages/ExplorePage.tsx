import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { DimensionGridSkeleton } from '@/components/feedback/ListSkeletons'
import { SearchBar } from '@/components/search/SearchBar'
import { DimensionCard } from '@/features/explore/DimensionCard'
import { TrendingChips } from '@/features/explore/TrendingChips'
import { useDimensions } from '@/features/dimensions/hooks'
import { useIsMobile } from '@/hooks/useIsMobile'
import { DIMENSIONS, type Dimension } from '@client-iptv/shared'

function isDimension(value: string): value is Dimension {
  return DIMENSIONS.includes(value as Dimension)
}

export function ExplorePage() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const isMobile = useIsMobile()

  const { data: dimensions, isLoading: dimsLoading } = useDimensions()

  const runSearch = (term: string) => {
    const q = term.trim()
    if (q) navigate(`/buscar?q=${encodeURIComponent(q)}`)
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Sticky glass search header (compact on mobile) */}
      <header className="pt-safe glass-panel sticky top-0 z-30 w-full px-margin-mobile py-4 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] md:px-margin-desktop md:py-12">
        <div className="mx-auto max-w-container-max">
          <SearchBar
            className="mx-auto max-w-3xl"
            compact={isMobile}
            value={input}
            onChange={setInput}
            onSubmit={runSearch}
          />
        </div>
      </header>

      <div className="mx-auto w-full max-w-container-max flex-1 px-margin-mobile py-8 md:py-12 md:pb-24">
        <div className="mb-6 md:mb-10">
          <h2 className="mb-2 text-headline-md font-bold tracking-tight text-on-surface md:text-headline-lg">
            Discover Contents
          </h2>
          <p className="text-body-md text-on-surface-variant">
            Browse our massive library by category
          </p>
        </div>

        {/* Bento grid: the 8 navigation dimensions */}
        {dimsLoading ? (
          <DimensionGridSkeleton />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
            {(dimensions ?? [])
              .filter(dim => isDimension(dim.id))
              .map(dim => (
                <DimensionCard
                  key={dim.id}
                  dimension={dim.id as Dimension}
                  name={dim.name}
                  subtitle={dim.subtitle}
                  icon={dim.glyph}
                />
              ))}
          </div>
        )}

        {/* Trending */}
        <TrendingChips onSelect={runSearch} />
      </div>
    </div>
  )
}

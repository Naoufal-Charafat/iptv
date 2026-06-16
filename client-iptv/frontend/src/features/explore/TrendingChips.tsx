import { CategoryChip } from '@/components/ui/category-chip'
import { ChipListSkeleton } from '@/components/feedback/ListSkeletons'
import { useTrending } from '@/features/home/hooks'

export interface TrendingChipsProps {
  /** Fired with the chip's search query when pressed. */
  onSelect: (query: string) => void
}

/**
 * "Trending Now" chips (issue #41), fed by `useTrending`. Pressing a chip runs
 * the associated search query.
 */
export function TrendingChips({ onSelect }: TrendingChipsProps) {
  const { data, isLoading } = useTrending()

  if (isLoading) {
    return (
      <div className="mt-16">
        <h3 className="mb-4 text-headline-md font-bold text-on-surface">Trending Now</h3>
        <ChipListSkeleton />
      </div>
    )
  }

  if (!data || data.length === 0) return null

  return (
    <div className="mt-16">
      <h3 className="mb-4 text-headline-md font-bold text-on-surface">Trending Now</h3>
      <div className="flex flex-wrap gap-3">
        {data.map(item => (
          <CategoryChip key={item.id} label={item.label} onClick={() => onSelect(item.query)} />
        ))}
      </div>
    </div>
  )
}

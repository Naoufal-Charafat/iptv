import { useState } from 'react'

import { ChipListSkeleton } from '@/components/feedback/ListSkeletons'
import { MaterialIcon } from '@/components/icons/MaterialIcon'
import { CategoryChip } from '@/components/ui/category-chip'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { DimensionItem } from '@client-iptv/shared'

export interface FilterPanelProps {
  /** Dimension entries rendered as selectable chips. */
  items: DimensionItem[] | undefined
  isLoading: boolean
  /** Currently selected entry id (or null = all). */
  activeId: string | null
  onSelect: (id: string | null) => void
}

/** The chip list itself (shared by the desktop inline view and the mobile sheet). */
function ChipList({
  items,
  activeId,
  onSelect
}: {
  items: DimensionItem[]
  activeId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map(item => (
        <CategoryChip
          key={item.id}
          label={item.glyph ? `${item.glyph} ${item.name}` : item.name}
          count={item.channelCount}
          active={activeId === item.id}
          onClick={() => onSelect(activeId === item.id ? null : item.id)}
        />
      ))}
    </div>
  )
}

/**
 * Sub-filter chips for the active dimension (issue #42). Selecting a chip
 * refines the channel query; selecting it again clears it.
 *
 * Responsive (issue #47): on desktop the chips render inline; on mobile a
 * compact "Filtros" button opens the chip list in a {@link BottomSheet} so the
 * (potentially long) list does not push the grid down the page.
 */
export function FilterPanel({ items, isLoading, activeId, onSelect }: FilterPanelProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  if (isLoading) return <ChipListSkeleton className="mb-8" />
  if (!items || items.length === 0) return null

  if (isMobile) {
    const active = items.find(i => i.id === activeId)
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="mb-8 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-4 py-2 text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-bright"
        >
          <MaterialIcon name="tune" size={20} />
          <span>{active ? active.name : 'Filtros'}</span>
          {active && <span className="h-2 w-2 rounded-full bg-primary-container" />}
        </button>

        <BottomSheet open={open} onOpenChange={setOpen} title="Filtrar">
          {activeId && (
            <button
              type="button"
              onClick={() => {
                onSelect(null)
                setOpen(false)
              }}
              className="mb-4 flex min-h-[44px] items-center gap-2 text-label-md text-primary"
            >
              <MaterialIcon name="close" size={18} />
              Quitar filtro
            </button>
          )}
          <ChipList
            items={items}
            activeId={activeId}
            onSelect={id => {
              onSelect(id)
              setOpen(false)
            }}
          />
        </BottomSheet>
      </>
    )
  }

  return (
    <div className="mb-8">
      <ChipList items={items} activeId={activeId} onSelect={onSelect} />
    </div>
  )
}

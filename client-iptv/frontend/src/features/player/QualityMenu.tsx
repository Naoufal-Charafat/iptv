import { MaterialIcon } from '@/components/icons/MaterialIcon'
import { cn } from '@/lib/utils'
import { AUTO_QUALITY, type HlsPlayerState } from './playerTypes'

export interface QualityMenuProps {
  levels: HlsPlayerState['levels']
  currentLevel: number
  activeLevel: number
  onSelect: (levelIndex: number) => void
}

/** Resolution picker fed by `useHlsPlayer` (issue #45). Includes "Auto". */
export function QualityMenu({ levels, currentLevel, activeLevel, onSelect }: QualityMenuProps) {
  if (levels.length === 0) {
    return <p className="px-2 py-3 text-label-md text-on-surface-variant">Calidad no disponible.</p>
  }

  return (
    <ul className="flex flex-col gap-1" role="menu" aria-label="Calidad">
      {levels.map(level => {
        const selected = currentLevel === level.index
        const isAuto = level.index === AUTO_QUALITY
        const activeLabel =
          isAuto && currentLevel === AUTO_QUALITY
            ? levels.find(l => l.index === activeLevel)?.label
            : undefined
        return (
          <li key={level.index} role="none">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              onClick={() => onSelect(level.index)}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-DEFAULT px-3 py-2 text-left text-body-md transition-colors hover:bg-surface-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'text-primary' : 'text-on-surface'
              )}
            >
              <span className="flex items-center gap-2">
                {level.label}
                {activeLabel && (
                  <span className="text-label-sm text-on-surface-variant">({activeLabel})</span>
                )}
              </span>
              {selected && <MaterialIcon name="check" size={18} className="text-primary" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

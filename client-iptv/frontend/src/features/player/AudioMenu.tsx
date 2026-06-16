import { MaterialIcon } from '@/components/icons/MaterialIcon'
import { cn } from '@/lib/utils'
import type { HlsPlayerState } from './playerTypes'

export interface AudioMenuProps {
  tracks: HlsPlayerState['audioTracks']
  currentAudioTrack: number
  onSelect: (id: number) => void
}

/** Audio-track picker fed by `useHlsPlayer` (issue #45). */
export function AudioMenu({ tracks, currentAudioTrack, onSelect }: AudioMenuProps) {
  if (tracks.length === 0) {
    return (
      <p className="px-2 py-3 text-label-md text-on-surface-variant">
        Sin pistas de audio alternativas.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-1" role="menu" aria-label="Audio">
      {tracks.map(track => {
        const selected = currentAudioTrack === track.id
        return (
          <li key={track.id} role="none">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              onClick={() => onSelect(track.id)}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-DEFAULT px-3 py-2 text-left text-body-md transition-colors hover:bg-surface-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'text-primary' : 'text-on-surface'
              )}
            >
              <span className="flex items-center gap-2">
                {track.name}
                {track.lang && (
                  <span className="text-label-sm uppercase text-on-surface-variant">
                    {track.lang}
                  </span>
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

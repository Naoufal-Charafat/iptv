import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { MaterialIcon } from '@/components/icons/MaterialIcon'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useFavorites } from '@/features/favorites/useFavorites'
import { cn } from '@/lib/utils'
import type { ChannelSummary } from '@client-iptv/shared'
import { AudioMenu } from './AudioMenu'
import { ChannelSwitcher } from './ChannelSwitcher'
import { EpgPanel } from './EpgPanel'
import { QualityMenu } from './QualityMenu'
import { useIsMobile } from './useIsMobile'
import { AUTO_QUALITY, type HlsPlayerControls, type HlsPlayerState } from './playerTypes'

type PanelId = 'channels' | 'favorites' | 'audio' | 'quality' | 'epg'

export interface PlayerControlBarProps {
  channel: ChannelSummary | null
  channelId?: string
  state: HlsPlayerState
  controls: HlsPlayerControls
  /** Whether overlays are visible. */
  visible: boolean
  /** Switch the playing channel in place. */
  onSelectChannel: (channelId: string) => void
  /** Notify the page that a panel is open (so overlays stay visible). */
  onOpenChange?: (open: boolean) => void
}

interface ControlDef {
  id: PanelId
  icon: string
  label: string
  /** Optional sublabel shown on desktop (e.g. current quality/audio). */
  sublabel?: string
}

/**
 * Bottom control bar of the player (issue #45): Channels, Favorites, Audio,
 * Quality and EPG. The active control is highlighted in red; each opens a panel
 * (popover on desktop, bottom sheet on mobile). Quality/Audio reflect and apply
 * the real `useHlsPlayer` levels/tracks; Favorites toggles the persisted store.
 */
export function PlayerControlBar({
  channel,
  channelId,
  state,
  controls,
  visible,
  onSelectChannel,
  onOpenChange
}: PlayerControlBarProps) {
  const isMobile = useIsMobile()
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null)
  const { isFavorite, toggleFavorite } = useFavorites()
  const favorited = channel ? isFavorite(channel.id) : false

  const setOpen = (id: PanelId | null) => {
    setOpenPanel(id)
    onOpenChange?.(id !== null)
  }

  const currentQuality =
    state.currentLevel === AUTO_QUALITY
      ? 'Auto'
      : (state.levels.find(l => l.index === state.currentLevel)?.label ?? 'Auto')
  const currentAudio =
    state.audioTracks.find(t => t.id === state.currentAudioTrack)?.lang?.toUpperCase() ??
    state.audioTracks.find(t => t.id === state.currentAudioTrack)?.name ??
    null

  const controlDefs: ControlDef[] = [
    { id: 'channels', icon: 'grid_view', label: 'Channels' },
    { id: 'favorites', icon: 'favorite', label: 'Favorites' },
    { id: 'audio', icon: 'language', label: 'Audio', sublabel: currentAudio ?? undefined },
    { id: 'quality', icon: 'tune', label: 'Quality', sublabel: currentQuality },
    { id: 'epg', icon: 'calendar_month', label: 'EPG' }
  ]

  const panelContent = (id: PanelId): ReactNode => {
    switch (id) {
      case 'channels':
        return (
          <ChannelSwitcher
            currentChannelId={channelId}
            onSelect={next => {
              onSelectChannel(next)
              setOpen(null)
            }}
          />
        )
      case 'audio':
        return (
          <AudioMenu
            tracks={state.audioTracks}
            currentAudioTrack={state.currentAudioTrack}
            onSelect={id => {
              controls.setAudioTrack(id)
              if (!isMobile) setOpen(null)
            }}
          />
        )
      case 'quality':
        return (
          <QualityMenu
            levels={state.levels}
            currentLevel={state.currentLevel}
            activeLevel={state.activeLevel}
            onSelect={index => {
              controls.setQuality(index)
              if (!isMobile) setOpen(null)
            }}
          />
        )
      case 'epg':
        return <EpgPanel channelId={channelId} />
      case 'favorites':
        return (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => channel && toggleFavorite(channel)}
              disabled={!channel}
              className={cn(
                'flex items-center gap-3 rounded-DEFAULT px-3 py-3 text-left text-body-md transition-colors hover:bg-surface-bright disabled:opacity-50',
                favorited ? 'text-primary' : 'text-on-surface'
              )}
            >
              <MaterialIcon name="favorite" filled={favorited} size={22} />
              {favorited ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            </button>
            <Link
              to="/favoritos"
              onClick={() => setOpen(null)}
              className="flex items-center gap-3 rounded-DEFAULT px-3 py-3 text-body-md text-on-surface transition-colors hover:bg-surface-bright"
            >
              <MaterialIcon name="open_in_new" size={22} />
              Ver mis favoritos
            </Link>
          </div>
        )
      default:
        return null
    }
  }

  const panelTitle: Record<PanelId, string> = {
    channels: 'Canales',
    favorites: 'Favoritos',
    audio: 'Audio',
    quality: 'Calidad',
    epg: 'Programación'
  }

  const buttonClass = (active: boolean) =>
    cn(
      'flex min-w-[64px] flex-col items-center gap-1 rounded-lg px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      active ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
    )

  const renderTrigger = (def: ControlDef) => {
    const active = openPanel === def.id || (def.id === 'favorites' && favorited)
    return (
      <>
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-DEFAULT',
            openPanel === def.id && 'bg-primary-container text-white'
          )}
        >
          <MaterialIcon
            name={def.icon}
            filled={def.id === 'favorites' ? favorited : openPanel === def.id}
            size={22}
          />
        </span>
        <span className="hidden text-label-sm font-semibold md:inline">
          {def.label}
          {def.sublabel ? ` (${def.sublabel})` : ''}
        </span>
        <span className="sr-only">{active ? `${def.label} activo` : def.label}</span>
      </>
    )
  }

  return (
    <nav
      aria-label="Controles del reproductor"
      className={cn(
        'pb-safe pl-safe pr-safe absolute inset-x-0 bottom-0 z-30 flex items-center justify-around gap-1 bg-gradient-to-t from-black/90 to-transparent px-2 py-3 transition-opacity duration-300 md:justify-center md:gap-6 md:py-4',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      )}
    >
      {controlDefs.map(def => {
        const isOpen = openPanel === def.id

        if (isMobile) {
          return (
            <div key={def.id}>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                className={buttonClass(isOpen)}
                onClick={() => setOpen(isOpen ? null : def.id)}
              >
                {renderTrigger(def)}
              </button>
              <BottomSheet
                open={isOpen}
                onOpenChange={open => setOpen(open ? def.id : null)}
                title={panelTitle[def.id]}
              >
                {panelContent(def.id)}
              </BottomSheet>
            </div>
          )
        }

        return (
          <Popover key={def.id} open={isOpen} onOpenChange={open => setOpen(open ? def.id : null)}>
            <PopoverTrigger asChild>
              <button type="button" aria-haspopup="dialog" className={buttonClass(isOpen)}>
                {renderTrigger(def)}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="center"
              side="top"
              sideOffset={12}
              className={cn(
                'max-h-[60vh] overflow-y-auto',
                def.id === 'channels' || def.id === 'epg' ? 'w-80' : 'w-64'
              )}
            >
              <p className="mb-2 px-1 text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">
                {panelTitle[def.id]}
              </p>
              {panelContent(def.id)}
            </PopoverContent>
          </Popover>
        )
      })}
    </nav>
  )
}

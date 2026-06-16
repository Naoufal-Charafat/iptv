import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { HeroItem } from '@client-iptv/shared'

export interface HeroLiveProps {
  hero: HeroItem
  /** Open the channel detail modal ("More Info"). */
  onMoreInfo?: () => void
  className?: string
}

/**
 * Home hero ("LIVE NOW") per the Inicio mockup (issue #40): full-bleed backdrop
 * with a bottom gradient, the LIVE badge, a display title, description and the
 * "Watch Now" (-> player) / "More Info" (-> detail modal) actions.
 */
export function HeroLive({ hero, onMoreInfo, className }: HeroLiveProps) {
  const navigate = useNavigate()
  const watch = () => navigate(`/reproductor/${encodeURIComponent(hero.channelId)}`)

  return (
    <section
      className={cn('relative h-[60vh] min-h-[420px] w-full overflow-hidden', className)}
      aria-label={hero.title}
    >
      {hero.backdrop && (
        <img src={hero.backdrop} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {/* Cinematic gradients: bottom + left for legibility. */}
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-surface/80 via-transparent to-transparent" />

      <div className="relative z-10 flex h-full max-w-container-max flex-col justify-end gap-3 px-margin-mobile pb-8 md:gap-4 md:pb-12 md:px-margin-desktop">
        {hero.badge && (
          <span className="flex items-center gap-2 text-label-md font-bold uppercase tracking-wider text-primary">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary-container" />
            {hero.badge}
          </span>
        )}
        <h1 className="max-w-2xl text-display-lg-mobile text-on-surface md:text-display-lg">
          {hero.title}
        </h1>
        <p className="line-clamp-3 max-w-xl text-body-md text-on-surface-variant md:line-clamp-none md:text-body-lg">
          {hero.description}
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
          <Button size="lg" iconLeft="play_arrow" onClick={watch} className="w-full sm:w-auto">
            Watch Now
          </Button>
          <Button
            size="lg"
            variant="secondary"
            iconLeft="info"
            onClick={onMoreInfo}
            className="w-full sm:w-auto"
          >
            More Info
          </Button>
        </div>
      </div>
    </section>
  )
}

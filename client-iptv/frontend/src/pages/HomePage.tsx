import { useState } from 'react'

import { ErrorState } from '@/components/feedback/ErrorState'
import { CarouselSkeleton } from '@/components/media/CarouselSkeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { ChannelDetailModal } from '@/features/home/ChannelDetailModal'
import { HeroLive } from '@/features/home/HeroLive'
import { HomeShelves } from '@/features/home/HomeShelves'
import { useHomeContent } from '@/features/home/hooks'

const FOOTER_LINKS = ['Privacy Policy', 'Terms of Service', 'Help Center', 'Contact']

function HomeFooter() {
  return (
    <footer className="mt-16 border-t border-outline-variant px-margin-mobile py-8 md:px-margin-desktop">
      <div className="mx-auto flex max-w-container-max flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-headline-md font-extrabold tracking-tight text-primary">CineStream</p>
          <p className="mt-1 text-label-sm text-on-surface-variant">
            © {new Date().getFullYear()} CineStream IPTV. All rights reserved.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          {FOOTER_LINKS.map(link => (
            <a
              key={link}
              href="#"
              className="text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
            >
              {link}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}

export function HomePage() {
  const { data, isLoading, isError, refetch } = useHomeContent()
  const [detailOpen, setDetailOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="pb-24">
        <Skeleton className="h-[60vh] min-h-[420px] w-full rounded-none" />
        <div className="space-y-10 px-margin-mobile pt-10 md:px-margin-desktop">
          <CarouselSkeleton />
          <CarouselSkeleton />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-12">
        <ErrorState
          title="No se pudo cargar el inicio"
          description="Comprueba tu conexión e inténtalo de nuevo."
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  const { hero, carousels } = data

  return (
    <div className="pb-24">
      <HeroLive hero={hero} onMoreInfo={() => setDetailOpen(true)} />
      <HomeShelves carousels={carousels} />
      <HomeFooter />

      <ChannelDetailModal
        channelId={hero.channelId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  )
}

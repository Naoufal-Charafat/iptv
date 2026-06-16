import { Carousel } from '@/components/media/Carousel'
import { MediaCard } from '@/components/media/MediaCard'
import type { Carousel as CarouselModel } from '@client-iptv/shared'

export interface HomeShelvesProps {
  carousels: CarouselModel[]
}

/**
 * Stack of home carousels (issue #40): "Recommended for You" plus per-category
 * shelves, each rendered with `Carousel` + `MediaCard`.
 */
export function HomeShelves({ carousels }: HomeShelvesProps) {
  return (
    <div className="space-y-10 pt-10 md:px-margin-desktop">
      {carousels.map(row => (
        <Carousel key={row.id} title={row.title} isEmpty={row.items.length === 0}>
          {row.items.map(item => (
            <div key={item.id} className="snap-start">
              <MediaCard channel={item} />
            </div>
          ))}
        </Carousel>
      ))}
    </div>
  )
}

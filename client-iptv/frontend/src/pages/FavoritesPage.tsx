import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/feedback/EmptyState'
import { MediaCard } from '@/components/media/MediaCard'
import { Button } from '@/components/ui/button'
import { useFavorites } from '@/features/favorites/useFavorites'

export function FavoritesPage() {
  const { favorites, count } = useFavorites()

  return (
    <div className="mx-auto w-full max-w-container-max px-margin-mobile py-8 md:py-12 md:pb-24">
      <h1 className="mb-6 text-headline-md font-bold tracking-tight text-on-surface md:mb-8 md:text-headline-lg">
        Favorites
        {count > 0 && (
          <span className="ml-3 text-headline-md text-on-surface-variant">{count}</span>
        )}
      </h1>

      {favorites.length === 0 ? (
        <EmptyState
          icon="favorite"
          title="No tienes favoritos todavía"
          description="Marca canales con el corazón para encontrarlos rápido aquí."
          action={
            <Button asChild variant="secondary" iconLeft="explore">
              <Link to="/explorar">Explorar canales</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {favorites.map(channel => (
            <MediaCard key={channel.id} channel={channel} className="w-full" />
          ))}
        </div>
      )}
    </div>
  )
}

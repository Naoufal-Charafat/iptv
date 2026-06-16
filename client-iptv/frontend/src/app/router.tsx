import { createBrowserRouter } from 'react-router-dom'

import { PlayerLayout } from '@/components/layout/PlayerLayout'
import { RootLayout } from '@/components/layout/RootLayout'
import { ChannelBrowserPage } from '@/pages/ChannelBrowserPage'
import { ExplorePage } from '@/pages/ExplorePage'
import { FavoritesPage } from '@/pages/FavoritesPage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PlayerPage } from '@/pages/PlayerPage'
import { SearchResultsPage } from '@/pages/SearchResultsPage'

export const router = createBrowserRouter([
  {
    // Shell layout (sidebar + bottom tabs).
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/explorar', element: <ExplorePage /> },
      { path: '/explorar/:dimension', element: <ChannelBrowserPage /> },
      { path: '/buscar', element: <SearchResultsPage /> },
      { path: '/favoritos', element: <FavoritesPage /> },
      { path: '*', element: <NotFoundPage /> }
    ]
  },
  {
    // Fullscreen player (no shell).
    element: <PlayerLayout />,
    children: [{ path: '/reproductor/:channelId', element: <PlayerPage /> }]
  }
])

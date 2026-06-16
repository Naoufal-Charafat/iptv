/** Shared navigation model for the sidebar (desktop) and bottom tabs (mobile). */
export interface NavItem {
  /** Material Symbols icon name. */
  icon: string
  label: string
  to: string
  /** Match nested routes (e.g. /explorar/:dimension). */
  matchPrefix?: boolean
}

export const primaryNavItems: NavItem[] = [
  { icon: 'search', label: 'Search', to: '/explorar', matchPrefix: true },
  { icon: 'home', label: 'Home', to: '/' },
  { icon: 'movie', label: 'Movies', to: '/explorar/categories' },
  { icon: 'tv', label: 'TV Shows', to: '/explorar/sources' },
  { icon: 'sports_esports', label: 'Sports', to: '/explorar/regions' }
]

export const bottomNavItems: NavItem[] = [
  { icon: 'home', label: 'Home', to: '/' },
  { icon: 'search', label: 'Explore', to: '/explorar', matchPrefix: true },
  { icon: 'favorite', label: 'Favorites', to: '/favoritos' }
]

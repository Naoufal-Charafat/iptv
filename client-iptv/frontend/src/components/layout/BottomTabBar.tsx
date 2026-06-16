import { NavLink, useLocation } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { bottomNavItems } from './nav-items'

/**
 * Mobile glassmorphism bottom tab bar. Shown below the `md` breakpoint;
 * collapses the desktop sidebar into a fixed footer of primary destinations.
 */
export function BottomTabBar() {
  const location = useLocation()

  return (
    <nav className="glass-panel pb-safe fixed bottom-0 left-0 right-0 z-40 flex h-16 items-stretch justify-around border-t border-outline-variant md:hidden">
      {bottomNavItems.map(item => {
        const active = item.matchPrefix
          ? location.pathname.startsWith(item.to)
          : location.pathname === item.to
        return (
          <NavLink
            key={item.label}
            to={item.to}
            end={!item.matchPrefix}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 text-label-sm transition-colors',
              active ? 'text-primary' : 'text-on-surface-variant'
            )}
          >
            <span
              className={cn('material-symbols-outlined', active && 'filled')}
              aria-hidden="true"
            >
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

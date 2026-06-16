import { NavLink, useLocation } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { primaryNavItems } from './nav-items'

/**
 * Desktop glassmorphism sidebar (256px, fixed). Mirrors the explore mockup:
 * brand header, primary nav with active state, upgrade CTA, footer links.
 * Hidden below the `md` breakpoint (mobile uses BottomTabBar).
 */
export function SideNavBar() {
  const location = useLocation()

  return (
    <nav className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col gap-4 border-r border-outline-variant bg-surface-container-low/90 p-4 shadow-md backdrop-blur-2xl md:flex">
      {/* Brand */}
      <div className="mb-8 mt-4 flex items-center gap-4 px-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-container to-on-primary-fixed">
          <span className="material-symbols-outlined filled text-white">play_circle</span>
        </div>
        <div>
          <h1 className="text-headline-md font-extrabold tracking-tight text-primary">
            CineStream
          </h1>
          <p className="text-label-sm text-on-surface-variant">Premium IPTV</p>
        </div>
      </div>

      {/* Primary nav */}
      <div className="flex flex-grow flex-col gap-2">
        {primaryNavItems.map(item => {
          const active = item.matchPrefix
            ? location.pathname.startsWith(item.to)
            : location.pathname === item.to
          return (
            <NavLink
              key={item.label}
              to={item.to}
              end={!item.matchPrefix}
              className={cn(
                'flex items-center gap-4 rounded-lg px-4 py-3 text-label-md transition-all duration-300',
                active
                  ? 'bg-primary-container font-bold text-on-primary-container'
                  : 'text-on-surface-variant hover:bg-surface-bright hover:text-on-secondary-container'
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
      </div>

      {/* Upgrade CTA */}
      <div className="group relative mb-4 mt-auto overflow-hidden rounded-xl border border-outline-variant bg-surface-container-high p-4 text-center">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-container/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="material-symbols-outlined filled mb-2 text-primary" aria-hidden="true">
          workspace_premium
        </span>
        <p className="mb-3 text-label-md text-on-surface">Upgrade to Pro</p>
        <button className="w-full rounded-lg bg-primary-container py-2 text-label-md font-bold text-white transition-colors hover:bg-inverse-primary">
          Upgrade Now
        </button>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-2 border-t border-outline-variant pt-4">
        <NavLink
          to="/ajustes"
          className="flex items-center gap-4 rounded-lg px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            settings
          </span>
          <span>Settings</span>
        </NavLink>
      </div>
    </nav>
  )
}

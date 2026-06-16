import { Outlet } from 'react-router-dom'

import { AmbientBackground } from '@/components/AmbientBackground'
import { BottomTabBar } from './BottomTabBar'
import { SideNavBar } from './SideNavBar'

/**
 * Shell layout: ambient background + desktop sidebar + mobile bottom tabs.
 * Content scrolls independently of the fixed sidebar (`md:ml-64`). The
 * fullscreen player route uses {@link PlayerLayout} instead (no shell).
 */
export function RootLayout() {
  return (
    <div className="relative flex min-h-dvh bg-surface text-on-surface">
      <AmbientBackground />
      <SideNavBar />
      <main className="pb-bottom-nav relative z-10 flex min-h-dvh w-full max-w-full flex-col overflow-x-hidden md:ml-64 md:pb-0">
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  )
}

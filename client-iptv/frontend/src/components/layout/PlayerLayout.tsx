import { Outlet } from 'react-router-dom'

/**
 * Fullscreen layout for the player route. Intentionally renders no sidebar /
 * tab bar so the video fills the viewport (see fullscreen player mockup).
 */
export function PlayerLayout() {
  return (
    <div className="relative min-h-screen bg-black text-on-surface">
      <Outlet />
    </div>
  )
}

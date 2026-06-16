/**
 * Ambient "light leak" background: two blurred brand-colored blobs blended
 * with mix-blend-screen, replicating the cinematic depth from the mockup.
 * Fixed, non-interactive, sits behind all content (z-0).
 */
export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -right-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-primary-container opacity-10 mix-blend-screen blur-[150px]" />
      <div className="absolute -bottom-1/4 -left-1/4 h-1/2 w-1/2 rounded-full bg-tertiary-container opacity-5 mix-blend-screen blur-[150px]" />
    </div>
  )
}

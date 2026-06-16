import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-12 text-center">
      <p className="text-display-lg-mobile font-extrabold text-primary md:text-display-lg">404</p>
      <p className="text-body-lg text-on-surface-variant">This page does not exist.</p>
      <Button asChild>
        <Link to="/">Back to Home</Link>
      </Button>
    </div>
  )
}

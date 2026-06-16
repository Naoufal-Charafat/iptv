import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/App'
import { enableMocking } from '@/mocks/browser'
import '@/styles/globals.css'

async function bootstrap() {
  // Start MSW before the first render so initial queries are intercepted.
  await enableMocking()

  const rootEl = document.getElementById('root')
  if (!rootEl) throw new Error('Root element #root not found')

  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

void bootstrap()

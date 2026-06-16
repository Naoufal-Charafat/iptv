import { setupWorker } from 'msw/browser'

import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

/**
 * Starts MSW when VITE_USE_MOCKS is enabled. Called before React renders so
 * the very first queries are intercepted. No-op when mocks are disabled.
 */
export async function enableMocking(): Promise<void> {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: false
  })
}

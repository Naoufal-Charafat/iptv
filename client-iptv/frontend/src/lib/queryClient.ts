import { QueryClient } from '@tanstack/react-query'

/**
 * Shared QueryClient. Defaults are tuned for a personal app: long cache,
 * no refetch-on-focus, and a single retry (mocks/backend are local).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min
      gcTime: 30 * 60 * 1000, // 30 min
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
})

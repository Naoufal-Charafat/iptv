/**
 * COMPONENT LIBRARY — public barrel
 * ---------------------------------------------------------------------------
 * Reusable "Cinematic Glassmorphism" components (DESIGN.md). Import from here
 * (`@/components`) for ergonomic access, or from the concrete module path.
 *
 * USAGE GUIDE (which component for which situation):
 *
 *  Actions
 *   - `Button`           primary CTA (red), `secondary` (glass), `ghost`, with
 *                        `iconLeft`/`iconRight` (Material Symbols) + `loading`.
 *   - `CategoryChip`     selectable pill (filters, "Trending Now").
 *   - `FavoriteButton`   heart toggle bound to the favorites store.
 *
 *  Media
 *   - `MediaCard`        channel card (16:9 / 2:3 / square; default/compact/hero).
 *   - `MediaCardSkeleton`placeholder matching `MediaCard` size (no layout shift).
 *   - `Carousel`         horizontal shelf w/ peek, desktop arrows, loading/empty.
 *   - `CarouselSkeleton` standalone shelf placeholder.
 *
 *  Search
 *   - `SearchBar`        glass search field w/ glow + clear; pair with
 *                        `useDebouncedValue` (built in via `onDebouncedChange`).
 *
 *  Overlays
 *   - `Modal`            Level-3 glass dialog (md/lg/fullscreen) over Radix.
 *   - `BottomSheet`      mobile bottom drawer for option selection.
 *
 *  Feedback / states
 *   - `Spinner` / `LoadingOverlay`  transient/blocking loads.
 *   - `ErrorState`       error + optional `onRetry` (pass a query `refetch`).
 *   - `EmptyState`       no-results / empty list with optional CTA.
 *   - `ErrorBoundary`    catches render errors, shows recoverable fallback.
 *   - `ChannelListSkeleton` / `DimensionGridSkeleton` / `ChipListSkeleton`.
 *   - `Skeleton`         base shimmer placeholder (compose your own).
 */

// Icons
export { MaterialIcon } from './icons/MaterialIcon'

// Actions / inputs
export { Button, buttonVariants } from './ui/button'
export type { ButtonProps } from './ui/button'
export { CategoryChip } from './ui/category-chip'
export type { CategoryChipProps } from './ui/category-chip'

// Overlays
export { Modal } from './ui/modal'
export type { ModalProps, ModalSize } from './ui/modal'
export { BottomSheet } from './ui/bottom-sheet'
export type { BottomSheetProps } from './ui/bottom-sheet'

// Media
export { MediaCard } from './media/MediaCard'
export type { MediaCardProps, MediaCardAspect, MediaCardVariant } from './media/MediaCard'
export { MediaCardSkeleton } from './media/MediaCardSkeleton'
export { Carousel } from './media/Carousel'
export type { CarouselProps } from './media/Carousel'
export { CarouselSkeleton } from './media/CarouselSkeleton'
export { FavoriteButton } from './media/FavoriteButton'
export type { FavoriteButtonProps } from './media/FavoriteButton'

// Search
export { SearchBar } from './search/SearchBar'
export type { SearchBarProps } from './search/SearchBar'

// Player surface (issue #43 — the engine/hook live under features/player)
export { VideoPlayer } from '@/features/player/VideoPlayer'
export type { VideoPlayerProps } from '@/features/player/VideoPlayer'

// Feedback / states
export { Skeleton } from './ui/skeleton'
export { Spinner, LoadingOverlay } from './feedback/Spinner'
export type { SpinnerProps, LoadingOverlayProps } from './feedback/Spinner'
export { ErrorState } from './feedback/ErrorState'
export type { ErrorStateProps } from './feedback/ErrorState'
export { EmptyState } from './feedback/EmptyState'
export type { EmptyStateProps } from './feedback/EmptyState'
export { ErrorBoundary } from './feedback/ErrorBoundary'
export {
  ChannelListSkeleton,
  DimensionGridSkeleton,
  ChipListSkeleton
} from './feedback/ListSkeletons'

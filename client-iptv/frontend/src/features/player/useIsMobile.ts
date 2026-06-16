/**
 * Re-export of the shared {@link useIsMobile} hook. Kept here so existing player
 * imports (`./useIsMobile`) keep working after the hook was promoted to
 * `@/hooks/useIsMobile` for reuse across screens (issue #47).
 */
export { useIsMobile } from '@/hooks/useIsMobile'

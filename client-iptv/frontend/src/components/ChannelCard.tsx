import { MediaCard } from '@/components/media/MediaCard'
import type { ChannelSummary } from '@client-iptv/shared'

interface ChannelCardProps {
  channel: ChannelSummary
}

/**
 * @deprecated Use `MediaCard` from `@/components/media/MediaCard` directly.
 * Kept as a thin compatibility wrapper (compact, square variant) for any
 * lingering imports.
 */
export function ChannelCard({ channel }: ChannelCardProps) {
  return <MediaCard channel={channel} aspect="square" variant="compact" />
}

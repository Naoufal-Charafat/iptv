import type { EpgGuide, EpgProgram } from '@client-iptv/shared'

const TITLES = [
  'Morning Briefing',
  'World Report',
  'Midday Live',
  'Feature Presentation',
  'Prime Time Special',
  'Late Night Edition',
  'Highlights & Recap',
  'Overnight Stream'
]

/** Build a 8-slot EPG for the given channel, anchored to the current hour. */
export function epgFor(channelId: string): EpgGuide {
  const now = new Date()
  now.setMinutes(0, 0, 0)
  const slotMs = 3 * 60 * 60 * 1000 // 3h slots

  const programs: EpgProgram[] = TITLES.map((title, i) => {
    const start = new Date(now.getTime() + (i - 1) * slotMs)
    const stop = new Date(start.getTime() + slotMs)
    return {
      channel: channelId,
      title,
      start: start.toISOString(),
      stop: stop.toISOString(),
      description: `${title} on ${channelId}. Catch up on the latest programming.`,
      category: i % 2 === 0 ? 'news' : 'entertainment'
    }
  })

  return {
    channel: channelId,
    feed: 'SD',
    site: 'example.com',
    site_id: channelId,
    site_name: 'Example EPG',
    lang: 'en',
    programs
  }
}

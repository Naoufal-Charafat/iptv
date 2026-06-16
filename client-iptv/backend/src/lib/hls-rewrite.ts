/**
 * HLS manifest rewriting (BE-12 / issue #22).
 *
 * An `.m3u8` manifest references other URIs (variant playlists, media segments
 * and encryption keys) that are usually relative to the manifest URL. For
 * hls.js in the browser to play a proxied manifest, every one of those URIs
 * must also be routed through the proxy (so CORS / UA / referrer are applied
 * uniformly). This module resolves each referenced URI to an absolute URL and
 * rewrites it to `<proxyBase>?url=<encoded>[&ua=..&referrer=..]`.
 */

export interface RewriteOptions {
  /** Absolute URL of the manifest being rewritten (base for relative URIs). */
  manifestUrl: string
  /** Proxy endpoint path/URL that takes `?url=` (e.g. "/api/proxy"). */
  proxyBase: string
  /** Optional passthrough user-agent to carry on rewritten URLs. */
  userAgent?: string
  /** Optional passthrough referrer to carry on rewritten URLs. */
  referrer?: string
}

/** Build a proxy URL for a single absolute target URL. */
function toProxyUrl(absoluteUrl: string, opts: RewriteOptions): string {
  const params = new URLSearchParams({ url: absoluteUrl })
  if (opts.userAgent) params.set('ua', opts.userAgent)
  if (opts.referrer) params.set('referrer', opts.referrer)
  return `${opts.proxyBase}?${params.toString()}`
}

/** Resolve a possibly-relative URI against the manifest URL; null if invalid. */
function resolveUri(uri: string, manifestUrl: string): string | null {
  try {
    return new URL(uri, manifestUrl).toString()
  } catch {
    return null
  }
}

/** Rewrite the `URI="..."` attribute inside an EXT-X tag line (KEY, MAP, ...). */
function rewriteAttributeUris(line: string, opts: RewriteOptions): string {
  return line.replace(/URI="([^"]*)"/g, (match, uri: string) => {
    const absolute = resolveUri(uri, opts.manifestUrl)
    if (!absolute) return match
    return `URI="${toProxyUrl(absolute, opts)}"`
  })
}

/**
 * Rewrite an HLS manifest so all referenced URIs flow through the proxy.
 * Non-URI lines (and blank lines) are passed through unchanged.
 */
export function rewriteManifest(manifest: string, opts: RewriteOptions): string {
  const lines = manifest.split(/\r?\n/)
  const out: string[] = []

  for (const rawLine of lines) {
    const line = rawLine

    if (line.length === 0) {
      out.push(line)
      continue
    }

    if (line.startsWith('#')) {
      // Tag line. Some tags embed a URI="..." attribute (EXT-X-KEY, EXT-X-MAP,
      // EXT-X-MEDIA, EXT-X-I-FRAME-STREAM-INF, ...). Rewrite those in place.
      if (line.includes('URI="')) {
        out.push(rewriteAttributeUris(line, opts))
      } else {
        out.push(line)
      }
      continue
    }

    // Non-comment, non-empty line: a playlist/segment URI.
    const absolute = resolveUri(line.trim(), opts.manifestUrl)
    out.push(absolute ? toProxyUrl(absolute, opts) : line)
  }

  return out.join('\n')
}

/** Heuristic: does this content look like an HLS manifest? */
export function looksLikeManifest(contentType: string | null, url: string): boolean {
  const ct = (contentType ?? '').toLowerCase()
  if (
    ct.includes('mpegurl') || // application/vnd.apple.mpegurl, application/x-mpegurl
    ct.includes('m3u')
  ) {
    return true
  }
  // Fall back to the path extension when the origin omits a useful content-type.
  const path = url.split('?')[0]?.toLowerCase() ?? ''
  return path.endsWith('.m3u8') || path.endsWith('.m3u')
}

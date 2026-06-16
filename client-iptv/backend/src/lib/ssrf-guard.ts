import { isIP } from 'node:net'

/**
 * SSRF guard (BE-12 / issue #22, reused by BE-14 / issue #24).
 *
 * Validates that a user-supplied URL is safe to fetch server-side:
 *   - protocol must be http or https;
 *   - the host must not be a loopback/private/link-local/reserved address or a
 *     hostname that obviously points at the local machine.
 *
 * This is a best-effort, synchronous, allowlist-by-shape check on the URL's
 * literal host. It does NOT perform DNS resolution (which could itself be an
 * SSRF vector and would make the guard async); a hostname that resolves to a
 * private IP is therefore not caught here. For a personal client proxying
 * public IPTV manifests this literal-host check is the pragmatic mitigation the
 * issue asks for. Callers that need stronger guarantees should additionally pin
 * resolution / use an egress allowlist.
 */

export interface SsrfCheckResult {
  ok: boolean
  /** Reason the URL was rejected (only set when `ok` is false). */
  reason?: string
  /** The parsed URL when valid. */
  url?: URL
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback'
])

/** Strip IPv6 brackets and zone id from a URL hostname. */
function normalizeHost(hostname: string): string {
  let host = hostname.toLowerCase()
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1)
  }
  const zone = host.indexOf('%')
  if (zone !== -1) host = host.slice(0, zone)
  return host
}

/** Whether an IPv4 string falls in a private/reserved range. */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(p => Number.parseInt(p, 10))
  if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) {
    // Not a clean dotted quad — treat as suspicious.
    return true
  }
  const [a, b] = parts as [number, number, number, number]
  if (a === 0) return true // 0.0.0.0/8
  if (a === 10) return true // 10.0.0.0/8
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64.0.0/10
  if (a === 192 && b === 0) return true // 192.0.0.0/24 + test nets
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
  if (a >= 224) return true // multicast + reserved
  return false
}

/** Whether an IPv6 string is loopback/link-local/unique-local/unspecified. */
function isPrivateIPv6(ip: string): boolean {
  const host = ip.toLowerCase()
  if (host === '::1' || host === '::') return true
  if (host.startsWith('fe80')) return true // link-local
  if (host.startsWith('fc') || host.startsWith('fd')) return true // unique-local
  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded v4.
  const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIPv4(mapped[1] as string)
  return false
}

/**
 * Validate a URL for safe server-side fetching. Returns the parsed URL on
 * success or a reason on failure.
 */
export function checkUrl(rawUrl: string): SsrfCheckResult {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, reason: 'Malformed URL' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: `Unsupported protocol: ${url.protocol}` }
  }

  const host = normalizeHost(url.hostname)
  if (host.length === 0) {
    return { ok: false, reason: 'Empty host' }
  }
  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, reason: 'Loopback host is not allowed' }
  }

  const ipVersion = isIP(host)
  if (ipVersion === 4 && isPrivateIPv4(host)) {
    return { ok: false, reason: 'Private/reserved IPv4 address is not allowed' }
  }
  if (ipVersion === 6 && isPrivateIPv6(host)) {
    return { ok: false, reason: 'Private/reserved IPv6 address is not allowed' }
  }

  // Reject obvious internal TLDs.
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) {
    return { ok: false, reason: 'Internal hostname is not allowed' }
  }

  return { ok: true, url }
}

import dns from 'node:dns/promises';
import net from 'node:net';

export interface SafeFetchOptions extends RequestInit {
  allowedHostnames?: string[];
  timeoutMs?: number;
  maxRedirects?: number;
}

/**
 * Checks if an IPv4 address is in a private, loopback, link-local, or reserved range.
 */
export function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(p => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return true; // Invalid IP is treated as unsafe
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 10.0.0.0/8 (Private)
  if (a === 10) return true;

  // 172.16.0.0/12 (Private: 172.16.0.0 – 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 (Link-local / Cloud Metadata Server 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 100.64.0.0/10 (Shared Address Space / CGNAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0 && parts[2] === 0) return true;

  // 198.18.0.0/15 (Network Benchmark Tests)
  if (a === 198 && (b === 18 || b === 19)) return true;

  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 (Reserved / Future Use)
  if (a >= 240) return true;

  // 255.255.255.255 (Broadcast)
  if (ip === '255.255.255.255') return true;

  return false;
}

/**
 * Checks if an IPv6 address is in a private, loopback, link-local, or IPv4-mapped private range.
 */
export function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();

  // Loopback ::1
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

  // Unspecified ::
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

  // Unique Local Address (fc00::/7 -> fc.. or fd..)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  // Link-local unicast (fe80::/10)
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true;
  }

  // Multicast (ff00::/8)
  if (normalized.startsWith('ff')) return true;

  // IPv4-mapped IPv6 (::ffff:192.0.2.128 or ::ffff:c000:0280)
  const v4MappedMatch = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4MappedMatch) {
    return isPrivateOrReservedIPv4(v4MappedMatch[1]);
  }

  return false;
}

/**
 * Validates a target URL and checks DNS resolution to prevent SSRF attacks.
 * Throws an Error if the URL resolves to an internal/private/loopback/cloud metadata IP.
 */
export async function validateSafeUrl(urlString: string, allowedHostnames?: string[]): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch (_e) {
    throw new Error(`Invalid URL: ${urlString}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Forbidden protocol: ${url.protocol}. Only http: and https: are permitted.`);
  }

  const hostname = url.hostname.toLowerCase();

  // Check against optional allowlist
  if (allowedHostnames && allowedHostnames.length > 0) {
    const isAllowed = allowedHostnames.some(allowed => 
      hostname === allowed.toLowerCase() || hostname.endsWith(`.${allowed.toLowerCase()}`)
    );
    if (!isAllowed) {
      throw new Error(`Hostname '${hostname}' is not in the allowed destinations list.`);
    }
  }

  // Quick check for literal localhost / metadata hostnames
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === 'metadata.google.internal') {
    throw new Error(`SSRF Prevention: Access to localhost or metadata services is strictly forbidden.`);
  }

  // Check if hostname is an IP literal
  const isIP = net.isIP(hostname);
  if (isIP === 4) {
    if (isPrivateOrReservedIPv4(hostname)) {
      throw new Error(`SSRF Prevention: Access to private/reserved IP (${hostname}) is strictly forbidden.`);
    }
    return url;
  } else if (isIP === 6) {
    if (isPrivateOrReservedIPv6(hostname)) {
      throw new Error(`SSRF Prevention: Access to private/reserved IPv6 (${hostname}) is strictly forbidden.`);
    }
    return url;
  }

  // Resolve DNS to verify all underlying IP addresses
  try {
    const lookupResults = await dns.lookup(hostname, { all: true });
    if (!lookupResults || lookupResults.length === 0) {
      throw new Error(`Unable to resolve host: ${hostname}`);
    }

    for (const record of lookupResults) {
      if (record.family === 4) {
        if (isPrivateOrReservedIPv4(record.address)) {
          throw new Error(`SSRF Prevention: Host ${hostname} resolves to forbidden IP ${record.address}.`);
        }
      } else if (record.family === 6) {
        if (isPrivateOrReservedIPv6(record.address)) {
          throw new Error(`SSRF Prevention: Host ${hostname} resolves to forbidden IPv6 ${record.address}.`);
        }
      }
    }
  } catch (err: any) {
    if (err.message.includes('SSRF Prevention')) {
      throw err;
    }
    throw new Error(`DNS resolution failed for host ${hostname}: ${err.message}`);
  }

  return url;
}

/**
 * SSRF-Safe HTTP Fetch wrapper.
 * Rejects access to internal metadata, loopback, private networks, and disables automatic redirects.
 */
export async function safeFetch(inputUrl: string, options: SafeFetchOptions = {}): Promise<Response> {
  const { allowedHostnames, timeoutMs = 10000, ...fetchOptions } = options;

  await validateSafeUrl(inputUrl, allowedHostnames);

  // Disable automatic redirects to prevent open-redirect SSRF bounces
  const fetchConfig: RequestInit = {
    ...fetchOptions,
    redirect: 'error' // Disallow redirect bouncing to internal metadata
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  fetchConfig.signal = controller.signal;

  try {
    // eslint-disable-next-line no-restricted-syntax
    const response = await fetch(inputUrl, fetchConfig);
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

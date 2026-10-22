import supabaseConfig from '../../../supabase-config.json';

/**
 * One source for the Content-Security-Policy (AUD-12). connect-src follows the configured Supabase
 * project instead of a hard-coded host:
 * - the browser bundle talks to VITE_SUPABASE_URL (falling back to supabase-config.json), so the
 *   static-hosting header in vercel.json is generated from that (scripts/vercel-csp.ts, checked on
 *   every build and by src/tests/csp-supabase-project.test.ts);
 * - the Express header (helmet, securityMiddleware.ts) also allows the server's SUPABASE_URL when it
 *   names a different project.
 * Only the exact project origins are added (https for data/auth, wss for realtime); never a wildcard.
 */

type Env = Record<string, string | undefined>;

/** Sources other than the Supabase project; unchanged from the policy that was hard-coded before. */
const PLAID_AND_GOOGLE_CONNECT = ['https://*.plaid.com', 'https://*.googleapis.com'];

/** `https://ref.supabase.co` → [`https://ref.supabase.co`, `wss://ref.supabase.co`]. Throws on a non-URL. */
export function supabaseConnectSources(projectUrl: string): string[] {
  const url = new URL(projectUrl.trim());
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Supabase URL must be http(s): ${projectUrl}`);
  }
  const socket = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return [url.origin, `${socket}//${url.host}`];
}

/** The project the browser bundle connects to (same rule as src/lib/db/client.ts). */
export function clientSupabaseUrl(env: Env = process.env): string {
  return env.VITE_SUPABASE_URL || supabaseConfig.url;
}

/** Every configured project origin pair: the browser's project, then the server's when different. */
export function configuredSupabaseConnectSources(env: Env = process.env, serverUrl?: string): string[] {
  const urls = [clientSupabaseUrl(env), serverUrl || env.SUPABASE_URL || supabaseConfig.url];
  return [...new Set(urls.flatMap(supabaseConnectSources))];
}

/** connect-src for the given Supabase origins. */
export function connectSources(supabaseSources: string[]): string[] {
  return ["'self'", ...supabaseSources, ...PLAID_AND_GOOGLE_CONNECT];
}

/** The static-hosting (vercel.json) policy for a browser bundle built against `projectUrl`. */
export function staticCspHeaderValue(projectUrl: string): string {
  const directives: Array<[string, string[]]> = [
    ['default-src', ["'self'"]],
    ['script-src', ["'self'", "'unsafe-inline'", 'https://cdn.plaid.com']],
    ['style-src', ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']],
    ['font-src', ["'self'", 'data:', 'https://fonts.gstatic.com']],
    ['img-src', ["'self'", 'data:', 'blob:', 'https:']],
    ['connect-src', connectSources(supabaseConnectSources(projectUrl))],
    ['frame-src', ["'self'", 'https://*.stripe.com', 'https://cdn.plaid.com']],
    ['worker-src', ["'self'", 'blob:']],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['frame-ancestors', ["'self'"]],
  ];
  return directives.map(([name, values]) => `${name} ${values.join(' ')}`).join('; ');
}

/** The Content-Security-Policy value inside a parsed vercel.json, or undefined. */
export function vercelCspValue(vercelConfig: unknown): string | undefined {
  const blocks = (vercelConfig as { headers?: Array<{ headers?: Array<{ key: string; value: string }> }> }).headers || [];
  for (const block of blocks) {
    const header = block.headers?.find(h => h.key.toLowerCase() === 'content-security-policy');
    if (header) return header.value;
  }
  return undefined;
}

/** Returns vercel.json with its CSP set to the policy for `projectUrl` (adds nothing else). */
export function withVercelCsp<T>(vercelConfig: T, projectUrl: string): T {
  const copy = JSON.parse(JSON.stringify(vercelConfig)) as T;
  const blocks = (copy as { headers?: Array<{ headers?: Array<{ key: string; value: string }> }> }).headers || [];
  const header = blocks.flatMap(b => b.headers || []).find(h => h.key.toLowerCase() === 'content-security-policy');
  if (!header) throw new Error('vercel.json has no Content-Security-Policy header to update.');
  header.value = staticCspHeaderValue(projectUrl);
  return copy;
}

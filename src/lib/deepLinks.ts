/**
 * Maps the links the server and the web app emit onto app routes (expo-router `+native-intent`):
 *
 *   https://hausboss.app/estimate/<token>                 → /public-estimate/<token>   (customer-facing estimate)
 *   https://hausboss.app/accept-invite?token=…&type=invite → /accept-invite?token=…
 *   https://hausboss.app/reset-password?token=…&type=recovery → /reset-password?token=…
 *   https://hausboss.app/job/<id>, /messages/<id>          → the same in-app routes
 *   hausboss://job/<id> etc.                               → unchanged (already app routes)
 *
 * Pure (no React / Expo imports) so it is unit-tested.
 */

export const UNIVERSAL_HOSTS = ['hausboss.app', 'www.hausboss.app'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ParsedLink { scheme: string | null; host: string | null; path: string; query: Record<string, string> }

export function parseLink(input: string): ParsedLink {
  let rest = input.trim();
  let scheme: string | null = null;
  let host: string | null = null;
  const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)/i.exec(rest);
  if (m) { scheme = m[1].toLowerCase(); host = m[2].toLowerCase() || null; rest = rest.slice(m[0].length); }
  const hash = rest.indexOf('#');
  if (hash >= 0) rest = rest.slice(0, hash);
  const q = rest.indexOf('?');
  const path = (q >= 0 ? rest.slice(0, q) : rest) || '/';
  const query: Record<string, string> = {};
  if (q >= 0) {
    for (const pair of rest.slice(q + 1).split('&')) {
      if (!pair) continue;
      const eq = pair.indexOf('=');
      const k = decodeURIComponent((eq >= 0 ? pair.slice(0, eq) : pair).replace(/\+/g, ' '));
      const v = eq >= 0 ? decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' ')) : '';
      if (k) query[k] = v;
    }
  }
  return { scheme, host, path: path.startsWith('/') ? path : `/${path}`, query };
}

function withQuery(path: string, query: Record<string, string | undefined>): string {
  const parts = Object.entries(query).filter((e): e is [string, string] => !!e[1]).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `${path}?${parts.join('&')}` : path;
}

/** Returns the in-app path for a system URL, or null to leave the URL to the router. */
export function resolveSystemPath(url: string): string | null {
  const link = parseLink(url);
  if (link.scheme === 'hausboss' && link.host === 'expo-development-client') return null; // dev client launch URL
  const universal = link.scheme === 'https' || link.scheme === 'http';
  if (universal && (!link.host || !UNIVERSAL_HOSTS.includes(link.host))) return null;
  // For the custom scheme the "host" is the first route segment (hausboss://job/<id>).
  const segments = [...(!universal && link.host ? [link.host] : []), ...link.path.split('/').filter(Boolean)];
  const [head, second] = segments;

  if (head === 'estimate' && second && universal) return `/public-estimate/${second}`;
  if (head === 'accept-invite' || head === 'reset-password') return link.query.token ? withQuery(`/${head}`, { token: link.query.token }) : `/${head}`;
  if ((head === 'job' || head === 'messages' || head === 'customers') && second && UUID.test(second)) return `/${head}/${second}`;
  if (head === 'chat' && second && UUID.test(second)) return `/chat/${second}`;
  if (universal) return segments.length === 0 ? '/' : null;
  return null;
}

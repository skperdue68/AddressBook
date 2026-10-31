import { isIP } from 'node:net';

// Per-client request limits for the web portal.
//
// The limits are deliberately generous. They are meant to stop floods and
// login-hammering, not to get in the way of someone clicking around quickly. All
// counters live in memory, so they reset when the process restarts.

export const DEFAULT_RATE_LIMITS = Object.freeze({
  // Every request, including static assets and thumbnails (per minute).
  general: Object.freeze({ limit: 600, windowMs: 60_000 }),
  // Form submissions and other state-changing requests (per minute).
  mutation: Object.freeze({ limit: 60, windowMs: 60_000 }),
  // Starting or finishing a Discord sign-in (per five minutes).
  auth: Object.freeze({ limit: 30, windowMs: 300_000 })
});

export const MAX_TRACKED_CLIENTS = 10_000;

// A limit of 0 turns that bucket off.
export function createRateLimiter({ limit, windowMs, now = () => Date.now(), maxKeys = MAX_TRACKED_CLIENTS }) {
  const windows = new Map();
  return {
    take(key) {
      if (!(limit > 0)) return { allowed: true, retryAfterSeconds: 0 };
      const time = now();
      let entry = windows.get(key);
      if (!entry || entry.resetAt <= time) {
        // Drop expired windows when a new one is needed, then enforce the key cap
        // (oldest first, because Map iterates in insertion order).
        if (windows.size >= maxKeys) {
          for (const [stale, value] of windows) if (value.resetAt <= time) windows.delete(stale);
          while (windows.size >= maxKeys) windows.delete(windows.keys().next().value);
        }
        windows.delete(key);
        entry = { count: 0, resetAt: time + windowMs };
        windows.set(key, entry);
      }
      entry.count += 1;
      if (entry.count > limit) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - time) / 1000)) };
      return { allowed: true, retryAfterSeconds: 0 };
    },
    size: () => windows.size
  };
}

const stripMapped = address => String(address || '').trim().replace(/^::ffff:/i, '');

// Loopback and private-network peers: the addresses a reverse proxy on the same
// host, container network or LAN connects from.
export function isPrivateAddress(address) {
  const value = stripMapped(address).toLowerCase();
  if (isIP(value) === 4) {
    const [a, b] = value.split('.').map(Number);
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  if (isIP(value) === 6) return value === '::1' || /^f[cd]/.test(value) || /^fe[89ab]/.test(value);
  return false;
}

// Works out which client a request came from.
//
// X-Forwarded-For is only believed when the connection itself comes from a private
// or loopback address, that is, from a reverse proxy we sit behind. A client on the
// internet cannot reach us from such an address, so it cannot forge the header. The
// header is read from the right, skipping our own proxies, because each proxy appends
// the address it saw and only those right-hand entries are trustworthy.
export function clientAddress(request, { trustProxy = 'auto' } = {}) {
  const peer = stripMapped(request.socket?.remoteAddress) || 'unknown';
  if (String(trustProxy).toLowerCase() === 'false' || !isPrivateAddress(peer)) return peer;
  const hops = String(request.headers?.['x-forwarded-for'] || '').split(',').map(stripMapped).filter(Boolean);
  for (let index = hops.length - 1; index >= 0; index--) {
    if (isIP(hops[index]) && !isPrivateAddress(hops[index])) return hops[index];
  }
  return peer;
}

const positiveOrZero = (value, fallback) => {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
};

export function rateLimitConfig(env = process.env) {
  return {
    general: { ...DEFAULT_RATE_LIMITS.general, limit: positiveOrZero(env.WEB_RATE_LIMIT_PER_MINUTE, DEFAULT_RATE_LIMITS.general.limit) },
    mutation: { ...DEFAULT_RATE_LIMITS.mutation, limit: positiveOrZero(env.WEB_RATE_LIMIT_POSTS_PER_MINUTE, DEFAULT_RATE_LIMITS.mutation.limit) },
    auth: { ...DEFAULT_RATE_LIMITS.auth, limit: positiveOrZero(env.WEB_RATE_LIMIT_SIGNINS_PER_5_MINUTES, DEFAULT_RATE_LIMITS.auth.limit) },
    trustProxy: String(env.WEB_TRUST_PROXY || 'auto').trim().toLowerCase() === 'false' ? 'false' : 'auto'
  };
}

// Builds the request check used by the server: returns null when the request may
// proceed, or the number of seconds the client should wait.
export function createWebRateLimiter(settings = {}, now = () => Date.now()) {
  // Merge per bucket, so a partial override such as { auth: { limit: 3 } } keeps the default window.
  const defaults = rateLimitConfig({});
  const merged = {
    general: { ...defaults.general, ...settings.general },
    mutation: { ...defaults.mutation, ...settings.mutation },
    auth: { ...defaults.auth, ...settings.auth },
    trustProxy: settings.trustProxy ?? defaults.trustProxy
  };
  const buckets = {
    general: createRateLimiter({ ...merged.general, now }),
    mutation: createRateLimiter({ ...merged.mutation, now }),
    auth: createRateLimiter({ ...merged.auth, now })
  };
  return {
    check(request, pathname) {
      const client = clientAddress(request, { trustProxy: merged.trustProxy });
      const checks = [buckets.general.take(client)];
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) checks.push(buckets.mutation.take(client));
      if (pathname === '/auth/discord' || pathname === '/auth/callback') checks.push(buckets.auth.take(client));
      const blocked = checks.filter(result => !result.allowed);
      return blocked.length ? Math.max(...blocked.map(result => result.retryAfterSeconds)) : null;
    },
    buckets
  };
}

import crypto from 'node:crypto';

// Pending OAuth sign-ins are kept in memory. Each state is single use, expires
// after STATE_TTL_MS, and is bound to the browser that started the sign-in through
// a short-lived cookie so a state cannot be replayed from a different browser.
export const OAUTH_BINDING_COOKIE = 'hearthbound_oauth';
export const STATE_TTL_MS = 10 * 60 * 1000;
export const MAX_PENDING_STATES = 5000;

const states = new Map();
const safeAdminReturn = value => {
  const path = String(value)==='/'?'/app':String(value);
  if (path.length > 2048 || !/^\/(admin|app)(\/|\?|$)/.test(path) || path.includes('\\') || /[\u0000-\u001f\u007f]/.test(path)) return '/admin';
  try {
    const url = new URL(path, 'http://addressbook.invalid');
    if (url.origin === 'http://addressbook.invalid' && /^\/(admin|app)(\/|$)/.test(url.pathname) && !url.hash) return path;
  } catch { /* invalid return path */ }
  return '/admin';
};

const hashBinding = binding => crypto.createHash('sha256').update(String(binding ?? ''), 'utf8').digest();

// Drop expired entries, then evict the oldest ones if the table is still full so
// unauthenticated traffic cannot grow it without bound.
function prune(now) {
  for (const [key, value] of states) if (value.expires <= Number(now)) states.delete(key);
  while (states.size >= MAX_PENDING_STATES) states.delete(states.keys().next().value);
}

export function createOAuthState(returnTo = '/admin', now = Date.now(), secret = process.env.WEB_SESSION_SECRET) {
  if (!secret) throw new Error('WEB_SESSION_SECRET is required for OAuth state.');
  prune(now);
  const state = `${cryptoRandom()}${cryptoRandom()}`;
  const binding = crypto.randomBytes(24).toString('base64url');
  states.set(state, { returnTo: safeAdminReturn(returnTo), expires: Number(now) + STATE_TTL_MS, secret: String(secret), bindingHash: hashBinding(binding) });
  return { state, binding };
}

export function consumeOAuthState(state, now = Date.now(), secret = process.env.WEB_SESSION_SECRET, binding = '') {
  const value = states.get(String(state));
  states.delete(String(state));
  if (!value || value.secret !== String(secret || '') || value.expires <= Number(now)) return null;
  if (!binding || !crypto.timingSafeEqual(value.bindingHash, hashBinding(binding))) return null;
  return value.returnTo;
}

export function pendingOAuthStateCount() {
  return states.size;
}

export function buildDiscordAuthorizeUrl(state, { clientId, redirectUri } = {}) {
  const params = new URLSearchParams({ client_id: String(clientId), response_type: 'code', redirect_uri: String(redirectUri), scope: 'identify guilds', state: String(state) });
  return `https://discord.com/oauth2/authorize?${params}`;
}

export async function exchangeDiscordCode(code, { clientId, clientSecret, redirectUri } = {}, fetchImpl = fetch) {
  const response = await fetchImpl('https://discord.com/api/oauth2/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: String(clientId), client_secret: String(clientSecret), grant_type: 'authorization_code', code: String(code), redirect_uri: String(redirectUri) }) });
  if (!response.ok) throw new Error(`Discord OAuth token exchange failed (${response.status}).`);
  return response.json();
}

function cryptoRandom() {
  return crypto.randomBytes(12).toString('base64url');
}

import crypto from 'node:crypto';

// Pending sign-ins are kept in memory for ten minutes. The map is swept on every
// new sign-in attempt and capped, so repeated hits on /auth/discord cannot grow it
// without limit.
const states = new Map();
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export const OAUTH_STATE_MAX_PENDING = 5000;
export const OAUTH_BINDING_COOKIE = 'hearthbound_oauth';

const safeAdminReturn = value => {
  const path = String(value)==='/'?'/app':String(value);
  if (path.length > 2048 || !/^\/(admin|app)(\/|\?|$)/.test(path) || path.includes('\\') || /[\u0000-\u001f\u007f]/.test(path)) return '/admin';
  try {
    const url = new URL(path, 'http://addressbook.invalid');
    if (url.origin === 'http://addressbook.invalid' && /^\/(admin|app)(\/|$)/.test(url.pathname) && !url.hash) return path;
  } catch { /* invalid return path */ }
  return '/admin';
};

const digest = value => crypto.createHash('sha256').update(String(value)).digest();

function sweep(now) {
  for (const [key, value] of states) if (value.expires <= Number(now)) states.delete(key);
  // Map iteration follows insertion order, so the oldest pending sign-ins go first.
  while (states.size >= OAUTH_STATE_MAX_PENDING) states.delete(states.keys().next().value);
}

// With `bind: true` a random browser token is returned alongside the state. The
// caller stores it in a short-lived cookie, and the callback only succeeds when the
// same browser presents it. That stops an attacker from starting a sign-in and
// tricking a victim's browser into completing it (login CSRF).
export function createOAuthState(returnTo = '/admin', now = Date.now(), secret = process.env.WEB_SESSION_SECRET, { bind = false } = {}) {
  if (!secret) throw new Error('WEB_SESSION_SECRET is required for OAuth state.');
  sweep(now);
  const state = `${cryptoRandom()}${cryptoRandom()}`;
  const binding = bind ? cryptoRandom() + cryptoRandom() : null;
  states.set(state, { returnTo: safeAdminReturn(returnTo), expires: Number(now) + OAUTH_STATE_TTL_MS, secret: String(secret), binding: binding ? digest(binding) : null });
  return { state, binding };
}

export function consumeOAuthState(state, now = Date.now(), secret = process.env.WEB_SESSION_SECRET, binding = null) {
  const value = states.get(String(state));
  states.delete(String(state));
  if (!value || value.secret !== String(secret || '') || value.expires <= Number(now)) return null;
  if (value.binding) {
    if (typeof binding !== 'string' || !binding || !crypto.timingSafeEqual(value.binding, digest(binding))) return null;
  }
  return value.returnTo;
}

// Cookie that ties a pending sign-in to the browser that started it. It is only
// sent to /auth/*, is single-use (the state it guards is consumed on first use) and
// expires with the state after ten minutes.
export const oauthBindingCookie = (value, secure = false) => `${OAUTH_BINDING_COOKIE}=${value}; HttpOnly; SameSite=Lax;${secure ? ' Secure;' : ''} Path=/auth; Max-Age=${OAUTH_STATE_TTL_MS / 1000}`;

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

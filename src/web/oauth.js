import crypto from 'node:crypto';

const states = new Map();
const safeAdminReturn = value => {
  const path = String(value);
  if (path.length > 2048 || !path.startsWith('/admin') || path.includes('\\') || /[\u0000-\u001f\u007f]/.test(path)) return '/admin';
  try {
    const url = new URL(path, 'http://addressbook.invalid');
    if (url.origin === 'http://addressbook.invalid' && (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) && !url.hash) return path;
  } catch { /* invalid return path */ }
  return '/admin';
};

export function createOAuthState(returnTo = '/admin', now = Date.now(), secret = process.env.WEB_SESSION_SECRET) {
  if (!secret) throw new Error('WEB_SESSION_SECRET is required for OAuth state.');
  const state = `${cryptoRandom()}${cryptoRandom()}`;
  states.set(state, { returnTo: safeAdminReturn(returnTo), expires: Number(now) + 10 * 60 * 1000, secret: String(secret) });
  return { state };
}

export function consumeOAuthState(state, now = Date.now(), secret = process.env.WEB_SESSION_SECRET) {
  const value = states.get(String(state));
  states.delete(String(state));
  if (!value || value.secret !== String(secret || '') || value.expires <= Number(now)) return null;
  return value.returnTo;
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

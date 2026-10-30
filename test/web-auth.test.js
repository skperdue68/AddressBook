import './web-login-recovery.test.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiscordAuthorizeUrl, consumeOAuthState, createOAuthState, exchangeDiscordCode, MAX_PENDING_STATES, pendingOAuthStateCount, STATE_TTL_MS } from '../src/web/oauth.js';
import { createSession, csrfMatches, readSession } from '../src/web/session.js';

test('OAuth state is one-use and expires', () => {
  const created = createOAuthState('/admin', 1000, 'secret');
  assert.equal(consumeOAuthState(created.state, 1000, 'secret', created.binding), '/admin');
  assert.equal(consumeOAuthState(created.state, 1000, 'secret', created.binding), null);
  const expired = createOAuthState('/admin', 1000, 'secret');
  assert.equal(consumeOAuthState(expired.state, 1000 + 11 * 60 * 1000, 'secret', expired.binding), null);
});

test('OAuth state is bound to the browser that started the sign-in', () => {
  const first = createOAuthState('/admin', 1000, 'secret');
  assert.match(first.binding, /^[A-Za-z0-9_-]{32,}$/);
  // A missing or different binding fails, and a failed attempt still spends the state.
  assert.equal(consumeOAuthState(first.state, 1000, 'secret', ''), null);
  assert.equal(consumeOAuthState(first.state, 1000, 'secret', first.binding), null);
  const second = createOAuthState('/admin', 1000, 'secret');
  const other = createOAuthState('/admin', 1000, 'secret');
  assert.equal(consumeOAuthState(second.state, 1000, 'secret', other.binding), null);
  const third = createOAuthState('/admin', 1000, 'secret');
  assert.equal(consumeOAuthState(third.state, 1000, 'secret'), null);
  const fourth = createOAuthState('/admin', 1000, 'secret');
  assert.equal(consumeOAuthState(fourth.state, 1000, 'other-secret', fourth.binding), null);
});

test('pending OAuth states are swept when expired and capped in number', () => {
  const start = 5_000_000;
  for (let index = 0; index < 20; index += 1) createOAuthState('/admin', start, 'secret');
  const before = pendingOAuthStateCount();
  assert.ok(before >= 20);
  // Creating a state after the lifetime has passed discards the expired ones.
  createOAuthState('/admin', start + STATE_TTL_MS + 1, 'secret');
  assert.equal(pendingOAuthStateCount(), 1);
  // Unauthenticated flooding cannot grow the table past the cap, and the newest state survives.
  let newest;
  for (let index = 0; index < MAX_PENDING_STATES + 50; index += 1) newest = createOAuthState('/admin', start + STATE_TTL_MS + 2, 'secret');
  assert.ok(pendingOAuthStateCount() <= MAX_PENDING_STATES);
  assert.equal(consumeOAuthState(newest.state, start + STATE_TTL_MS + 2, 'secret', newest.binding), '/admin');
});

test('OAuth return path cannot redirect away from the administration console', () => {
  for (const unsafe of ['//outside.example', '/\\outside.example', '/admin\\outside.example', '/administer', 'https://outside.example', '/auth/logout', '/admin\n//outside.example']) {
    const { state, binding } = createOAuthState(unsafe, 1000, 'secret');
    assert.equal(consumeOAuthState(state, 1000, 'secret', binding), '/admin', unsafe);
  }
  const { state, binding } = createOAuthState('/admin/audit?page=2&action=approve', 1000, 'secret');
  assert.equal(consumeOAuthState(state, 1000, 'secret', binding), '/admin/audit?page=2&action=approve');
});

test('signed web session rejects tampering and expires', () => {
  const cookie = createSession({ id: 'u1', username: 'User' }, 1000, 'secret');
  const session = readSession(cookie, 1000, 'secret');
  assert.equal(session.id, 'u1');
  assert.equal(session.username, 'User');
  assert.match(session.csrf, /^[A-Za-z0-9_-]{32,}$/);
  assert.equal(csrfMatches(session.csrf, session.csrf), true);
  assert.equal(csrfMatches(session.csrf, ''), false);
  assert.equal(csrfMatches(session.csrf, `${session.csrf}x`), false);
  assert.equal(readSession(`${cookie}x`, 1000, 'secret'), null);
  const [payload, signature] = cookie.split('.');
  const tampered = `${payload.slice(0, -1)}${payload.endsWith('A') ? 'B' : 'A'}.${signature}`;
  assert.equal(readSession(tampered, 1000, 'secret'), null);
  assert.equal(readSession(cookie, 1000 + 31 * 24 * 60 * 60 * 1000, 'secret'), null);
});

test('Discord authorize URL contains required OAuth parameters', () => {
  const url = buildDiscordAuthorizeUrl('state', { clientId: 'client', redirectUri: 'https://example.test/auth/callback' });
  assert.match(url, /client_id=client/);
  assert.match(url, /response_type=code/);
  assert.match(url, /scope=identify(?:%20|\+)guilds/);
});

test('Discord code exchange uses the OAuth token endpoint', async () => {
  const calls = [];
  const result = await exchangeDiscordCode('code', { clientId: 'client', clientSecret: 'secret', redirectUri: 'https://example.test/callback' }, async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ access_token: 'token' }) }; });
  assert.equal(result.access_token, 'token');
  assert.equal(calls[0].url, 'https://discord.com/api/oauth2/token');
});

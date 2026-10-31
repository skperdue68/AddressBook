import './web-login-recovery.test.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { OAUTH_STATE_MAX_PENDING, OAUTH_STATE_TTL_MS, buildDiscordAuthorizeUrl, consumeOAuthState, createOAuthState, exchangeDiscordCode, oauthBindingCookie, pendingOAuthStateCount } from '../src/web/oauth.js';
import { createSession, csrfMatches, readSession } from '../src/web/session.js';

test('OAuth state is one-use and expires', () => {
  const created = createOAuthState('/admin', 1000, 'secret');
  assert.equal(consumeOAuthState(created.state, 1000, 'secret'), '/admin');
  assert.equal(consumeOAuthState(created.state, 1000, 'secret'), null);
  const expired = createOAuthState('/admin', 1000, 'secret');
  assert.equal(consumeOAuthState(expired.state, 1000 + 11 * 60 * 1000, 'secret'), null);
});

test('OAuth return path cannot redirect away from the administration console', () => {
  for (const unsafe of ['//outside.example', '/\\outside.example', '/admin\\outside.example', '/administer', 'https://outside.example', '/auth/logout', '/admin\n//outside.example']) {
    const { state } = createOAuthState(unsafe, 1000, 'secret');
    assert.equal(consumeOAuthState(state, 1000, 'secret'), '/admin', unsafe);
  }
  const { state } = createOAuthState('/admin/audit?page=2&action=approve', 1000, 'secret');
  assert.equal(consumeOAuthState(state, 1000, 'secret'), '/admin/audit?page=2&action=approve');
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

test('expired sign-ins are swept and pending sign-ins are capped', () => {
  const start = 5_000_000;
  for (let i = 0; i < OAUTH_STATE_MAX_PENDING + 50; i++) createOAuthState('/admin', start, 'cap-secret');
  assert.ok(pendingOAuthStateCount() <= OAUTH_STATE_MAX_PENDING, 'pending sign-ins must stay under the cap');
  // A later attempt, after everything has expired, clears the expired entries first.
  createOAuthState('/admin', start + OAUTH_STATE_TTL_MS + 1, 'cap-secret');
  assert.equal(pendingOAuthStateCount(), 1);
});

test('the oldest pending sign-in is evicted first when the cap is reached', () => {
  const now = 9_000_000;
  const first = createOAuthState('/admin', now, 'evict-secret');
  for (let i = 0; i < OAUTH_STATE_MAX_PENDING; i++) createOAuthState('/admin', now, 'evict-secret');
  assert.equal(consumeOAuthState(first.state, now, 'evict-secret'), null, 'the oldest state was evicted');
  const newest = createOAuthState('/admin', now, 'evict-secret');
  assert.equal(consumeOAuthState(newest.state, now, 'evict-secret'), '/admin');
});

test('a bound sign-in only completes in the browser that started it', () => {
  const now = 20_000_000;
  const a = createOAuthState('/admin', now, 'bind-secret', { bind: true });
  assert.ok(a.binding && a.binding.length >= 32, 'a random browser token is issued');
  assert.equal(consumeOAuthState(a.state, now, 'bind-secret'), null, 'no cookie is rejected');
  const b = createOAuthState('/admin', now, 'bind-secret', { bind: true });
  assert.equal(consumeOAuthState(b.state, now, 'bind-secret', 'someone-elses-token'), null, 'another browser token is rejected');
  const c = createOAuthState('/app/houses', now, 'bind-secret', { bind: true });
  assert.equal(consumeOAuthState(c.state, now, 'bind-secret', c.binding), '/app/houses', 'the same browser succeeds');
  assert.equal(consumeOAuthState(c.state, now, 'bind-secret', c.binding), null, 'and only once');
  assert.match(oauthBindingCookie('abc', true), /^hearthbound_oauth=abc; HttpOnly; SameSite=Lax; Secure; Path=\/auth; Max-Age=600$/);
});

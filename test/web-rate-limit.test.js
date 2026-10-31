import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebAdminServer } from '../src/web/server.js';
import { DEFAULT_RATE_LIMITS, clientAddress, createRateLimiter, createWebRateLimiter, isPrivateAddress, rateLimitConfig } from '../src/web/rate-limit.js';

const request = (remoteAddress, headers = {}, method = 'GET') => ({ method, headers, socket: { remoteAddress } });

test('a client is allowed up to the limit, then told how long to wait, then allowed again', () => {
  let time = 1_000_000;
  const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => time });
  for (let i = 0; i < 3; i++) assert.deepEqual(limiter.take('a'), { allowed: true, retryAfterSeconds: 0 });
  const blocked = limiter.take('a');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 60);
  time += 20_000;
  assert.equal(limiter.take('a').retryAfterSeconds, 40, 'the wait shrinks as the window runs out');
  assert.equal(limiter.take('b').allowed, true, 'other clients are unaffected');
  time += 40_000;
  assert.equal(limiter.take('a').allowed, true, 'the window has reset');
});

test('a limit of zero turns the bucket off', () => {
  const limiter = createRateLimiter({ limit: 0, windowMs: 60_000 });
  for (let i = 0; i < 1000; i++) assert.equal(limiter.take('a').allowed, true);
  assert.equal(limiter.size(), 0);
});

test('tracked clients are capped, dropping expired and then the oldest entries', () => {
  let time = 0;
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => time, maxKeys: 5 });
  for (let i = 0; i < 100; i++) { limiter.take(`client-${i}`); assert.ok(limiter.size() <= 5); }
  time += 5000;
  limiter.take('late');
  assert.equal(limiter.size(), 1, 'expired windows are swept first');
  // Filling the cap with live entries evicts the oldest one ('late'), which therefore gets a fresh allowance,
  // while the newest entry is still tracked and still limited.
  for (let i = 0; i < 5; i++) limiter.take(`live-${i}`);
  assert.equal(limiter.take('late').allowed, true);
  assert.equal(limiter.take('live-4').allowed, false);
});

test('private, loopback and link-local addresses are recognised, public ones are not', () => {
  for (const address of ['127.0.0.1', '::1', '::ffff:127.0.0.1', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.20', '169.254.1.1', 'fd12:3456::1', 'fe80::1']) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  for (const address of ['8.8.8.8', '172.32.0.1', '172.15.0.1', '192.169.0.1', '2606:4700::1111', 'not-an-ip', '', undefined]) {
    assert.equal(isPrivateAddress(address), false, String(address));
  }
});

test('client address: a direct internet client cannot forge X-Forwarded-For', () => {
  assert.equal(clientAddress(request('203.0.113.9', { 'x-forwarded-for': '198.51.100.1' })), '203.0.113.9');
  assert.equal(clientAddress(request('::ffff:203.0.113.9', { 'x-forwarded-for': '198.51.100.1' })), '203.0.113.9');
});

test('client address: behind a local proxy the right-most untrusted hop is the client', () => {
  assert.equal(clientAddress(request('127.0.0.1', { 'x-forwarded-for': '203.0.113.7' })), '203.0.113.7');
  // A forged left-hand entry is ignored because the proxy appended the real address on the right.
  assert.equal(clientAddress(request('172.18.0.1', { 'x-forwarded-for': '1.2.3.4, 203.0.113.7' })), '203.0.113.7');
  // Our own proxies on the right are skipped.
  assert.equal(clientAddress(request('127.0.0.1', { 'x-forwarded-for': '203.0.113.7, 10.0.0.2, 127.0.0.1' })), '203.0.113.7');
  // Garbage entries are never used as a key.
  assert.equal(clientAddress(request('127.0.0.1', { 'x-forwarded-for': 'unknown, <script>' })), '127.0.0.1');
  assert.equal(clientAddress(request('127.0.0.1')), '127.0.0.1');
  assert.equal(clientAddress({ headers: {}, socket: {} }), 'unknown');
});

test('WEB_TRUST_PROXY=false always uses the connecting address', () => {
  assert.equal(clientAddress(request('127.0.0.1', { 'x-forwarded-for': '203.0.113.7' }), { trustProxy: 'false' }), '127.0.0.1');
  assert.equal(rateLimitConfig({ WEB_TRUST_PROXY: 'FALSE' }).trustProxy, 'false');
  assert.equal(rateLimitConfig({ WEB_TRUST_PROXY: 'anything-else' }).trustProxy, 'auto');
});

test('rate limit settings come from the environment, with safe fallbacks', () => {
  assert.deepEqual(rateLimitConfig({}).general, DEFAULT_RATE_LIMITS.general);
  const custom = rateLimitConfig({ WEB_RATE_LIMIT_PER_MINUTE: '100', WEB_RATE_LIMIT_POSTS_PER_MINUTE: '0', WEB_RATE_LIMIT_SIGNINS_PER_5_MINUTES: '7' });
  assert.equal(custom.general.limit, 100);
  assert.equal(custom.mutation.limit, 0, '0 disables the bucket');
  assert.equal(custom.auth.limit, 7);
  assert.equal(custom.auth.windowMs, DEFAULT_RATE_LIMITS.auth.windowMs, 'the window is not configurable');
  const bad = rateLimitConfig({ WEB_RATE_LIMIT_PER_MINUTE: 'lots', WEB_RATE_LIMIT_POSTS_PER_MINUTE: '-5' });
  assert.equal(bad.general.limit, DEFAULT_RATE_LIMITS.general.limit);
  assert.equal(bad.mutation.limit, DEFAULT_RATE_LIMITS.mutation.limit);
});

test('a partial override keeps the default window', () => {
  const limiter = createWebRateLimiter({ auth: { limit: 1 } });
  assert.equal(limiter.check(request('203.0.113.1'), '/auth/discord'), null);
  assert.equal(limiter.check(request('203.0.113.1'), '/auth/discord'), 300);
});

test('requests are counted per bucket: everything, mutations, and sign-in routes', () => {
  const limiter = createWebRateLimiter({ general: { limit: 100 }, mutation: { limit: 2 }, auth: { limit: 2 } });
  const client = '203.0.113.20';
  assert.equal(limiter.check(request(client), '/app'), null);
  assert.equal(limiter.check(request(client, {}, 'POST'), '/app/houses/1/actions'), null);
  assert.equal(limiter.check(request(client, {}, 'POST'), '/app/houses/1/actions'), null);
  assert.ok(limiter.check(request(client, {}, 'POST'), '/app/houses/1/actions') > 0, 'third POST in the window is blocked');
  assert.equal(limiter.check(request(client), '/app'), null, 'reads are unaffected by the POST limit');
  assert.equal(limiter.check(request(client), '/auth/callback'), null);
  assert.equal(limiter.check(request(client), '/auth/discord'), null);
  assert.ok(limiter.check(request(client), '/auth/discord') > 0, 'third sign-in request is blocked');
  assert.equal(limiter.check(request('203.0.113.21'), '/auth/discord'), null, 'a different client is not');
});

async function listening(rateLimits) {
  const server = createWebAdminServer({
    service: {},
    config: { sessionSecret: 'test-secret-test-secret', oauth: { clientId: 'client', clientSecret: 'secret', redirectUri: 'http://127.0.0.1/auth/callback' }, rateLimits }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test('HTTP: too many requests get a 429 with Retry-After, and other clients behind the proxy are unaffected', async () => {
  const { server, base } = await listening({ general: { limit: 4 } });
  try {
    for (let i = 0; i < 4; i++) assert.equal((await fetch(`${base}/privacy`, { headers: { 'x-forwarded-for': '203.0.113.50' } })).status, 200);
    const blocked = await fetch(`${base}/privacy`, { headers: { 'x-forwarded-for': '203.0.113.50' } });
    assert.equal(blocked.status, 429);
    assert.match(blocked.headers.get('retry-after'), /^\d+$/);
    assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
    assert.match(await blocked.text(), /Too many requests/);
    // The proxy is local, so a different forwarded client has its own allowance.
    assert.equal((await fetch(`${base}/privacy`, { headers: { 'x-forwarded-for': '203.0.113.51' } })).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('HTTP: repeated sign-in attempts are limited without affecting ordinary pages', async () => {
  const { server, base } = await listening({ auth: { limit: 3 } });
  try {
    for (let i = 0; i < 3; i++) assert.equal((await fetch(`${base}/auth/discord`, { redirect: 'manual' })).status, 302);
    const blocked = await fetch(`${base}/auth/discord`, { redirect: 'manual' });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('set-cookie'), null, 'no sign-in state or cookie is created');
    assert.equal((await fetch(`${base}/privacy`)).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('HTTP: form posts are limited separately from page views', async () => {
  const { server, base } = await listening({ mutation: { limit: 2 } });
  try {
    for (let i = 0; i < 2; i++) assert.equal((await fetch(`${base}/privacy`, { method: 'POST', body: 'x=1' })).status, 405);
    assert.equal((await fetch(`${base}/privacy`, { method: 'POST', body: 'x=1' })).status, 429);
    assert.equal((await fetch(`${base}/privacy`)).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('HTTP: WEB_TRUST_PROXY=false ignores X-Forwarded-For', async () => {
  const { server, base } = await listening({ general: { limit: 2 }, trustProxy: 'false' });
  try {
    assert.equal((await fetch(`${base}/privacy`, { headers: { 'x-forwarded-for': '203.0.113.60' } })).status, 200);
    assert.equal((await fetch(`${base}/privacy`, { headers: { 'x-forwarded-for': '203.0.113.61' } })).status, 200);
    assert.equal((await fetch(`${base}/privacy`, { headers: { 'x-forwarded-for': '203.0.113.62' } })).status, 429, 'rotating the header does not help');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

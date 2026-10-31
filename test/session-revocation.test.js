import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, closeDatabase } from '../src/db/database.js';
import { SessionRevocationService } from '../src/services/session-revocation-service.js';
import { createWebAdminServer } from '../src/web/server.js';
import { createSession, newSessionId, readSessionDetails } from '../src/web/session.js';

const SECRET = 'revocation-test-secret-value';

async function memoryService(clock) {
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: ':memory:' });
  const service = new SessionRevocationService(db, { now: () => clock.time });
  await service.ensureSchema();
  return { db, service };
}

test('ensureSchema can run on every start', async () => {
  const clock = { time: 1_000 };
  const { db, service } = await memoryService(clock);
  try { await service.ensureSchema(); await service.ensureSchema(); } finally { await closeDatabase(db); }
});

test('a signed-out login is revoked until its cookie would have expired, and only that login', async () => {
  const clock = { time: 1_000_000 };
  const { db, service } = await memoryService(clock);
  try {
    assert.equal(await service.isRevoked({ sessionId: 'a', userId: 'u1', issuedAt: 999_000 }), false);
    await service.revokeSession('a', clock.time + 60_000);
    assert.equal(await service.isRevoked({ sessionId: 'a', userId: 'u1', issuedAt: 999_000 }), true);
    assert.equal(await service.isRevoked({ sessionId: 'b', userId: 'u1', issuedAt: 999_000 }), false, 'another login of the same member is untouched');
    await service.revokeSession('a', clock.time + 60_000); // signing out twice is harmless
    clock.time += 61_000;
    assert.equal(await service.isRevoked({ sessionId: 'a', userId: 'u1', issuedAt: 999_000 }), false, 'past the cookie lifetime the record no longer matters');
    await service.purgeExpired();
    assert.equal((await db.query('SELECT count(*) n FROM web_revoked_sessions'))[0].n, 0);
  } finally { await closeDatabase(db); }
});

test('sign out everywhere voids logins issued up to that moment, not later ones or other members', async () => {
  const clock = { time: 5_000_000 };
  const { db, service } = await memoryService(clock);
  try {
    await service.revokeAllForUser('u1', 5_000_000);
    assert.equal(await service.isRevoked({ sessionId: 'x', userId: 'u1', issuedAt: 4_000_000 }), true, 'older login');
    assert.equal(await service.isRevoked({ sessionId: 'x', userId: 'u1', issuedAt: 5_000_000 }), true, 'login at the same instant');
    assert.equal(await service.isRevoked({ sessionId: 'x', userId: 'u1', issuedAt: 5_000_001 }), false, 'later login');
    assert.equal(await service.isRevoked({ sessionId: 'x', userId: 'u2', issuedAt: 4_000_000 }), false, 'another member');
    await service.revokeAllForUser('u1', 4_500_000); // an earlier time can never lower the floor
    assert.equal(await service.isRevoked({ sessionId: 'x', userId: 'u1', issuedAt: 5_000_000 }), true);
    await service.revokeAllForUser('u1', 6_000_000);
    assert.equal(await service.isRevoked({ sessionId: 'x', userId: 'u1', issuedAt: 5_500_000 }), true, 'a later sign-out everywhere raises it');
  } finally { await closeDatabase(db); }
});

test('missing ids are ignored rather than matching everything, and old floors are purged', async () => {
  const clock = { time: 400 * 86_400_000 };
  const { db, service } = await memoryService(clock);
  try {
    await service.revokeSession('', 1);
    await service.revokeSession(null, 1);
    await service.revokeAllForUser('', 1);
    assert.equal(await service.isRevoked({}), false);
    assert.equal(await service.isRevoked({ sessionId: undefined, userId: undefined, issuedAt: 1 }), false);
    await service.revokeAllForUser('old', 1000);
    await service.revokeAllForUser('recent', clock.time - 86_400_000);
    await service.purgeExpired();
    const users = (await db.query('SELECT discord_user_id id FROM web_session_floors')).map(row => row.id);
    assert.deepEqual(users, ['recent']);
  } finally { await closeDatabase(db); }
});

async function running({ sessionRevocations, clock, identity = { id: 'u1', username: 'User' } }) {
  const server = createWebAdminServer({
    sessionRevocations,
    config: { sessionSecret: SECRET, oauth: { clientId: 'client', clientSecret: 'secret', redirectUri: 'http://127.0.0.1/auth/callback' } },
    service: {
      authorizeGuild: () => ({ allowed: true }),
      overview: async () => ({ backend: 'SQLite', connection: 'Connected', esoServer: 'pc_na', pendingSubmissions: 0, globalModeratorRequests: 0, openReports: 0 })
    },
    resolveOAuthIdentity: async () => ({ ...identity, guilds: [{ id: 'g1', name: 'Guild', roleIds: ['mod'], esoServer: 'pc_na' }] }),
    fetchImpl: async () => ({ ok: true, json: async () => ({ access_token: 'token' }) }),
    now: () => clock.time
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

// Signs in the way a browser does and returns the session cookie. Any cookie set by the
// sign-in start (for example a browser binding) is sent back with the callback.
async function signIn(base) {
  const start = await fetch(`${base}/auth/discord`, { redirect: 'manual' });
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const carried = start.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const callback = await fetch(`${base}/auth/callback?code=test&state=${state}`, { redirect: 'manual', headers: { cookie: carried } });
  assert.equal(callback.status, 302, 'sign-in succeeded');
  return callback.headers.get('set-cookie').split(';')[0];
}

const adminStatus = async (base, cookie) => (await fetch(`${base}/admin`, { headers: { cookie }, redirect: 'manual' })).status;
const csrfOf = cookie => JSON.parse(Buffer.from(cookie.split('=')[1].split('.')[0], 'base64url').toString('utf8')).csrf;

test('every browser login carries its own session id', async () => {
  const clock = { time: 1_700_000_000_000 };
  const { db, service } = await memoryService(clock);
  const { server, base } = await running({ sessionRevocations: service, clock });
  try {
    const one = await signIn(base);
    const two = await signIn(base);
    const first = readSessionDetails(one.split('=')[1], clock.time, SECRET).user.sid;
    const second = readSessionDetails(two.split('=')[1], clock.time, SECRET).user.sid;
    assert.match(first, /^[\w-]{20,}$/);
    assert.notEqual(first, second);
  } finally { await new Promise(resolve => server.close(resolve)); await closeDatabase(db); }
});

test('signing out cancels that login on the server, so a copy of its cookie stops working', async () => {
  const clock = { time: 1_700_000_000_000 };
  const { db, service } = await memoryService(clock);
  const { server, base } = await running({ sessionRevocations: service, clock });
  try {
    const laptop = await signIn(base);
    const phone = await signIn(base);
    assert.equal(await adminStatus(base, laptop), 200);
    assert.equal(await adminStatus(base, phone), 200);
    const logout = await fetch(`${base}/auth/logout`, { headers: { cookie: laptop }, redirect: 'manual' });
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
    // A stolen copy of the laptop cookie is refused even though it has not expired.
    assert.equal(await adminStatus(base, laptop), 302);
    assert.match((await fetch(`${base}/admin`, { headers: { cookie: laptop }, redirect: 'manual' })).headers.get('location'), /auth\/discord/);
    assert.equal(await adminStatus(base, phone), 200, 'the other device stays signed in');
  } finally { await new Promise(resolve => server.close(resolve)); await closeDatabase(db); }
});

test('a cross-site request cannot sign anyone out, on the server or in the browser', async () => {
  const clock = { time: 1_700_000_000_000 };
  const { db, service } = await memoryService(clock);
  const { server, base } = await running({ sessionRevocations: service, clock });
  try {
    const cookie = await signIn(base);
    const attack = await fetch(`${base}/auth/logout`, { headers: { cookie, 'sec-fetch-site': 'cross-site' }, redirect: 'manual' });
    assert.equal(attack.headers.get('set-cookie'), null);
    assert.equal(await adminStatus(base, cookie), 200);
  } finally { await new Promise(resolve => server.close(resolve)); await closeDatabase(db); }
});

test('sign out everywhere asks for confirmation, checks the CSRF token, then voids every login', async () => {
  const clock = { time: 1_700_000_000_000 };
  const { db, service } = await memoryService(clock);
  const { server, base } = await running({ sessionRevocations: service, clock });
  try {
    const laptop = await signIn(base);
    clock.time += 1000;
    const phone = await signIn(base);
    clock.time += 1000;

    const confirm = await fetch(`${base}/auth/logout-all`, { headers: { cookie: laptop } });
    assert.equal(confirm.status, 200);
    const html = await confirm.text();
    assert.match(html, /<form method="post" action="\/auth\/logout-all">/);
    assert.ok(html.includes(csrfOf(laptop)));
    assert.equal(await adminStatus(base, laptop), 200, 'viewing the page signs nobody out');

    const forged = await fetch(`${base}/auth/logout-all`, { method: 'POST', headers: { cookie: laptop, 'content-type': 'application/x-www-form-urlencoded' }, body: 'csrf=wrong', redirect: 'manual' });
    assert.equal(forged.status, 400);
    assert.equal(await adminStatus(base, laptop), 200, 'a bad token changes nothing');

    const done = await fetch(`${base}/auth/logout-all`, { method: 'POST', headers: { cookie: laptop, 'content-type': 'application/x-www-form-urlencoded' }, body: `csrf=${encodeURIComponent(csrfOf(laptop))}`, redirect: 'manual' });
    assert.equal(done.status, 302);
    assert.match(done.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal(await adminStatus(base, laptop), 302);
    assert.equal(await adminStatus(base, phone), 302, 'every device is signed out');

    clock.time += 1000;
    const fresh = await signIn(base);
    assert.equal(await adminStatus(base, fresh), 200, 'signing in again works');
  } finally { await new Promise(resolve => server.close(resolve)); await closeDatabase(db); }
});

test('sign out everywhere requires being signed in and only accepts GET or POST', async () => {
  const clock = { time: 1_700_000_000_000 };
  const { db, service } = await memoryService(clock);
  const { server, base } = await running({ sessionRevocations: service, clock });
  try {
    const anonymous = await fetch(`${base}/auth/logout-all`, { redirect: 'manual' });
    assert.equal(anonymous.status, 302);
    assert.equal(anonymous.headers.get('location'), '/');
    const cookie = await signIn(base);
    const put = await fetch(`${base}/auth/logout-all`, { method: 'PUT', headers: { cookie }, redirect: 'manual' });
    assert.equal(put.status, 405);
    assert.equal(await adminStatus(base, cookie), 200);
  } finally { await new Promise(resolve => server.close(resolve)); await closeDatabase(db); }
});

test('logins issued before this feature (no session id) still work and are still voided by sign out everywhere', async () => {
  const clock = { time: 1_700_000_000_000 };
  const { db, service } = await memoryService(clock);
  const { server, base } = await running({ sessionRevocations: service, clock });
  try {
    const legacy = `addressbook_session=${createSession({ id: 'u1', username: 'User', guilds: [{ id: 'g1', name: 'Guild', roleIds: ['mod'], esoServer: 'pc_na' }] }, clock.time, SECRET, 86_400)}`;
    assert.equal(await adminStatus(base, legacy), 200);
    clock.time += 1000;
    await service.revokeAllForUser('u1', clock.time);
    assert.equal(await adminStatus(base, legacy), 302);
  } finally { await new Promise(resolve => server.close(resolve)); await closeDatabase(db); }
});

test('if revocations cannot be checked, the request is treated as signed out and the error is logged', async t => {
  const clock = { time: 1_700_000_000_000 };
  const { db, service } = await memoryService(clock);
  const { server, base } = await running({ sessionRevocations: service, clock });
  const errors = t.mock.method(console, 'error', () => {});
  try {
    const cookie = await signIn(base);
    assert.equal(await adminStatus(base, cookie), 200);
    service.isRevoked = async () => { throw new Error('database unavailable'); };
    assert.equal(await adminStatus(base, cookie), 302, 'fails closed');
    assert.ok(errors.mock.calls.some(call => /revocations/i.test(String(call.arguments[0]))));
  } finally { errors.mock.restore(); await new Promise(resolve => server.close(resolve)); await closeDatabase(db); }
});

test('without a revocation service the portal behaves as before, and sign out everywhere explains it is unavailable', async () => {
  const clock = { time: 1_700_000_000_000 };
  const { server, base } = await running({ sessionRevocations: null, clock });
  try {
    const cookie = await signIn(base);
    assert.equal(await adminStatus(base, cookie), 200);
    assert.equal((await fetch(`${base}/auth/logout-all`, { headers: { cookie } })).status, 501);
    const logout = await fetch(`${base}/auth/logout`, { headers: { cookie }, redirect: 'manual' });
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('newSessionId is random and url-safe', () => {
  const ids = new Set(Array.from({ length: 50 }, newSessionId));
  assert.equal(ids.size, 50);
  for (const id of ids) assert.match(id, /^[A-Za-z0-9_-]{22}$/);
});

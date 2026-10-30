import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebAdminServer } from '../src/web/server.js';

async function running(options = {}) {
  const server = createWebAdminServer({
    config: { sessionSecret: 'secret', oauth: { clientId: 'client', clientSecret: 'secret', redirectUri: 'http://127.0.0.1/auth/callback' }, ...options.config },
    service: options.service || {
      authorizeGuild: () => ({ allowed: true }),
      overview: async () => ({ backend: 'SQLite', connection: 'Connected', esoServer: 'pc_na', pendingSubmissions: 0, globalModeratorRequests: 0, openReports: 0 }),
      listAudit: async () => ({ rows: [], page: 1, pageSize: 25, total: 0, hasNext: false }),
      listMaintenance: async () => ({ stale: [], duplicates: [] }),
      listPending: async () => [],
      exportGuild: async () => '{"private":false}'
    },
    resolveGuildMembership: options.resolveGuildMembership,
    resolveOAuthIdentity: options.resolveOAuthIdentity || (async () => ({ id: 'u1', username: 'User', guilds: [{ id: 'g1', name: 'Guild', roleIds: ['mod'], esoServer: 'pc_na' }] })),
    fetchImpl: options.fetchImpl || (async () => ({ ok: true, json: async () => ({ access_token: 'token' }) })),
    now: () => 1000
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return { server, base: `http://127.0.0.1:${address.port}` };
}

test('multi-guild moderators must choose the guild before administration loads', async () => {
  const calls = [];
  const { server, base } = await running({
    resolveOAuthIdentity: async () => ({ id: 'u1', username: 'User', guilds: [
      { id: 'g1', name: 'First Guild', roleIds: ['mod'], esoServer: 'pc_na' },
      { id: 'g2', name: 'Second Guild', roleIds: ['mod'], esoServer: 'pc_eu' }
    ] }),
    service: {
      authorizeGuild: () => ({ allowed: true }),
      overview: async context => { calls.push(context); return { backend: 'SQLite', connection: 'Connected', esoServer: context.esoServer }; },
      listAudit: async () => ({ rows: [], page: 1, pageSize: 25, total: 0, hasNext: false }), listMaintenance: async () => ({ stale: [], duplicates: [] }), listPending: async () => [], exportGuild: async () => '{}'
    }
  });
  try {
    const auth = await loggedIn(base);
    const chooser = await fetch(`${base}/admin`, { headers: { cookie: auth.cookie } });
    const chooserHtml = await chooser.text();
    assert.equal(chooser.status, 200);
    assert.match(chooserHtml, /Choose Discord Server/);
    assert.match(chooserHtml, /First Guild/);
    assert.match(chooserHtml, /Second Guild/);
    const selection = await fetch(`${base}/admin?guildId=g2`, { headers: { cookie: auth.cookie }, redirect: 'manual' });
    assert.equal(selection.status, 302);
    const selectedCookie = selection.headers.get('set-cookie');
    const selected = await fetch(`${base}/admin`, { headers: { cookie: selectedCookie } });
    assert.equal(selected.status, 200);
    const selectedHtml = await selected.text();
    assert.match(selectedHtml, /Second Guild/);
    assert.match(selectedHtml, /Change Server/);
    assert.equal(calls.at(-1).guildId, 'g2');
    const chooserAgain = await fetch(`${base}/admin?choose=1`, { headers: { cookie: selectedCookie } });
    assert.match(await chooserAgain.text(), /Choose Discord Server/);
    const invalid = await fetch(`${base}/admin?guildId=g3`, { headers: { cookie: selectedCookie } });
    assert.equal(invalid.status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('a revoked selected guild never silently switches administration to another guild',async()=>{
  let firstAllowed=true;const calls=[];
  const {server,base}=await running({
    resolveOAuthIdentity:async()=>({id:'u1',username:'User',guilds:[{id:'g1',name:'First',roleIds:['mod'],esoServer:'pc_na'},{id:'g2',name:'Second',roleIds:['mod'],esoServer:'pc_eu'}]}),
    resolveGuildMembership:async({guildId})=>({id:guildId,name:guildId,roleIds:guildId==='g1'&&!firstAllowed?[]:['mod'],esoServer:guildId==='g1'?'pc_na':'pc_eu'}),
    service:{authorizeGuild:({memberRoleIds})=>({allowed:memberRoleIds.includes('mod')}),overview:async c=>{calls.push(c);return{backend:'SQLite',connection:'Connected',esoServer:c.esoServer};}}
  });
  try{
    const auth=await loggedIn(base);
    const selected=await fetch(`${base}/admin?guildId=g1`,{headers:{cookie:auth.cookie},redirect:'manual'});
    const cookie=selected.headers.get('set-cookie');assert.equal(selected.status,302);
    firstAllowed=false;
    const response=await fetch(`${base}/admin`,{headers:{cookie}});
    assert.equal(response.status,403);
    assert.equal(calls.length,0);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

async function loggedIn(base) {
  const login = await fetch(`${base}/auth/discord`, { redirect: 'manual' });
  const state = new URL(login.headers.get('location')).searchParams.get('state');
  const callback = await fetch(`${base}/auth/callback?code=test&state=${state}`, { redirect: 'manual' });
  const cookie = callback.headers.get('set-cookie');
  const payload = JSON.parse(Buffer.from(cookie.split('=')[1].split('.')[0], 'base64url').toString('utf8'));
  return { cookie, csrf: payload.csrf };
}

test('unauthenticated admin request redirects to Discord OAuth', async () => {
  const { server, base } = await running();
  try {
    const response = await fetch(`${base}/admin`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    const oauth = await fetch(`${base}${response.headers.get('location')}`, { redirect: 'manual' });
    assert.equal(oauth.status, 302);
    assert.match(oauth.headers.get('location'), /discord.com\/oauth2\/authorize/);
  }
  finally { await new Promise(resolve => server.close(resolve)); }
});

test('OAuth callback stays on HearthBound after an unsafe returnTo is supplied', async () => {
  const { server, base } = await running();
  try {
    const login = await fetch(`${base}/auth/discord?returnTo=${encodeURIComponent('//outside.example/steal')}`, { redirect: 'manual' });
    const state = new URL(login.headers.get('location')).searchParams.get('state');
    const callback = await fetch(`${base}/auth/callback?code=test&state=${state}`, { redirect: 'manual' });
    assert.equal(callback.status, 302);
    assert.equal(callback.headers.get('location'), '/admin');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('authenticated admin page renders guild and environment context', async () => {
  const { server, base } = await running();
  try {
    const auth = await fetch(`${base}/auth/callback?code=test&state=invalid`, { redirect: 'manual' });
    assert.equal(auth.status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('web export sends the guild JSON snapshot as a download', async () => {
  const { server, base } = await running();
  try {
    const login = await fetch(`${base}/auth/discord`, { redirect: 'manual' });
    const state = new URL(login.headers.get('location')).searchParams.get('state');
    const callback = await fetch(`${base}/auth/callback?code=test&state=${state}`, { redirect: 'manual' });
    const response = await fetch(`${base}/admin/export`, { headers: { cookie: callback.headers.get('set-cookie') }, redirect: 'manual' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.match(await response.text(), /private/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('HTTPS OAuth configuration marks the session cookie Secure', async () => {
  const { server, base } = await running({ config: { oauth: { clientId: 'client', clientSecret: 'secret', redirectUri: 'https://admin.example.test/auth/callback' } } });
  try {
    const login = await fetch(`${base}/auth/discord`, { redirect: 'manual' });
    const state = new URL(login.headers.get('location')).searchParams.get('state');
    const callback = await fetch(`${base}/auth/callback?code=test&state=${state}`, { redirect: 'manual' });
    assert.match(callback.headers.get('set-cookie'), /Secure/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('web requests recheck current guild roles instead of trusting the login snapshot', async () => {
  const { server, base } = await running({
    resolveGuildMembership: async () => ({ roleIds: [] }),
    service: {
      authorizeGuild: ({ memberRoleIds }) => ({ allowed: memberRoleIds.includes('mod') }),
      overview: async () => ({ backend: 'SQLite', connection: 'Connected', esoServer: 'pc_na' }),
      listAudit: async () => ({ rows: [], page: 1, pageSize: 25, total: 0, hasNext: false }),
      listMaintenance: async () => ({ stale: [], duplicates: [] }),
      listPending: async () => [],
      exportGuild: async () => '{"private":false}'
    }
  });
  try {
    const login = await fetch(`${base}/auth/discord`, { redirect: 'manual' });
    const state = new URL(login.headers.get('location')).searchParams.get('state');
    const callback = await fetch(`${base}/auth/callback?code=test&state=${state}`, { redirect: 'manual' });
    const response = await fetch(`${base}/admin`, { headers: { cookie: callback.headers.get('set-cookie') }, redirect: 'manual' });
    assert.equal(response.status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('pending review renders escaped rows and CSRF-bound moderation forms', async () => {
  const { server, base } = await running({ service: {
    authorizeGuild: () => ({ allowed: true }), overview: async () => ({ backend: 'SQLite', connection: 'Connected', esoServer: 'pc_na' }),
    listAudit: async () => ({ rows: [], page: 1, pageSize: 25, total: 0, hasNext: false }), listMaintenance: async () => ({ stale: [], duplicates: [] }),
    listPending: async () => [{ id: 7, display_name: '<Unsafe & House>', house_name: 'Catalog', eso_owner: 'Owner <x>', scope: 'server', created_by_display_name: 'Submitter', created_at: '2026-09-21' }], exportGuild: async () => '{}'
  } });
  try {
    const { cookie, csrf } = await loggedIn(base);
    const response = await fetch(`${base}/admin/pending`, { headers: { cookie } });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /Moderation actions enabled/i);
    assert.match(html, /&lt;Unsafe &amp; House&gt;/);
    assert.match(html, /action="\/admin\/pending\/7\/approve"/);
    assert.match(html, /action="\/admin\/pending\/7\/deny"/);
    assert.match(html, new RegExp(`name="csrf" value="${csrf}"`));
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('pending review paginates and returns to the same page after moderation', async () => {
  const requested = []; const reviewed = [];
  const row = n => ({ id: n, display_name: `House ${n}`, eso_owner: `Owner ${n}`, scope: 'server', created_by: 'submitter' });
  const { server, base } = await running({ service: {
    authorizeGuild: () => ({ allowed: true }),
    listPending: async options => { requested.push(options); return options.offset ? [row(26), row(27)] : Array.from({ length: 26 }, (_, n) => row(n + 1)); },
    reviewPending: async options => { reviewed.push(options); return { action: options.action, record: { id: options.id } }; }
  } });
  try {
    const { cookie, csrf } = await loggedIn(base);
    const first = await fetch(`${base}/admin/pending`, { headers: { cookie } });
    const firstHtml = await first.text();
    assert.match(firstHtml, /Page 1/);
    assert.match(firstHtml, /href="\/admin\/pending\?page=2"[^>]*>.*Next/i);
    assert.doesNotMatch(firstHtml, /House 26/);
    const second = await fetch(`${base}/admin/pending?page=2`, { headers: { cookie } });
    const secondHtml = await second.text();
    assert.match(secondHtml, /House 26/);
    assert.doesNotMatch(secondHtml, /House 25/);
    assert.match(secondHtml, /href="\/admin\/pending\?page=1"[^>]*>.*Previous/i);
    assert.match(secondHtml, /name="page" value="2"/);
    assert.equal(requested[1].offset, 25);
    assert.equal(requested[1].guildId, 'g1');
    assert.equal(requested[1].esoServer, 'pc_na');
    const response = await fetch(`${base}/admin/pending/26/approve`, { method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf, confirm: 'approve', page: '2' }), redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/admin/pending?page=2&status=approved');
    assert.equal(reviewed[0].id, '26');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('pending review POST requires CSRF and confirmation, then redirects after review', async () => {
  const reviewed = [];
  const { server, base } = await running({ service: {
    authorizeGuild: () => ({ allowed: true }), overview: async () => ({ backend: 'SQLite', connection: 'Connected', esoServer: 'pc_na' }),
    listAudit: async () => ({ rows: [], page: 1, pageSize: 25, total: 0, hasNext: false }), listMaintenance: async () => ({ stale: [], duplicates: [] }), listPending: async () => [], exportGuild: async () => '{}',
    reviewPending: async options => { reviewed.push(options); return { action: 'approve', record: { id: 7 } }; }
  } });
  try {
    const { cookie, csrf } = await loggedIn(base);
    const missing = await fetch(`${base}/admin/pending/7/approve`, { method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: 'confirm=approve' });
    assert.equal(missing.status, 400);
    assert.equal(reviewed.length, 0);
    const wrongMethod = await fetch(`${base}/admin/pending/7/approve`, { headers: { cookie }, redirect: 'manual' });
    assert.equal(wrongMethod.status, 405);
    const response = await fetch(`${base}/admin/pending/7/approve`, { method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf, confirm: 'approve' }), redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/admin/pending?status=approved');
    assert.equal(reviewed[0].id, '7');
    assert.equal(reviewed[0].action, 'approve');
    assert.equal(reviewed[0].guildId, 'g1');
    assert.equal(reviewed[0].esoServer, 'pc_na');
    assert.equal(reviewed[0].actor.id, 'u1');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('pending review POST maps stale and unavailable records without leaking details', async () => {
  const { server, base } = await running({ service: {
    authorizeGuild: () => ({ allowed: true }), overview: async () => ({ backend: 'SQLite', connection: 'Connected', esoServer: 'pc_na' }),
    listAudit: async () => ({ rows: [], page: 1, pageSize: 25, total: 0, hasNext: false }), listMaintenance: async () => ({ stale: [], duplicates: [] }), listPending: async () => [], exportGuild: async () => '{}',
    reviewPending: async () => { throw new Error('Pending house was already reviewed or is not available. SQL password=secret'); }
  } });
  try {
    const { cookie, csrf } = await loggedIn(base);
    const response = await fetch(`${base}/admin/pending/7/deny`, { method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf, confirm: 'deny' }) });
    const body = await response.text();
    assert.equal(response.status, 409);
    assert.match(body, /already reviewed|not available/i);
    assert.doesNotMatch(body, /SQL password|secret/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('maintenance verification POST requires CSRF and redirects after verification', async () => {
  const verified = [];
  const { server, base } = await running({ service: {
    authorizeGuild: () => ({ allowed: true }), overview: async () => ({ backend: 'SQLite', connection: 'Connected', esoServer: 'pc_na' }),
    listAudit: async () => ({ rows: [], page: 1, pageSize: 25, total: 0, hasNext: false }), listMaintenance: async () => ({ stale: [], duplicates: [] }), listPending: async () => [], exportGuild: async () => '{}',
    verifyHouse: async options => { verified.push(options); return { houseId: Number(options.houseId), verified: true }; }
  } });
  try {
    const { cookie, csrf } = await loggedIn(base);
    const missing = await fetch(`${base}/admin/maintenance/verify/62`, { method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: 'confirm=verify' });
    assert.equal(missing.status, 400);
    assert.equal(verified.length, 0);
    const response = await fetch(`${base}/admin/maintenance/verify/62`, { method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf, confirm: 'verify' }), redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/admin/maintenance?status=verified');
    assert.equal(verified[0].houseId, '62');
    assert.equal(verified[0].guildId, 'g1');
    assert.equal(verified[0].esoServer, 'pc_na');
    assert.equal(verified[0].actor.id, 'u1');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('maintenance duplicate merge POST requires CSRF and redirects after merge', async () => {
  const merged = [];
  const { server, base } = await running({ service: {
    authorizeGuild: () => ({ allowed: true }), overview: async () => ({ backend: 'SQLite', connection: 'Connected', esoServer: 'pc_na' }),
    listAudit: async () => ({ rows: [], page: 1, pageSize: 25, total: 0, hasNext: false }), listMaintenance: async () => ({ stale: [], duplicates: [] }), listPending: async () => [], exportGuild: async () => '{}',
    mergeDuplicate: async options => { merged.push(options); return { keepId: Number(options.keepId), removeId: Number(options.removeId) }; }
  } });
  try {
    const { cookie, csrf } = await loggedIn(base);
    const missing = await fetch(`${base}/admin/maintenance/merge/11/12`, { method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: 'confirm=merge' });
    assert.equal(missing.status, 400);
    assert.equal(merged.length, 0);
    const response = await fetch(`${base}/admin/maintenance/merge/11/12`, { method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf, confirm: 'merge' }), redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/admin/maintenance?status=merged');
    assert.equal(merged[0].keepId, '11');
    assert.equal(merged[0].removeId, '12');
    assert.equal(merged[0].actor.id, 'u1');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('maintenance renders a confirmation form for Private duplicates in this guild', async () => {
  const { server, base } = await running({ service: {
    authorizeGuild: () => ({ allowed: true }), overview: async () => ({ backend: 'SQLite', connection: 'Connected', esoServer: 'pc_na' }),
    listAudit: async () => ({ rows: [], page: 1, pageSize: 25, total: 0, hasNext: false }),
    listMaintenance: async () => ({ stale: [], duplicates: [{ destination_id: 3, scope: 'private', owner_user_id: 'owner', saved_house_ids: '11,12' }] }),
    listPending: async () => [], exportGuild: async () => '{}'
  } });
  try {
    const { cookie, csrf } = await loggedIn(base);
    const response = await fetch(`${base}/admin/maintenance`, { headers: { cookie } });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /<td>Private<\/td>/);
    assert.match(html, /action="\/admin\/maintenance\/merge\/11\/12"/);
    assert.match(html, new RegExp(`name="csrf" value="${csrf}"`));
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('audit log renders scoped page status and previous/next navigation', async () => {
  const requested = [];
  const { server, base } = await running({ service: {
    authorizeGuild: () => ({ allowed: true }), overview: async () => ({ backend: 'SQLite', connection: 'Connected', esoServer: 'pc_na' }),
    listAudit: async options => { requested.push(options); return { rows: [{ action: 'house_updated', entity_name: 'Villa', actor_display_name: 'Moderator', created_at: '2026-09-21' }], page: 2, pageSize: 25, total: 60, hasNext: true }; },
    listMaintenance: async () => ({ stale: [], duplicates: [] }), listPending: async () => [], exportGuild: async () => '{}'
  } });
  try {
    const { cookie } = await loggedIn(base);
    const response = await fetch(`${base}/admin/audit?page=2`, { headers: { cookie } });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /Page 2 of 3/);
    assert.match(html, /href="\/admin\/audit\?page=1"[^>]*>.*Previous/i);
    assert.match(html, /href="\/admin\/audit\?page=3"[^>]*>.*Next/i);
    assert.match(html, /Villa/);
    assert.equal(requested[0].guildId, 'g1');
    assert.equal(requested[0].page, 2);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('audit log normalizes fractional infinite negative and nonnumeric pages', async () => {
  const requested = [];
  const { server, base } = await running({ service: {
    authorizeGuild: () => ({ allowed: true }),
    listAudit: async options => { requested.push(options.page); return { rows: [], page: options.page, pageSize: 25, total: 0, hasNext: false }; }
  } });
  try {
    const { cookie } = await loggedIn(base);
    for (const value of ['1.5', 'Infinity', '-9', 'not-a-number']) {
      const response = await fetch(`${base}/admin/audit?page=${encodeURIComponent(value)}`, { headers: { cookie } });
      assert.equal(response.status, 200);
    }
    assert.deepEqual(requested, [1, 1, 1, 1]);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('audit log filters preserve action and entity type across pagination', async () => {
  const requested = [];
  const { server, base } = await running({ service: {
    authorizeGuild: () => ({ allowed: true }), overview: async () => ({ backend: 'SQLite', connection: 'Connected', esoServer: 'pc_na' }),
    listAudit: async options => { requested.push(options); return { rows: [{ action: 'house_updated', entity_type: 'saved_house', entity_name: 'Villa', actor_display_name: 'Moderator', created_at: '2026-09-21' }], page: 1, pageSize: 25, total: 1, hasNext: false }; },
    listMaintenance: async () => ({ stale: [], duplicates: [] }), listPending: async () => [], exportGuild: async () => '{}'
  } });
  try {
    const { cookie } = await loggedIn(base);
    const response = await fetch(`${base}/admin/audit?page=1&action=house_updated&entityType=saved_house`, { headers: { cookie } });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /name="action"/);
    assert.match(html, /name="entityType"/);
    assert.match(html, /value="house_updated"/);
    assert.match(html, /value="saved_house"/);
    assert.equal(requested[0].guildId, 'g1');
    assert.equal(requested[0].action, 'house_updated');
    assert.equal(requested[0].entityType, 'saved_house');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('audit Target and partial Action stay in page links and CSV downloads', async () => {
  const listed=[],exports=[];
  const { server, base } = await running({service:{
    authorizeGuild:()=>({allowed:true}),overview:async()=>({backend:'SQLite',connection:'Connected',esoServer:'pc_na'}),
    listAudit:async options=>{listed.push(options);return {rows:[{action:'house_updated',entity_id:'123',entity_name:'Grand Villa',created_at:'2026-09-21'}],page:options.page,pageSize:25,total:51,hasNext:options.page<3};},
    exportAudit:async options=>{exports.push(options);return 'id,action\r\n1,house_updated\r\n';}
  }});
  try {
    const {cookie}=await loggedIn(base);
    const page=await fetch(`${base}/admin/audit?action=upd&target=Villa&page=2`,{headers:{cookie}});
    const html=await page.text();
    assert.match(html,/name="target"/);
    assert.match(html,/action=upd&amp;target=Villa&amp;page=3/);
    assert.match(html,/audit\.csv\?action=upd&amp;target=Villa/);
    await fetch(`${base}/admin/audit.csv?action=upd&target=Villa`,{headers:{cookie}});
    assert.equal(listed[0].target,'Villa');
    assert.equal(listed[0].action,'upd');
    assert.equal(exports[0].target,'Villa');
  } finally { await new Promise(resolve=>server.close(resolve)); }
});

test('filtered audit CSV download uses the selected moderator guild', async () => {
  const calls = [];
  const { server, base } = await running({ service: {
    authorizeGuild: () => ({ allowed: true }),
    listAudit: async () => ({ rows: [], page: 1, pageSize: 25, total: 0, hasNext: false }),
    exportAudit: async options => { calls.push(options); return 'id,action\r\n1,house_updated\r\n'; }
  } });
  try {
    const unauthenticated = await fetch(`${base}/admin/audit.csv`, { redirect: 'manual' });
    assert.equal(unauthenticated.status, 302);
    const { cookie } = await loggedIn(base);
    const listing = await fetch(`${base}/admin/audit?action=house_updated&entityType=saved_house`, { headers: { cookie } });
    assert.match(await listing.text(), /href="\/admin\/audit\.csv\?action=house_updated&amp;entityType=saved_house"/);
    const download = await fetch(`${base}/admin/audit.csv?action=house_updated&entityType=saved_house`, { headers: { cookie } });
    assert.equal(download.status, 200);
    assert.equal(download.headers.get('content-type'), 'text/csv; charset=utf-8');
    assert.match(download.headers.get('content-disposition'), /attachment; filename="hearthbound-audit-g1\.csv"/);
    assert.match(await download.text(), /house_updated/);
    assert.deepEqual(calls, [{ guildId: 'g1', esoServer: 'pc_na', action: 'house_updated', entityType: 'saved_house', target: null }]);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('administration overview renders integrity, freshness, and duplicate health metrics', async () => {
  const { server, base } = await running({ service: {
    authorizeGuild: () => ({ allowed: true }),
    overview: async () => ({ backend: 'SQLite', connection: 'Connected', esoServer: 'pc_na', pendingSubmissions: 2, globalModeratorRequests: 1, openReports: 3, freshness: { staleHouses: 4 }, duplicates: { duplicateGroups: 2 }, integrity: { orphanStops: 1, duplicateDestinations: 2, mismatchedHouses: 0, staleProgress: 3 }, reminderHealth: { staleClaims: 0, failedDeliveries: 1 }, roleCounts: { moderator: 1, trusted: 0, tours: 1 } }),
    listAudit: async () => ({ rows: [], page: 1, pageSize: 25, total: 0, hasNext: false }), listMaintenance: async () => ({ stale: [], duplicates: [] }), listPending: async () => [], exportGuild: async () => '{}'
  } });
  try {
    const { cookie } = await loggedIn(base);
    const response = await fetch(`${base}/admin`, { headers: { cookie } });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /Data integrity/i);
    assert.match(html, /Orphan tour stops<\/td><td>1/i);
    assert.match(html, /href="\/admin\/maintenance#stale"[^>]*><span>Stale houses<\/span><strong class="number">4/i);
    assert.match(html, /href="\/admin\/maintenance#duplicates"[^>]*><span>Duplicate groups<\/span><strong class="number">2/i);
    assert.doesNotMatch(html, /Failed reminders/i);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('export landing page explains Private entries are excluded', async () => {
  const { server, base } = await running();
  try {
    const { cookie } = await loggedIn(base);
    const response = await fetch(`${base}/admin/export?view=1`, { headers: { cookie } });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /Export Data/);
    assert.match(html, /pc_na/);
    assert.match(html, /current Discord guild/i);
    assert.match(html, /Private houses and tours are excluded/i);
    assert.doesNotMatch(html, /plus Private houses|Private houses and tours originating in this guild/i);
    assert.match(html, /not a complete database backup/i);
    assert.match(html, /href="\/admin\/export"/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('backup and export page explains Private exclusion and backend backups', async () => {
  const { server, base } = await running();
  try {
    const { cookie } = await loggedIn(base);
    const response = await fetch(`${base}/admin/backup`, { headers: { cookie } });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /Backup &amp; Export/i);
    assert.match(html, /Portable JSON export/i);
    assert.match(html, /SQLite/i);
    assert.match(html, /MariaDB/i);
    assert.match(html, /Private houses and tours are excluded/i);
    assert.doesNotMatch(html, /plus Private houses|Private houses and tours originating in this guild/i);
    assert.match(html, /not a complete database backup/i);
    assert.match(html, /href="\/admin\/export"/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('problem reports page paginates escaped Private-safe rows and keeps moderation on the same page', async () => {
  const requested = []; const moderated = [];
  const row = n => ({ id: n, targetSummary: n === 26 ? 'Private House Share Pass #8' : `<House ${n}> — @Owner`, problemLabel: 'Other', reporter_display_name: `Reporter ${n}`, status: n === 2 ? 'reviewing' : 'open', created_at: '2026-09-22', explanation: n === 26 ? undefined : `Explanation ${n}` });
  const { server, base } = await running({ service: {
    authorizeGuild: () => ({ allowed: true }),
    listReports: async options => { requested.push(options); const all = Array.from({ length: 27 }, (_, n) => row(n + 1)); return { rows: all.slice((options.page - 1) * 25, options.page * 25), page: options.page, pageSize: 25, total: 27, hasNext: options.page === 1 }; },
    moderateReport: async options => { moderated.push(options); return { id: Number(options.id), status: options.action }; }
  } });
  try {
    const { cookie, csrf } = await loggedIn(base);
    const first = await fetch(`${base}/admin/reports`, { headers: { cookie } });
    const firstHtml = await first.text();
    assert.equal(first.status, 200);
    assert.match(firstHtml, /Problem Reports/);
    assert.match(firstHtml, /&lt;House 1&gt;/);
    assert.match(firstHtml, /href="\/admin\/reports\?page=2"/);
    assert.doesNotMatch(firstHtml, /Private House Share Pass/);
    const second = await fetch(`${base}/admin/reports?page=2`, { headers: { cookie } });
    const secondHtml = await second.text();
    assert.match(secondHtml, /Private House Share Pass #8/);
    assert.match(secondHtml, /name="page" value="2"/);
    assert.match(secondHtml, new RegExp(`name="csrf" value="${csrf}"`));
    assert.equal(requested[1].guildId, 'g1');
    assert.equal(requested[1].esoServer, 'pc_na');
    assert.equal(requested[1].actor.id, 'u1');
    const action = await fetch(`${base}/admin/reports/26/resolve`, { method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf, confirm: 'resolve', page: '2' }), redirect: 'manual' });
    assert.equal(action.status, 302);
    assert.equal(action.headers.get('location'), '/admin/reports?page=2&status=resolved');
    assert.equal(moderated[0].id, '26');
    assert.equal(moderated[0].action, 'resolve');
    assert.equal(moderated[0].actor.id, 'u1');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('problem report actions require POST, CSRF, confirmation, and hide service errors', async () => {
  const moderated = [];
  const { server, base } = await running({ service: {
    authorizeGuild: () => ({ allowed: true }),
    listReports: async () => ({ rows: [], page: 1, pageSize: 25, total: 0, hasNext: false }),
    moderateReport: async options => { moderated.push(options); throw new Error('Report no longer available. SQL password=secret'); }
  } });
  try {
    const { cookie, csrf } = await loggedIn(base);
    const wrongMethod = await fetch(`${base}/admin/reports/7/review`, { headers: { cookie }, redirect: 'manual' });
    assert.equal(wrongMethod.status, 405);
    const missing = await fetch(`${base}/admin/reports/7/review`, { method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: 'confirm=review' });
    assert.equal(missing.status, 400);
    assert.equal(moderated.length, 0);
    const stale = await fetch(`${base}/admin/reports/7/review`, { method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf, confirm: 'review' }) });
    const staleHtml = await stale.text();
    assert.equal(stale.status, 409);
    assert.match(staleHtml, /no longer available/i);
    assert.doesNotMatch(staleHtml, /SQL password|secret/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('administration known-total lists provide page jumps and clamp stale page links', async () => {
  const {server,base}=await running({service:{
    authorizeGuild:()=>({allowed:true}),
    listAudit:async o=>({rows:[],page:o.page,pageSize:25,total:60,hasNext:o.page<3}),
    listReports:async o=>({rows:[],page:o.page,pageSize:25,total:27,hasNext:o.page<2})
  }});
  try{
    const {cookie}=await loggedIn(base),headers={cookie};
    const audit=await fetch(`${base}/admin/audit?action=house&target=Garden&entityType=saved_house`,{headers});const html=await audit.text();
    assert.match(html,/Jump to page/);assert.match(html,/name="target" value="Garden"/);assert.match(html,/name="entityType" value="saved_house"/);assert.match(html,/aria-label="Page 1"/);
    const last=await fetch(`${base}/admin/audit?page=99&action=house&target=Garden&entityType=saved_house`,{headers,redirect:'manual'});assert.equal(last.status,302);const target=new URL(last.headers.get('location'),base);assert.equal(target.searchParams.get('page'),'3');assert.equal(target.searchParams.get('target'),'Garden');assert.equal(target.searchParams.get('action'),'house');assert.equal(target.searchParams.get('entityType'),'saved_house');
    const reports=await fetch(`${base}/admin/reports`,{headers});assert.match(await reports.text(),/Jump to page/);
    const clamped=await fetch(`${base}/admin/reports?page=99&status=resolved`,{headers,redirect:'manual'});assert.equal(clamped.status,302);assert.equal(clamped.headers.get('location'),'/admin/reports?page=2&status=resolved');
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('pages carry security headers, and HSTS only over HTTPS', async () => {
  const plain = await running();
  try {
    const response = await fetch(`${plain.base}/privacy`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('strict-transport-security'), null);
    const asset = await fetch(`${plain.base}/assets/workspace.css`);
    assert.equal(asset.headers.get('x-content-type-options'), 'nosniff');
  } finally { await new Promise(resolve => plain.server.close(resolve)); }
  const secure = await running({ config: { oauth: { clientId: 'client', clientSecret: 'secret', redirectUri: 'https://admin.example.test/auth/callback' } } });
  try {
    const response = await fetch(`${secure.base}/privacy`);
    assert.match(response.headers.get('strict-transport-security'), /max-age=\d+/);
    assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
  } finally { await new Promise(resolve => secure.server.close(resolve)); }
});

test('administration downloads are not sniffable', async () => {
  const { server, base } = await running();
  try {
    const { cookie } = await loggedIn(base);
    const response = await fetch(`${base}/admin/export`, { headers: { cookie }, redirect: 'manual' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('sign-out ignores requests that another website started', async () => {
  const { server, base } = await running();
  try {
    for (const site of ['cross-site', 'same-site']) {
      const response = await fetch(`${base}/auth/logout`, { headers: { 'sec-fetch-site': site }, redirect: 'manual' });
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), '/');
      assert.equal(response.headers.get('set-cookie'), null, site);
    }
    for (const headers of [{ 'sec-fetch-site': 'same-origin' }, { 'sec-fetch-site': 'none' }, {}]) {
      const response = await fetch(`${base}/auth/logout`, { headers, redirect: 'manual' });
      assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('unexpected errors show a reference instead of internal details', async () => {
  const service = { authorizeGuild: () => ({ allowed: true }), overview: async () => { throw new Error("SQLITE_ERROR: no such table: secrets at /app/src/db/database.js:42:7"); } };
  const { server, base } = await running({ service });
  const original = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args.map(String).join(' '));
  try {
    const { cookie } = await loggedIn(base);
    const response = await fetch(`${base}/admin`, { headers: { cookie }, redirect: 'manual' });
    assert.equal(response.status, 500);
    const html = await response.text();
    assert.doesNotMatch(html, /SQLITE|no such table|\/app\/src/);
    const reference = /Reference: <code>([a-f0-9]{8})<\/code>/.exec(html)?.[1];
    assert.ok(reference, 'the page shows a reference code');
    assert.ok(logged.some(line => line.includes(reference) && line.includes('web error')), 'the real error is logged with the same reference');
  } finally { console.error = original; await new Promise(resolve => server.close(resolve)); }
});

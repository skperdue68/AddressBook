import test from 'node:test';
import assert from 'node:assert/strict';
import { webAdminConfig } from '../src/web/config.js';
import { GENERIC_ERROR_MESSAGE, publicErrorMessage } from '../src/utils/public-error.js';
import { CONTENT_SECURITY_POLICY } from '../src/web/security-headers.js';

test('web administration is disabled by default and validates enabled configuration', () => {
  assert.equal(webAdminConfig({}).enabled, false);
  const config = webAdminConfig({ WEB_ADMIN_ENABLED: 'true', WEB_ADMIN_HOST: '127.0.0.1', WEB_ADMIN_PORT: '8787', WEB_SESSION_SECRET: 'a-long-random-secret-for-tests-0123456789', DISCORD_OAUTH_CLIENT_ID: 'client', DISCORD_OAUTH_CLIENT_SECRET: 'oauth-secret', DISCORD_OAUTH_REDIRECT_URI: 'https://example.test/auth/callback' });
  assert.deepEqual(config, { enabled: true, host: '127.0.0.1', port: 8787, sessionSecret: 'a-long-random-secret-for-tests-0123456789', sessionDays:30, oauth: { clientId: 'client', clientSecret: 'oauth-secret', redirectUri: 'https://example.test/auth/callback' } });
});

test('enabled web administration rejects missing session secret', () => {
  assert.throws(() => webAdminConfig({ WEB_ADMIN_ENABLED: 'true' }), /WEB_SESSION_SECRET/);
});

test('production web membership bypasses cached roles and rejects departed staff',async()=>{
 const {resolveCurrentGuildMembership}=await import('../src/web/guild-membership.js');
 let state='removed-role';
 const guild={id:'g1',name:'Guild',members:{async fetch(options){
   // Discord's external boundary returns cached membership without force.
   if(typeof options==='string'||!options.force)return {roles:{cache:new Map([['staff',true]])}};
   if(state==='departed')throw new Error('Unknown Member');
   return {roles:{cache:new Map()}};
 }}};
 const client={guilds:{cache:new Map([['g1',guild]])}},guilds={ensureSettings:async()=>({eso_server:'pc_na'})};
 const member=await resolveCurrentGuildMembership({client,guilds,userId:'u',guildId:'g1'});assert.deepEqual(member.roleIds,[]);
 state='departed';assert.equal(await resolveCurrentGuildMembership({client,guilds,userId:'u',guildId:'g1'}),null);
});


test('strict membership lookup distinguishes absent members from service failures',async()=>{
 const {resolveCurrentGuildMembership}=await import('../src/web/guild-membership.js');
 let failure=null;
 const guild={id:'g',name:'Guild',members:{fetch:async()=>{if(failure)throw failure;return {id:'u',displayName:'Guild Nick',user:{username:'name',globalName:'Person'},roles:{cache:new Map()}};}}};
 const args={client:{guilds:{cache:new Map([['g',guild]])}},guilds:{ensureSettings:async()=>({eso_server:'pc_na'})},guildId:'g',userId:'u',strict:true};
 assert.equal((await resolveCurrentGuildMembership(args)).member.displayName,'Guild Nick');
 failure=Object.assign(new Error('Unknown Member'),{code:10007});assert.equal(await resolveCurrentGuildMembership(args),null);
 failure=new Error('Service unavailable');await assert.rejects(resolveCurrentGuildMembership(args),/could not be verified/);
 await assert.rejects(resolveCurrentGuildMembership({...args,guildId:'missing'}),/could not be verified/);
});

test('session secret must be long enough to be safe', () => {
  const env = secret => ({ WEB_ADMIN_ENABLED: 'true', WEB_SESSION_SECRET: secret, DISCORD_OAUTH_CLIENT_ID: 'client', DISCORD_OAUTH_CLIENT_SECRET: 'oauth-secret', DISCORD_OAUTH_REDIRECT_URI: 'https://example.test/auth/callback' });
  for (const weak of ['secret', 'changeme', 'x'.repeat(15)]) assert.throws(() => webAdminConfig(env(weak)), /at least 16 characters/);
  assert.equal(webAdminConfig(env('x'.repeat(16))).enabled, true);
  const warnings = [];
  const original = console.warn;
  console.warn = message => warnings.push(String(message));
  try {
    webAdminConfig(env('y'.repeat(20)));
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /shorter than 32/);
    webAdminConfig(env('z'.repeat(32)));
    assert.equal(warnings.length, 1);
  } finally { console.warn = original; }
});

test('public error messages hide internal details but keep messages written for people', () => {
  assert.equal(publicErrorMessage(new Error('Choose an image no larger than 5 MB.')), 'Choose an image no larger than 5 MB.');
  assert.equal(publicErrorMessage(new Error('A house gallery supports up to eight screenshots. Remove one before adding another.')).startsWith('A house gallery'), true);
  const internal = [
    'SQLITE_CONSTRAINT: UNIQUE constraint failed: saved_houses.id',
    'ER_DUP_ENTRY: Duplicate entry for key PRIMARY',
    "ENOENT: no such file or directory, open '/app/data/house-images/x.webp'",
    "Cannot read properties of undefined (reading 'id')",
    'x is not a function',
    'Error at Object.<anonymous> (/app/src/index.js:10:5)',
    'a'.repeat(301),
    'two\nlines',
    ''
  ];
  for (const message of internal) assert.equal(publicErrorMessage(new Error(message)), GENERIC_ERROR_MESSAGE, message);
  assert.equal(publicErrorMessage(null), GENERIC_ERROR_MESSAGE);
  assert.equal(publicErrorMessage(new Error('SQLITE_ERROR: boom'), 'custom'), 'custom');
});

test('content security policy blocks framing and third-party scripts', () => {
  assert.match(CONTENT_SECURITY_POLICY, /frame-ancestors 'none'/);
  assert.match(CONTENT_SECURITY_POLICY, /object-src 'none'/);
  assert.match(CONTENT_SECURITY_POLICY, /base-uri 'none'/);
  assert.match(CONTENT_SECURITY_POLICY, /default-src 'self'/);
  assert.doesNotMatch(CONTENT_SECURITY_POLICY, /script-src[^;]*https?:/);
});

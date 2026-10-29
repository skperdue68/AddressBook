import crypto from 'node:crypto';
import {deflateRawSync,inflateRawSync} from 'node:zlib';

const b64 = value => Buffer.from(value).toString('base64url');
const unb64 = value => Buffer.from(value, 'base64url').toString('utf8');
const sign = (value, secret) => crypto.createHmac('sha256', String(secret || '')).update(value).digest('base64url');

export function csrfMatches(expected, supplied) {
  if (typeof expected !== 'string' || typeof supplied !== 'string' || !expected || expected.length !== supplied.length) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return crypto.timingSafeEqual(left, right);
}

export function sessionLifetimeSeconds(env=process.env){
  const days=Number(String(env.WEB_SESSION_DAYS??'').trim()||30);
  if(!Number.isSafeInteger(days)||days<1||days>365)throw new Error('WEB_SESSION_DAYS must be a whole number from 1 to 365.');
  return days*24*60*60;
}

export function createSession(user, now = Date.now(), secret = process.env.WEB_SESSION_SECRET, lifetimeSeconds = sessionLifetimeSeconds(), preserveCsrf = false) {
  if (!secret) throw new Error('WEB_SESSION_SECRET is required for web administration sessions.');
  if(!Number.isSafeInteger(lifetimeSeconds)||lifetimeSeconds<1||lifetimeSeconds>365*86400)throw new Error('Invalid session lifetime.');
  const json = JSON.stringify({ ...user, csrf: preserveCsrf&&typeof user.csrf==='string'?user.csrf:crypto.randomBytes(24).toString('base64url'), iat: Number(now), exp: Number(now) + lifetimeSeconds * 1000 });
  const plain = b64(json);
  const compressed = `z${deflateRawSync(Buffer.from(json)).toString('base64url')}`;
  const payload = plain.length > 2800 && compressed.length < plain.length ? compressed : plain;
  return `${payload}.${sign(payload, secret)}`;
}

export function readSession(cookie, now = Date.now(), secret = process.env.WEB_SESSION_SECRET) {
  if (!cookie || !secret) return null;
  const [payload, signature, extra] = String(cookie).split('.');
  if (extra !== undefined || String(cookie).length > 65536) return null;
  if (!payload || !signature) return null;
  const expected = sign(payload, secret);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    // Authenticate before decoding or bounded decompression. Legacy JSON payloads start with ey.
    const json = payload.startsWith('z') ? inflateRawSync(Buffer.from(payload.slice(1), 'base64url'), {maxOutputLength:262144}).toString('utf8') : unb64(payload);
    const value = JSON.parse(json);
    if (!Number.isFinite(Number(value.exp)) || Number(value.exp) <= Number(now)) return null;
    const { iat, exp, ...user } = value;
    return user;
  } catch { return null; }
}

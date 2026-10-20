import crypto from 'node:crypto';

const b64 = value => Buffer.from(value).toString('base64url');
const unb64 = value => Buffer.from(value, 'base64url').toString('utf8');
const sign = (value, secret) => crypto.createHmac('sha256', String(secret || '')).update(value).digest('base64url');

export function csrfMatches(expected, supplied) {
  if (typeof expected !== 'string' || typeof supplied !== 'string' || !expected || expected.length !== supplied.length) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return crypto.timingSafeEqual(left, right);
}

export function createSession(user, now = Date.now(), secret = process.env.WEB_SESSION_SECRET) {
  if (!secret) throw new Error('WEB_SESSION_SECRET is required for web administration sessions.');
  const payload = b64(JSON.stringify({ ...user, csrf: crypto.randomBytes(24).toString('base64url'), iat: Number(now), exp: Number(now) + 8 * 60 * 60 * 1000 }));
  return `${payload}.${sign(payload, secret)}`;
}

export function readSession(cookie, now = Date.now(), secret = process.env.WEB_SESSION_SECRET) {
  if (!cookie || !secret) return null;
  const [payload, signature] = String(cookie).split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload, secret);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const value = JSON.parse(unb64(payload));
    if (Number(value.exp) <= Number(now)) return null;
    const { iat, exp, ...user } = value;
    return user;
  } catch { return null; }
}

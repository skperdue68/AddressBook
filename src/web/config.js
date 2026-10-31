import {sessionLifetimeSeconds} from './session.js';
import { adminInterfaceMode } from '../config/admin-interface.js';

export const MIN_SESSION_SECRET_LENGTH = 16;
export const RECOMMENDED_SESSION_SECRET_LENGTH = 32;

export function webAdminConfig(env = process.env) {
  const interfaceMode = adminInterfaceMode(env);
  const enabled = String(env.WEB_ADMIN_ENABLED || '').trim().toLowerCase() === 'true';
  if (interfaceMode === 'web' && !enabled) throw new Error('WEB_ADMIN_ENABLED=true is required when ADMIN_INTERFACE=web.');
  const portal=String(env.WEB_PORTAL_ENABLED||'').trim().toLowerCase()==='true';
  if (interfaceMode === 'discord'&&!portal) return { enabled: false };
  if (!enabled&&!portal) return { enabled: false };
  const sessionSecret = String(env.WEB_SESSION_SECRET || '').trim();
  if (!sessionSecret) throw new Error('WEB_SESSION_SECRET is required when WEB_ADMIN_ENABLED=true.');
  // The secret signs every login cookie, so anyone who can guess it can sign in as any member or administrator.
  if (sessionSecret.length < MIN_SESSION_SECRET_LENGTH) throw new Error(`WEB_SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters. Generate one with: openssl rand -base64 48`);
  if (sessionSecret.length < RECOMMENDED_SESSION_SECRET_LENGTH) console.warn(`HearthBound: WEB_SESSION_SECRET is shorter than ${RECOMMENDED_SESSION_SECRET_LENGTH} characters. Use a longer random value (openssl rand -base64 48); changing it signs everyone out.`);
  const oauth = { clientId: String(env.DISCORD_OAUTH_CLIENT_ID || env.DISCORD_CLIENT_ID || '').trim(), clientSecret: String(env.DISCORD_OAUTH_CLIENT_SECRET || '').trim(), redirectUri: String(env.DISCORD_OAUTH_REDIRECT_URI || '').trim() };
  const missing = Object.entries(oauth).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Missing web administration OAuth configuration: ${missing.join(', ')}`);
  return { enabled: true, host: String(env.WEB_ADMIN_HOST || '127.0.0.1'), port: Math.max(1, Number(env.WEB_ADMIN_PORT || 8787)), sessionSecret, sessionDays:sessionLifetimeSeconds(env)/86400, oauth };
}

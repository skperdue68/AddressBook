import { adminInterfaceMode } from '../config/admin-interface.js';

export function webAdminConfig(env = process.env) {
  const interfaceMode = adminInterfaceMode(env);
  const enabled = String(env.WEB_ADMIN_ENABLED || '').trim().toLowerCase() === 'true';
  if (interfaceMode === 'web' && !enabled) throw new Error('WEB_ADMIN_ENABLED=true is required when ADMIN_INTERFACE=web.');
  const portal=String(env.WEB_PORTAL_ENABLED||'').trim().toLowerCase()==='true';
  if (interfaceMode === 'discord'&&!portal) return { enabled: false };
  if (!enabled&&!portal) return { enabled: false };
  const sessionSecret = String(env.WEB_SESSION_SECRET || '').trim();
  if (!sessionSecret) throw new Error('WEB_SESSION_SECRET is required when WEB_ADMIN_ENABLED=true.');
  const oauth = { clientId: String(env.DISCORD_OAUTH_CLIENT_ID || env.DISCORD_CLIENT_ID || '').trim(), clientSecret: String(env.DISCORD_OAUTH_CLIENT_SECRET || '').trim(), redirectUri: String(env.DISCORD_OAUTH_REDIRECT_URI || '').trim() };
  const missing = Object.entries(oauth).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Missing web administration OAuth configuration: ${missing.join(', ')}`);
  return { enabled: true, host: String(env.WEB_ADMIN_HOST || '127.0.0.1'), port: Math.max(1, Number(env.WEB_ADMIN_PORT || 8787)), sessionSecret, oauth };
}

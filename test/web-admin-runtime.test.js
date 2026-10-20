import test from 'node:test';
import assert from 'node:assert/strict';
import { webAdminConfig } from '../src/web/config.js';

test('web administration is disabled by default and validates enabled configuration', () => {
  assert.equal(webAdminConfig({}).enabled, false);
  const config = webAdminConfig({ WEB_ADMIN_ENABLED: 'true', WEB_ADMIN_HOST: '127.0.0.1', WEB_ADMIN_PORT: '8787', WEB_SESSION_SECRET: 'secret', DISCORD_OAUTH_CLIENT_ID: 'client', DISCORD_OAUTH_CLIENT_SECRET: 'oauth-secret', DISCORD_OAUTH_REDIRECT_URI: 'https://example.test/auth/callback' });
  assert.deepEqual(config, { enabled: true, host: '127.0.0.1', port: 8787, sessionSecret: 'secret', oauth: { clientId: 'client', clientSecret: 'oauth-secret', redirectUri: 'https://example.test/auth/callback' } });
});

test('enabled web administration rejects missing session secret', () => {
  assert.throws(() => webAdminConfig({ WEB_ADMIN_ENABLED: 'true' }), /WEB_SESSION_SECRET/);
});

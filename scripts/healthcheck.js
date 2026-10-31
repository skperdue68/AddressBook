// Container health probe, run by Docker's HEALTHCHECK.
//
// When the web portal or administration console is enabled, the container is healthy
// once /privacy (a public page) answers 200 on the configured port. When the web
// interface is disabled there is no HTTP listener to probe, so the check passes and
// Docker's own process supervision (restart: unless-stopped) covers a crashed bot.
import http from 'node:http';

const enabled = value => String(value || '').trim().toLowerCase() === 'true';
const webEnabled = enabled(process.env.WEB_ADMIN_ENABLED) || enabled(process.env.WEB_PORTAL_ENABLED);
if (!webEnabled) process.exit(0);

const port = Math.max(1, Number(process.env.WEB_ADMIN_PORT || 8787));
const request = http.get({ host: '127.0.0.1', port, path: '/privacy', timeout: 4000 }, response => {
  response.resume();
  process.exit(response.statusCode === 200 ? 0 : 1);
});
request.on('timeout', () => { request.destroy(); process.exit(1); });
request.on('error', () => process.exit(1));

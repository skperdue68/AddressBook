// Response headers applied to every HTML page served by the web portal.
//
// The portal still uses a few inline scripts, handlers and styles, so script-src
// and style-src allow 'unsafe-inline'. The policy nevertheless blocks the things
// that matter most for this app: framing (clickjacking), plugins, <base> hijacking,
// and loading scripts or posting data to origins other than the portal itself.
// Discord is allowed as a form target because an expired session may redirect a
// submitted form through the sign-in flow.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cdn.discordapp.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self' https://discord.com",
  "frame-ancestors 'none'"
].join('; ');

export const SECURITY_HEADERS = Object.freeze({
  'content-security-policy': CONTENT_SECURITY_POLICY,
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()'
});

// Only meaningful, and only safe to send, over HTTPS.
export const HSTS_HEADERS = Object.freeze({ 'strict-transport-security': 'max-age=15552000' });

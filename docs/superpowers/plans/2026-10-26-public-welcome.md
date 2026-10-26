# HearthBound public welcome and server picker

**Goal:** Give shared links HearthBound branding and explain the product before login; match the server picker to the portal.

**Approved design:** Public root page with existing logo, houses/tours/sharing explanation, sign-in and invite actions, and Open Graph metadata. Protected workspace remains at `/app`. Server selection uses a responsive navy/gold card layout and existing account menu without assuming a guild or granting permissions.

**Approach:** Reuse workspace CSS and assets in a small standalone page renderer. Metadata URLs come from the configured OAuth callback origin (never an incoming Host header). Existing authorization still constructs server choices. A separate public page is preferable to crawler-specific login bypasses or changing protected workspace rendering.

**Tech stack:** Existing Node HTTP server, server-rendered HTML/CSS, node:test. No database migration or dependencies.

## Steps
- [x] Add failing HTTP tests for anonymous public metadata, protected routes, branded authorized picker, and persisted selection.
- [x] Implement welcome and picker renderers, route root before session resolution, and retain login flow.
- [x] Verify targeted/full tests and desktop/mobile browser rendering; document deployment and preview caching.
- [x] Review changes and publish a separate PR against current master.

## Review focus
- Public page must contain no user, guild, or housing data and must not need membership queries.
- Preview assets must work without login; canonical URLs must ignore hostile Host headers.
- Server labels must be escaped and unauthorized/revoked memberships excluded.
- Existing selection cookie and member/admin destination behavior must remain intact.
- Layout, keyboard focus and long server names must work at mobile widths.

**Validation:** 597 full-suite tests passed, plus focused final public-page/persistent-login checks. Chrome desktop 1440px and mobile 390px screenshots inspected; no horizontal overflow. Independent review found no significant issues.

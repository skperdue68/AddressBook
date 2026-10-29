# Tour Covers and Direct Links Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan inline, with one final independent review. Track completed steps here.

**Goal:** Give each tour an optional cover graphic shown on web lists/details and Discord tour starts, plus an easy permission-respecting web link.

**Architecture:** A single cover per tour in a new version-16 table, files outside source control, and a service that rechecks current tour permissions on every read/write. Web multipart routes reuse the existing upload parser. Discord attaches cover bytes to the existing unified-card layout. Login and guild selection preserve the intended tour URL.

**Tech Stack:** Existing Node/SQLite/MariaDB, sharp, Discord.js and server-rendered web UI; no new dependency.

**Spec:** User requests in this chat: optional screenshot/graphic for a tour, thumbnails in tour search, cover at the top of tour information and Discord when starting, and directly shareable web URLs.

## Global Constraints

- Private tours remain creator-only; Server and Global scopes retain existing rules.
- Files: still PNG/JPEG/WebP, at most 5 MB / 40 megapixels; normalize to WebP and strip metadata.
- One replaceable/removable cover; no placeholder for missing covers.
- No production deployment or automatic upload of the generated contest artwork.
- Migration must be additive and safe on the Linux MariaDB installation.

## Review Focus

- Access revoked after viewing a form must prevent mutation and image reads.
- No metadata/image leak for a restricted tour or a recipient outside a Server tour's guild.
- Repeated replacement/removal and concurrent writes must not lose the current valid file.
- OAuth and guild selection must retain the target while rejecting external redirects.
- Discord must clear a prior cover when moving to a tour without one and stay within component/attachment limits.

### Task 1: Persist authorized tour covers

Files: new `src/db/tour-cover-schema.js`, `src/services/tour-cover-service.js`; modify database/workspace initialization; test `test/tour-covers.test.js`.

- [x] Write failing migration/service tests for storage, replace/remove, validation and permission boundaries.
- [x] Add version-16 migration and `TourCoverService` read/save/remove/cleanup methods.
- [x] Run tests; confirm atomic file/DB behavior and repeat migration safety.

### Task 2: Web covers and direct links

Files: new `src/web/tour-cover.js`, `src/web/tour-links.js`; existing workspace routes, server, public pages, stylesheet. Test `test/web-tour-covers.test.js`.

- [x] Test upload/read/replace/delete, list/detail/player display, no-image layout, CSRF and stale access.
- [x] Add owner/admin upload controls, cover thumbnails and cover header; add copyable direct link.
- [x] Preserve path/query through login and server selection; include guild context for Server-tour links.
- [x] Run HTTP and browser checks, including login restoration and mobile bounds.

### Task 3: Discord starts and release

Files: new `src/ui/tour-cover.js`, existing housing menu and tour rendering integration; tests for attachments, no-cover clearing and Private access.

- [x] Add failing tests for cover attachment on tour information and first stop.
- [x] Attach authorized bytes via unified cards, leaving house screenshots on individual stops.
- [x] Run focused and full tests, request review, fix findings, document upgrade and open a separate PR against master.

## Implementation ledger

- Service, web HTTP, Discord self-paced/shared starts, image-free transitions, and authorization tests pass.
- Whole-branch review found an environment-context issue in Global/Private links. Added ESO environment to links and matching-guild selection with a regression test; follow-up review found no important issue. Global remains limited to its platform/region.
- Final full suite on master including PR48 and the mobile aspect-ratio fix: 785/785 passed, 0 failures or skipped tests.
- Ruling: anonymous Global viewing belongs to a separate change; these links retain normal authentication and scope checks.
- Ruling: no automatic production changes or artwork import; startup applies the additive migration after the user deploys the merged PR.

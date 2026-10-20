# Companion Administration Web Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a read-only, Discord-authenticated web administration console that reuses AddressBook services and never creates a second permission model.

**Architecture:** Add a small Node built-in HTTP server mounted alongside the Discord client. A `WebAdminService` resolves authorized guild/environment view models from existing services. A `WebAdminServer` handles OAuth state, signed short-lived sessions, HTML rendering, and read-only routes. Browser requests never execute SQL directly.

**Tech Stack:** Node.js 22 built-in `http`, `crypto`, and `fetch`; Discord OAuth2; existing SQLite/MariaDB services; Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-21-companion-admin-learning-design.md`

## Global Constraints

- No public member house directory in this release.
- No web mutations in the first release.
- Every page is scoped to a Discord guild and exact ESO environment.
- Private houses, tours, comments, and unrelated guild data never appear in guild administration views.
- OAuth state is single-use and sessions are short-lived, HTTP-only, and signed.
- Discord remains the member workflow.

## Review Focus

- A signed-in Discord user without Housing Moderator access receives a non-leaking forbidden response.
- A valid moderator cannot request another guild or ESO environment through query-string changes.
- OAuth callback state mismatch and expired state are rejected.
- Export downloads the existing guild/environment export and excludes Private data.
- Audit, maintenance, health, and pending-review tables paginate without exceeding response limits.

### Task 1: Web-admin view service

**Files:**
- Create: `src/services/web-admin-service.js`
- Test: `test/web-admin-service.test.js`

**Interfaces:**
- `getOverview({ guildId, esoServer, actor })` returns an environment-scoped overview view model.
- `listAudit({ guildId, page, pageSize })` delegates to `AuditLogService`.
- `listMaintenance({ guildId, esoServer })` delegates to `HouseMaintenanceService`.
- `listPending({ guildId, esoServer })` delegates to `RegistrationService`.
- `exportGuild({ guildId, esoServer })` delegates to `DataExportService`.
- `authorizeGuild({ actorId, guildId, memberRoleIds })` returns `{ allowed, reason }` using existing guild role logic.

- [ ] **Step 1: Write failing tests for moderator authorization, missing environment, Private exclusion, and exact guild/environment forwarding.
- [ ] **Step 2: Run `node --test test/web-admin-service.test.js` and verify the tests fail because the service does not exist.
- [ ] **Step 3: Implement the service using existing `GuildService`, `AdminHealthService`, `AuditLogService`, `HouseMaintenanceService`, `RegistrationService`, and `DataExportService`.
- [ ] **Step 4: Ensure all view models contain guild/environment labels but no database credentials or private records.
- [ ] **Step 5: Run the focused tests and verify they pass.
- [ ] **Step 6: Commit with `git commit -am "feat: add scoped web administration view service"`.

### Task 2: OAuth and session primitives

**Files:**
- Create: `src/web/session.js`
- Create: `src/web/oauth.js`
- Modify: `.env.example`
- Test: `test/web-auth.test.js`

**Interfaces:**
- `createOAuthState(returnTo, now)` and `consumeOAuthState(state, now)`.
- `createSession(user, now)` and `readSession(cookie, now)`.
- `buildDiscordAuthorizeUrl(state, config)`.
- `exchangeDiscordCode(code, config, fetchImpl)`.

- [ ] **Step 1: Write failing tests for state one-time use, expiry, signed-cookie tamper rejection, and OAuth URL parameters.
- [ ] **Step 2: Run the focused tests and verify they fail because the primitives do not exist.
- [ ] **Step 3: Implement state/session signing with `crypto.createHmac`, constant-time signature comparison, and bounded expiry.
- [ ] **Step 4: Add `WEB_ADMIN_ENABLED`, `WEB_ADMIN_HOST`, `WEB_ADMIN_PORT`, `DISCORD_OAUTH_CLIENT_SECRET`, `DISCORD_OAUTH_REDIRECT_URI`, and `WEB_SESSION_SECRET` to `.env.example` with safe empty defaults.
- [ ] **Step 5: Run the focused tests and verify they pass.
- [ ] **Step 6: Commit with `git commit -am "feat: add secure web admin sessions"`.

### Task 3: Read-only HTTP server and routes

**Files:**
- Create: `src/web/server.js`
- Create: `src/web/render.js`
- Modify: `src/index.js`
- Test: `test/web-admin-http.test.js`

**Interfaces:**
- `createWebAdminServer({ db, client, config, services, fetchImpl })` returns an HTTP server with `listen` and `close`.
- Routes: `/admin`, `/admin/audit`, `/admin/maintenance`, `/admin/pending`, `/admin/export`, `/auth/discord`, `/auth/callback`, `/auth/logout`.

- [ ] **Step 1: Write failing HTTP tests for unauthenticated redirect, OAuth callback, forbidden moderator access, overview rendering, pagination, and export content type.
- [ ] **Step 2: Run the focused HTTP tests and verify they fail because the server does not exist.
- [ ] **Step 3: Implement HTML rendering with escaped values, consistent guild/environment header, read-only badge, navigation, empty states, and table pagination.
- [ ] **Step 4: Implement OAuth routes and resolve Discord `/users/@me` plus guild membership/roles server-side through the Discord client/API.
- [ ] **Step 5: Implement all read-only admin routes through `WebAdminService`; reject arbitrary guild/environment parameters.
- [ ] **Step 6: Implement export as a streamed attachment from the existing export service with no private data.
- [ ] **Step 7: Run the focused HTTP tests and verify they pass.
- [ ] **Step 8: Commit with `git commit -am "feat: add read-only AddressBook admin console"`.

### Task 4: Runtime configuration and operator documentation

**Files:**
- Modify: `src/index.js`
- Modify: `README.md`
- Modify: current user/admin guide source.
- Test: `test/web-admin-runtime.test.js`

- [ ] **Step 1: Add a failing startup test proving the web server is not created when `WEB_ADMIN_ENABLED` is false and is created with configured host/port when true.
- [ ] **Step 2: Start the server only after database initialization and close it during SIGINT/SIGTERM shutdown.
- [ ] **Step 3: Add deployment instructions for HTTPS reverse proxy, OAuth redirect URI, session secret, and local-only binding.
- [ ] **Step 4: Run the complete test suite and a startup/shutdown smoke test.
- [ ] **Step 5: Commit with `git commit -am "docs: document AddressBook admin console"`.

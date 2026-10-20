# Web Pending Review Moderation Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure web approval and rejection of pending Server and Global house submissions while preserving AddressBook’s existing Discord permission model.

**Architecture:** Extend `WebAdminService` with an environment- and guild-scoped review operation that validates queue ownership, performs the existing status transition, and records an audit entry. Extend the signed web session with a CSRF token and add POST-only moderation routes to the existing server-rendered HTTP console; browsers never select guild or ESO environment values.

**Tech Stack:** Node.js 22 built-in `http` and `crypto`, Discord OAuth2 sessions, existing SQLite/MariaDB repositories, server-rendered HTML, and Node’s built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-21-web-pending-review-actions-design.md`

## Global Constraints

- Discord remains the source of the permission model.
- Every moderation request revalidates current Discord membership, Housing Moderator roles, guild, and exact ESO environment.
- Only pending Server records owned by the guild and pending Global records originating in the guild are eligible.
- Private records never appear in or mutate through the web review queue.
- GET requests remain read-only; state changes require POST plus a valid CSRF token and explicit confirmation.
- No web-specific role model, arbitrary guild/environment form fields, or browser SQL access.
- Existing Discord workflows and the `ADMIN_INTERFACE=both|discord|web` behavior remain unchanged.

## Review Focus

- A pending record from another guild or ESO environment must be rejected even when its numeric ID is submitted; covered by Task 1 queue-scope tests.
- A record reviewed by another moderator between page load and POST must not be transitioned twice; covered by Task 1 stale-state tests.
- Missing, malformed, or mismatched CSRF values must not reach the repository; covered by Task 2 and Task 3 tests.
- A user whose role was removed after OAuth login must receive the existing non-leaking 403 response; covered by Task 3 request revalidation tests.
- HTML must escape house, owner, actor, and error text; covered by Task 3 rendering tests.

### Task 1: Scoped web moderation service and audit transition

**Files:**
- Modify: `src/services/web-admin-service.js`
- Test: `test/web-admin-service.test.js`

**Interfaces:**
- Add `WebAdminService.reviewPending({ id, action, guildId, esoServer, actor })` returning `{ action, record }` or throwing a safe review error.
- `action` accepts only `'approve'` or `'deny'`.
- `actor` contains `{ id, globalName, displayName }`.

- [ ] **Step 1: Write failing unit tests** for approving an eligible Server record, denying an eligible Global record, rejecting Private records, rejecting another guild’s record, rejecting an environment mismatch, rejecting non-pending records, rejecting invalid actions, and recording actor/guild/environment audit fields.
- [ ] **Step 2: Run the focused service test** with `node --test test/web-admin-service.test.js` and confirm the new assertions fail because `reviewPending` does not exist.
- [ ] **Step 3: Implement the smallest scoped review operation.** Import `one` and `withTransaction` from `src/db/database.js`; inside `withTransaction`, load the row with `SELECT ... FOR UPDATE`, require `status='pending'`, require `eso_server` to match, require `(scope='public' AND guild_id=guildId) OR (scope='global' AND origin_guild_id=guildId)`, map `approve` to `active` and `deny` to `archived`, update the row, and write one `audit_log` row with action `web_approve_house` or `web_deny_house`, entity `saved_house`, house name, actor identity, guild, environment, and saved-house ID. Return the updated record after the transaction.
- [ ] **Step 4: Run the focused tests** and confirm all service assertions pass for both SQLite and the existing database abstraction.
- [ ] **Step 5: Commit** with `git add src/services/web-admin-service.js src/services/registration-service.js test/web-admin-service.test.js && git commit -m "feat: add scoped web pending review service"`.

### Task 2: CSRF-bound web session state

**Files:**
- Modify: `src/web/session.js`
- Modify: `src/web/server.js` session creation call
- Test: `test/web-auth.test.js`

**Interfaces:**
- `createSession(user, now, secret)` includes a cryptographically random `csrf` field and returns the existing signed cookie format.
- `readSession(cookie, now, secret)` returns the session with `csrf` available to server-side route handling.
- Add `csrfMatches(expected, supplied)` using constant-time comparison and returning `false` for missing or malformed values.

- [ ] **Step 1: Write failing tests** proving new sessions contain a CSRF value, tampering with it invalidates the signature, matching values pass, missing values fail, and unequal-length values fail without throwing.
- [ ] **Step 2: Run `node --test test/web-auth.test.js`** and verify the new CSRF assertions fail before implementation.
- [ ] **Step 3: Implement the CSRF field and constant-time matcher** with `crypto.randomBytes` and `crypto.timingSafeEqual`; preserve existing expiry, cookie, and OAuth behavior.
- [ ] **Step 4: Run the focused authentication tests** and confirm they pass, including existing signed-session tests.
- [ ] **Step 5: Commit** with `git add src/web/session.js src/web/server.js test/web-auth.test.js && git commit -m "feat: bind web forms to signed csrf sessions"`.

### Task 3: Pending Review HTML and POST routes

**Files:**
- Modify: `src/web/server.js`
- Modify: `src/web/render.js`
- Test: `test/web-admin-http.test.js`

**Interfaces:**
- Add POST routes `/admin/pending/:id/approve` and `/admin/pending/:id/deny`.
- Add a small URL-encoded body parser that rejects oversized or malformed bodies.
- Keep all route scope values derived from `sessionContext`, never from submitted form data.

- [ ] **Step 1: Write failing HTTP tests** for escaped pending rows with approve/reject forms, successful approve POST redirect, successful deny POST redirect, missing CSRF rejection, invalid CSRF rejection, GET rejection for mutation paths, current-role removal returning 403, wrong record scope returning a safe unavailable response, and stale review returning a non-mutating message.
- [ ] **Step 2: Run `node --test test/web-admin-http.test.js`** and confirm the new route tests fail because forms and POST routes do not exist.
- [ ] **Step 3: Render the Pending Review table** with house name, owner, visibility, submitter, submission timestamp, escaped values, a moderation-enabled badge, and separate confirmation forms. Render an explicit reject confirmation field/button without introducing a rejection-reason column.
- [ ] **Step 4: Implement POST parsing and CSRF validation** before calling `WebAdminService.reviewPending`; require `confirm=approve` or `confirm=deny`, parse only the path ID, pass the current session actor identity, and redirect to `/admin/pending?status=...` after success.
- [ ] **Step 5: Map safe errors** for unauthorized, malformed, wrong-scope, missing, and stale records without exposing SQL or credentials; ensure repository methods are not called when CSRF validation fails.
- [ ] **Step 6: Run the focused HTTP tests** and verify all new and existing web tests pass.
- [ ] **Step 7: Commit** with `git add src/web/server.js src/web/render.js test/web-admin-http.test.js && git commit -m "feat: add web pending review actions"`.

### Task 4: Documentation, configuration, and full verification

**Files:**
- Modify: `README.md`
- Modify: `docs/AddressBook-v1.0.0-Current-State.md`
- Test: `test/web-admin-runtime.test.js`

- [ ] **Step 1: Add a failing runtime assertion** that `ADMIN_INTERFACE=web` still requires `WEB_ADMIN_ENABLED=true`, and add a focused HTTP assertion that the Pending Review page carries the moderation-enabled label.
- [ ] **Step 2: Update operator documentation** with the new Pending Review workflow, CSRF/HTTPS requirement, audit behavior, and the fact that Private records remain excluded.
- [ ] **Step 3: Run the complete suite** with `npm test` and require zero failures.
- [ ] **Step 4: Run a syntax check** with `node --check src/web/server.js && node --check src/web/session.js && node --check src/services/web-admin-service.js`.
- [ ] **Step 5: Inspect the rendered Pending Review response** for escaped values, confirmation controls, and no database credentials or private rows.
- [ ] **Step 6: Commit** with `git add README.md docs/AddressBook-v1.0.0-Current-State.md test/web-admin-runtime.test.js && git commit -m "docs: document web pending moderation"`.
- [ ] **Step 7: Build the release ZIP** excluding `node_modules`, `.git`, runtime data, and the ZIP itself; record its SHA-256 and provide the direct download link.

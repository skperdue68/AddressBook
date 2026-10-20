# MariaDB + Global Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SQLite with MariaDB, migrate existing AddressBook data into a unified scope-aware schema, add Global houses/tours/moderation, and make tour sessions transient and correctly scoped.

**Architecture:** Runtime persistence is MariaDB-only through one connection pool and async services. Private/Public/Global saved houses share one stable `saved_houses` identity so scope changes preserve comments and metadata. Tours reference saved-house IDs, Global tours can contain only Global houses, and active tour sessions are transient rows uniquely scoped by guild/channel/mode/user as appropriate.

**Tech Stack:** Node.js 22+, discord.js v14, `mariadb` Node driver, dotenv, built-in `node:sqlite` only in the one-time migration CLI.

**Spec:** `docs/superpowers/specs/2026-09-13-mariadb-global-scope-design.md`

## Global Constraints

- MariaDB is the only runtime database after cutover.
- The database itself is created by the operator; AddressBook creates and migrates its tables.
- `DB_PASSWORD_FILE` overrides `DB_PASSWORD` when configured.
- Public houses/tours are guild isolated; Private houses follow the owning Discord user; Global houses/tours are bot-wide.
- Global tours may contain Global houses only.
- Existing SQLite `tour_sessions` are intentionally not imported.
- Scope changes retain house identity/comments and require impact confirmation before pruning invalid tour stops.
- Ending or replacing a tour session deletes the database row; stale controls return `This tour has been closed.`
- Global moderator authority is centralized by Discord user ID and approved only by IDs in `GLOBAL_MODERATOR_APPROVER_USER_IDS`.
- Migration refuses a non-empty target and rolls back on any failure.

---

### Task 1: MariaDB runtime and schema migrations

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Replace: `src/db/database.js`
- Create: `src/db/schema.js`
- Modify: `src/db/init.js`
- Modify: `src/db/seed-houses.js`
- Test: `test/mariadb-schema.test.js`

**Interfaces:**
- Produces `openDatabase() -> Promise<Pool>`, `withTransaction(pool, fn)`, `migrate(pool)`, `closeDatabase(pool)`, and password-file config loading.
- Produces schema tables `schema_migrations`, `houses`, `guild_settings`, `saved_houses`, `house_comments`, `tours`, `tour_stops`, `tour_sessions`, `global_moderators`, `global_moderator_requests`, `audit_log`.

- [ ] Write schema/config tests that assert MariaDB-only env names, `mariadb` dependency, unified `saved_houses`, FK/cascade rules, session mode/indexes, and moderator tables.
- [ ] Run the new test and verify it fails against v0.3.47.
- [ ] Implement pool creation, password-file support, versioned schema migration, and MariaDB house catalog upsert.
- [ ] Run the schema/config tests and syntax checks.

### Task 2: Unified saved-house service and scope conversion

**Files:**
- Create: `src/services/saved-house-service.js`
- Replace callers of: `src/services/bookmark-service.js`, `src/services/registration-service.js`
- Modify: `src/services/comment-service.js`
- Modify: `src/services/visit-service.js`
- Test: `test/saved-house-scope.test.js`

**Interfaces:**
- Produces async methods `createPrivate`, `createPublic`, `createGlobal`, `getVisible`, `searchVisible`, `update`, `delete`, `previewScopeChange`, `changeScope`.
- `previewScopeChange` returns affected tour IDs/names/stops; `changeScope` performs scope update + invalid-stop pruning in one transaction.

- [ ] Write failing tests for visibility rules, ownership, stable IDs/comments, and scope-change impact/pruning.
- [ ] Implement unified saved-house queries and permission-safe visibility.
- [ ] Convert comments to reference `saved_house_id` and cascade on house deletion.
- [ ] Run saved-house tests and static syntax checks.

### Task 3: Tours, Global tours, and transient sessions

**Files:**
- Replace: `src/services/tour-service.js`
- Create: `src/services/tour-session-service.js`
- Test: `test/tour-session-scope.test.js`
- Test: `test/global-tour.test.js`

**Interfaces:**
- Tours use visibility `private|public|global` and source rules over saved-house scopes.
- Session API: `startSelfPaced`, `startShared`, `get`, `advance`, `end`; replacement deletes previous matching session.

- [ ] Write failing tests for Global-tour eligibility and session replacement/deletion/stale behavior.
- [ ] Implement async tour service with `saved_house_id` stops and Global constraints.
- [ ] Implement session service with unique guild/channel/mode scoping and physical deletion.
- [ ] Run tests and syntax checks.

### Task 4: Global moderator request/approval subsystem

**Files:**
- Create: `src/services/global-moderator-service.js`
- Modify: `src/services/guild-service.js`
- Test: `test/global-moderator.test.js`

**Interfaces:**
- Methods `isApprover`, `isGlobalModerator`, `requestAccess`, `listPending`, `approve`, `deny`, `revoke`, `listModerators`.
- Approvers come only from `GLOBAL_MODERATOR_APPROVER_USER_IDS`.

- [ ] Write failing tests for request reason, duplicate prevention, centralized approval, and revocation.
- [ ] Implement service and configuration parsing.
- [ ] Run tests and syntax checks.

### Task 5: Convert Discord handlers/UI to async MariaDB services and add Global UI

**Files:**
- Modify: `src/index.js`
- Modify: `src/handlers.js`
- Modify: `src/ui/housing-menu.js`
- Modify: `src/ui/housing-ui.js`
- Modify: `src/utils/menu-specs.js`
- Modify: `src/utils/registration-routing.js`
- Modify: `src/commands/definitions.js` if copy/help text requires it
- Test: existing UI/navigation tests plus `test/global-ui.test.js`

**Interfaces:**
- Register New House offers Private/Public/Global.
- Edit House includes scope change; impacted tours receive preview/confirm before commit.
- Administration exposes Global Moderator request flow and approver management flow.
- Search includes user Private + guild Public + Global + optional Non-Player.
- Tour stale controls respond exactly `This tour has been closed.`

- [ ] Write/update static UI tests for Global registration, Global tour labels, moderator controls, scope-confirm flow, and stale-session copy.
- [ ] Convert service calls to `await`, remove all direct handler/UI SQL, and wire new services.
- [ ] Run all runnable tests and syntax checks.

### Task 6: SQLite-to-MariaDB migration CLI

**Files:**
- Create: `src/db/migrate-sqlite-to-mariadb.js`
- Modify: `package.json`
- Test: `test/sqlite-import.test.js`

**Interfaces:**
- Command: `npm run db:migrate-sqlite-to-mariadb -- ./data/eso-housing.sqlite`.
- Opens SQLite read-only, refuses non-empty MariaDB application target, maps `registered_houses` and `personal_bookmarks` to stable `saved_houses`, migrates comments/tours/stops/audit rows, skips `tour_sessions`, validates counts/references, commits or rolls back as a unit.

- [ ] Write migration mapping/empty-target/skip-session tests.
- [ ] Implement importer and verification summary.
- [ ] Run migration tests that do not require a live MariaDB server plus syntax checks.

### Task 7: Deployment/docs/version/package

**Files:**
- Modify: `README.md`
- Modify: `AddressBook_v0.3.47_README.md` (rename/version as appropriate)
- Modify: `docker-compose.yml`
- Modify: `Dockerfile` if needed
- Modify: `.gitignore`
- Modify: `package.json`
- Update current-state documentation under `docs/`

**Interfaces:**
- Documents MariaDB database creation responsibility, env keys, migration command, backup/cutover, Global scopes, moderator requests, tour-session behavior, and scope-change pruning.

- [ ] Update current-state documentation with no changelog/history section.
- [ ] Bump package release version.
- [ ] Run complete available test suite, JS syntax checks, grep for runtime SQLite/direct SQL remnants, and archive integrity check.
- [ ] Produce updated ZIP.

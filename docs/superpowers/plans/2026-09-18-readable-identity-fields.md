# Readable Identity Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep numeric IDs authoritative while storing and refreshing readable names for Discord guilds, users, guild memberships, channels, roles, tours, saved houses, and official ESO houses in both supported databases.

**Architecture:** Add normalized Discord identity-cache tables plus companion-name columns on operational records. A central `IdentityService` captures names from every Discord interaction and propagates changed names to all associated rows; house and tour services propagate internal entity renames. Schema version 2 upgrades SQLite and MariaDB additively and cross-backend migration copies the new data.

**Tech Stack:** Node.js 22+, discord.js 14, `node:sqlite`, MariaDB, Node test runner.

**Spec:** Approved conversation design: named entities only; retain global and guild-specific Discord names; refresh all associated records, including historical audit rows; IDs remain authoritative.

## Global Constraints

- Store names for guilds, Discord users, guild-specific member names, channels, roles, tours, saved houses, and official houses.
- Do not add names for message IDs or request IDs.
- Never use a companion name for authorization, uniqueness, or relational identity.
- Retain the last known name when Discord cannot resolve a newer value.
- Apply equivalent schema and behavior to SQLite and MariaDB.
- Preserve companion names during SQLite/MariaDB migration in either direction.

---

### Task 1: Schema version 2

**Files:**
- Modify: `src/db/sqlite-schema.js`
- Modify: `src/db/schema.js`
- Modify: `src/db/database.js`
- Test: `test/identity-schema.test.js`

**Interfaces:**
- Produces schema version 2 and cache tables `discord_guilds`, `discord_users`, `discord_guild_members`, `discord_channels`, and `discord_roles`.
- Produces nullable companion-name columns on all ID-bearing operational tables.

- [ ] Write a failing integration test that migrates a fresh SQLite database and verifies cache tables and representative companion columns using `PRAGMA table_info`.
- [ ] Run `node --test test/identity-schema.test.js` and confirm failure because version 2 is absent.
- [ ] Define equivalent SQLite and MariaDB version-2 cache tables and column specifications.
- [ ] Add backend-aware, idempotent column migration helpers and record schema version 2.
- [ ] Re-run the test and confirm it passes.

### Task 2: Discord identity synchronization and propagation

**Files:**
- Create: `src/services/identity-service.js`
- Modify: `src/handlers.js`
- Test: `test/identity-service.test.js`

**Interfaces:**
- Produces `IdentityService.syncInteraction(interaction): Promise<void>`.
- Produces `IdentityService.refreshInternalNames(): Promise<void>` for house/tour companion names.
- `createHandlers(db)` invokes identity synchronization before dispatching every supported interaction.

- [ ] Write failing SQLite integration tests for initial capture, updated-name propagation, last-known-name retention, and guild-specific display names.
- [ ] Run the focused test and confirm failures because `IdentityService` is absent.
- [ ] Implement normalized value extraction and portable SELECT/INSERT/UPDATE upserts.
- [ ] Propagate guild, global-user, guild-member, channel, and role names to every companion field that references the corresponding ID.
- [ ] Backfill internal house/tour names using relational joins expressed as portable row updates.
- [ ] Wire synchronization ahead of handler dispatch without blocking an interaction when an optional name is absent.
- [ ] Re-run focused tests and confirm they pass.

### Task 3: Operational write paths and migrations

**Files:**
- Modify: `src/db/database-migration.js`
- Modify: `src/db/migrate-sqlite-to-mariadb.js`
- Modify: `src/services/saved-house-service.js`
- Modify: `src/services/tour-service.js`
- Modify: `src/services/guild-service.js`
- Modify: `src/services/comment-service.js`
- Modify: `src/services/tour-session-service.js`
- Modify: `src/services/global-moderator-service.js`
- Test: `test/identity-service.test.js`
- Test: `test/visibility-and-migration.test.js`

**Interfaces:**
- Existing service public methods remain backward compatible.
- Migration table manifests include cache tables and all companion columns.

- [ ] Add failing tests proving a tour rename and saved-house rename propagate into dependent rows and cross-backend manifests retain new fields.
- [ ] Run focused tests and confirm the expected failures.
- [ ] Extend service writes to populate or refresh known internal companion names in the same transaction.
- [ ] Extend unified migration manifests and legacy import defaults without requiring unavailable names.
- [ ] Re-run focused tests and confirm they pass.

### Task 4: Release metadata, documentation, and verification

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `.env.example` only if configuration changes are required.

**Interfaces:**
- Produces AddressBook version `0.5.3` and a complete release archive.

- [ ] Document readable companion fields, automatic refresh behavior, last-known-name behavior, and ID authority.
- [ ] Run `npm test` and require zero failures.
- [ ] Run `npm pack --dry-run` and inspect the packaged file list for secrets and accidental database files.
- [ ] Create `AddressBook-v0.5.3.zip` excluding `.env`, databases, logs, migration markers, and `node_modules`.
- [ ] Inspect the archive listing and save the final archive as the new deliverable.

## Self-Review

- Spec coverage: cache, companion columns, refresh propagation, audit updates, both backends, and bidirectional migration are assigned to Tasks 1–3.
- Placeholder scan: no deferred implementation steps or unspecified error handling remain.
- Type consistency: `IdentityService.syncInteraction` and `refreshInternalNames` are the only new cross-file service interfaces.

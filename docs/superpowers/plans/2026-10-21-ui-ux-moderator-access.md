# AddressBook Moderator Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Move access requests under Help and let current AddressBook Server administrators approve individual Server grants.

**Architecture:** Add a service for Server requests, grants, and authoritative review checks. Refresh its results through `GuildService` before Discord and web authorization; keep Global approval policy separate. Add focused request screens and small dispatch hooks.

**Tech Stack:** Node.js ES modules, discord.js 14, SQLite/MariaDB additive migrations, `node:test`.

**Spec:** [Approved design](../specs/2026-10-21-ui-ux-refresh-design.md). Coordination: [master plan](2026-10-21-ui-ux-refresh.md).

## Global Constraints

- "Use individual grants stored inside AddressBook."
- "One pending request per user and guild is allowed."
- "A reviewer cannot approve their own request."
- "An empty moderator-role configuration's bootstrap administration access must not authorize approvals."
- "Global grants remain environment-specific."
- "Neither a Server grant nor a Global grant provides access to another user's Private houses or tours."
- Preserve existing configured staff roles; no Discord role assignments or new slash commands.

## Review Focus

Stale request revisions, concurrent approvals, revoked reviewer grants, missing actual Server approvers, and web sessions belonging to departed guild members must all fail closed. The tests in A1/A2 pin these cases.

## Task A1: Add persistent request policy and schema version 11

**Files:** Create `src/services/server-moderator-service.js`, `test/server-moderator.test.js`, `test/ui-ux-schema.test.js`. Modify `src/db/schema.js`, `src/db/sqlite-schema.js`, `src/db/database.js`, `src/db/database-migration.js`, `src/db/migrate-sqlite-to-mariadb.js`, `test/environment-transfer.test.js`, `test/mariadb-schema.test.js`, `package.json`.

**Interfaces:** `ServerModeratorService(db)` produces async `access({guildId,userId,roleIds}) -> {isModerator,hasGrant,activeGrantCount,canReviewRequests,bootstrap}`, `request({guildId,userId,reason,names}) -> Request`, `review({guildId,requestId,revision,reviewer,decision}) -> Request`, `revoke({guildId,userId,reviewer}) -> boolean`, `listRequests({guildId}) -> Request[]`, `listGrants({guildId}) -> Grant[]`, and `status({guildId,userId}) -> {hasGrant,request}`. `reviewer` is `{userId,roleIds}` supplied only after the controller verifies current guild membership. `decision` is exactly `approve` or `deny`.

- [x] **Write failing service/migration tests.** Use a local fixture with guilds `g1`/`g2`, configured role `staff`, applicant `u1`, and reviewers with/without that role. Assert duplicate pending requests are rejected, no bootstrap/self/Global-only approval succeeds, an approved grant exists only in `g1`, a denied applicant can re-request, the revision increases, and an old revision cannot approve the new request. Assert concurrent reviews produce one grant and one successful decision, and a revoked reviewer cannot review another request.
- [x] **Run red:** `node --test test/server-moderator.test.js test/ui-ux-schema.test.js`. Confirm the failures identify missing grant policy/tables.
- [x] **Implement the migration and service.** Create v11 tables using the shared migration contract. Request columns are `id,guild_id,discord_user_id,reason,status,revision,requested_at,reviewed_at,reviewed_by,discord_global_name,discord_display_name,guild_name`; use statuses `pending,approved,denied,revoked` and unique `(guild_id,discord_user_id)`. Grant columns are `guild_id,discord_user_id,approved_by,request_id,request_revision,approved_at`, with composite primary key `(guild_id,discord_user_id)`. Cycle columns are defined in the master plan. Use transactions and conditional updates matching pending status/revision; audit transitions as guild actions without Private-content references. Derive reviewer authority from fresh database settings/grants and verified role IDs, never from bootstrap or an externally supplied boolean.
- [x] **Implement transfer compatibility.** Extend both transfer paths' copy/clear/verification lists in dependency order. Treat only these new tables as optional on pre-v11 sources. Add fresh-install, repeated-migration, v10-upgrade preservation, and both-direction transfer assertions for the three tables and existing event data.
- [x] **Run green:** `node --test test/server-moderator.test.js test/ui-ux-schema.test.js test/environment-transfer.test.js test/mariadb-schema.test.js test/database-backend.test.js`. Expected: new authorization/migration cases pass without changing existing ownership records.
- [x] **Commit:** `feat: add scoped AddressBook Server moderator grants`.

## Task A2: Integrate grant authorization and Help/Administration screens

**Files:** Create `src/ui/moderator-access-ui.js`, `src/ui/server-moderator-menu.js`, `test/server-moderator-ui.test.js`. Modify `src/services/guild-service.js`, `src/services/my-addressbook-service.js`, `src/ui/housing-menu.js`, `src/ui/housing-ui.js`, `src/utils/menu-specs.js`, `src/index.js`, `src/services/web-admin-service.js`, `src/web/server.js`, `test/multi-role-admin.test.js`, `test/web-admin-service.test.js`, `test/web-admin-http.test.js`, `test/admin-interface-mode.test.js`, `test/tour-admin-permissions.test.js`, `package.json`.

**Consumes:** A1's service methods and schema. **Produces:** async `GuildService.ensureModeratorAccess(interaction) -> Access` that refreshes the current guild/user cache before existing synchronous policy methods; async `WebAdminService.authorizeGuild({guildId,requestedGuildId,esoServer,requestedEsoServer,userId,memberRoleIds}) -> {allowed,reason}`; request UI dispatcher `handleServerModeratorAction(i,{serverModerators,guilds})` and `isServerModeratorAction(customId) -> boolean`.

- [x] **Write failing interaction tests.** Assert Home no longer offers Global requests; Help → Moderator Access offers both accurately labeled scopes and Back navigation. Exercise request, pending status, administrator approval/denial, grant listing/revocation, denied re-request, and duplicate submissions through handlers. Assert each review ID includes request ID and revision, expired controls produce a useful retry screen, and a role or grant revoked after opening a form prevents its action.
- [x] **Write authorization regressions.** An individual Server grant enables the same Server tools as role `staff` only in `g1`. It does not enable Global approval or another owner's Private house/tour editor. Grant removal is reflected on the next Discord action and HTTP request; independent role access survives individual-grant revocation. A no-role/no-grant bootstrap screen cannot approve requests, and no-role with existing grants does not grant everyone administration. A departed guild member loses web access.
- [x] **Run red:** `node --test test/server-moderator-ui.test.js test/multi-role-admin.test.js test/web-admin-http.test.js test/tour-admin-permissions.test.js`.
- [x] **Wire refreshed policy.** Inject the Server service into `GuildService`; refresh in `prepareInteraction` before any policy checks. Update `canAdmin`, `isModerator`, channel bypass, and related existing predicates to combine verified role access with the refreshed grant. Keep bootstrap limited to no configured roles and zero active grants, and keep review authority separate. Verify current members/roles again for review actions. Recheck grant-dependent editor/picker actions before displaying or writing records, including stale screens. Make the web authorization call awaited; pass `session.id` and current membership roles, never a body/query user ID. Update existing synchronous authorization tests to await the new method.
- [x] **Wire navigation and screens.** Use prefixes `hu:help:moderators`, `hu:servermod:*`, and `hu:modal:servermod:request`. Show statuses and the no-approver explanation. Place Server review/grant management under Administration even in web-only mode; retain current Global approval controls under their authorized access screen, with request-page Back controls returning to Help. Update the home layout as well as button specs so removing Global access cannot leave an undefined button. Extend `MyAddressBookService.pending(userId,esoServer,guildId=null)` and `myPendingPayload({houses,requests,serverRequests=[]})` to show current-guild Server requests, and include them in pending counts.
- [x] **Run green:** the red command plus `node --test test/admin-interface-mode.test.js test/web-admin-service.test.js test/global-moderator.test.js test/environment-global-moderator.test.js test/approved-ux.test.js test/discord-component-limits.test.js`. Expected: role/grant parity and privacy boundaries hold, and Global approval behavior remains unchanged.
- [x] **Commit:** `feat: move moderator requests into Help and support Server approvals`.

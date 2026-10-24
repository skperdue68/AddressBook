# Member Web Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a polished member portal with shared permissions, house/tour workflows, community insights, named usage, owner-only catalog additions and explicit access labels.

**Architecture:** Extend the existing Node HTTP portal and business services. Introduce shared policy and focused web route/render modules; version additive schema changes for SQLite and MariaDB. Keep Discord and web on shared services.

**Tech Stack:** Node >=22 ESM, node:http, discord.js, existing SQLite/MariaDB adapters, plain HTML/CSS/browser JavaScript, node:test.

**Spec:** docs/superpowers/specs/2026-10-23-web-workspace-design.md

## Global Constraints
- No live Linux access or database mutation is authorized as part of local implementation.
- Private houses/tours: owner only, including against administrators and bot owners.
- Every action rechecks exact guild/environment and authoritative AddressBook permissions.
- Usage: newest first; named actor and originating server; no Private object identifiers or search text.
- 90-day raw event retention; no fabricated historical backfill.
- Existing runtime/deployment; isolated branch and PR; no installation/default-branch edits.

## Review Focus
- Revoked grants or guild membership between form display and submit must deny writes (Task 1/3).
- Seed update colliding with an owner-added catalog ID must preserve owner data (Task 6).
- Concurrent tour editing or incompatible stops must fail without partial updates (Task 4).
- Target made Private/deleted after activity must not leak cached labels/links (Task 7).
- Duplicate interactions, telemetry failures and equal-timestamp pagination must not miscount or break actions (Task 7).

## File map
New: src/services/content-policy-service.js, web-workspace-service.js, community-statistics-service.js, usage-activity-service.js, house-catalog-service.js; src/web/workspace-routes.js, workspace-render.js, assets/workspace.css, assets/tour-editor.js; src/db/workspace-schema.js. Existing integration: src/web/{server,render,config,oauth}.js, src/index.js, src/ui/{housing-menu,housing-ui}.js, src/db/{database,schema,sqlite-schema,seed-houses,database-migration}.js. New focused node:test files per task; add them to package.json test script. Preserve existing administrative routes and tests.

### Task 1: Shared access policy and explicit role model
**Files:** new content-policy-service.js, test/content-policy.test.js; modify housing-menu.js shared edit helpers, guild/global moderator services only where needed.
**Interfaces:** ContentPolicyService.context({userId,guildId,esoServer,memberRoleIds}) returns verified actor context with roles [{kind,label,guildId?,esoServer?}], isOwner/isServerAdmin/isGlobalAdmin. canViewHouse/canEditHouse/canViewTour/canEditTour(record,context) return boolean, keeping pass capabilities separate.
- [ ] Write tests: owner cannot see/edit others' Private; Global admin edits Server tours in same env but cannot edit Server houses without Server rights; Server admin restricted to own guild; creator, multi-role labels, Member fallback, revoked grant refresh.
- [ ] Run node --test test/content-policy.test.js and confirm initial failure.
- [ ] Extract existing effective rules without changing Discord behavior; return all applicable role labels with scope.
- [ ] Run new policy and existing tour-admin/private/owner tests; commit passing deliverable.

### Task 2: Member entry, application shell and Your Access
**Files:** web config/oauth/server/render, new workspace-routes.js/workspace-render.js/assets/workspace.css, index.js; test/web-workspace-auth.test.js and web-workspace-render.test.js.
**Interfaces:** WebWorkspaceService.authorizeContext(input) returns member eligibility plus Task 1 context. workspace route handler receives authenticated context and returns handled boolean; admin authorization remains separately required. renderWorkspace({title,body,user,context,active}) escapes all values and renders all role badges.
- [ ] Test member allowed into workspace but denied admin; configured owner/global/server/multiple/member labels; env/guild switch updates; stale role denial; safe OAuth return paths; CSRF and unauthorized direct routes; escaped hostile names.
- [ ] Confirm failures with node --test test/web-workspace-auth.test.js test/web-workspace-render.test.js.
- [ ] Implement fresh membership context, split member/admin gates, WEB_PORTAL_ENABLED with backward-compatible WEB_ADMIN_ENABLED behavior, shared dark responsive shell, navigation, access details and legacy admin links. Keep admin-interface mode controlling admin presentation, not explicitly enabled member portal.
- [ ] Run targeted web/auth/config/runtime tests; inspect desktop/mobile and keyboard navigation; commit.

### Task 3: House registration, browsing, personal collection and discovery
**Files:** web-workspace-service.js/workspace-routes.js/workspace-render.js; existing saved-house/search/registration/discovery/featured services; test/web-house-workflows.test.js.
**Interfaces:** listHouses(context,filters), registerHouse(context,input), updateHouse(context,id,input), personalCollection(context), randomHouse(context), featured(context) return service results with policy-derived action flags.
- [ ] Test exact env/scope visibility; missing catalog match helpful retry; duplicate handling; open/roles/approval registration; unknown or revoked actor on POST; Private owner-only; pending registration not silently active; house-to-tour eligibility.
- [ ] Run node --test test/web-house-workflows.test.js, confirm red.
- [ ] Implement paginated search/filter forms and CSRF-protected writes using existing service validation, preserving original actor and scope; personal collection, featured/Random House and post-registration tour shortcut. Never accept client ownership assignments.
- [ ] Run workflow, registration, discovery and Private tests; commit.

### Task 4: Atomic tour editor with drag/drop
**Files:** web-workspace-service.js/workspace-routes.js/workspace-render.js/assets/tour-editor.js; tour-service.js; test/web-tour-editor.test.js.
**Interfaces:** listTours(context,filters) alphabetical; getTourDraft(context,id) returns {tour,stops,version}; saveTourDraft(context,{id?,version,details,stopIds}) returns saved tour or conflict. Version compares current tour plus ordered stop snapshot under transaction locking.
- [ ] Test creator/admin matrix, foreign server Global editing without widening house access, scope compatibility, duplicate destinations, stale version, two concurrent saves and rollback on invalid stop; alphabetical names; ordered multi-selection.
- [ ] Run node --test test/web-tour-editor.test.js; confirm red.
- [ ] Implement single transactional draft save with fresh policy/destination checks, safe version comparison and row locking supported by each backend. Add searchable eligible houses, scope/details forms, local stop draft, keyboard Up/Down, drag/drop, unsaved change warning and explicit Save. Tour start/progress uses existing readiness/session/progress services.
- [ ] Run tour/editor/permission tests; manually inspect mobile/keyboard ordering; commit.

### Task 5: Statistics with explicit deduplication
**Files:** community-statistics-service.js, workspace routes/render; test/community-statistics.test.js.
**Interfaces:** snapshot(context) returns personal Private count, selected Server/Global registrations and accessible active tour metrics; popularity(context,{metric,page}) groups official house IDs with distinct registrations/members/normalized ESO owners/eligible tour appearances.
- [ ] Test cross-scope duplicate destination, distinct registering members vs ESO owners, same owner different env, repeated stops in same tour, inactive/pending records, other users' Private and other guilds excluded.
- [ ] Run node --test test/community-statistics.test.js; confirm red.
- [ ] Implement parameterized scoped queries, labeled official house rankings and fun facts, filters and policy-safe drilldowns. No fabricated historical visit counts.
- [ ] Run statistics and environment/privacy tests; inspect UI; commit.

### Task 6: Owner-only official catalog additions and schema provenance
**Files:** house-catalog-service.js, workspace-schema.js, database/schema/sqlite-schema/seed-houses/database-migration, web routes/render, housing-menu/ui; test/owner-house-catalog.test.js and workspace-schema.test.js.
**Interfaces:** HouseCatalogService.preview(actor,input) and add(actor,input) enforce BOT_OWNER_IDS directly, return canonical validated definition; bundled seed respects owner-managed provenance. New schema version allocated after checking current remote/base.
- [ ] Test nonowner Global/Server/Discord admins denied on direct add, positive real-ID validation, missing metadata null, ID duplicates/concurrent insert, name warnings, audit, immediate search and restart/seed collision preservation, backend transfer.
- [ ] Run catalog/schema tests, confirm red.
- [ ] Add provenance migration both backends; owner form preview/confirmation web and Discord; shared transactional insert, audit and cache invalidation. Keep add-only scope, no overwrite/delete or server-side URL fetching.
- [ ] Run catalog/schema/seed/transfer tests with disposable DBs; commit.

### Task 7: Global recent activity and usage telemetry
**Files:** usage-activity-service.js, workspace-schema/database schemas, workspace routes/render; index and semantic Discord/web success handlers; test/usage-activity.test.js and usage-integration.test.js.
**Interfaces:** recordUsage({eventKey,kind,actor,originGuildId,esoServer,source,target?}) idempotent; listActivity(viewer,{server,kind,cursor,limit}) returns safe items and stable next cursor; usageTotals(viewer,range); purgeExpired(now). Timestamps UTC server-generated, ordering occurred_at DESC,id DESC.
- [ ] Test equal timestamp cursor pagination, event-key retries, actual completed action only, telemetry failure not failing operation, generic personal events without target, server removed, target deleted/Private/archived, XSS names, no private metadata/search text; 90-day cutoff.
- [ ] Run node --test test/usage-activity.test.js test/usage-integration.test.js; confirm red.
- [ ] Implement minimal indexed events table/migration for both backends; sanitized allowlisted activity kinds and bounded snapshots, fresh target access before labels/links; global feed independent of stats selected-guild scope. Use post-commit idempotent recording with captured original operation key and logged telemetry failure; no retries that fabricate successful uncommitted mutations.
- [ ] Instrument meaningful Discord and web successes (registration/update, tour creation/start/progress when established, search/detail/random/featured/personal and ordinary page use), excluding polls, keystrokes, security audit, duplicates and failures. Add filters, usage totals, time labels, pagination and bounded scheduled cleanup.
- [ ] Run activity and runtime regression tests; inspect named/server feed and Private sanitization; commit.

### Task 8: Administration polish, upgrade documentation and PR
**Files:** web render/server modules, README.md, .env.example, package.json, CHANGELOG.md (if existing), docs/Linux upgrade guide, existing release/version constants.
**Interfaces:** no new service contract; integrates Tasks 1-7 and existing admin behavior.
- [ ] Test grouped admin navigation/Back links, role-restricted owner tool, CSRF and legacy routes; verify test script includes every new test.
- [ ] Confirm tests fail before missing integration, implement groups and empty/error/success states.
- [ ] Document Linux backup before automatic startup migration, preserve live connection env, do not enable MIGRATE data transfer, verification of schema version, 90-day retention and new-history-only semantics, owner-ID setup and portal config. Add release notes/version consistently.
- [ ] Run npm test and git diff --check, relevant MariaDB checks against a disposable database if available; explicitly report any unavailable live-backend verification. Visually inspect representative desktop/mobile pages with sample data, no production data. Conduct independent full-branch review and fix findings.
- [ ] Commit; check latest GitHub base/PR6 merge status and resolve integration before publishing. Create a PR with behavior, migrations, privacy and validation evidence; never merge or deploy without authorization.

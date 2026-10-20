# AddressBook v0.9.0 Engagement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Ship v0.9.0 with AddressBook-managed tour events, Going/Interested RSVPs, channel and opt-in DM reminders, moderator-curated Featured houses/tours, and restart-safe personal tour progress while preserving exact ESO-environment isolation and existing v0.8 behavior.

**Architecture:** Add schema version 7 and four focused services—`TourEventService`, `EventReminderService`, `FeaturedContentService`, and `TourProgressService`. Keep persistence and authorization in services, keep Discord composition in UI/menu modules, and run reminders/expiry from one injected lifecycle worker. Use a built-in `Intl` timezone utility and native `Date` values for both database drivers.

**Tech Stack:** Node.js ESM, Discord.js, node:test, SQLite, MariaDB, existing AddressBook service/UI conventions, `Intl.DateTimeFormat`/`Intl.supportedValuesOf`.

**Spec:** `docs/superpowers/specs/2026-09-20-engagement-events-progress-design.md`

## Global constraints

- IDs are authoritative; readable guild, channel, tour, house, and Discord-user names are stored beside IDs and refreshed by the existing identity sync path.
- Visibility is always presented as Global, Server, Private. Private records remain redacted unless the viewer already has access or the record is explicitly shared.
- Every house/tour/event/progress query includes the exact ESO environment pair.
- Both SQLite and MariaDB must create, migrate, reset, and transfer schema v7 safely. MariaDB receives JavaScript `Date` objects, never ISO timestamp strings in datetime parameters.
- Discord component and selector limits are enforced through existing menu-spec and component-limit tests; lists paginate instead of truncating silently.
- New services accept injected clock/database/gateway dependencies where timing or delivery is tested.

## Review focus

- Validate access-context and environment predicates on every event, Featured, RSVP, and progress read/write.
- Validate DST gap/ambiguity rejection and stable UTC round-tripping.
- Validate reminder claim uniqueness and the deliberate no-automatic-retry behavior after a claimed delivery.
- Validate stale interaction handling, private-event redaction, creator/moderator host rules, and leader-only tour controls.
- Validate SQLite/MariaDB parity, v6-to-v7 upgrade idempotence, transfer reset semantics, and no duplicate result-column aliases.

---

## Task 1: Add schema version 7 and guild timezone storage

**Files:** `src/db/schema.js`, `src/db/sqlite-schema.js`, `src/db/database.js`, `test/engagement-schema.test.js`, `test/environment-schema.test.js`.

- [ ] Add `SCHEMA_V7` and `SQLITE_SCHEMA_V7`, retaining v6 definitions and adding `guild_settings.timezone` plus `tour_events`, `tour_event_rsvps`, `tour_event_deliveries`, `featured_items`, `tour_progress`, and `tour_progress_stops` with the exact status/check, unique, foreign-key, environment, and index rules in the spec.
- [ ] Add a single v6-to-v7 upgrade path that is idempotent, preserves existing rows, creates the nullable timezone column, and records schema version 7.
- [ ] Keep column aliases unique in every new query; add migration assertions for foreign keys and indexes.
- [ ] Test fresh schema creation, upgrade from v6, rerun upgrade, expected constraints, and version reporting on both schema generators.

```bash
node --test test/engagement-schema.test.js test/environment-schema.test.js
```

## Task 2: Implement strict IANA timezone conversion

**Files:** new `src/utils/timezone.js`; new `test/timezone.test.js`.

- [ ] Export `listSupportedTimezones({query,page,limit})`, `normalizeTimezone(value)`, `parseLocalDateTime({date,time,timezone})`, and `formatEventTimestamps(utcDate,timezone)`.
- [ ] Parse `YYYY-MM-DD`, friendly 12-hour input, and 24-hour input; reject malformed dates/times, unsupported zones, DST gaps, and DST ambiguities using deterministic `Intl.DateTimeFormat` round-trips.
- [ ] Return a JavaScript `Date` plus normalized local input and zone; never silently select an offset for a zero/two-match local time.
- [ ] Cover UTC, representative North American and European zones, leap dates, invalid input, spring gaps, fall ambiguity, pagination, and stable formatting.

```bash
node --test test/timezone.test.js
```

## Task 3: Extend guarded SQLite/MariaDB transfer for engagement data

**Files:** `src/db/database-migration.js`, `src/db/migrate-sqlite-to-mariadb.js`, `src/db/database.js`, new `test/engagement-transfer.test.js`, `test/environment-transfer.test.js`.

- [ ] Include timezone, event, RSVP, delivery, Featured, and progress tables in deterministic dependency order for SQLite→MariaDB and MariaDB→SQLite.
- [ ] Preserve IDs, names, environments, UTC timestamps, nullable fields, and JSON/text fields; convert driver-specific datetime values at the adapter boundary.
- [ ] Keep the explicit `MIGRATE` reset semantics: destination engagement tables are erased only after the existing confirmation/guard succeeds, then recreated and copied transactionally.
- [ ] Verify rerunning a transfer does not duplicate rows and that a failed transfer rolls back destination changes.

```bash
node --test test/engagement-transfer.test.js test/environment-transfer.test.js
```

## Task 4: Build `TourEventService`

**Files:** new `src/services/tour-event-service.js`; new `test/tour-events.test.js`.

- [ ] Implement `create`, `get`, `listUpcoming`, `listHosted`, `update`, `cancel`, `setRsvp`, `removeRsvp`, `toggleReminder`, `start`, `complete`, and `setCardMessage` with explicit input/result objects.
- [ ] Require a configured guild timezone for creation; convert local input through `parseLocalDateTime`; persist UTC and schedule revision 1.
- [ ] Enforce host rules: tour creator for Private; Housing Tours or Housing Moderator for Server/Global; existing administrator bootstrap when no moderator roles are configured.
- [ ] Revalidate tour visibility, environment, current access, and channel on every mutation; redact private event details for viewers without access.
- [ ] Start through `TourSessionService`, bind the event environment, preserve the event host as leader, and prevent attendees from controlling leader-only actions.
- [ ] Use transaction boundaries for RSVP replacement/removal and schedule revision changes; store refreshed identity names.

```bash
node --test test/tour-events.test.js
```

## Task 5: Build reminder claiming and delivery

**Files:** new `src/services/event-reminder-service.js`; new `test/event-reminders.test.js`.

- [ ] Export `claimDue`, `deliverClaim`, `runOnce`, `listStaleClaims`, and `formatReminder` with injected clock, database, and Discord gateway.
- [ ] Claim channel reminders and opted-in DM reminders at 24h and 1h; enforce the unique event/revision/reminder/target key transactionally.
- [ ] Deliver channel cards to the event channel and concise DMs to each opted-in Going/Interested attendee; record bounded failure data.
- [ ] Never automatically retry a claimed row; expose stale claimed rows for health review and ensure a process crash cannot duplicate a reminder.
- [ ] Test due-window selection, schedule revision isolation, idempotent claim, successful/failed delivery, DM opt-in, no-DM behavior, stale claim reporting, and empty runs.

```bash
node --test test/event-reminders.test.js
```

## Task 6: Build `FeaturedContentService`

**Files:** new `src/services/featured-content-service.js`; new `test/featured-content.test.js`.

- [ ] Implement `list`, `set`, `remove`, `reorder`, and `expireDue` for at most five houses and five tours per guild.
- [ ] Allow only moderator-authorized actors; reject Private, non-player, wrong-environment, missing, or inaccessible targets.
- [ ] Make ordering transactional, enforce one target/position per guild and kind, and retain selector identity names.
- [ ] Filter Featured results through current access rather than trusting retained names or old visibility.

```bash
node --test test/featured-content.test.js
```

## Task 7: Build persistent `TourProgressService`

**Files:** new `src/services/tour-progress-service.js`, `src/services/tour-session-service.js`; new `test/tour-progress.test.js`.

- [ ] Implement `startOrResume`, `advance`, `back`, `restart`, `reconcile`, `complete`, `listInProgress`, and `listCompleted`.
- [ ] Use stable tour-stop IDs, exact environment checks, current access revalidation, and optional Share Pass binding; never grant access merely because progress exists.
- [ ] Preserve completion count and most recent completion while restart clears only current-run completed stops and pointer.
- [ ] Keep shared-event sessions separate from attendees’ personal progress unless the attendee explicitly starts/resumes progress.
- [ ] Test resume after restart, edited/deleted stops, access loss, pass expiry, completion history, stale custom IDs, and leader-controlled shared sessions.

```bash
node --test test/tour-progress.test.js test/tour-session-scope.test.js
```

## Task 8: Add event, Featured, and progress UI payloads

**Files:** new `src/ui/event-ui.js`, `src/ui/featured-ui.js`, `src/ui/progress-ui.js`; `src/ui/housing-ui.js`; `src/utils/menu-specs.js`; `src/utils/render.js`; new `test/engagement-ui.test.js`.

- [ ] Add compact event cards showing title, tour, host, guild timezone, Discord absolute/relative timestamps, environment, RSVP counts/status, and Start/RSVP/Reminder actions.
- [ ] Add paginated Upcoming, Hosted, My RSVPs, Featured Houses, Featured Tours, In Progress, and Completed views.
- [ ] Add creation/edit/review modals with date/time/timezone selection and clear DST validation errors; keep custom IDs within Discord limits.
- [ ] Add progress cards with Resume, Restart, Back, Next, and completion-history actions; preserve the existing Global, Server, Private ordering everywhere.
- [ ] Add component-limit and stale-view tests for every new payload.

```bash
node --test test/engagement-ui.test.js test/component-limits.test.js
```

## Task 9: Wire menus, permissions, and event-card interactions

**Files:** `src/ui/housing-menu.js`, `src/handlers.js`, `src/utils/menu-specs.js`; new `test/engagement-menu.test.js`; update `test/my-addressbook.test.js`, `test/environment-ui.test.js`, `test/global-ui.test.js`.

- [ ] Route Home/Tours/My Address Book/Administration buttons to the new list, create, RSVP, reminder, Featured, and progress payloads.
- [ ] Add Schedule Event, Upcoming Events, Hosted Events, My RSVPs, Manage Featured, and timezone settings actions with role checks and stale-interaction recovery.
- [ ] Restrict event controls to the host or authorized moderator; keep attendee buttons visible but harmless for leader-only tour controls.
- [ ] Render private event details only to viewers with access and provide a safe “not available” response after access changes.
- [ ] Ensure all list controls paginate and all confirmation modals use ephemeral responses where appropriate.

```bash
node --test test/engagement-menu.test.js test/my-addressbook.test.js test/environment-ui.test.js test/global-ui.test.js
```

## Task 10: Add administration for timezone, Featured, and reminder health

**Files:** `src/ui/housing-menu.js`, `src/ui/housing-ui.js`, `src/services/admin-health-service.js`; new `test/engagement-admin.test.js`; update `test/admin-health.test.js`.

- [ ] Add server timezone search/select/update for Housing Moderators, with administrator bootstrap when no moderator roles exist.
- [ ] Add Featured management with target search, position, expiry, reorder, removal, and the five-per-kind limit.
- [ ] Add reminder health rows for stale claims and failed deliveries without exposing private event content to unauthorized viewers.
- [ ] Refresh displayed guild/channel/user names through the existing identity service while keeping IDs authoritative.

```bash
node --test test/engagement-admin.test.js test/admin-health.test.js
```

## Task 11: Add lifecycle worker and identity/runtime integration

**Files:** new `src/services/engagement-worker.js`; `src/index.js`; `src/handlers.js`; `src/services/identity-service.js`; `src/services/admin-health-service.js`; new `test/engagement-runtime.test.js`.

- [ ] Create one start/stop-safe worker that runs reminder claiming/delivery and Featured expiry on an injected interval; prevent duplicate workers during reconnects.
- [ ] Start it only after database migration and Discord readiness; stop it before database close and on shutdown signals.
- [ ] Extend ready-time identity refresh to event hosts, RSVPs, Featured selectors, and progress names without overwriting IDs.
- [ ] Make worker failures observable in health output and non-fatal to the Discord process.

```bash
node --test test/engagement-runtime.test.js test/identity-service.test.js
```

## Task 12: Integrate environment changes and migration previews

**Files:** `src/services/guild-environment-service.js`, `src/db/environment-migration.js`, `src/ui/housing-menu.js`, `src/ui/housing-ui.js`; new `test/engagement-environment.test.js`; update `test/environment-transfer.test.js`.

- [ ] Include Private tours/houses, events, RSVPs, Featured rows, and progress rows in environment-change previews and copy/move operations according to the existing first-destination-claims rule.
- [ ] Keep legacy records with null environment visible through the existing compatibility path and provide an explicit admin migration action.
- [ ] Cancel or hide events whose referenced tour no longer exists in the destination environment; never cross-publish Global content across incompatible server types.
- [ ] Test preview counts, first-claim copying, rollback, null-environment compatibility, and old-tour access.

```bash
node --test test/engagement-environment.test.js test/environment-transfer.test.js
```

## Task 13: Version, onboarding, help, and documentation

**Files:** `package.json`, `package-lock.json`, `src/ui/housing-ui.js`, `src/ui/housing-menu.js`, `README.md`, `docs/USER_GUIDE.docx` (or the current guide source), new/updated version and onboarding tests.

- [ ] Set the release version to `0.9.0`; update the `/housing` introduction, Show Me Around flow, help text, and feature summaries for events, RSVPs, Featured, reminders, and progress.
- [ ] Document host/role rules, timezone setup, event reminder behavior, privacy redaction, Featured limits, resume/restart semantics, and MariaDB/SQLite migration behavior.
- [ ] Render and inspect the guide after editing; correct layout before packaging.
- [ ] Verify every user-facing version string reports 0.9.0 and no v0.8-only feature claim remains.

```bash
npm test -- --test-name-pattern='version|onboarding|help'
```

## Task 14: Full verification and release artifact

**Files:** no source changes unless verification exposes a defect; release output under `dist/`.

- [ ] Run the complete test suite, syntax checks, and a fresh SQLite migration smoke test.
- [ ] Run MariaDB schema/query tests and, when a configured MariaDB instance is available, a clean v6→v7 upgrade and transfer smoke test.
- [ ] Inspect generated SQL for duplicate aliases and inspect component counts/custom-ID lengths.
- [ ] Run the documented guide render/inspection workflow and confirm the ZIP contains source, migrations, tests, README, and the updated guide without `node_modules`, secrets, or database files.
- [ ] Package `AddressBook-v0.9.0.zip`, verify it can be extracted and started from a clean install, then report the exact artifact path.

```bash
npm test
node --check src/index.js
git diff --check
```

## Execution order

Implement tasks 1–3 first so every later service has a stable schema and transfer contract. Implement tasks 4–7 as isolated service/test slices. Implement tasks 8–10 for payloads and menu wiring. Implement tasks 11–12 for runtime and environment integration. Finish with tasks 13–14 and do not call the release complete until the full verification commands pass.

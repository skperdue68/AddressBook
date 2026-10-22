# AddressBook Events and Featured Houses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Retire scheduled-event interactions and refresh Featured Houses every seven days without losing historical data.

**Architecture:** Guard all retired event IDs before their old handlers and stop scheduling reminder work. Use the existing Featured service plus one persisted per-guild cycle row to coordinate rotation; keep Featured Tours and ordinary tour sessions independent.

**Tech Stack:** Node.js ES modules, discord.js 14, SQLite/MariaDB transactions, injectable time/randomness, `node:test`.

**Spec:** [Approved design](../specs/2026-10-21-ui-ux-refresh-design.md). Coordination: [master plan](2026-10-21-ui-ux-refresh.md).

## Global Constraints

- "Do not start the event reminder worker or send previously scheduled event reminders."
- "Do not delete users' historical event data during this change."
- "Refresh the guild's Featured House selection every seven days."
- "Choose up to five distinct eligible player-house destinations."
- "The weekly refresh applies to the displayed Featured House list, including manually selected houses."
- "Featured Tours do not rotate automatically."
- Only active Server houses in the guild and Global houses in its exact ESO environment are eligible; Private/Non-Player houses are never selected.

## Review Focus

Old event buttons must be harmless; a restart must retain the deadline; concurrent ticks must replace a cycle once; small/empty pools must remain usable; manual changes must not postpone rotation. B1/B2 test each condition.

## Task B1: Retire event menus, routes, and reminder execution

**Files:** Create `src/ui/retired-events.js`, `test/retired-events.test.js`. Modify `src/index.js`, `src/services/engagement-worker.js`, `src/utils/menu-specs.js`, `src/ui/housing-ui.js`, `src/ui/housing-menu.js`, `src/ui/engagement-ui.js`, `test/engagement-runtime.test.js`, `test/engagement-ui.test.js`, `test/tour-events.test.js`, `test/event-reminders.test.js`, `test/onboarding-and-empty-states.test.js`, `test/onboarding-learning.test.js`, `package.json`.

**Consumes:** Existing tour/Featured payload builders. **Produces:** `isRetiredEventInteraction(id) -> boolean` and `retiredEventPayload() -> Discord payload`; the worker runs Featured maintenance only.

- [x] **Write failing tests:** Home, Help, My AddressBook, tour menus, and tour management contain no live event/RSVP/reminder actions. Exercise historical `hu:tours:events`, `hu:events:*`, `hu:event:*`, `hu:tour:event:*`, `hu:modal:tour:event:*`, and `hu:modal:event:edit:*` IDs through the corresponding button/select/modal entry points. Assert the response says exactly `Scheduled events are no longer available`, offers Back to Housing Tours, and leaves event/RSVP/session data unchanged. A reminder stub passed to an old worker signature must never be invoked.
- [x] **Run red:** `node --test test/retired-events.test.js test/engagement-runtime.test.js`.
- [x] **Implement retirement.** Dispatch the guard immediately after normal interaction authorization and before any old event handler. Remove dead event UI routes/builders/imports once guarded; preserve service/schema code needed for historical reads/transfers. Stop constructing `EventReminderService` in startup and remove reminder execution from the worker. Update menu specs, explicit layouts, onboarding/Help topic labels and text, and current runtime descriptions together. Existing shared/self-paced sessions remain operable.
- [x] **Update relevant tests.** Replace retired interaction expectations with no-side-effect retirement assertions; keep any event storage/transfer compatibility tests and standalone tour-session tests. Dormant event service fixtures that use dates must not be mistaken for a still-supported member workflow.
- [x] **Run green:** `node --test test/retired-events.test.js test/engagement-runtime.test.js test/engagement-ui.test.js test/onboarding-and-empty-states.test.js test/onboarding-learning.test.js test/tour-session-scope.test.js test/tour-progress.test.js`. Expected: retired IDs are harmless, Featured work still runs, and ordinary sessions/progress remain supported.
- [x] **Commit:** `feat: retire scheduled events and event reminders`.

## Task B2: Persist and rotate Featured House cycles

**Files:** Modify `src/services/featured-content-service.js`, `src/services/engagement-worker.js`, `src/ui/engagement-ui.js`, `test/featured-content.test.js`, `test/engagement-runtime.test.js`. Create `test/featured-weekly.test.js`. Register the new test in `package.json`.

**Consumes:** A1's `featured_house_cycles(guild_id,eso_server,last_rotated_at,previous_destination_ids)` table. **Produces:** `FeaturedContentService(db,{clock=()=>Date.now(),random=Math.random}={})`, async `rotateHouses({guildId,esoServer}) -> {rotated,items,nextRotationAt}`, and `rotateDueHousesAll() -> per-guild results`. Keep `list`, `set`, `remove`, `reorder`, and expiry APIs working. `nextRotationAt` is a Date or null when no cycle can yet be initialized.

- [x] **Write failing clock-driven tests.** At `2026-10-21T12:00:00Z`, initialize an existing eligible list without replacement; its due boundary is `2026-10-28T12:00:00Z`. At boundary minus 1 ms no rotation occurs; at the boundary exactly one does. Recreate the service between calls to prove persistence. Simultaneous calls produce one successful rotation. Test pools of 0, 1, 4, 5, 6, and 10 distinct destinations, duplicate saved entries for one destination, and excluded Private/archived/foreign/Non-Player rows. With ten alternatives the previous five destinations are absent; with smaller pools fill all available slots without duplicates.
- [x] **Run red:** `node --test test/featured-weekly.test.js`.
- [x] **Implement the cycle algorithm.** Inside a transaction, create-or-lock the guild cycle row, detect an environment change, and load current eligible entries. Use persisted `previous_destination_ids` for the last cycle, independent of manual current-list edits. Prefer shuffled new destinations, then shuffled eligible repeats, truncate to five, validate targets, and replace only house rows. Initialize a nonempty upgrade list at the injected current time. Initialize an empty list immediately if candidates exist; do not consume the first deadline when no candidates exist. For an existing cycle, an early empty-list refill preserves its current weekly boundary and previous-cycle history. Update the persisted selection history on a due cycle only. Use the SQLite transaction semantics and MariaDB row locks already supported by the database adapter; make first-row creation race-safe. Serialize concurrent calls sharing one SQLite connection; use database locking for independent connections. Use the injected clock for list eligibility and expiry as well as rotation.
- [x] **Cover manual/expiry behavior.** Add, reorder, expire, and remove entries midweek, then assert the weekly deadline did not move. Advance past the deadline by several weeks and assert one current selection with a new seven-day deadline, not repeated catch-up cycles. An ESO environment change immediately discards the previous cycle's scope. A Featured Tour's ID/order/expiry remains unchanged throughout.
- [x] **Wire the worker.** `runOnce()` expires due entries and calls `rotateDueHousesAll()`, with an in-flight guard to prevent overlapping runs. Keep start/stop idempotent and the existing 60,000 ms polling default. Replace old empty-only scheduling; do not run both selection algorithms concurrently. Display the next house refresh time where the Featured screen explains automatic selection.
- [x] **Run green:** `node --test test/featured-weekly.test.js test/featured-content.test.js test/engagement-runtime.test.js test/data-export.test.js test/environment-transfer.test.js`. Expected: all new clock/eligibility/concurrency cases pass; touched expiry fixtures use controlled time rather than past calendar dates.
- [x] **Commit:** `feat: rotate Featured Houses on persistent seven-day cycles`.

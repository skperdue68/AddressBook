# AddressBook UI and UX Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement the six approved UI changes while preserving Private ownership and existing installations.

**Architecture:** Three linked plans separate moderator access, Featured/event behavior, and registration/tour selection. Execute them sequentially on `codex/ui-ux-refresh` because they share migrations and the main interaction controller; publish one tested PR. Business rules remain in services, and focused UI modules keep new screens out of the large generic UI module where practical.

**Tech Stack:** Node.js 22+, JavaScript ES modules, discord.js 14, SQLite, MariaDB, built-in `node:test`.

**Spec:** [Approved design](../specs/2026-10-21-ui-ux-refresh-design.md).

## Global Constraints

- "Do not edit the user's installation or commit directly to the default branch."
- "Neither a Server grant nor a Global grant provides access to another user's Private houses or tours."
- "Do not assign Discord roles, rely on Discord Administrator permission, or change the existing Global approval authority."
- "Refresh the guild's Featured House selection every seven days."
- "Choose up to five distinct eligible player-house destinations."
- "Featured Tours do not rotate automatically."
- "Do not delete users' historical event data during this change."
- "The confirmed preview is the authoritative insertion order."
- No new production dependencies. Members continue to use `/housing`.

## Review Focus

1. A denied request is submitted again while an old approval button remains: reject the old request revision (Plan A, Task A1).
2. An approved Server moderator loses the grant while a web session remains open: deny the next authorized request (A2).
3. A weekly rotation fires twice or the clock advances across a restart: perform one persisted rotation, not two (B2).
4. A pending registration becomes active while an old confirmation remains: reload the saved record rather than trusting the screen (C3).
5. A user changes pages or deselects and reselects a multi-selected house: the confirmed preview and appended route agree (C2).

## Execution order and interfaces

1. [Plan A: Moderator access](2026-10-21-ui-ux-moderator-access.md), Tasks A1–A2. Creates schema version 11, including the cycle table needed by Plan B, and wires refreshed grant authorization.
2. [Plan B: Events and Featured Houses](2026-10-21-ui-ux-featured-events.md), Tasks B1–B2. Retires event routes, then replaces empty-only house selection with persisted weekly rotation.
3. [Plan C: Registration and tour selection](2026-10-21-ui-ux-registration-tours.md), Tasks C1–C3. Fixes empty registration results, adds ordered selection review, then reuses it for registration-to-tour actions.
4. Complete the release and final verification below. No task may silently relax an earlier privacy boundary.

Each task owns a red/green test cycle, reviewable commit, and its related documentation. Register new test files in the explicit `package.json` test command as they are added.

## Shared migration contract

Task A1 creates the three additive schema-v11 tables in both backends. `server_moderator_requests` has one current request per `(guild_id,discord_user_id)` and an incrementing `revision`; review controls carry both request ID and revision. `server_moderators` stores active per-guild grants referencing the request. `featured_house_cycles` stores `guild_id`, `eso_server`, `last_rotated_at`, and JSON `previous_destination_ids` for the most recently selected cycle.

Table creation and transfers must preserve version-10 sources: absence of these three tables in an older source means empty new-table data, not a corrupt source. Never erase the source or remove retained event tables. Existing destructive-transfer confirmations remain mandatory.

## Final release and verification

**Files:** `package.json`, `package-lock.json`, `README.md`, `docs/member-guide.md`, `docs/administration.md`, new `INSTALL-v1.0.60.txt`, current release text in `src/services/onboarding-service.js`, `src/ui/housing-ui.js`, `src/services/web-admin-service.js`, and `src/services/data-export-service.js`.

- [x] Set the application release to `1.0.60` and schema version to `11`. Update current runtime version literals and release-specific Help text; preserve historical guides as historical documents. Explain additive migration, retired events, the seven-day/manual-feature behavior, Server grant review, Private ownership, and selection-order limitations.
- [x] Run the focused tests from all three plans, then `npm test` on a frozen source tree. Run `git diff --check` and check local documentation links. Verify every changed Discord payload has nonempty rows, at most five components per row, and 1–25 options whenever a String Select is present.
- [x] Run SQLite fresh-install and upgrade tests, two-way transfer tests, and MariaDB schema/query tests. Use a real MariaDB instance if available; otherwise explicitly report that integration limitation rather than claiming both backends were exercised live.
- [x] Record baseline failures before implementation. The prior baseline has two date-sensitive Featured tests and four date-sensitive event tests. Replace retired event UI expectations with retirement tests; keep retained-data/service compatibility checks. Replace obsolete fixed-date fixtures in touched tests with an injected clock and relative dates when needed; never remove unrelated failing tests merely to obtain green output.
- [x] Obtain a final independent review against the approved spec, inspect the complete diff, and resolve correctness/privacy findings. Preserve generated files and secrets outside tracking.
- [x] Commit verified work locally, publish only the PR branch, verify its file tree matches the tested tree, and create a PR targeting the then-current `master`. Do not merge or deploy it.

## Review and execution handoff

The user approved the spec and plans and chose Native execution. Tasks were implemented sequentially with one independent final review. All review findings were fixed with regression tests, and the final suite passed 533/533.

Implementation and independent review are complete. Schema 11 and application version 1.0.60 are ready for the requested pull request. Live MariaDB validation was unavailable; schema/query tests passed.

# Private Shared Tour Repair Implementation Plan

> Execute inline using test-driven development; preserve the user's approved one-time Private sharing behavior.

**Goal:** A creator can deliberately run a Private tour in Shared mode without weakening normal Private access.
**Architecture:** Schema 10 adds a nullable launch visibility snapshot to transient sessions. Runtime, return navigation, and advancement enforce it; visibility changes terminate existing Shared sessions transactionally.
**Tech Stack:** Node.js, Discord.js, SQLite, MariaDB.
**Spec:** User-approved Private tour sharing, leader-only navigation, and exact environment isolation in the current-state document.

## Constraints and review focus
- Existing sessions without explicit Private sharing authorization fail closed.
- Spectators can view the shared route and return; only the leader advances or ends it.
- Private sharing cannot bypass guild or environment checks.
- Fresh and upgraded SQLite/MariaDB databases receive the same nullable column.
- Saving ordinary metadata must not terminate a session.

## Tasks
- [x] Add failing runtime tests for intentionally shared Private tours, return navigation, nonowner creation, and stale direct advancement.
- [x] Add launch snapshot migration, central access predicate, service enforcement, and guarded return handling; run targeted tests.
- [x] Test migration idempotence and visibility-change termination, run full suite, review diff.
- [x] Update current-state docs and guide to 1.0.57, inspect rendered guide, package and independently test clean ZIP.

## Execution record
Source is an isolated release copy rather than a git repository. Existing design approval authorizes this corrective work without another approval pause.

Verification: initial eight regression tests failed before the repair and passed after it. Visibility-change invalidation, Private-stop comments, and Resume/Restart bypass each reproduced before correction. Full suite: 445 passed. JavaScript syntax checks passed. Guide: 17 pages rendered and inspected. MariaDB coverage uses migration/query tests, not a live MariaDB server.

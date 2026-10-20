# SDD ledger — plan: docs/superpowers/plans/2026-09-20-engagement-events-progress.md

Pre-flight: Tasks 1–3 share schema-version and transfer contracts; Tasks 4–7 consume the v7 table names and exact environment fields; Tasks 8–12 consume the service method/result boundaries. No conflicts found against the approved spec.

Task 1: complete (commit fb36877, tests: node --test test/engagement-schema.test.js test/environment-schema.test.js → 5/5 pass)
Task 2: complete (commit fb36877, tests: node --test test/timezone.test.js → 4/4 pass)
Task 3: complete (commit af35d6b, tests: node --test test/environment-transfer.test.js test/engagement-schema.test.js test/timezone.test.js plus npm test → 183/183 pass)
Task 4: complete (commit b7bcb10, tests: node --test test/tour-events.test.js plus npm test → 183/183 pass)
Task 5: complete (commit 0863664, tests: node --test test/event-reminders.test.js plus npm test → 183/183 pass)
Task 6: complete (commit 943cccd, tests: node --test test/featured-content.test.js plus npm test → 183/183 pass)
Task 7: partial (commits e7fee8e, 4edb368, 1299ddf, 3c87ed4, 0834a2b implement progress service, route Self Paced starts through persistent tracking, show current stop house context, open the current house card, display completed stop history, and reopen completed houses from history; detailed stop actions remain)
Task 8: complete (commit 5dd8f42, tests: node --test test/engagement-ui.test.js plus npm test → 202/202 pass)
Task 9: in progress (commits 49bfe5a, d4cb800, 6c0fb40, b86f608, e0250eb, 6e7eb57, 92dc261, a82f297, 57b017a, 67b5c0e, 9b8ad9e, f7facfc, cfe53dd, 7d5b208, 133142e add Upcoming Events pagination, cross-guild Global event discovery, RSVP, reminder preferences, origin-guild-bound controls, start/cancel/complete routes, event scheduling, event editing, correct started_at lifecycle filtering, visible event state, interactive post-start cards, read-only completed cards, session cleanup on cancellation, and started-only completion validation; broader management routes remain)
Task 10: partial (commits ab9682d, a5b78ce, 534a6f6, c75d46f, 3c87ed4 expose Featured Housing in the Tours menu, allow Housing Moderators to add/remove/reorder eligible entries, set expiration or never-expire, display expiry state, and enforce environment/visibility checks; current work adds a selector so all five entries remain addressable)
Task 12: partial (commits 9100c74, 49694a6, aab1e63, f742b0b reconcile event/progress environments, revalidate progress access/share passes, filter stale progress lists, expose completion history, provide completed-house reopening, and paginate history beyond 25 stops; detailed stop actions remain)
Task 11: complete (commit 5dd8f42, tests: node --test test/engagement-runtime.test.js plus npm test → 202/202 pass)
Task 13: in progress (release version and README heading now report 0.9.0; full guide refresh remains)
Final review: fresh reviewer identified release blockers. Fixed missing event service wiring, MariaDB RSVP syntax, duplicate event edit alias, real shared-session creation on event start, Featured target filtering/eligibility, and reminder-window overdelivery (commits 9d9fa07, c4d17c5, d88e269; suite 204/204).
Task 13: partial (commits 414d91f, 293d031, and 2d1eb5e add guild timezone administration, README documentation, and in-bot Help/Show Me Around coverage for v0.9 engagement features; full admin/user guide refresh remains)
Final: deferred remaining plan work — full admin/user guide refresh, deeper stop-level history/actions, and broader engagement interaction coverage remain before calling v0.9 complete.
Completion pass: progress reconciliation and terminal-run cleanup added (2354564); reminder-health aggregate counts added to Administration Health; v0.9 guide and current-state documentation refreshed; full suite now 229/229 passing; syntax and fresh SQLite smoke checks pass; clean extraction/startup verification passed; release archive created at dist/AddressBook-v0.9.0.zip.

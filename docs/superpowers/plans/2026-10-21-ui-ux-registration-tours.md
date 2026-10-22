# AddressBook Registration and Tour Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make unknown-house recovery useful, preserve reviewable multi-select order, and offer tour addition immediately after registration.

**Architecture:** Fix zero matches before building registration drafts/pickers. Add pure ordered-selection helpers and a paginated order preview shared by bulk search actions and single-house registration shortcuts. Keep record eligibility and writes in the existing access/tour services.

**Tech Stack:** Node.js ES modules, discord.js 14 message components/modals, SQLite/MariaDB transactions, `node:test`.

**Spec:** [Approved design](../specs/2026-10-21-ui-ux-refresh-design.md). Coordination: [master plan](2026-10-21-ui-ux-refresh.md).

## Global Constraints

- "When a name or ID does not exist in the official catalog, show \"No matching ESO house found\"."
- "Do not create a saved house, leave an unusable draft, or build an empty dropdown."
- "Keep multiple selection and pagination."
- "The confirmed preview is the authoritative insertion order."
- "Saving the house and adding it to a tour are separate steps."
- "Private houses may be added only to an eligible tour owned by that house's owner."
- Preserve 1–25 options in every rendered String Select; never grant access through stale client-side selection state.

## Review Focus

Unknown names with a missing owner must still yield house-not-found feedback; empty data after a stale screen must not create invalid components; invalid page indexes cannot inject houses; pending-to-active status is reloaded; failed tour writes cannot lose the saved registration. Tasks C1–C3 test these cases.

## Task C1: Recover from unknown or empty house matches

**Files:** Modify `src/utils/destination-input.js`, `src/ui/housing-menu.js`, `src/ui/housing-ui.js`, `src/services/registration-draft-service.js`, `test/destination-input.test.js`, `test/registration-review.test.js`, `test/component-limits.test.js`. Create `test/registration-empty.test.js`; register it in `package.json`.

**Interfaces:** `resolveDestinationInput({input,owner},houseService)` retains its success/ambiguity contract but throws a friendly house-not-found error for zero matches. Add `registrationNotFoundPayload({retryId,backId})`, and extend `destinationInputModal(visibility,{destination='',owner=''}={})` to prefill retried input. Store retry data in an owner/guild/environment-bound, expiring registration draft; custom IDs carry only its token, not user text.

- [x] **Write failing handler tests.** Submit an unknown name and an unknown numeric ID, with/without an owner. Assert the response contains `No matching ESO house found`, Try Again and Back controls, zero saved records, and no String Select. Try Again reopens a modal preserving destination/owner; a different user or environment cannot reuse it. Assert a single/exact match continues review, multiple matches paginate, and an empty generic picker renders Back without an empty select. Also exercise the legacy registration form.
- [x] **Run red:** `node --test test/registration-empty.test.js test/destination-input.test.js test/registration-review.test.js`.
- [x] **Implement the guards and recovery.** Check zero matches before normal draft/ambiguity handling. Use the same friendly headline for ID/name misses, with advice to try an official name, part of it, or a valid ID. Clear expired/replaced retry drafts. In `pickerPayload`, render an empty-state embed/navigation when `options.length===0`; retain the existing 25-option page limit for actual menus. Do not mask unrelated database/permission failures as an unknown house.
- [x] **Run green:** the red command plus `node --test test/component-limits.test.js test/discord-component-limits.test.js test/registration-review.test.js`. Expected: all zero-match responses serialize to valid Discord component payloads, and ambiguity/normal registration remain intact.
- [x] **Commit:** `fix: handle unmatched house registration without empty dropdowns`.

## Task C2: Preserve ordered multi-selection and confirm route order

**Files:** Create `src/utils/ordered-selection.js`, `src/ui/tour-selection-ui.js`, `test/ordered-selection.test.js`, `test/tour-selection-order.test.js`. Modify `src/ui/housing-menu.js`, `src/ui/housing-ui.js`, `src/services/tour-service.js`, `test/tour-add-house.test.js`, `package.json`.

**Interfaces:** `updateOrderedSelection(selected:Set<number>,submitted:string[],start:number,end:number) -> Set<number>` returns a fresh insertion-ordered Set; `moveSelection(selected:Set<number>,from:number,to:number) -> Set<number>` uses zero-based positions and rejects out-of-range positions. `selectionRows(rows,selected,mode) -> Row[]` uses Set insertion order unless mode is `all`. `tourSelectionReviewPayload({token,rows,page,selectedPosition,backId})` renders numbered pages, Adjust Order/up/down controls, and Confirm Order. Add async `TourService.createWithStops({creatorId,guildId,esoServer,visibility,name,description,savedHouseIds}) -> {tour,added}` using its existing connection-scoped create/stop methods in one transaction.

- [x] **Write failing pure tests.** From selected `[3,1]`, submit `['1','4']` on page `[0,25)` and assert `[1,4]`; retain an off-page `26` in its original relative position. Re-submit unchanged values in a different received order without moving retained selections. Deselect/reselect appends to the end. Reject noninteger, negative, and out-of-page indexes without modifying the old Set; ignore duplicate submitted values. Assert a move from 2 to 0 changes `[3,1,4]` into `[4,3,1]`.
- [x] **Write failing end-to-end tests.** Select received values `['2','0']`, select `['26']` on page two, return to page one without resetting ranks, and assert preview/inserted order `[2,0,26]`. Adjust to `[26,2,0]` and assert exactly that order for both existing and new tours. Add All previews search-result order. A revoked editor, changed visibility/environment, invalid house status, or one failing required stop insertion leaves the route unchanged; a new-tour failure leaves no orphan tour.
- [x] **Run red:** `node --test test/ordered-selection.test.js test/tour-selection-order.test.js`.
- [x] **Implement selection state and UI.** Remove only deselected indexes on the submitted page, retain all existing ranks, and append genuinely new indexes in received order. Replace `bulkSelectedRows`'s result-array filter with `selectionRows`. Route Done/Add All through a paginated numbered preview, then Confirm Order into existing-tour selection or new-tour naming/visibility. Up/down controls operate on the pending Set, never the database. Display a brief note that the preview, rather than an undocumented Discord click-history guarantee, determines the route.
- [x] **Implement atomic creation and existing append checks.** Reuse `createInConnection`/`addStopInConnection`; reload active houses and tour authorization before committing. Existing-tour addition uses the confirmed order and its transaction-based stop appending; preserve duplicate-destination skipping/explanation in sequence. Bind pending state to user, guild, environment, and the existing session expiry; stale callbacks cannot reuse another context.
- [x] **Run green:** `node --test test/ordered-selection.test.js test/tour-selection-order.test.js test/tour-add-house.test.js test/environment-tours.test.js test/tour-admin-permissions.test.js test/discord-component-limits.test.js`. Expected: preview order equals persisted stop order and failed required writes roll back.
- [x] **Commit:** `feat: review and preserve multi-selected tour stop order`.

## Task C3: Add registered houses to an existing or new tour

**Files:** Create `src/ui/registration-tour-ui.js`, `test/registration-tour.test.js`. Modify `src/ui/housing-menu.js`, `src/ui/housing-ui.js`, `test/registration-review.test.js`, `test/tour-add-house.test.js`, `package.json`.

**Consumes:** C2's single transaction creation and confirmed selection path, existing `AccessContextService`, `TourService.addStops`, and current tour edit policy. **Produces:** `registrationTourActions({savedHouseId,status,backId}) -> ButtonSpec[]`; controller helper `startRegistrationTour(i,savedHouseId) -> Promise<Discord response>` reuses a one-row bulk state. Bulk states gain explicit `backId` and optional `searchStateId` so a registration shortcut does not require an unrelated search session.

- [x] **Write failing registration-flow tests.** Complete active Private, Server, and Global registrations and assert Add to a Tour appears. Pending submissions show an approval-needed explanation with no enabled tour shortcut. Reload an approved house from an old pending screen and allow eligible addition; an archived or newly inaccessible house is rejected. Select an eligible existing tour and assert the appended house is the final stop; Create New Tour gives it position 1. Assert alphabetical target pagination, duplicate-destination feedback, and creator-only Private eligibility.
- [x] **Write cancellation/failure tests.** Cancel at target selection, new-tour naming, and visibility selection: the registered house still exists exactly once and no unintended tour/stop exists. Revoke editing rights or change the tour/house environment before confirmation: no stop is written. An existing registered house later opened by its authorized owner offers the same shortcut.
- [x] **Run red:** `node --test test/registration-tour.test.js`.
- [x] **Implement focused actions and dispatch.** Use `hu:registration:tour:<savedHouseId>` for the entry action and the shared C2 state/preview path thereafter. On all successful legacy and new registration routes, append the actions only after loading the saved record's current status. Add the shortcut to active authorized house cards. Build eligible targets from current tour edit authority and actual house compatibility; do not offer Private tours owned by someone else or let admin access bypass house visibility. Use the existing create-tour visibility choices filtered for the house's eligibility.
- [x] **Implement useful responses.** Report successful append/creation with Open Tour and Back to House. Report duplicates without writing them. If no existing tour is eligible, keep Create New Tour and Back available. A registration remains saved even when later tour operations fail. Pending success screens explain that tour addition becomes available after approval.
- [x] **Run green:** `node --test test/registration-tour.test.js test/registration-review.test.js test/tour-selection-order.test.js test/tour-add-house.test.js test/tour-admin-permissions.test.js test/house-card-context.test.js`. Expected: every saved-house status and ownership combination has a valid, usable outcome.
- [x] **Commit:** `feat: offer tour addition after house registration`.

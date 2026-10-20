# Discord Learning Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Show Me Around replayable, version-aware, and discoverable through Help & Learning without resetting existing onboarding completion.

**Architecture:** Extend the existing `user_onboarding` record with a current walkthrough version and acknowledged feature keys. Keep the existing seven-page ephemeral Discord flow, adding a Help & Learning landing screen and topic-specific shortcuts. No web dependency is required for this plan.

**Tech Stack:** Node.js 22, discord.js builders, SQLite/MariaDB schema migration, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-21-companion-admin-learning-design.md`

## Global Constraints

- AddressBook remains Discord-first for normal member workflows.
- Existing `completed` and `skipped` onboarding status must remain valid and must not be reset by replay.
- Every Discord message must remain within five top-level action rows and five components per row.
- Global/Server/Private and ESO-environment boundaries must remain unchanged.
- No new runtime dependency is required.

## Review Focus

- A user who already completed onboarding can replay it without changing status.
- A skipped user can open Help & Learning and acknowledge What’s New without being forced through the full tour.
- A future release version is not reported as already seen because an older version was acknowledged.
- Topic shortcut actions complete first-use onboarding only when they actually open a feature.
- Help and learning payloads stay within Discord component limits.

### Task 1: Versioned onboarding persistence

**Files:**
- Modify: `src/db/sqlite-schema.js`
- Modify: `src/db/schema.js`
- Modify: `src/db/database-migration.js`
- Modify: `src/services/onboarding-service.js`
- Test: `test/onboarding-learning.test.js`

**Interfaces:**
- Produces `OnboardingService.getLearningState(userId)` returning `{ walkthroughVersion, acknowledgedFeatures }`.
- Produces `OnboardingService.acknowledgeFeature(userId, featureKey, names)`.
- Produces `OnboardingService.markWalkthroughSeen(userId, version, names)` without changing `status`.

- [ ] **Step 1: Write the failing tests** for default learning state, idempotent feature acknowledgement, version advancement, and status preservation.
- [ ] **Step 2: Run `node --test test/onboarding-learning.test.js` and verify the new tests fail because the columns and methods do not exist.**
- [ ] **Step 3: Add nullable `last_seen_tour_version` and `acknowledged_features` columns to both schemas and an idempotent migration that adds them to existing databases.
- [ ] **Step 4: Implement JSON-safe read/write helpers in `OnboardingService` with empty-array fallback for corrupt or missing feature state.
- [ ] **Step 5: Run the focused test and verify it passes.
- [ ] **Step 6: Run the existing onboarding and schema tests to verify no migration regressions.
- [ ] **Step 7: Commit with `git commit -am "feat: version Discord onboarding state"`.

### Task 2: Help & Learning UI

**Files:**
- Modify: `src/ui/housing-ui.js`
- Modify: `src/ui/housing-menu.js`
- Modify: `src/utils/menu-specs.js` if shared labels need a new Help & Learning entry.
- Test: `test/onboarding-learning.test.js`

**Interfaces:**
- Produces `helpLearningPayload({ latestVersion, seenVersion, acknowledgedFeatures })`.
- Produces `whatsNewPayload({ latestVersion, acknowledgedFeatures })`.
- Produces `learningTopicPayload(topic)` for `search`, `houses`, `tours`, `sharing`, and `administration`.

- [ ] **Step 1: Add failing UI tests for the landing buttons, What’s New acknowledgement, topic navigation, replay, and row limits.
- [ ] **Step 2: Run the focused UI tests and verify they fail because the new payloads/custom IDs are absent.
- [ ] **Step 3: Implement the three payload builders with Back, Close, and feature action controls, keeping copy consistent with current visibility/environment terminology.
- [ ] **Step 4: Route `hu:help:learning`, `hu:help:whatsnew`, `hu:help:whatsnew:ack`, and `hu:help:topic:<topic>` in `housing-menu.js`.
- [ ] **Step 5: Change Help’s current “Show Introduction Again” button to open Help & Learning while preserving a direct replay button there.
- [ ] **Step 6: Run the focused UI tests and verify they pass.
- [ ] **Step 7: Commit with `git commit -am "feat: add replayable Help and Learning center"`.

### Task 3: Contextual learning entry points and documentation

**Files:**
- Modify: `src/ui/housing-ui.js`
- Modify: `README.md`
- Modify: `docs/AddressBook-v1.0.0-Current-State.md`
- Test: `test/onboarding-learning.test.js`

- [ ] **Step 1: Add failing assertions that Help, My AddressBook, Housing Tours, and Administration expose a compact Help/Learning action.
- [ ] **Step 2: Implement the buttons with stable `hu:help:learning` routing and no additional action-row overflow.
- [ ] **Step 3: Document replay and What’s New behavior in the user guide and README.
- [ ] **Step 4: Run the complete test command and inspect the generated UI payloads.
- [ ] **Step 5: Commit with `git commit -am "docs: explain replayable AddressBook learning"`.

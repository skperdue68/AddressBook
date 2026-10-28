# HearthBound House and Tour Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make finding houses and adding them to tours easier on web and Discord.
**Architecture:** Extend existing SSR links with bounded validated internal return context. Keep Discord action IDs and policy services, reorganizing discoverable controls.
**Tech Stack:** Node.js, Discord.js, plain HTML/CSS/browser JS, node:test, Chrome.
**Spec:** docs/superpowers/specs/2026-10-27-house-tour-flow-design.md

## Global Constraints
No new dependencies, schema migrations or production DB changes. Private boundaries and guild/environment POST checks remain. /hearth and /housing stay equivalent.

## Review Focus
- External/encoded return links never redirect or produce unsafe hrefs.
- Non-owner shared house tour addition checks target tour rights, not source edit rights.
- Pending or no eligible tours communicate restrictions without leaking hidden tours.
- Existing filters/page survive personal-action/edit round trips.
- Extra Discord actions fit five rows and preserve long IDs/navigation state.

### Task 1: Web discovery and return navigation
**Files:** Create src/web/flow-navigation.js; modify workspace-routes.js, web-actions-routes.js, house-details.js, workspace.css, web-actions.js; create test/web-house-tour-flow.test.js.
**Interfaces:** safeHouseReturn(value) returns allowed relative search/personal URL or null; houseFlowHref(id,returnTo,anchor='') builds escaped-at-render links. houseCards(rows,{returnTo}) and houseTourSection(h,tours,csrf,{returnTo}) accept optional context.
- [x] Add HTTP tests covering filtered result -> Add to tour -> detail/back, personal action and edit context, safe invalid URLs, management access, eligible tour submission.
- [x] Run node --test test/web-house-tour-flow.test.js and confirm failures for missing behavior.
- [x] Implement validated return context and grouped actions, keep search context through forms; add responsive CSS.
- [x] Run new tests plus existing web workflow/scope/tour tests and inspect Chrome desktop/mobile rendering.
- [x] Commit web flow improvement.

### Task 2: Discord house/tour flow
**Files:** Modify src/ui/housing-ui.js, src/utils/menu-specs.js and src/services/visit-service.js; add test/discord-house-tour-flow.test.js.
**Interfaces:** Preserve destinationMenuPayload and tourDetailPayload signatures and existing custom IDs; move active house tour shortcut outside edit-only controls; add direct tour Add House action.
- [x] Test non-owner active shortcut, hidden edit controls, pending exclusion, row limits, direct tour add, and actual handler adding a shared house to own tour.
- [x] Run node --test test/discord-house-tour-flow.test.js and confirm missing-behavior failures.
- [x] Implement action order and explicit tour/back labels without modifying backend rights.
- [x] Run new tests with registration-tour and component-limit regressions.
- [x] Update docs/version/test list, run npm test, review complete branch and publish separate PR.


## Execution evidence
- Baseline: merged #24 at 41304f5, npm test 641 passed.
- Shared interface: VisitService search rows supply active status to both web collections and Discord single-result house cards; preserve that status in the source SELECT rather than infer it in each UI.
- Web HTTP tests failed first for missing shortcuts/return context, then 15 related tests passed.
- Discord flow tests failed first for hidden shortcut/direct add/labels; single-result status test separately failed undefined→active, then 37 related tests and 14 combined tests passed.
- Chrome CDP: real portal at 1440px desktop and 390px mobile; return/tour shortcuts, collapsed management, visit expansion, draft selection and page bounds verified. Mobile results use cards instead of requiring table scrolling.

- Independent review found a pending-registration Edit discovery regression. New HTTP regression failed first, then shared active/pending management markup restored Edit without adding tour actions to pending houses.
- Existing navigation tests now use named destinations while preserving exact custom-ID and return-screen assertions. Introductory tour links say Back to Introduction; normal tour links say Main Menu.

- Final verification: npm test 650/650 passed, zero skipped; git diff --check clean. Independent review had no additional important/critical findings after the pending Edit issue was reproduced and fixed. No minor findings deferred.

# HearthBound web feature parity implementation plan

User authorization: continue the deferred web changes and make Discord workflows available through the web, in their own PR. Preserve all existing ownership, Private, server and ESO-environment boundaries. Web tours are self-paced and do not create or control live Discord sessions. Retired scheduled events stay retired.

Additional user requirement: navigation and every visible action must be capability-driven. Hide Administration and restricted tools unless the same user would have those capabilities in Discord. Visibility is not authorization: direct URLs and POSTs must independently recheck the same live permissions. Include ordinary-member and scoped-administrator HTML assertions in regression coverage.

Approach: extend the existing server-rendered portal with focused actions/service and route modules. Reuse the existing collection, search, comment, report, sharing, progress and environment services. Keep destructive actions behind an impact preview and explicit confirmation, stale-form checks, CSRF and fresh authorization. No new database schema is expected.

## Work checklist

- [x] House and tour deletion with scoped permissions, impact counts and stale-safe confirmation; full supported house editing and visibility changes.
- [x] Dedicated self-paced tour player with current stop, house links/details, notes, previous/next, completion, restart and progress history; stale advance protection; no Discord session coupling.
- [x] Favorites, Want to Visit, Visited, recently viewed, saved searches with run/rename/delete, advanced search and ordered result-to-tour selection.
- [x] House comments and problem reporting, including from the player; tour stop titles/notes.
- [x] Share Pass creation/revocation, channel and optional-thread posting from the web, opening/copying shared houses/tours without expanding normal Private access.
- [x] Web moderator requests, remaining server settings, featured expiration, environment/recovery previews and confirmations; preserve bot-owner-only catalog/global grant tools.
- [x] Improve discovery/navigation so actions are reachable; document parity and any platform-specific exceptions accurately.
- [x] Verify permission matrices, stale/forged forms, direct endpoints, backend compatibility and browser flows; independent final review; publish a separate PR.

Implementation units: `web-actions-service.js` owns authorization wrappers and safe operations; `web-actions-routes.js` owns additional page/form workflows; a Discord adapter owns channel/member checks and posting. Existing workspace routes remain the main entry point and perform CSRF/context validation before dispatch. Existing policy services remain authoritative.

Validation: meaningful tests for creator/member/Server/Global/Owner combinations, other-user Private denial, wrong server/environment denial, deletion side effects, repeated/stale player submissions, comments/state/search ownership, pass revocation and channel validation, settings/recovery preview integrity. Use temporary databases only. Production deployment remains Git pull plus service restart; document any discovered migration requirement before publishing.

## Verification record

Independent review identified and resolved role-restricted visibility choices, incompatible server/creator stop retention during visibility changes, pass pagination after environment filtering, and the revoked-registration-role visibility default. Regression coverage verifies these cases. Browser checks cover actual comment submission, starting the independent player, member-only navigation, desktop/mobile bounds and keyboard account navigation. The updated nine-page Word guide was rendered and every page inspected. Final npm test results are recorded in the PR. Existing schema 12 is reused; production data and deployment were not touched.

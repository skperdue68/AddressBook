# AddressBook UI and UX refresh

Date: 2026-10-21

Status: Approved, implemented, and independently reviewed. Verified with 533 passing tests on 2026-10-22.

Source baseline: `skperdue68/AddressBook`, master commit `f18de212f709a6470c6926cc3418dc5087e76418`. This includes the owner-only Private content correction.

## Purpose and approved scope

Make common housing and tour actions easier to find and complete. Remove unused scheduled events, rotate Featured Houses weekly, move infrequent moderator access requests under Help, support adding a newly registered house to a tour, handle unknown houses gracefully, and preserve a reviewable order when selecting multiple search results.

Deliver the changes through an isolated branch and pull request. Do not edit the user's installation or commit directly to the default branch. Preserve all existing ESO environment, guild, house visibility, and Private ownership boundaries.

## Member navigation

The home menu offers Search Houses, Register New House, Housing Tours, My AddressBook, and Help. Administration remains visible only under the application's existing administration rules. Remove Global Moderator Access from the home menu.

Help gains a Moderator Access entry with two clearly labeled destinations:

- Request Server Moderator Access: access for the current Discord server only.
- Request Global Moderator Access: access for the current ESO environment through the existing Global approval workflow.

Each access page shows current status, any pending request, scope, and a Back to Help action. People who already hold the relevant access see their status instead of a redundant request button. My AddressBook's pending-items view distinguishes Server and Global Moderator requests.

## Server Moderator requests and approvals

Use individual grants stored inside AddressBook. Do not assign Discord roles, rely on Discord Administrator permission, or change the existing Global approval authority.

1. A current member requests access under Help and supplies a reason.
2. The request is bound to their Discord user ID and the current guild. One pending request per user and guild is allowed.
3. Current AddressBook Server administrators review it in Administration under Server Moderator Requests. This Discord administration tool remains available when other migrated tools use the web console.
4. The reviewer approves or denies the request. Approval creates an AddressBook Server Moderator grant for that user and guild; denial grants no permissions.
5. Current Server administrators can list and revoke these individual grants. Revoking a request-based grant does not revoke a separate configured-role entitlement.

An existing configured Housing Moderator role or active approved Server grant establishes review authority for that guild. Global Moderator status alone does not establish Server request-review authority. Pending applicants cannot approve requests, and a reviewer cannot approve their own request. An empty moderator-role configuration's bootstrap administration access must not authorize approvals. If no actual reviewer is configured, explain that the server must configure AddressBook staff before the request can be approved.

Requests and grants are server-scoped, like the existing configured staff roles, rather than attached to one ESO environment. They therefore remain scoped to that guild if its configured ESO environment changes. Global grants remain environment-specific.

Refresh membership and AddressBook grant authorization before request review and privileged actions. Refresh grant state for normal Discord interactions and web authorization so approvals and revocations take effect without restarting the bot. Recheck permissions on stale buttons, pending forms, and confirmation screens. Users who leave a guild cannot retain access to its web administration through an old session.

Approved Server grants participate in the same Server moderation and administration decisions as configured Housing Moderator roles. Bootstrap administration applies only while neither staff roles nor active individual Server grants are configured. It never provides request-approval authority. Preserve existing role-based access for current staff.

Audit request, approval, denial, and revocation transitions with actor, guild, applicant, and timestamps. Do not include house or tour data in these request records. No unsolicited DMs or external notifications are needed for this release.

## Private content and scope boundaries

Neither a Server grant nor a Global grant provides access to another user's Private houses or tours. Private access remains owner-controlled, including the existing explicit Share Pass behavior. Administrative exports, audit displays, maintenance, and report redaction retain the privacy restrictions introduced in the preceding correction.

Server administrators manage Server content only in their own guild. Global administrators retain the approved Global/Server tour authority within their authorized ESO environment. New Server grants do not confer Global authority or the ability to approve Global requests.

## Remove scheduled events

Remove Upcoming Events, Schedule Event, event RSVP/reminder actions, event-creation modals, and scheduled-event guidance from member menus, tour management, Help, onboarding, and current documentation.

Do not start the event reminder worker or send previously scheduled event reminders. Old event interaction IDs return a brief "Scheduled events are no longer available" response with a route back to Housing Tours; they must not create events, RSVP, start event sessions, or send reminders.

Retain existing event database tables and historical records for upgrade compatibility and backend transfer. Do not delete users' historical event data during this change. Standalone tour sessions, Share Pass tours, Featured Housing, and persistent tour progress remain supported. Remove obsolete event UI expectations from active tests while retaining tests that protect preserved data compatibility where appropriate.

## Weekly Featured Houses

Refresh the guild's Featured House selection every seven days. This is a persisted seven-day interval, not a calendar-week or Monday schedule. Bot restarts must not reset the interval.

Choose up to five distinct eligible player-house destinations from active Server houses in the guild and compatible Global houses in its exact ESO environment. Exclude Private, archived, invalid, and Non-Player homes. Prefer destinations outside the previous selection; fill remaining slots from still-eligible previous destinations when the pool is too small. Never invent houses or leave avoidable empty slots solely to avoid repeats.

The weekly refresh applies to the displayed Featured House list, including manually selected houses. Manual additions, reordering, removals, and existing expiration controls remain available between refreshes, but do not postpone the weekly refresh. Featured Tours do not rotate automatically.

On upgrade, initialize the first cycle from the existing eligible selection without immediately replacing it; its first weekly refresh is due seven days after cycle initialization. If the list is empty, populate it immediately. If there are no candidates, show a useful empty state and retry when candidates become available rather than waiting a week.

Persist the cycle's guild, ESO environment, and last successful rotation time. An environment change invalidates that cycle and triggers selection in the new environment. Recheck eligibility in a transaction and guard overlapping worker ticks so a due cycle is replaced only once. An empty expired selection can be refilled before the next weekly boundary without moving the weekly boundary for an already initialized cycle.

## Registration followed by tour addition

After a successful registration of an active house, offer Add to a Tour on the success/card screen. It opens an alphabetical, paginated list of tours the member can edit and to which that house can legally be added, plus Create New Tour. Reuse existing tour creation and eligibility rules with the single newly registered house as the initial selection.

For existing tours, append the new stop after their current stops. For a new tour, the house becomes its first stop. Show a clear success message and links back to the house or tour. Reject duplicate destinations with a useful explanation rather than silently inserting duplicates.

A house awaiting registration approval is saved normally, but its confirmation explains that it can be added to tours once approved. Do not offer an active Add to a Tour shortcut for pending houses. Approved active house cards provide the shortcut later.

Saving the house and adding it to a tour are separate steps. Canceling tour selection or failing an eligibility check must not roll back or duplicate a successful house registration. Recheck house status, tour edit access, destination ownership, source guild, and exact ESO environment immediately before adding. Private houses may be added only to an eligible tour owned by that house's owner.

## Unknown or unmatched house input

The reproduced bug is in the new registration destination flow: a house-name search with zero matches reaches `registration-house-match` and builds a String Select containing zero options. The legacy house form already has a no-match guard.

When a name or ID does not exist in the official catalog, show "No matching ESO house found" with brief advice to try the official name, part of its name, or a valid house ID. Provide Try Again and Back controls and retain the entered owner and destination where possible. Do not create a saved house, leave an unusable draft, or build an empty dropdown.

Use the same behavior for every registration entry route. Preserve ambiguity resolution when several houses genuinely match. A shared picker guard must also avoid invalid empty select components in other empty states. Keep selections paginated to Discord's 25-option limit.

## Multi-select order and confirmation

Keep multiple selection and pagination. Replace the current conversion from selected indexes back into search-result order with an ordered selection state.

Retain the rank of already selected houses. Remove deselected houses without disturbing the others. Append newly selected houses in the order received in the interaction. Returning to a previous page must not move existing selections. Deselecting and selecting a house again appends it at the end.

Discord documents selected values, not a guaranteed history of click order within one completed multi-select submission. The bot therefore cannot promise to reconstruct that click sequence. Show a numbered, paginated route preview before adding the houses, with a lightweight Adjust Order action using the familiar up/down controls and a Confirm Order action. The confirmed preview is the authoritative insertion order.

Use that order both when appending results to an existing tour and when creating a new tour from results. Add All retains the current search-result order and also offers the preview. Revalidate all selected destinations immediately before writing; stale or inaccessible selections require a fresh review. Preserve duplicate-destination handling and do not create a partial route when a required insertion fails.

## Architecture and persistence

Keep domain policy in services and use focused menu/UI modules for the new access-request and registration-to-tour paths instead of expanding unrelated branches in the main menu controller.

Add an additive schema migration for both SQLite and MariaDB, expected to be version 11 on the inspected baseline:

- `server_moderator_requests`: one current request record per guild/user, current status and reason, applicant identity, request/review timestamps, and reviewer identity. A denied or revoked applicant may submit a new request by updating the current record; audit entries preserve transition history.
- `server_moderators`: active individual grants keyed by guild/user, approval identity/time, and request reference.
- `featured_house_cycles`: one persisted cycle per guild, recording the ESO environment and rotation time.

Use transactions and uniqueness constraints to reject duplicate pending submissions and repeated/stale reviews. Preserve existing role settings, Global grants, and Private ownership data. Extend guarded SQLite/MariaDB transfers to preserve the new request/grant/cycle records in dependency order. Never erase an existing database or require users to recreate content.

Normal authorization must combine current configured roles with current approved Server grants. Web authorization must receive a verified user identity and current guild membership, not a client-supplied user ID or grant flag. Existing Global request/grant services remain authoritative for Global scope.

Use an injectable clock for weekly-rotation tests and deterministic randomness where needed. No additional slash command is required; members continue to start with `/housing`.

## Verification and acceptance

- Menus, Help, onboarding, and current docs contain no active scheduled-event workflow. Old event buttons are harmless, and no event reminders run.
- Help contains clearly scoped Server and Global request entries. Server requests are approved/denied/revoked by actual current AddressBook Server administrators only; test duplicate requests, self-approval, role removal, grant revocation, no-approver setup, and cross-guild isolation.
- Approved grants work in Discord and the web console after authorization refresh. Neither grants nor requests expose Private houses/tours or grant Global access.
- Featured Houses initialize, rotate exactly when due, survive restarts, respect the ESO environment, and handle small/empty candidate pools without duplicate destinations or overlapping rotations. Featured Tours remain unaffected.
- Successful active registration supports adding the house to an eligible existing/new tour; pending registration, cancellation, stale permissions, duplicates, and failed insertion behave clearly without losing the saved house.
- Unknown names/IDs return useful feedback and valid components; test zero, one, multiple, and more than 25 matches.
- Ordered multi-selection remains stable across submissions, deselection/reselection, and page navigation. Preview adjustments and actual inserted stop order agree, and stale records cannot bypass eligibility.
- Test SQLite migrations and query/transfer compatibility for MariaDB. Run the full project suite and report any pre-existing failures separately. Remove event-feature tests only when their tested feature is deliberately retired; do not hide unrelated failures.
- Review the final diff and test evidence before creating the implementation PR. Update the README/current guides and release-specific Help text for the final behavior.

## Delivery and review sequence

This document is the design artifact, not an implementation plan. After the user approves this written spec, prepare a task-level implementation plan with the relevant files, tests, migration/upgrade steps, and execution approach. Obtain the plan review/execution choice required by the development workflow, then implement and open a pull request. No product code has been changed for this refresh at the design stage.

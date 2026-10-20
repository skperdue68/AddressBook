# AddressBook v0.9.0 Engagement, Events, and Progress Design

## Purpose

AddressBook v0.9.0 is the engagement release on the path to 1.0. Version
0.8.0 made houses and tours easier to discover and remember. Version 0.9.0
must make that saved content useful for organized guild activity through
scheduled tour events, RSVPs, opt-in reminders, moderator-curated Featured
content, and restart-safe personal tour progress.

The release must preserve AddressBook's established rules:

- ESO environments remain exact isolation boundaries.
- Visibility is always presented as Global, Server, Private.
- Private content never becomes generally discoverable.
- Shared tours remain controlled by their initiating leader.
- IDs remain authoritative while readable Discord and AddressBook names are
  stored beside important IDs and refreshed later.
- SQLite and MariaDB remain first-class backends with guarded two-way transfer.
- Discord component, selector, modal, and custom-ID limits are enforced.

## Release Scope

Version 0.9.0 includes:

1. AddressBook-managed scheduled tour events posted as Discord channel cards.
2. Going and Interested RSVPs.
3. Separate opt-in DM reminders plus general channel reminders at 24 hours and
   1 hour before an event.
4. Up to five moderator-curated Featured Houses and five Featured Tours per
   Discord server.
5. Persistent per-user self-paced tour progress, completion count, and most
   recent completion time.
6. Navigation, administration, health, identity refresh, audit, migration,
   onboarding, and documentation updates required by those features.

The following operational-hardening work remains targeted at v1.0 rather than
being expanded into this release:

- a general-purpose audit-log viewer;
- automated backup/export orchestration;
- a broad database-integrity dashboard;
- moderator duplicate-merging tools; and
- general house/tour freshness campaigns.

Discord Scheduled Events are also out of scope. AddressBook event cards avoid
requiring the Discord Manage Events permission and keep the bot's event,
reminder, and tour-start state consistent.

## Architectural Approach

The engagement features form a dedicated subsystem instead of reusing
transient tour-session rows. Saved events, RSVPs, Featured choices, and
personal progress are durable domain records. Existing tour sessions remain
temporary channel presentations.

Four focused services provide the public application boundaries:

- `TourEventService` schedules, edits, lists, cancels, starts, completes, and
  authorizes events and manages RSVPs.
- `EventReminderService` claims due reminders, delivers them through an
  injected Discord gateway, and records every success or failure idempotently.
- `FeaturedContentService` curates, orders, expires, and access-filters
  Featured Houses and Tours.
- `TourProgressService` starts, resumes, advances, restarts, and completes
  personal self-paced progress.

The Discord menu composes these services but does not contain their persistence
rules. Time conversion lives in a separate timezone utility. The periodic
worker delegates all selection and delivery decisions to
`EventReminderService`.

## Schema Version 7

Both SQLite and MariaDB advance to schema version 7.

### Guild timezone

`guild_settings` receives a nullable `timezone` field containing a validated
IANA timezone such as `America/Chicago`. A timezone is required only before a
member can schedule an event; it does not block normal `/housing` use.

Housing Moderators configure the value in Administration. When no Housing
Moderator roles are configured, the existing Discord Administrator bootstrap
rule applies. Administration provides timezone search and paginated selection
from `Intl.supportedValuesOf('timeZone')`; arbitrary unvalidated strings are
never persisted.

### tour_events

`tour_events` stores:

- numeric ID;
- guild and readable guild name;
- channel and readable channel name;
- Discord event-card message ID;
- tour ID and retained readable tour name;
- exact ESO environment;
- host Discord ID, global name, and display name;
- event title and optional description;
- UTC start time;
- lifecycle status: `scheduled`, `cancelled`, or `completed`;
- schedule revision, initially 1;
- started, completed, and cancelled timestamps;
- creator/updater identity fields and normal created/updated timestamps.

The event retains readable names for audit and graceful error messages but
always authorizes against the current referenced tour and Discord IDs.

Changing the event's start time or timezone interpretation increments
`schedule_revision`. This permits a rescheduled event to send a new valid
reminder sequence without deleting the historical delivery record.

### tour_event_rsvps

`tour_event_rsvps` has one row per event and Discord user:

- RSVP status: `going` or `interested`;
- `dm_reminders` boolean, independent from RSVP status;
- readable Discord global/display names; and
- created/updated timestamps.

Removing an RSVP deletes the row and therefore removes its DM opt-in. Changing
Going to Interested or the reverse updates the same row. RSVP status never
grants permanent access to a Private tour.

### tour_event_deliveries

`tour_event_deliveries` records one attempted delivery using:

- event ID and schedule revision;
- reminder key: `24h` or `1h`;
- delivery target string, either `channel:<channel_id>` or
  `user:<discord_user_id>`;
- status: `claimed`, `sent`, or `failed`;
- bounded failure code/message suitable for administration;
- attempted and completed timestamps.

A unique key across event, revision, reminder key, and delivery target prevents
duplicate delivery. The worker first claims the row transactionally and never
automatically retries a claimed row. If the process crashes between claim and
Discord delivery, that reminder may be missed but will not be duplicated.
Administration Health reports old claimed rows so an operator can investigate
them explicitly.

### featured_items

`featured_items` stores:

- guild ID and readable guild name;
- target kind: `house` or `tour`;
- target ID and retained readable target name;
- ordered position 1 through 5 within its kind;
- optional UTC expiration;
- selecting moderator identity; and
- created/updated timestamps.

The database enforces one selection per guild/kind/target and one occupied
position per guild/kind. Reordering runs transactionally.

### tour_progress and tour_progress_stops

`tour_progress` has one row per Discord user and tour:

- exact ESO environment;
- retained readable tour and user names;
- current run status: `active` or `completed`;
- current stable tour-stop ID;
- optional Share Pass ID when pass-only access created the progress;
- current run start and last-activity timestamps;
- completion count;
- most recent completion timestamp; and
- normal created/updated timestamps.

`tour_progress_stops` stores the stable tour-stop IDs completed during the
current run, uniquely by progress row and stop ID.

Completing a run changes its status to `completed`, increments the count, and
records the completion time. Later tour edits do not silently reopen that
completed run. Restart changes the status to `active` and clears only the
current run's completed-stop rows and current pointer while retaining completion
count and most recent completion. This supplies useful history without an
unbounded per-run event log.

## Timezone and Date Handling

Hosts enter:

- a date in `YYYY-MM-DD`; and
- a time in either friendly 12-hour form such as `7:30 PM` or 24-hour form
  such as `19:30`.

The guild's configured IANA timezone converts the local value to UTC before
persistence. The timezone utility must round-trip the value through
`Intl.DateTimeFormat` and reject:

- malformed dates or times;
- nonexistent local times during a spring DST transition; and
- ambiguous local times during a fall DST transition.

The error explains that the selected local time occurs zero or twice and asks
the host to choose a nearby unambiguous time. AddressBook never silently picks
an offset.

The review card displays:

- the guild timezone used for interpretation;
- Discord absolute and relative timestamp forms, which render in each viewer's
  local timezone; and
- the exact event channel.

Changing the guild timezone affects only future input. Stored event timestamps
remain fixed UTC instants. MariaDB receives native JavaScript `Date` values
rather than ISO timestamp strings.

## Event Creation and Lifecycle

### Host authorization

- A Private tour may be scheduled only by its creator.
- A Server or Global tour may be scheduled by a member with the Housing Tours
  role or Housing Moderator access.
- A Global tour must belong to the guild's exact ESO environment.
- The tour must pass the existing readiness check before event confirmation and
  again before start.

### Creation flow

1. Open an accessible tour and choose **Schedule Event**.
2. Revalidate host permission and ensure the guild timezone is configured.
3. Enter event title, optional description, date, and time.
4. Resolve the time and display a review card.
5. Confirm to create the database row and post the event card in the current
   channel.
6. Store the posted Discord message ID. If posting fails, roll back event
   creation so there is no invisible scheduled event.

The creation and review interactions are ephemeral. The confirmed card is a
normal channel message.

### Public event card

The event card shows:

- event and tour names, except for the Private redaction rule below;
- host;
- Discord-localized absolute start and relative countdown;
- ESO environment and tour visibility;
- Going and Interested counts; and
- current event status.

Controls include:

- **Going**
- **Interested**
- **Remove RSVP**
- **Reminder Settings**
- **View Attendees**
- host-only logical actions for **Edit**, **Cancel**, and **Start Tour**

Discord cannot visually hide public message buttons per viewer, so every click
must enforce ownership and role rules server-side and return an ephemeral
explanation when unauthorized.

### Private event redaction

A public event for a Private tour reveals only:

- event title;
- host;
- time;
- ESO environment; and
- the host-approved event description.

It does not show the private tour name, route, stop count, tags, houses, or stop
notes. Starting the event creates a shared session linked to the event in the
same guild and channel. Event-derived access is valid only through that active
shared session. Stop controls revalidate event ID, channel, status, environment,
and session.

Ending or replacing the session completes the event and closes event-derived
access. Cancelling the event closes any linked session. RSVP data never becomes
a general Private-tour grant.

### Editing, cancellation, and completion

The host may edit the title, description, or start time. Changing time
increments the schedule revision and updates the public card. Housing
Moderators may cancel any event in their guild without gaining access to a
Private route; the event service uses a redacted moderation query.

Only the host may start the shared tour and remains its leader under the
existing shared-session rules. AddressBook does not automatically start a tour.
The host may start it when the group is ready. Start is rejected for cancelled
or completed events and rechecks current tour access and readiness.

Ending the event-derived shared run marks the event completed. Old buttons
respond with a clear completed, cancelled, moved, deleted, or unauthorized
message rather than timing out.

## RSVPs and Reminders

Going and Interested are mutually exclusive. Removing the RSVP removes both the
status and DM reminder preference. **Reminder Settings** lets a member enable
or disable DMs without changing the RSVP.

At 24 hours and 1 hour before the start:

- one general reminder is posted in the event channel without mass mentions;
- each Going or Interested member with `dm_reminders=true` receives a DM;
- a failed DM does not stop channel delivery or other recipients; and
- every attempt is recorded independently.

When an event is created inside a reminder threshold, that already-passed
reminder is not sent. When the bot restarts after a threshold but before event
start, it may send the reminder only inside a bounded grace period. It never
sends a pre-event reminder after the event has started.

The scheduler begins only after the Discord client is ready, checks roughly
once per minute, and stops cleanly during shutdown. Its clock, repository, and
Discord delivery gateway are injectable for deterministic tests. Multiple bot
processes remain safe because delivery claiming is database-unique and
transactional.

## Featured Houses and Tours

Each guild may have up to five Featured Houses and five Featured Tours.
Housing Moderators can add, remove, reorder, and set an optional expiration.

Eligible houses are:

- active Server entries belonging to the current guild; or
- active Global entries in the guild's exact environment.

Eligible tours are:

- Server tours belonging to the current guild; or
- Global tours in the guild's exact environment.

Private entries and Non-Player Houses are not eligible.

Featured queries always revalidate current access, visibility, status,
environment, and expiration. An invalid selection disappears from member
discovery immediately. Administration continues to show a redacted warning and
reason so a moderator can remove or replace it.

The `/housing` home gains **Featured**. It opens a compact gallery ordered by
the moderator-defined position, presenting houses before tours and paginating
within Discord limits. Selecting an item opens the normal authorized house or
tour card, preserving all existing access checks and navigation behavior.

## Persistent Personal Tour Progress

Persistent progress applies only to self-paced tours. Shared event sessions do
not silently update attendee progress.

### Start and resume

Starting an eligible self-paced tour creates or resumes its progress row.
Resume rechecks access and current environment, reconciles current tour stops,
then creates a transient self-paced presentation in the current channel. A
resume in another channel closes the user's older transient presentation for
that same tour while retaining the durable progress.

For pass-only Private access, progress records the Share Pass ID. Later reads
must validate that exact pass. If the pass is revoked, expired, moved, or no
longer authorizes the tour, progress remains stored but is hidden and cannot be
advanced.

### Stop reconciliation

Progress stores stable stop IDs, not positions.

- Reordering stops preserves completed state.
- Deleted stops disappear from completed state.
- A deleted current stop advances to the first incomplete stop in current tour
  order.
- Newly added stops begin incomplete.
- If no eligible stops remain, the run cannot continue and displays a useful
  recovery message.

Advancing from a stop marks that stop complete and selects the next incomplete
stop. Going backward changes the displayed current stop but does not erase
completed state.

### Completion and restart

Finishing the last incomplete stop:

- increments completion count;
- records the most recent completion time;
- closes the transient session; and
- presents **Tour Complete** with Restart and Back actions.

Restart starts a new current run while preserving the completion count and last
completion time.

My AddressBook gains:

- **Tours in Progress**, ordered by most recent activity; and
- **Completed Tours**, ordered by most recent completion.

Rows are reauthorized before display. Inaccessible Private data, archived
tours, invalid passes, and cross-environment tours are not exposed through
names, counts, selectors, or completion details.

## Discord Navigation

The established home layout remains primary:

- `/housing` adds **Featured**.
- **Housing Tours** adds **Upcoming Events**.
- eligible tour cards add **Schedule Event**.
- **My AddressBook** adds **Hosted Events**, **My RSVPs**,
  **Tours in Progress**, and **Completed Tours**.

Upcoming Events shows scheduled events accessible in the current guild and
environment, ordered soonest first. Hosted Events includes the member's
scheduled, cancelled, and recently completed events without exposing a Private
route to moderators. My RSVPs includes scheduled Going and Interested events.

All lists paginate at 25 options, component layouts remain at five rows or
fewer, modal limits are honored, and custom IDs use bounded opaque tokens where
the underlying context would be too long.

## Environment Changes

The existing environment-change preview and transaction must include:

- events whose referenced tour moves with the guild;
- events that become incompatible and will be cancelled;
- pending reminder deliveries that will become inapplicable;
- Featured choices that will be retained or removed; and
- event-derived sessions that will close.

When a provenance-linked tour moves successfully with the guild, its scheduled
events update to the new environment and remain scheduled if the tour is still
eligible. Other incompatible future events are cancelled. Their pending
reminders are suppressed. Featured records that no longer pass eligibility are
removed. All changes occur in the same transaction and are included in the
preview fingerprint so stale confirmation is refused.

Personal progress follows the referenced tour when that tour itself moves.
Otherwise it remains stored under its original environment and is simply
inaccessible from the changed guild.

## Identity and Audit

The identity refresh service covers every new guild, channel, user, house, and
tour companion-name field. Event-card and RSVP interactions refresh observed
names before applying the requested action.

Audit entries are written for:

- create, edit, cancel, start, and complete event;
- moderator cancellation;
- add, remove, reorder, and expire Featured content; and
- automatic environment-change cancellation/removal.

Routine RSVP changes, reminder deliveries, and personal progress transitions
do not flood the general audit log; they remain visible in their domain tables.
No token, password, DM content, or other secret is stored in audit details.

## Failure Handling

- Database writes that require a public Discord message use compensation or a
  transaction boundary so invisible active records are not left behind.
- A deleted or inaccessible event channel produces an Administration Health
  warning and suppresses channel delivery while allowing eligible DMs.
- A deleted event message does not recreate itself automatically; the host may
  repost it, which updates the stored message ID and invalidates the old card.
- One failed DM never blocks other recipients.
- Event edits and cancellation use current status and schedule revision to
  reject stale confirmations.
- Tour start, progress, Featured selection, and every direct-ID path revalidate
  visibility and environment at use time.
- Error messages are concise, actionable, and ephemeral.

## Administration and Health

Administration adds:

- **Server Timezone**
- **Manage Featured Houses**
- **Manage Featured Tours**
- **Manage Tour Events**

Administration Health adds:

- configured timezone;
- scheduled, completed, and cancelled event counts;
- upcoming reminders and failed delivery counts;
- Featured House and Tour counts;
- stale event-channel/message warnings; and
- active personal-progress count.

Health never displays DM text, credentials, tokens, or Private route metadata.

## Migration and Transfer

Fresh databases create schema version 7. Existing schema-v6 databases upgrade
additively without data loss.

The guarded SQLite-to-MariaDB and MariaDB-to-SQLite transfer copies all new
persistent tables in dependency order and validates:

- event-to-tour environment consistency;
- RSVP and delivery parent relationships;
- Featured target type and guild eligibility fields;
- progress-to-tour and progress-stop relationships; and
- row counts for all new tables.

Transient tour sessions, including event-derived sessions, remain intentionally
excluded from transfer. Persistent events, RSVP preferences, reminder delivery
history, Featured choices, and personal progress are included.

## Testing Strategy

Implementation follows test-driven development. Required coverage includes:

1. Fresh SQLite and MariaDB schema definitions and v6-to-v7 upgrade.
2. Two-way transfer preservation and relationship validation.
3. Time parsing, timezone conversion, invalid input, DST gaps, and DST
   ambiguity.
4. Event creation, posting rollback, editing, rescheduling, cancellation,
   completion, and stale confirmations.
5. Host, Housing Tours, Housing Moderator, Private-tour, guild, and environment
   permission boundaries.
6. RSVP transitions, reminder toggling, attendee redaction, and pagination.
7. 24-hour and 1-hour selection, grace periods, transactional claiming,
   duplicate prevention, restart behavior, parallel workers, and DM failures.
8. Private event-card redaction and event-derived session closure.
9. Featured capacity, ordering, expiration, invalidation, and normal-card
   delegation.
10. Progress start, cross-channel resume, stop reorder/delete/add
    reconciliation, pass revocation, completion count, and restart.
11. Environment-change preview, fingerprint, move, cancellation, and rollback.
12. Identity refresh and readable audit details.
13. Discord 25-option, five-row, modal, field, and custom-ID limits.
14. Full regression suite, syntax checks, SQLite smoke test, MariaDB
    schema/query-spy tests, and live MariaDB integration when configured.
15. Clean extracted-release ZIP test and forbidden-file inspection.

## Documentation and Release

Runtime version, package metadata, Administration Health, home footer, README,
current-state guide, and Word user/administrator guide advance to 0.9.0.

The guide explains:

- setting the server timezone;
- scheduling, editing, cancelling, and starting an event;
- RSVP and reminder privacy;
- Featured eligibility;
- persistent self-paced progress and completion history;
- Private-event boundaries; and
- restart, environment, migration, and troubleshooting behavior.

The release archive excludes secrets, databases, dependencies, worktrees,
development planning files, and prior archives. It is integrity-tested,
extracted, and regression-tested before delivery.

# ESO Environment Partitioning Design

**Date:** 2026-09-19  
**Project:** AddressBook v0.6.0  
**Status:** Approved design; implementation pending

## Purpose

AddressBook currently treats Global housing as one bot-wide namespace. ESO housing destinations are not interchangeable across platforms and megaservers, however. A PC NA destination must not appear in PC EU, Xbox, PlayStation, or PTS searches, tours, comments, moderation queues, or shared-tour sessions.

This design partitions all AddressBook housing data and Global Moderator authority into seven explicit ESO environments while retaining the existing Global, Server, and Private visibility model.

The supported environments, in display order, are:

| Stored value | Display label |
| --- | --- |
| `pc_na` | PC NA |
| `pc_eu` | PC EU |
| `xbox_na` | Xbox NA |
| `xbox_eu` | Xbox EU |
| `playstation_na` | PlayStation NA |
| `playstation_eu` | PlayStation EU |
| `pts` | PTS |

`NULL` represents a legacy record that has not yet been assigned. The UI calls this state **Unassigned**. `unassigned` is not stored as an eighth environment and is never a searchable or shareable environment.

## Goals

- Require every Discord guild using AddressBook to select one ESO environment.
- Keep Global results global only within the same exact environment.
- Make destination identity, comments, duplicate detection, houses, and tours environment-specific.
- Make Global Moderator grants and requests environment-specific.
- Safely classify existing data without guessing when the available evidence is ambiguous.
- Let owners classify unresolved Private data from My AddressBook.
- Provide a previewed, confirmed, audited way for Housing Moderators to change a guild environment.
- Apply equivalent schema, migration, behavior, and tests to SQLite and MariaDB.
- Preserve the existing visibility order everywhere: Global, Server, Private.

## Non-goals

- A Discord guild cannot simultaneously represent more than one ESO environment.
- A house, tour, comment collection, or share pass cannot span environments.
- Environment aliases, custom environments, and cross-environment searches are not included.
- Selecting an environment does not grant Global Moderator access.
- The upgrade does not silently assign ambiguous legacy Private records or conflicting legacy Global tours.

## Core invariants

These rules apply at both the service and database boundaries where practical:

1. A configured Discord guild has exactly one supported ESO environment.
2. A saved house with an assigned environment refers to a destination in the same environment.
3. Destination identity is `(eso_server, normalized_owner, house_id)`.
4. Comments belong to an environment-specific destination and never cross environments.
5. Every assigned tour belongs to exactly one environment.
6. Every tour stop must resolve to a house in the tour's environment and satisfy the tour visibility rule.
7. Global discovery returns only records from the request guild's environment.
8. Global Moderator authority is keyed by both Discord user ID and environment.
9. Unassigned records are excluded from search, sharing, tour execution, and moderation discovery until assigned.
10. Direct IDs, old Discord buttons, and share tokens do not bypass environment checks.

## Visibility and tour eligibility

Environment matching is required in addition to existing access checks.

| Tour visibility | Eligible stops |
| --- | --- |
| Global | Global houses in the same environment |
| Server | Global or Server houses in the same environment |
| Private | Accessible Private, Server, or Global houses in the same environment |

Private access continues to follow existing ownership, submission, sharing, and moderation rules. Environment matching does not make a Private record broadly visible.

Eligibility is checked when a stop is added and again when a tour starts or advances. This protects a tour if a house's visibility or environment changes after the stop was created.

## Data model

The implementation will use explicit, indexed environment columns instead of deriving environment through joins. This makes isolation inspectable, efficient, and difficult to omit accidentally.

### `guild_settings`

Add:

- `eso_server`: nullable environment code; non-null after setup.
- `eso_server_selected_by`: Discord user ID that completed initial setup or the most recent change.
- `eso_server_selected_at`: database-native timestamp.

The associated Discord display/global names remain captured through the project's existing identity and audit mechanisms. The guild setting is the authoritative current environment for Discord interactions.

### `housing_destinations`

Add nullable `eso_server` and replace the current destination uniqueness rule with:

`UNIQUE (eso_server, normalized_owner, house_id)`

Because SQL engines differ in their treatment of `NULL` in unique indexes, the migration and destination service must explicitly control legacy unassigned rows rather than relying on the unique index to deduplicate them.

Add indexes supporting environment-first lookups, including house and normalized-owner search inside an environment.

### `saved_houses`

Add nullable, indexed `eso_server`.

New records always receive the current guild environment. New Private records also retain `origin_guild_id` and the readable origin guild name, so later classification and administrative changes have a reliable provenance.

Assigned saved houses must point to a destination with the same environment. Existing readable identity fields remain intact.

### `tours`

Add:

- nullable, indexed `eso_server`
- `origin_guild_id` and readable origin guild name where not already available under the equivalent current field

New tours always receive the current guild environment. `origin_guild_id` is retained even for Private and Global tours so provenance is not lost when visibility changes.

### `global_moderator_requests`

Add non-null `eso_server` for all new requests. Pending-request uniqueness becomes one pending request per `(discord_user_id, eso_server)`.

The request records the origin guild and its readable name as it does today. A request submitted from a PC NA guild is a PC NA request.

### `global_moderators`

Change authorization identity from Discord user alone to `(discord_user_id, eso_server)`. A person can hold any combination of the seven environment grants.

Approval metadata, readable names, request linkage, and timestamps remain recorded independently for each grant.

### Derived environment records

Comments, reports, tour stops, house passes, tour passes, sessions, and recent views derive their environment through their destination, saved house, or tour. Environment need not be duplicated on every table unless query performance or migration safety demonstrates a need during implementation.

Regardless of physical storage, every service retrieving one of these records must resolve and enforce its target environment.

## First-use guild setup

When `/housing` runs in a guild whose `guild_settings.eso_server` is `NULL`, AddressBook shows a required setup card instead of the normal home screen.

The card briefly explains why the choice matters and presents the seven environments in the approved display order. Discord component pagination may be used if future options require it, although seven options currently fit in one select.

Any guild member may complete the initial selection. The first successfully committed selection wins:

1. Start a transaction.
2. Lock or conditionally update the guild settings row only while `eso_server IS NULL`.
3. Store the environment, actor, and timestamp.
4. Run the guild-linked legacy assignment described below.
5. Commit.

If another person wins the race, the losing interaction reports the selected environment and continues to the normal AddressBook home screen. It does not overwrite the selection.

After configuration, `/housing` displays the environment on the home screen along with the bot version and its short purpose statement. The Administration screen also displays it prominently.

## Legacy-data classification

### Guild-linked Server records

When a guild first selects an environment, its Server houses and Server tours are assigned to that environment using `guild_id` or equivalent guild ownership.

### Guild-linked Global houses

Global saved houses whose `origin_guild_id` matches the configured guild are assigned to the guild environment. Their destinations are claimed or created for that environment.

If the same owner and house number already exist in that environment, the service reuses the environment destination. It does not combine the saved-house metadata rows unless the existing duplicate-handling rules explicitly call for that.

### Legacy Global tours

Because existing Global tours do not always retain a dependable origin guild, they are inferred only when all resolvable stops identify one environment.

- If every resolved stop points to one environment, assign the tour to it.
- If the tour is empty, all stops are unresolved, or evidence spans environments, keep it Unassigned.
- The creator is prompted in My AddressBook to assign an unresolved tour.
- For a conflicting tour, the assignment preview shows stops that cannot remain and requires confirmation before removing them.

### Legacy Private houses and tours

Legacy Private records remain Unassigned, even if they have an apparent guild association. Their owner receives a migration notice in My AddressBook when using a configured guild.

The notice provides aggregate counts before any changes. The owner may:

- Assign eligible records to the current guild environment.
- Review conflicts and removals for tours.
- Postpone without losing access to the private records in the migration list.

Until assigned, these records remain private but cannot appear in normal searches, be shared, be copied, be added to a tour, or be executed as a tour.

### Ambiguous legacy comments

Legacy comments were recorded before environment became part of destination identity. They cannot reliably be duplicated across environments without incorrectly presenting a comment in a place where it may not apply.

The approved rule is **first environment to claim the destination receives the legacy comments**:

1. The first environment assignment for a legacy destination rekeys or moves its existing destination and retains the comments.
2. A later claim for the same owner and house number in another environment creates a new destination without those legacy comments.
3. Once separated, new comments never cross environments.
4. The claim result is transactional and auditable so concurrent first-use setup cannot copy the comments twice.

## Search, browsing, and direct access

All discovery operations require the current guild environment:

- Search Homes and every filter, including visibility and not-in-public/global-tour filtering
- Recently Added and recent views
- Global and Server directories
- My AddressBook's normal assigned lists
- House details and associated tour names
- Tour directories, candidate lists, and add-results actions
- Reports and moderation queues

The environment predicate must be applied in the service or repository layer, not merely in UI code.

My AddressBook separately displays an Unassigned legacy-data notice for the signed-in owner. Unassigned entries do not mix into the ordinary result selector.

Direct record IDs and Discord component custom IDs are treated as references, not authorization. After loading a record, AddressBook checks environment, visibility, ownership, guild, moderation, and share-pass access before rendering it.

Typical mismatch response:

> This destination belongs to PC EU, but this Discord server uses PC NA.

No metadata from an inaccessible record should be included in that response.

## House creation, editing, visibility changes, and copying

- A newly registered house receives the current guild environment.
- Parsed ESO housing links and `("@owner", houseId)` input affect owner and house identity but do not override the guild environment.
- Editing cannot change environment directly.
- Changing visibility does not change environment.
- Converting to Global or Server still requires all existing permission and moderation rules.
- A shared Private house may be copied only if its environment matches the recipient guild.
- The copy form may prepopulate editable nickname, description, and tags as currently designed.
- The resulting copy is created in the same environment; users cannot use copying to move a destination between environments.

## Tours and stops

Every tour create, copy, search-results conversion, and add-to-existing action sets or validates one environment.

- Candidate house queries require the tour environment.
- Stop insertion revalidates destination environment and visibility eligibility inside the write transaction.
- Tour copy is permitted only into a matching environment.
- Starting or advancing a tour validates all stops again.
- If stale invalid stops are discovered during ordinary execution, execution stops with a helpful message and records diagnostic context; it does not silently expose or skip content.

The explicit administrative environment-change workflow is allowed to prune incompatible stops after showing the impact preview. Remaining stops are renumbered without gaps.

## Sharing and Tour Passes

House and tour share passes retain their existing opaque-token security. The target's environment is authoritative.

- Opening a pass in a matching configured guild proceeds to the normal access checks.
- Opening it in a different environment reports a mismatch without revealing private metadata.
- Unassigned content cannot create a pass.
- A shared Private house remains a one-time access path and does not change its normal visibility.
- Starting a private/self-paced tour from a shared pass remains supported when environments match.

When a guild environment change moves an affected tour, all active passes for that tour are revoked and open share-pass sessions are closed. Existing Discord messages may still contain buttons, but clicking one reports that the tour's environment changed and a new pass is required. This is safer and clearer than allowing an old card posted in one environment to begin operating in another.

House passes affected by a destination move receive the same treatment when the pass could otherwise cross the old/new boundary.

## Environment-specific Global Moderation

Submitting a Global Moderator request uses the origin guild's current environment. An unconfigured guild cannot submit a request.

A moderator may hold multiple independent grants. Permission caches must therefore use an environment-aware key such as `(discord_user_id, eso_server)` rather than Discord user ID alone.

Configured IDs in `GLOBAL_MODERATOR_APPROVER_USER_IDS` remain bot-wide approvers. They can:

- View pending requests for every environment.
- Approve or deny a request for its requested environment.
- Revoke one environment grant without affecting the user's other grants.

The status UI lists each grant and request with its environment label. Review queues default to the current guild environment but provide approvers an explicit all-environments view where component limits permit. Ordinary Global Moderators see and moderate Global records only for their authorized environment.

## Changing a guild environment

Housing Moderators can choose **Change ESO Environment** in Administration. Existing Housing Moderator fallback behavior remains unchanged when no moderator roles are configured.

### Preview

Before confirmation, AddressBook calculates and presents:

- Current and proposed environment
- Server houses affected
- Origin-linked Global houses affected
- Server and origin-linked Global tours affected
- Destinations claimed, reused, or created
- Tour stops that would be removed
- House and tour passes that would be revoked
- Active pass sessions that would be closed
- Legacy or conflicting records that will remain Unassigned

The confirmation uses an explicit destructive-change warning and cannot be inferred from closing the modal.

### Confirmation transaction

Immediately before mutation, AddressBook recalculates the preview under transaction protection. If it differs materially from the preview the moderator saw, the operation stops and asks for a fresh review.

The confirmed operation:

1. Locks the guild setting and affected records.
2. Revalidates the moderator's authority and proposed environment.
3. Retags the guild's Server houses and tours.
4. Retags Global houses and tours whose origin is that guild.
5. Claims, creates, or remaps environment destinations.
6. Preserves comments when a destination moves cleanly.
7. Never merges comments into an already distinct destination in the new environment.
8. Removes tour stops that cannot satisfy the destination environment and visibility rules.
9. Renumbers remaining stops.
10. Revokes affected share passes and closes their active sessions.
11. Updates the guild environment, selecting actor, and timestamp.
12. Writes detailed audit records.
13. Commits and then clears relevant in-memory caches.

Any failure rolls back the complete change. The guild must never be left partly moved.

## Service boundaries

Implementation should centralize the rules instead of distributing string comparisons across Discord handlers.

### Environment definition utility

One module owns:

- Allowed stored values
- Display labels and order
- Validation and normalization
- Select-menu options
- Formatting for user-facing messages

### Guild environment service

Owns first-use selection, current-environment retrieval, impact previews, confirmed changes, concurrency protection, and cache invalidation.

### Destination service

All destination resolution and creation requires an environment for normal data. It implements the environment-aware uniqueness rule and the first-claim legacy-comment transaction.

### House and tour services

All create, query, update, copy, visibility-change, stop, start, and advance methods either accept an environment context or load it from an authoritative parent record. Methods must fail closed when an environment is unexpectedly absent.

### Access context and sharing services

These services perform environment checks after resolving direct IDs or tokens and before returning protected data. Share-pass creation and redemption validate assignment and environment.

### Global Moderator service

Requests, grants, cache entries, approvals, denials, revocations, and status summaries are environment-aware. Environment approver authority remains separately configured and bot-wide.

## Error handling

Discord users receive concise, actionable messages while full database errors remain in application logs.

Required cases include:

- Guild setup required
- Another member completed setup first
- Record/environment mismatch
- Legacy assignment required
- Tour stop no longer eligible
- Pass revoked after environment change
- Environment impact changed before confirmation
- Unsupported or malformed environment value
- Migration failure before startup

Interactions that may perform substantial previews or migrations must defer their Discord response promptly to avoid the three-second interaction timeout. Long lists use pagination and respect Discord's 25-option select limit.

## Audit requirements

Audit data must capture IDs and the project's corresponding readable names when available. Required environment-related events include:

- Initial guild environment selection
- Guild environment preview confirmation and completion
- Legacy house or tour assignment
- Ambiguous destination/comment first claim
- Tour stop removal and renumbering
- Share-pass revocation and session closure
- Global Moderator request, approval, denial, and revocation

Environment-change audit details include the old environment, new environment, recalculated counts, affected record IDs or a bounded summary with correlation identifier, actor, guild, and timestamp.

## Schema and data migration

SQLite and MariaDB receive functionally equivalent schema changes and indexes. Database-native timestamps are used; application-generated ISO timestamps must be normalized before MariaDB writes.

The startup upgrade sequence is:

1. Detect the current schema version and backend.
2. Create or alter nullable environment columns and supporting fields.
3. Replace incompatible destination and moderator uniqueness constraints.
4. Add environment-aware indexes.
5. Preserve existing rows as assigned only where the approved inference rules are deterministic.
6. Leave ambiguous data `NULL`/Unassigned.
7. Validate foreign-key relationships, destination consistency, duplicate keys, and orphan counts.
8. Record the schema migration only after successful validation.

MariaDB DDL limitations may require carefully ordered table/index alterations. The implementation must be restart-safe: rerunning after an interrupted migration either completes idempotently or reports a precise blocker.

The explicit `MIGRATE` SQLite-to-MariaDB and MariaDB-to-SQLite process must include all new columns and environment-specific moderator rows. Its destructive destination reset behavior remains as previously designed, but source validation occurs before destination deletion and transfer counts are verified before success is reported.

## Testing strategy

Tests are written before the corresponding implementation changes and cover both backend-independent services and backend-specific schema behavior.

### Setup and concurrency

- Seven environment values validate and display in the approved order.
- First completed setup wins under concurrent attempts.
- The losing interaction reports the committed choice.
- `/housing` blocks normal navigation until setup completes.

### Environment isolation

- Global searches never cross environments.
- Server and Private results require the current environment plus existing access rules.
- Direct IDs cannot bypass isolation.
- Same owner and house ID can exist in two environments.
- Comments remain shared within one destination/environment and isolated between environments.

### Houses and tours

- Registration and parsed links inherit the guild environment.
- Visibility changes preserve environment.
- Copying shared Private content requires an environment match.
- Tours cannot add or retain mismatched stops.
- All three visibility matrices enforce the approved rules.
- Start and advance revalidate stop eligibility.

### Sharing

- Matching house and tour passes open normally.
- Mismatched guilds receive a safe error.
- Unassigned content cannot be shared.
- Environment changes revoke affected passes and close sessions.
- Old buttons explain revocation without exposing private metadata.

### Global moderation

- Requests are created for the current environment.
- One user can have several grants.
- A moderator grant works only in its environment.
- Approvers can review all environments and revoke one grant independently.
- Cache keys and invalidation are environment-aware.

### Legacy migration

- Guild-linked Server and Global records assign correctly.
- Legacy Private records stay Unassigned until owner confirmation.
- Single-environment Global tours infer correctly.
- Empty, unresolved, and conflicting tours remain Unassigned.
- The first environment claim retains legacy comments exactly once.
- Concurrent claims do not duplicate comments.

### Administrative changes

- Impact counts are accurate.
- Changed impact invalidates the confirmation.
- Confirmed changes move only provenance-linked data.
- Invalid stops are removed and positions compacted.
- Comments and metadata follow the approved rules.
- Failure rolls back all mutations.
- Audit entries include old/new environments and readable identities.

### Database compatibility and regression

- Fresh SQLite and MariaDB schemas contain equivalent fields and constraints.
- Existing databases upgrade without losing unrelated data.
- SQLite-to-MariaDB and MariaDB-to-SQLite transfer preserve environment values and all seven grant types.
- MariaDB result sets contain no duplicate projected field names.
- MariaDB timestamp writes use valid database values.
- The entire existing test suite remains green.

## Documentation and release requirements

The current-state guide, administrator documentation, user guide, `.env` example, migration instructions, and Debian deployment instructions must describe the seven environments and their effects.

Documentation must explain:

- First-use guild configuration
- The difference between visibility and environment
- Environment-limited Global discovery
- House and tour eligibility
- Legacy Private assignment
- Environment-specific Global Moderator requests and grants
- Environment-change impact, pruning, and pass revocation
- SQLite/MariaDB migration behavior

The version in `package.json`, the `/housing` home screen, documentation, and release archive filename must match.

## Acceptance criteria

The feature is complete when:

1. A new guild cannot use normal AddressBook features until one member atomically selects one of the seven environments.
2. All Global house, tour, comment, report, pass, and moderation paths are isolated to the exact environment.
3. Destination identity includes environment for Global, Server, and Private data.
4. Tours cannot contain or execute stops from another environment.
5. Global Moderator requests and grants work independently per environment.
6. Existing deterministic records are assigned automatically and ambiguous records remain safely Unassigned.
7. Owners can preview and assign legacy Private records from My AddressBook.
8. Housing Moderators can preview and confirm a transactional, audited guild environment change.
9. Affected passes are revoked and old interactions fail safely.
10. SQLite and MariaDB fresh install, upgrade, and cross-backend migration tests pass.
11. Existing tests pass without regressions.
12. Release documentation and displayed versions accurately describe the implemented behavior.

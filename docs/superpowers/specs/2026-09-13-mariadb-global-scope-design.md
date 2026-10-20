# AddressBook MariaDB, Global Scope, and Tour Session Design

## Summary

AddressBook will migrate from SQLite to MariaDB-only runtime storage while preserving existing data and behavior, and will add three durable house scopes: Private, Public, and Global. Saved houses will use a single stable identity so scope can change without losing comments, metadata, audit history, or other references. Tours and tour sessions will be updated to honor the same scoping rules, and Global moderator authority will be centralized and user-based rather than controlled by arbitrary guild roles.

## Goals

- Replace SQLite runtime storage with MariaDB.
- Preserve existing AddressBook data through a one-time explicit SQLite-to-MariaDB migration.
- Keep Public houses and Public tours isolated by Discord guild/server.
- Keep Private houses user-scoped across guilds.
- Add bot-wide Global houses, comments, and Global tours.
- Allow authorized editors to change a saved house between Private, Public, and Global scope without losing comments or metadata.
- Reconcile tour stops whenever a house scope change makes the house ineligible for a tour.
- Make tour sessions transient: ending or replacing a session deletes its row.
- Enforce one Shared session per guild+channel and one Self Paced session per guild+channel+user.
- Add centralized Global Moderator request, approval, revocation, and audit behavior.

## Non-goals

- AddressBook will not create the MariaDB database itself.
- SQLite will not remain as a supported production runtime backend after migration.
- Global moderation authority will not be granted by arbitrary per-guild roles.
- Global Tours will not contain Private or Public houses.

## Runtime Database Configuration

AddressBook connects to a database created by the operator. The application creates and migrates its own tables.

Environment variables:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=addressbook
DB_USER=addressbook
DB_PASSWORD=replace_me
# Optional alternative for Docker/secret managers:
DB_PASSWORD_FILE=/run/secrets/addressbook_db_password

# One or more comma-separated Discord user IDs allowed to approve Global Moderators.
GLOBAL_MODERATOR_APPROVER_USER_IDS=123456789012345678,234567890123456789
```

If `DB_PASSWORD_FILE` is present, its trimmed contents take precedence over `DB_PASSWORD`.

The MariaDB account should be restricted to the AddressBook database and require only the privileges needed for normal CRUD and schema migrations.

## Database Lifecycle

At normal startup AddressBook will:

1. Connect to MariaDB using a connection pool.
2. Fail startup clearly if the database is unreachable.
3. Create `schema_migrations` if needed.
4. Apply pending ordered schema migrations.
5. Seed/update the official ESO house catalog.
6. Log in to Discord only after database initialization succeeds.

Schema migrations are versioned and idempotent. Production code has no SQLite fallback.

## Data Architecture

Discord UI and interaction handlers must not issue SQL directly.

```text
Discord handlers / UI
        |
        v
     Services
        |
        v
   Repositories
        |
        v
   MariaDB pool
```

Repositories own persistence and scope enforcement. Services own business rules and transactions spanning repositories.

## Core House Model

### `houses`

The existing official ESO catalog remains a separate table keyed by ESO `house_id`.

### `saved_houses`

Private, Public, and Global saved houses use one table so a scope change is an update of the same logical record rather than a copy/delete operation.

Conceptual columns:

```text
id BIGINT AUTO_INCREMENT PRIMARY KEY
scope ENUM('private','public','global') NOT NULL
house_id INT NOT NULL -> houses.house_id
eso_owner VARCHAR(...) NOT NULL
normalized_owner VARCHAR(...) NOT NULL
display_name VARCHAR(...) NULL
description TEXT NULL
tags JSON NOT NULL
owner_user_id VARCHAR(32) NULL
guild_id VARCHAR(32) NULL
created_by VARCHAR(32) NOT NULL
status ENUM('active','pending','archived') NOT NULL
created_at DATETIME NOT NULL
updated_by VARCHAR(32) NOT NULL
updated_at DATETIME NOT NULL
```

Scope invariants:

- Private: `owner_user_id` is set; `guild_id` is NULL.
- Public: `guild_id` is set; `owner_user_id` is NULL.
- Global: `guild_id` and `owner_user_id` are NULL.

Application validation and database constraints must enforce valid combinations.

### Visibility rules

Search Houses combines only:

- Private houses owned by the current Discord user.
- Public houses in the current Discord guild and with active status.
- Active Global houses.
- Non-Player catalog houses when the user enables that toggle.

Public records from another guild must never be returned.

## Registration and Approval

The Register New House flow gains a third Registration Type: Global.

Eligibility for Global submission matches eligibility for Public/guild-level submission in the originating guild:

- Open: eligible submissions become active immediately.
- Approval: ordinary submissions remain pending; trusted submitters and Housing Moderators follow the existing approval behavior.
- Roles: the same users allowed to submit Public houses may submit Global houses.

Once active, a Global house is visible bot-wide.

## House Edit/Delete Permissions

### Private

The owning Discord user may edit/delete.

### Public

The original submitter and users permitted by the current guild-level Housing Moderator rules may edit/delete, preserving current behavior.

### Global

- The original submitter may edit/delete their own Global house.
- Approved Global Moderators may edit/delete any Global house.
- Ordinary guild Housing Moderators do not automatically receive Global moderation authority.

Deleting a saved house deletes its comments and removes dependent tour stops according to foreign-key/service rules. Audit records are retained where practical.

## Changing House Scope

An editor who has edit permission on the current house may request a scope change between any of:

```text
Private <-> Public <-> Global
```

The same `saved_houses.id` is retained. Comments and all house metadata therefore remain attached to the record.

### Target-scope authorization

A user must also be eligible for the destination scope:

- To move to Private, the resulting record becomes private to the acting user/authorized owner according to the edit flow.
- To move to Public, a destination guild is required and the user must be eligible to register a Public house there.
- To move to Global, the user must be eligible to register a Public house in the originating/current guild; Global Moderator authority is not required merely to submit/move their own eligible record.

### Impact preview

Before applying a scope change, AddressBook finds every `tour_stop` referencing the saved house and determines whether the house remains valid for that tour under the tour's visibility/source rules.

If any stops would become invalid, AddressBook shows a confirmation screen listing the affected tours and the stop-removal consequences. No database change occurs before confirmation.

After confirmation, one transaction will:

1. Update the house scope and corresponding owner/guild fields.
2. Delete each now-invalid tour stop.
3. Renumber remaining stops in every affected tour.
4. Preserve eligible tour stops unchanged.
5. Record an audit entry describing the scope transition and affected tours.

If the transaction fails, the scope change and all tour edits roll back together.

## Comments

`house_comments` references `saved_houses.id` with `ON DELETE CASCADE`.

Comments are not separately scoped; visibility follows the saved house they belong to. Therefore:

- Comments on a Private house are visible only where that Private house is visible.
- Moving the house to Public makes the same comments visible with the Public record.
- Moving the house to Global makes the same comments visible bot-wide with that record.
- Moving the house back to Private restricts visibility again.
- Deleting the house deletes its comments.

## Tours

### `tours`

Tour visibility becomes:

```text
private | public | global
```

- Private Tour: discoverable/editable according to creator/private rules.
- Public Tour: discoverable within its owning guild only.
- Global Tour: discoverable bot-wide.

### House-source eligibility

Tour source configuration must explicitly represent which saved-house scopes the tour accepts. The implementation may use a normalized source-mask/JSON representation rather than the legacy `private|public|both` string, but the UI should present readable choices.

Global Tours are a special case and may contain **Global houses only**.

Public and Private Tours may include Global houses when their configured source permits Global.

A tour stop references `saved_houses.id`, not separate Private/Public tables. It retains tour-specific title and notes independently from the saved house.

### `tour_stops` versus `tours`

- `tours` is one row per saved tour and stores the tour's identity, creator, description, visibility, and allowed house sources.
- `tour_stops` is one row per ordered house inside that tour and stores position plus tour-specific stop title/notes and a reference to the saved house.

Deleting a tour cascades to its `tour_stops`.

## Tour Sessions

`tour_sessions` represents an actively running tour only. It is not history.

Conceptual columns:

```text
id BIGINT AUTO_INCREMENT PRIMARY KEY
tour_id BIGINT NOT NULL
mode ENUM('self_paced','shared') NOT NULL
guild_id VARCHAR(32) NOT NULL
channel_id VARCHAR(32) NOT NULL
started_by VARCHAR(32) NOT NULL
message_id VARCHAR(32) NULL
current_position INT NOT NULL
started_at DATETIME NOT NULL
updated_at DATETIME NOT NULL
```

There is no `active` flag. Closed sessions are deleted.

### Session uniqueness

Shared:

```text
one active Shared session per guild + channel
```

Self Paced:

```text
one active Self Paced session per guild + channel + user
```

Starting a new matching session replaces the previous one transactionally.

The implementation may enforce this with generated keys or separate nullable uniqueness helpers because MariaDB unique indexes treat NULL specially; whichever method is used must be covered by integration tests.

### Ending and replacing sessions

- End Tour physically deletes the row.
- Starting another Shared tour in the same guild/channel deletes/replaces the previous Shared session.
- Starting another Self Paced tour by the same user in the same guild/channel deletes/replaces that user's previous Self Paced session.
- Other users' Self Paced sessions in the same channel remain untouched.

### Stale controls

Discord buttons/selects may outlive their session row. Every advance/back/end/control operation must first resolve the expected session. If no matching row exists because the session was ended or replaced, the interaction returns a friendly message equivalent to:

```text
This tour has been closed.
```

It must not silently recreate a session or operate on a newer unrelated session.

## Global Moderator System

Global moderation is centralized and user-based.

### `global_moderator_requests`

Stores requests containing at least:

- requester Discord user ID
- originating guild ID
- required reason/message
- status (`pending`, `approved`, `denied`)
- requested/decided timestamps
- deciding approver ID where applicable

Only one pending request per user is allowed.

### `global_moderators`

Stores approved Discord user IDs and approval metadata. Access is bot-wide.

### Approvers

Only Discord user IDs listed in `GLOBAL_MODERATOR_APPROVER_USER_IDS` may approve/deny requests or revoke Global Moderator access. A requester may not self-approve unless they are separately configured as an approver; the UI should still make the authority explicit.

### Administration UI

Eligible users can see:

- Request Global Moderator Access

Configured approvers additionally see:

- Global Moderator Requests
- Manage Global Moderators

The request form requires a reason.

## MariaDB Schema Migrations

A `schema_migrations` table records applied migration versions. Migrations are ordered and run before Discord login.

The initial MariaDB schema must include indexes for common scope queries, including at minimum:

- `saved_houses(scope, guild_id, status)`
- `saved_houses(scope, owner_user_id, status)`
- normalized owner/name search fields where beneficial
- `tour_stops(tour_id, position)`
- `tours(visibility, guild_id)` or equivalent
- `tour_sessions(guild_id, channel_id, mode)`
- moderator request status/user lookups

## SQLite-to-MariaDB Migration

Migration is explicit:

```bash
npm run db:migrate-sqlite-to-mariadb -- ./data/eso-housing.sqlite
```

The source SQLite file is opened read-only and never modified.

The MariaDB target must contain no AddressBook application data. If application data already exists, migration aborts before importing anything.

### Data mapping

Legacy rows are normalized into the new schema:

- `registered_houses` -> `saved_houses(scope='public', guild_id=...)`
- `personal_bookmarks` -> `saved_houses(scope='private', owner_user_id=discord_user_id)`
- existing comments are remapped to the corresponding new `saved_houses.id`
- existing tour stops are remapped from `registered_house_id` / `personal_bookmark_id` to `saved_house_id`
- existing tours map `personal` -> `private`, `server` -> `public`
- existing legacy `tour_sessions` are **not treated as durable history**. Because the source may contain stale rows, the migration should not carry inactive/stale session state into the new production database unless a session can be unambiguously proven current; the safe default is to migrate no active session rows and start runtime sessions clean after cutover.

Where two legacy source rows could collapse into one new logical destination, migration must preserve distinct user data unless a deterministic identity mapping is explicitly safe.

### Transaction and verification

The import is all-or-nothing.

Within a MariaDB transaction, the migration:

1. Creates/updates schema.
2. Verifies target application tables are empty.
3. Imports catalog/settings/saved houses/comments/tours/stops/audit data in dependency order.
4. Preserves legacy primary IDs where practical or writes explicit old->new ID maps where table consolidation makes preservation impossible.
5. Resets auto-increment counters beyond imported maxima.
6. Verifies row counts after accounting for intentional table consolidation.
7. Verifies all foreign-key references.
8. Runs guild-isolation sanity checks.
9. Commits only if every check passes.

Any failure rolls back the imported application data.

## Guild Isolation Tests

Security-critical tests must prove:

```text
Guild A search:
  current user's Private houses: visible
  Guild A Public houses: visible
  Guild B Public houses: hidden
  Global houses: visible

Guild B search:
  current user's Private houses: visible
  Guild B Public houses: visible
  Guild A Public houses: hidden
  Global houses: visible
```

Public tours must follow equivalent guild boundaries. Global tours are visible bot-wide and contain only Global house stops.

## Testing Strategy

The production test path uses MariaDB rather than SQLite so SQL dialect and transaction behavior match production.

Required regression coverage includes:

- MariaDB startup and schema migration ordering
- password-file precedence
- Public guild isolation
- Private user isolation across guilds
- Global visibility across guilds
- Public/Private/Global registration rules
- Global moderator request/approve/deny/revoke
- original-submitter versus Global Moderator edit/delete rules
- house scope transitions in every direction
- comments surviving scope transitions
- impact preview before invalid tour-stop removal
- atomic scope transition + tour pruning
- Global Tour accepts Global houses only
- Public/Private tour source eligibility
- tour-stop renumbering after pruning
- Shared session replacement per guild+channel
- Self Paced replacement per guild+channel+user
- independent Self Paced sessions for different users
- End Tour deletes session row
- stale session controls return “This tour has been closed.”
- SQLite import into empty MariaDB target
- refusal to import into non-empty target
- failed import rollback
- preserved/remapped relationships after consolidation

## Error Handling

- Database unavailable at startup: fail startup with a clear error.
- Temporary runtime database error: command returns a friendly failure response and does not crash the bot process.
- Schema migration failure: fail startup.
- SQLite import failure: roll back and exit non-zero with a clear stage/error.
- Scope-change impact confirmation expires: no scope or tour changes occur.
- Stale tour interaction: return “This tour has been closed.”

## Documentation

Current-state documentation will be updated as an initial-release view, with no changelog/history section. It must explain:

- MariaDB configuration
- database creation responsibility
- optional `DB_PASSWORD_FILE`
- one-time SQLite import command
- Private/Public/Global house scope
- scope-changing behavior and affected-tour confirmation
- Global Tours
- transient session behavior
- Global Moderator request/approval workflow

## Cutover Procedure

1. Back up the existing SQLite file.
2. Create the empty MariaDB database and restricted AddressBook user.
3. Configure DB environment variables.
4. Install the updated AddressBook dependencies.
5. Run the explicit SQLite-to-MariaDB migration command.
6. Review the migration verification summary.
7. Start AddressBook.
8. Verify Search Houses from at least two guilds and one user with Private data.
9. Verify Global search visibility.
10. Start/end Self Paced and Shared tours and confirm `tour_sessions` rows are deleted/replaced as designed.
11. Keep the SQLite backup for rollback/archive; it is no longer used at runtime.

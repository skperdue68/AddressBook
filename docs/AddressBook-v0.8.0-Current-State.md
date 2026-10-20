# AddressBook 0.8.0 User and Administrator Guide

AddressBook is an Elder Scrolls Online housing directory and tour guide that runs inside Discord. This guide explains the current v0.8.0 behavior for members, tour creators, moderators, approvers, and operators. Most members begin with `/housing` and do not need to remember any other command.

## First use and ESO environment setup

The first `/housing` interaction in a Discord server requires one ESO environment:

| Choice | Stored value |
|---|---|
| PC NA | `pc_na` |
| PC EU | `pc_eu` |
| Xbox NA | `xbox_na` |
| Xbox EU | `xbox_eu` |
| PlayStation NA | `playstation_na` |
| PlayStation EU | `playstation_eu` |
| PTS | `pts` |

Any member may complete this initial setup. The first completed selection wins, which prevents two simultaneous interactions from assigning different environments. The selected environment appears on the main home screen and in Administration.

After setup, a first-time user may take the seven-screen **Show Me Around** introduction or go directly to Search Houses, Register New House, or Housing Tours. The introduction demonstrates search and filters, flexible registration input, copy-ready ESO links, My AddressBook, tour modes, Share Passes and copying, visibility, environment boundaries, reporting, and moderation. Every page includes a contextual action that records completion before opening the real feature being demonstrated. Completing or skipping the introduction is stored per Discord user and survives restarts. Help can replay it without changing the stored status.

## Environment and visibility

Environment answers **which ESO network contains the destination**. Visibility answers **who may discover the saved entry**. The Discord UI always presents visibility in this order: **Global, Server, Private**.

| Visibility | Discovery boundary | Environment boundary |
|---|---|---|
| Global | Discord servers using this AddressBook installation | Exact environment only |
| Server | Current Discord server | That server's selected environment |
| Private | Saving Discord user | Exact environment only |

Global is not one universal directory. A PC NA Global record is shared among PC NA Discord servers only. It is never returned in PC EU, Xbox, PlayStation, or PTS searches, tours, comments, Share Passes, active sessions, or moderation results.

## Home and My AddressBook

The `/housing` home screen describes the bot, displays v0.8.0, shows the selected ESO environment, and exposes the main actions. My AddressBook is a private dashboard containing:

- **My Houses** for Private houses and Server or Global submissions owned by the member;
- **My Tours** for tours created by the member;
- **Pending** for pending house submissions and Global Moderator requests;
- **Recently Viewed** for accessible recently opened houses;
- **Favorites**, **Want to Visit**, and **Visited** for private destination-level preferences;
- **Saved Searches** for reusable filter sets; and
- **Continue** shortcuts for an active Self Paced tour, an accessible recent house, or a recently edited owned tour.

Recently Viewed is stored per user. A house disappears from the list when the member can no longer access it in the current Discord server and environment.

## Search Houses

Opening Search Houses immediately populates the paginated selector with every accessible saved house. Results appear in Global, Server, Private order, followed by Non-Player Homes when enabled.

The Filters modal supports:

- House name or nickname partial match
- ESO owner partial match
- Tags or themes
- Zone
- Architectural style
- ESO classification
- Size or type
- House visibility
- Non-Player Homes included or excluded
- Not on an applicable Server or Global Tour

Different filter categories use AND. Multiple values inside one category use OR. Discord permits only 25 options in one select component, so large attribute lists use pages without discarding values. Clearing filters restores the complete accessible list.

### Saved searches

After applying one or more meaningful filters, choose **Save Search** and enter a name. Names are unique per Discord user. If the name already exists, AddressBook asks before replacing its filters; Cancel leaves the existing search unchanged.

Open **My AddressBook → Saved Searches** to run, rename, replace, or delete a saved search. Lists over 25 items are paginated. A saved search stores validated filter criteria, not a snapshot of house IDs. Running it in another Discord server recalculates results using that server's configured ESO environment and the member's current access. Malformed, oversized, unknown-key, or unsupported-version criteria never fall back to an unrestricted search; AddressBook offers Delete and Back instead.

### Surprise Me

Search result screens include **Surprise Me**. Selection uses the complete authorized result set, not only the current 25-item page. The selected house uses the normal house card and includes **Another Surprise**. When at least two destinations are available, the next selection excludes the immediately previous destination. Empty searches retain Filters and Clear Filters so the member can recover without restarting.

The tour-membership filter excludes houses already included in a Global tour from the current environment or a Server tour belonging to the current Discord server. Private tours and another guild's Server tours do not disqualify a house. Non-Player Homes are excluded while this filter is active.

## Registering a house

Registration first asks for Global, Server, or Private visibility. Destination input accepts:

- an official house name;
- a numeric official house ID;
- an ESO Housing Link;
- a full Jump to Specific House command; or
- the owner and house ID portion, such as `("@HouseOwner", 62)`.

AddressBook parses the destination and displays a review screen before saving. The member can review the ESO owner, official house, environment, visibility, nickname, description, and tags.

Private registrations are immediately personal. Server and Global submissions follow the current Discord server's registration policy:

| Policy | Result |
|---|---|
| Open | Permitted submissions become active immediately |
| Approval | Trusted Submitters and Housing Moderators are auto-approved; other submissions wait for review |
| Roles | Only Trusted Submitters and Housing Moderators may submit |

Anyone allowed to register a Server house may also submit a Global house. Global discovery remains limited to the current ESO environment.

## House cards and comments

Saved house cards show the official house, ESO owner, optional nickname and description, tags, submitting Discord member, visibility, comment count, and visible associated tours by name. Associated tours are shown only when the viewer can access those tours.

Navigation values appear in separate code blocks and always in this order:

1. Jump in ESO
2. Unfurnished Preview
3. Housing Link

Discord therefore provides a convenient copy control. AddressBook cannot bypass the ESO owner's visitor permissions.

### Personal Actions

Accessible player and Non-Player house cards include **Personal Actions**. These preferences are visible only to the Discord user and never alter visibility or grant house access.

- **Favorite** is independent and can coexist with either visit state.
- **Want to Visit** and **Visited** are mutually exclusive.
- **Clear Visit Status** returns the visit state to neither without removing Favorite.
- Marking Visited records the most recent visit time.

Personal lists resolve access again whenever they are opened. An archived house or a Private destination whose Share Pass is no longer valid is not exposed through Favorites, Want to Visit, or Visited. When the same destination has multiple accessible entries, the list prefers Global, then Server, then Private. Lists over 25 items are paginated.

Comments belong to the environment-specific ESO destination. Global, Server, and Private entries that identify the same owner and official house share one comment history inside that environment. Deleting one saved entry does not erase the destination's comments while another saved entry still uses that destination.

## Editing and deleting houses

| Visibility | Who can edit or delete |
|---|---|
| Global | Original submitter or a Global Housing Moderator approved for that environment |
| Server | Original submitter or a Housing Moderator in that Discord server |
| Private | Owner of that Private entry |

Change Visibility retains the saved-house record, metadata, destination comments, and ID. AddressBook previews any tour stops that would become invalid. Confirmation removes only incompatible stops and renumbers the affected tours in one transaction. Normal registration permissions still apply when moving an entry to Server or Global.

## Housing tours

Tour visibility determines discovery and stop eligibility:

| Tour visibility | Who can find it | Eligible houses |
|---|---|---|
| Global | Users in Discord servers with the same ESO environment | Global houses in that environment |
| Server | Users in the current Discord server | Global houses in that environment and Server houses from that guild |
| Private | Tour creator | Accessible Global and Server houses plus the creator's Private houses in that environment |

A tour and every stop must use one exact environment. Direct IDs, stale buttons, copied tours, and Share Passes are checked again at use time so they cannot bypass the boundary.

Changing Tour Visibility previews incompatible stops. Confirmation removes those stops and renumbers the route.

### Self Paced and Shared runs

Self Paced creates one active session per guild, channel, and user. Starting another Self Paced tour in that location replaces that user's earlier session.

Shared creates one active session per guild and channel. The initiating member is the leader. Everyone can see the current stop and copy its ESO values, but only the leader can move forward, move backward, or end the run. There is no join or leave state because the tour is displayed directly in the channel.

Ending a tour deletes the active session. Controls from an ended or replaced message respond that the tour has been closed.

## Share Passes

House and Tour Share Passes provide temporary access without changing normal visibility. Only a cryptographic hash of the opaque pass token is stored. Reposting rotates the token, making old cards stale. Owners can revoke a pass.

A House Pass may reveal a Private house in the channel where it was shared. When the viewer would not otherwise have access, Copy House appears and opens a review flow. Nickname, description, and tags are prefilled and editable; ESO owner and official house remain fixed. Tour associations are never copied.

A Tour Pass starts an independent ephemeral Self Paced run for each visitor. Copy Tour creates a new Private tour. Accessible destinations are reused, inaccessible stops become new Private entries, and the operation is transactional.

Every pass records its ESO environment. A pass cannot be redeemed from a Discord server using another environment. Changing the origin guild's environment revokes affected House and Tour Passes and closes active pass-derived sessions.

## Reports

Members can report an accessible house for a broken jump, blocked visitors, an incorrect destination, misleading information, a duplicate entry, or another problem. Reports are rate-limited and duplicate open reports from the same reporter are rejected. Private metadata is redacted when a moderator lacks permission to view the Private entry.

Server reports go to the applicable guild moderators. Global reports go to Global Housing Moderators for that exact ESO environment.

## Administration roles

Each guild-level function accepts up to 25 roles. Discord's native role picker can search the server's complete role list even when the server has hundreds or thousands of roles. A member receives a permission when they hold any configured role for that function.

| Role function | Abilities | Does not grant |
|---|---|---|
| Housing Moderator | Administration, Server moderation, pending review, channel recovery, reports, guild-level tour privileges | Global moderation in any environment |
| Housing Trusted Submitter | Trusted treatment under Approval or permission under Roles policy | General Administration |
| Housing Tours | Start Shared Server tours | House moderation or Administration |

When no Housing Moderator role is configured, Discord members with Administrator permission have bootstrap access to configure roles.

## Global Housing Moderation

Global Moderator grants are environment-specific. A PC NA Global Housing Moderator does not automatically moderate PC EU, Xbox, PlayStation, or PTS.

The request flow is:

1. Open Global Moderation.
2. Select Request access for the current environment.
3. Enter a reason.
4. A configured approver approves or denies the request.
5. Approval creates a grant for that one environment.

A member may hold separate grants for multiple environments. The status screen lists active and pending environments. Revoking one grant leaves other environment grants intact.

`GLOBAL_MODERATOR_APPROVER_USER_IDS` is intentionally different: configured IDs are bot-wide approvers and can review every environment queue. Use a comma-separated list:

```env
GLOBAL_MODERATOR_APPROVER_USER_IDS=123456789012345678,234567890123456789
```

Approver configuration does not automatically grant Global Moderator access. The approver may review and grant access, including their own request when appropriate, but the resulting permission is still stored per environment.

## Changing a guild's ESO environment

A Housing Moderator can choose Change ESO Environment in Administration. AddressBook first shows a destructive-change preview containing:

- Server and origin-linked Global or Private houses that will move;
- Server and origin-linked Global or Private tours that will move;
- destinations that will be claimed, reused, or created;
- incompatible tour stops that will be removed;
- House and Tour Share Passes that will be revoked;
- active pass-derived sessions that will be closed; and
- remaining unassigned legacy records.

The preview includes a fingerprint of the exact affected records. Confirmation recalculates the impact inside the transaction and refuses to proceed if the data changed after the preview.

Origin-linked Private houses and Private tours created in the changing guild move with it. Private records created in other guilds remain in their existing environments, just like unrelated Global records. The action is recorded in the audit log with readable names when available.

## Legacy environment assignment

Older databases may contain records with no environment. Initial guild setup deterministically assigns eligible guild-originated Server and Global records. When multiple environments later claim the same legacy destination, the first claim keeps the original destination and a later claim receives a separate environment-specific destination; comments are not silently copied across environments.

Unassigned Private houses and tours remain visible as a warning in My AddressBook. Their owner can preview and confirm assignment to the current environment. Incompatible tour stops are removed and the rest are renumbered. AddressBook does not guess private ownership or environment silently.

Housing Moderators have a separate **Administration → Legacy Tours** recovery screen. It lists only Unassigned Server tours whose `guild_id` is the current Discord server and Unassigned Global tours whose `origin_guild_id` is the current Discord server. Lists exceeding 25 tours are paginated.

Selecting a tour displays its visibility, creator, current stop count, retained stops, removed stops, and a warning when recovery will leave an empty route. Confirmation recalculates the preview inside a transaction, refuses stale confirmation screens, assigns the tour to the guild's current ESO environment, removes incompatible or Unassigned stops, renumbers the remaining route, and writes an audit entry. It does not change the tour's creator.

Private tours are never displayed in the moderator recovery screen. Tours without sufficient guild provenance also remain Unassigned rather than allowing one Discord server to claim another server's data.

## Identity companion fields

Database relationships continue to use stable Discord IDs and numeric AddressBook IDs. Readable guild, channel, role, user, house, and tour names are stored beside important IDs for administration and auditing. When AddressBook later observes a newer Discord name, associated companion fields are refreshed without changing the stable IDs.

## SQLite and MariaDB

AddressBook requires Node.js 22 or newer.

SQLite is the default. It uses Node's built-in SQLite module and requires no separate server:

```env
DB_TYPE=sqlite
DATABASE_PATH=./data/eso-housing.sqlite
```

MariaDB requires a reachable server and configured credentials. AddressBook creates `DB_NAME` when missing if the account has `CREATE DATABASE`; otherwise an administrator must create the database once. AddressBook creates and migrates its tables automatically.

```env
DB_TYPE=mariadb
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=addressbook
DB_USER=addressbook
DB_PASSWORD=replace_with_database_password
DB_PASSWORD_FILE=
DB_CONNECTION_LIMIT=5
```

`DB_PASSWORD_FILE` overrides `DB_PASSWORD` and is useful for container secrets.

## Guarded two-way migration

Set the destination backend in `DB_TYPE`, then explicitly authorize target erasure:

```env
MIGRATE=true
MIGRATE_CONFIRM=ERASE_TARGET_DATABASE
SQLITE_MIGRATION_PATH=./data/eso-housing.sqlite
```

With `DB_TYPE=mariadb`, AddressBook copies SQLite to MariaDB. With `DB_TYPE=sqlite`, it copies MariaDB to SQLite.

The migration validates the source first, erases AddressBook application data in the target, copies persistent tables in dependency order, checks table counts, verifies house-to-destination and tour-to-stop environment consistency, writes a completion marker, and exits. All seven environment identities, composite Global Moderator grants, personal Favorites and visit states, visit timestamps, saved-search filter versions, and exact saved filter JSON are preserved. Active tour sessions and Share Pass session links are intentionally omitted because they are transient.

The current SQLite and MariaDB schema version is 6. Startup upgrades are additive and nondestructive; only the explicitly confirmed two-way transfer erases target application tables.

After success, set `MIGRATE=false` and restart. The transfer is not continuous synchronization and does not merge two live databases. Always take independent backups before enabling it.

## Direct Node deployment

1. Install Node.js 22 or newer.
2. Extract AddressBook and enter its directory.
3. Run `npm install`.
4. Copy `.env.example` to `.env` and protect it from other users.
5. Run `npm run db:init`.
6. Run `npm run db:seed`.
7. Run `npm run deploy:commands`.
8. Run `npm start`.

Use a service manager such as systemd for a production Debian installation. SQLite needs a writable data directory. MariaDB needs network access and the permissions described above.

## Docker deployment

```bash
docker compose up -d --build
```

The supplied Compose file mounts `./data` at `/app/data` for SQLite persistence. It does not run MariaDB; configure an existing MariaDB server when using that backend.

## Administration Health

Health displays backend connectivity, schema migration version, configured channel availability, registration policy, role counts, pending queues, report counts, Share Pass counts, and a backup reminder. It never displays passwords, tokens, or connection credentials.

## Troubleshooting

**The bot cannot connect to MariaDB:** Read the nested database error. `Unknown database` means the configured account could connect but the database did not exist and could not be created. Give the account `CREATE DATABASE` once or create `DB_NAME` as an administrator. A pool timeout may simply wrap that underlying error.

**A Global item is missing:** Confirm both Discord servers use the same exact ESO environment and the item is active. Approval-policy submissions remain pending until reviewed.

**A Share Pass says the environment changed:** Redeem it from a Discord server using the pass's environment, or ask the owner to create a new pass after correcting the origin guild environment.

**A tour control says the tour is closed:** The active session ended or was replaced. Start the saved tour again.

**An environment confirmation is stale:** Open Change ESO Environment again and review the new impact. AddressBook intentionally refuses an outdated preview.

**A jump fails in ESO:** Verify the owner name and ESO visitor permissions. AddressBook cannot override access restrictions.

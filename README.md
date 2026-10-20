# AddressBook

**Version 1.0.59**

Tour Share Passes now have a paginated channel picker, existing thread / forum post selection, and a channel or thread link / ID option. See INSTALL-v1.0.59.txt for upgrade steps and permission requirements.

AddressBook is a menu-driven Discord bot for Elder Scrolls Online housing discovery, saved addresses, comments, controlled sharing, and guided tours. Members start with one command:

```text
/housing
```

The home screen identifies the installed version and provides Search Houses, Register New House, Housing Tours, My AddressBook, Help, Global Moderation, and Administration when authorized.

Administration can be exposed in Discord, in the companion web console, or in both places. Set `ADMIN_INTERFACE=both` (the default), `ADMIN_INTERFACE=discord`, or `ADMIN_INTERFACE=web`. Web-only mode keeps the Discord Administration entry for tools not yet offered on the web: settings, roles, environment changes, legacy tours, featured housing, Share Pass activity, and Global Moderator workflows. It directs Health, Audit Log, Maintenance, Pending Review, Problem Reports, and Export to the web console. Web-only mode requires the web console to be enabled and configured.

First-time users can choose **Show Me Around** for a seven-screen introduction covering search and filters, flexible house registration, copy-ready ESO links, My AddressBook, tour modes, Share Passes, visibility, environment boundaries, and reporting. Each screen can open the real feature it describes after recording onboarding completion; Back from its first feature screen returns to the same introduction page, including from Search after clearing filters. Help can replay the introduction later. **Help & Learning** also includes a release-specific **What’s New** guide and shortcuts to Search, Houses, Tours, Sharing, and Administration. Acknowledging release notes does not reset or alter the original completed/skipped onboarding status.

## ESO environments

Every Discord server must choose one ESO environment the first time `/housing` is used:

- PC NA
- PC EU
- Xbox NA
- Xbox EU
- PlayStation NA
- PlayStation EU
- PTS

Any member may complete the initial selection; the first completed selection wins. A Housing Moderator can later preview and confirm an environment change in Administration. The preview includes Server records plus Global and Private records whose `origin_guild_id` is this guild; unrelated Private records from other guilds remain where they are. A confirmed change also revalidates tour stops and revokes affected Share Passes.

Visibility and environment are separate concepts. The UI always lists visibility as **Global, Server, Private**:

- **Global** is shared only with Discord servers configured for the same exact ESO environment.
- **Server** is limited to the current Discord server and its selected ESO environment.
- **Private** belongs to one Discord user and is available only in Discord servers using the same ESO environment.

For example, a PC NA Global house, tour, comment thread, Share Pass, active run, or moderator grant is never returned in PC EU or on another platform.

## Houses and search

Search Houses initially displays all accessible houses and then lets the member open Filters. Available filters include house or nickname, owner, tags or themes, zone, architectural style, ESO classification, size or type, visibility, Non-Player Homes, and houses not already used by an applicable Server or Global tour. Attribute values are paginated so Discord's 25-option component limit does not discard results.

Filtered results can be saved by name and reopened from **My AddressBook → Saved Searches**. Saved searches can be run, renamed, replaced with the current filters, or deleted. They store criteria rather than result IDs, so every run applies the current Discord server, ESO environment, and access permissions. Invalid or future-version filter data fails closed instead of becoming an unfiltered search.

**Surprise Me** selects from the complete accessible result set, including results beyond the current 25-item Discord page. **Another Surprise** avoids immediately repeating the same destination when another result is available.

Register New House accepts an official house name or ID, an ESO Housing Link, a Jump to Specific House command, or the owner and numeric house ID portion such as:

```text
("@HouseOwner", 62)
```

The review screen shows the parsed destination before saving. House cards identify the submitter, visibility, visible associated tours, and these copy-friendly values in order:

```text
Jump in ESO
```

```text
Unfurnished Preview
```

```text
Housing Link
```

AddressBook cannot bypass ESO visitor permissions.

Comments attach to the environment-specific ESO destination, not to one visibility entry. Matching Global, Server, and Private entries for the same ESO owner and official house share their comment history inside that environment.

Every accessible player or Non-Player house includes **Personal Actions**. A member can independently mark a destination as a Favorite and set one visit state: Want to Visit, Visited, or neither. These private preferences do not change house visibility or grant access. My AddressBook provides paginated Favorites, Want to Visit, Visited, and Saved Searches lists, and inaccessible destinations are removed from personal list results at read time.

## Tours

- A **Global Tour** is available only in the same ESO environment and contains Global houses from that environment.
- A **Server Tour** contains Global houses from the same environment and Server houses from the current Discord server.
- A **Private Tour** contains accessible Global and Server houses plus the creator's Private houses, all in one environment. Stop insertion enforces the creator's ownership of Private houses and the tour's source guild for Server houses. Search-result bulk actions recheck selected houses before creating or extending a tour; changed results require a fresh search.

Browse Tours keeps the selected list active and provides Previous Tour and Next Tour controls on each tour card. Starting a tour first opens Tour Preflight, which reports the route's visibility, ESO environment, stop count, accessibility warnings, and any blocking missing, archived, duplicate, wrong-environment, or visibility-incompatible stops. Warnings allow the tour to proceed; blocking problems must be corrected first.

Self Paced tours create a private active run for one member. Shared tours post the current stop in a channel, but only the initiating leader can navigate or end the run. Starting either mode immediately shows the complete current house card with copy-ready ESO links and Previous/Next controls. More Details shows full catalog metadata—including standard and ESO+ furnishing and collectible limits—and remains expanded while moving between stops. Comments and Show Tour List return to the same stop and expanded/compact state. When the current viewer may edit the saved house, Edit House returns to the same tour stop and detail state after saving. Share Pass tours create an independent ephemeral Self Paced run for each visitor.

## Tour events, Featured Housing, and progress

Tour creators and authorized Housing Moderators can schedule events from a tour's management screen. Events use the guild's configured timezone, support Going and Interested RSVPs, and can send optional direct-message reminders to people who RSVP. Hosts and moderators can edit, start, cancel, or complete events; completing an event closes its shared tour session. Event cards display the optional description. New event titles are limited to 200 characters and descriptions to 2,000 characters; older or imported oversized values are safely shortened for Discord display.

Upcoming Events shows up to five events per page, each with its own Open button. Pages advance by five events without skipping the next event. Event detail cards include Back to Upcoming Events, which returns to the page you were browsing even after RSVP, reminder, event edit, or tour preflight actions. The list remains usable when no events are scheduled.

Opening or editing an event reads your saved Going/Interested RSVP and DM reminder preference so the controls reflect your choices. An event that has already started keeps its In progress state and Complete action when a reminder preference changes.

Housing Moderators can curate up to five eligible Global or Server player houses and tours as Featured Housing. Featured House cards include copy-ready Jump in ESO and Housing Link values. Non-Player/base houses are never selected. Featured entries are limited to the guild's exact ESO environment and are automatically hidden when the underlying content is no longer active, visible, or eligible. If a Server house or tour moves to another Discord guild, its old guild's Featured list stops displaying it. When a guild has no active Featured houses, the engagement worker automatically chooses up to five eligible Server or Global player houses at random for that guild and environment. Existing eligible Featured houses are never replaced by automation; manually selected and automatically selected entries remain visible until removed, expired, or no longer eligible.

Self-Paced starts are recorded in My AddressBook → Tour Progress. Members can resume, move to the previous or next stop, restart a run, and review completion history. When several runs exist, active and completed routes are paginated five at a time, with a working Resume or View Route button for every entry. Resuming a run from a later active list page preserves that page through stop controls, details, comments, and the tour list; Back returns to the same active list page. Completion History also retains the active list page while browsing completed routes and houses, so returning to Tour Progress resumes at that page. The current progress card shows the complete house, population limit, owner, tour-specific notes, jump values, and optional expanded catalog details without requiring a separate Open House action.

Completion History remembers its list page while a member opens a route, browses its completed stops, or opens a completed house. Back returns to the page of routes they came from.

## Share Passes and copying

A House or Tour Share Pass uses an opaque token; only its hash is stored. Reposting rotates the token, and revoking a pass blocks future access. A private house can be shared once without changing its normal visibility.

When a recipient sees someone else's Private house only through a Share Pass, **Copy House** can prefill nickname, description, and tags for review. The recipient chooses Global, Server, or Private only when their normal permissions allow it. A copied tour becomes a new Private tour; inaccessible stops are copied as Private houses in one transaction.

House Share Pass visitors can open and add comments, toggle More Details, and return from Copy House to the same private view. Each action verifies that the pass is still active and valid for the current ESO environment; a revoked pass cannot submit a comment.

Visitors running a private Tour Pass can return from its tour list to the current stop, read and add comments on a Private house stop, and move from Tour Information into the copy preview in the same private screen. Stop comments verify that the pass and session are still active before opening or saving.

Tour Information lists stops as **Nickname (Official House) — @Owner** when a nickname exists, or **Official House — @Owner** otherwise. A tour-specific stop title takes the nickname position. Active progress summaries, completed routes, and their house picker use the same naming order.

When a Tour Pass session is left behind after its pass link closes, its old Tour List, Details, Comments, Next, and Previous buttons close that session without displaying the private route. Session advancement checks the pass link again within its transaction.

The pass creation limit applies when issuing a new Share Pass. Viewing a house, reading comments, toggling details, reviewing a house copy, and moving between Tour Information and a tour copy preview do not consume that limit. Screen lookups have a separate, higher limit (60 per five minutes by default); set `SHARE_PASS_ACCESS_RATE_LIMIT` and `SHARE_PASS_ACCESS_RATE_WINDOW_SECONDS` if needed. Revocation and environment checks still apply on every view.

Share Passes are bound to one ESO environment. Changing a guild's environment revokes affected passes and closes active pass-derived sessions.

## Moderation and permissions

Guild administrative functions accept up to 25 configured roles through Discord's searchable native role picker. Holding any configured role grants that function.

- **Housing Moderator** manages Server content, pending review, server settings, reports, and guild-level tour privileges.
- **Housing Trusted Submitter** receives trusted submission treatment without general administration access.
- **Housing Tours** may start Shared Server tours without receiving moderation access.
- **Global Housing Moderator** manages Global content only in each specifically approved ESO environment.

If no Housing Moderator role is configured, members with Discord Administrator permission have bootstrap access to configure it.

Global Moderator requests are submitted from Global Moderation. IDs in `GLOBAL_MODERATOR_APPROVER_USER_IDS` are bot-wide approvers: they can review all environment queues, but every resulting moderator grant is tied to one ESO environment. The setting accepts comma-separated Discord user IDs:

```env
GLOBAL_MODERATOR_APPROVER_USER_IDS=123456789012345678,234567890123456789
```

## Database support

AddressBook requires Node.js 22 or newer. SQLite is the default and uses Node's built-in SQLite support. MariaDB is optional.

## Version 1.0 operations

Version 1.0 adds the operational tools needed to maintain a long-running AddressBook installation:

- **Audit Log** provides Housing Moderators with a paginated, guild-scoped history of changes. Action and Entity type filters narrow the results and totals; **Download matching audit entries (CSV)** exports all matching entries, including entries beyond the visible page, with stable IDs and readable identity fields.
- **Backup & Export** provides a portable JSON export and SQLite/MariaDB backup guidance for the current guild and exact ESO environment. The JSON includes Private houses and tours originating in this guild, with their comments and stops. It excludes unrelated guilds and environments and is not a complete database backup; older Private entries without an originating guild remain in a full database backup.
- **Administration Health** reports reminder delivery health, orphaned tour stops, duplicate destinations, environment mismatches, stale progress, stale houses, and duplicate-entry groups without exposing secrets or private event content.
- **Maintenance** lets moderators mark catalog houses verified and merge only exact-context duplicate saved entries. Merges preserve comments and compatible tour stops, archive the redundant entry, and write an audit record.

Maintenance repairs are transactional. AddressBook never merges entries merely because they share an ESO owner or house number; the destination, visibility, guild or owner context, and active status must all match.

### Optional web administration console

AddressBook remains Discord-first for members. An optional web console is available for Housing Moderators who prefer larger tables and easier administrative review. It provides Overview, Audit Log, Maintenance, Pending Review, Problem Reports, and Backup & Export pages without creating a second member workflow. It uses Discord OAuth2 and rechecks guild roles and the exact ESO environment server-side. Guild exports include Private records originating in that guild; ordinary search still limits Private entries to their owner.

Use HTTP only on the same machine through loopback; use HTTPS for remote access:

```env
WEB_ADMIN_ENABLED=true
ADMIN_INTERFACE=both
WEB_ADMIN_HOST=127.0.0.1
WEB_ADMIN_PORT=8787
WEB_SESSION_SECRET=use-a-long-random-secret
DISCORD_OAUTH_CLIENT_ID=your_discord_application_id
DISCORD_OAUTH_CLIENT_SECRET=your_discord_oauth_secret
DISCORD_OAUTH_REDIRECT_URI=https://admin.example.com/auth/callback
```

Register the exact redirect URI in the Discord application. Keep the console bound to localhost when using a reverse proxy, and do not expose it without HTTPS and a strong session secret. The Administration Overview now shows read-only integrity, freshness, duplicate, and reminder-health metrics. Export Data provides a read-only explanation page before downloading a JSON snapshot scoped to the current guild and exact ESO environment; Private records originating in that guild are included. Pending Review lists eligible Server and Global submissions in groups of 25 with Previous and Next controls. Approval or rejection returns to the same page. Problem Reports lists the selected guild and environment's actionable reports in groups of 25 and supports Mark reviewing, Resolve, and Dismiss. Private Share Pass reports remain redacted unless the moderator already has normal access to their target. Maintenance supports marking stale houses verified or merging exact-context duplicate entries. The Audit Log is paginated with explicit Previous and Next navigation plus Action and Entity type filters that now apply to the displayed entries and total; audit entries are scoped to the current guild, including historical entries from earlier ESO environments. Download matching audit entries (CSV) exports every matching entry across pages with spreadsheet-safe IDs and text. Every action requires a signed CSRF token, current Housing Moderator access, and a confirmation form; actions are audited with readable actor identity, guild, environment, and record identity. Private duplicate merges are available for entries originating in the current guild with the same owner and ESO environment. Private submissions still bypass the web review queue.

To use the console on the same computer as AddressBook, set `DISCORD_OAUTH_REDIRECT_URI=http://127.0.0.1:8787/auth/callback` and register that **exact** redirect URI in the Discord application's OAuth2 settings. Copy `.env.example` to `.env`, enable `WEB_ADMIN_ENABLED=true`, enter a long random `WEB_SESSION_SECRET`, and fill in `DISCORD_OAUTH_CLIENT_ID` and `DISCORD_OAUTH_CLIENT_SECRET`. Keep `ADMIN_INTERFACE=both` to offer the web tools in both places, or choose `web` to move the six migrated tools to the browser while retaining Discord-only administration in the bot. Start the bot with `npm start` and open `http://127.0.0.1:8787/admin` on that computer. Sign in with a Discord account that has the configured Housing Moderator role. If you moderate more than one guild, AddressBook displays a Choose Discord Server page showing each server and its ESO environment before loading administration. The selected server is stored in the signed session; use Change Server in the navigation to switch later. The server, role, and environment are rechecked on every request. The web server starts after the bot connects to Discord.

After Discord sign-in, AddressBook returns only to local `/admin` pages. External or malformed return paths are replaced with `/admin`, keeping the sign-in callback on the administration console.

With Docker Compose, use the same `.env` settings and run `docker compose up -d --build`. Compose publishes the configured web port only on the Docker host's `127.0.0.1`, while binding the listener inside the container. Open `http://127.0.0.1:8787/admin` **on the Docker host**. For access from another computer, publish it through an HTTPS reverse proxy and register the proxy's exact `https://…/auth/callback` URI in Discord; keep the Compose host port bound to loopback. If `WEB_ADMIN_PORT` differs from `8787`, use that port in the local URL and redirect URI.

For occasional access from your own computer to a remote server, open an SSH tunnel with `ssh -L 8787:127.0.0.1:8787 your-user@your-server`, keep that connection open, and visit `http://127.0.0.1:8787/admin` on your computer. Register the loopback redirect URI shown above; the browser's OAuth callback travels through the tunnel. Use the configured web port in both places if it is not `8787`.

```env
DB_TYPE=sqlite
DATABASE_PATH=./data/eso-housing.sqlite
```

For MariaDB, set `DB_TYPE=mariadb` and the `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and password settings. AddressBook creates the configured database when it is missing if the database account has `CREATE DATABASE` permission, then applies the required schema.

### Guarded database transfer

`MIGRATE` performs a one-time, destructive transfer to the backend named by `DB_TYPE`:

- `DB_TYPE=mariadb`: SQLite to MariaDB
- `DB_TYPE=sqlite`: MariaDB to SQLite

```env
MIGRATE=true
MIGRATE_CONFIRM=ERASE_TARGET_DATABASE
```

AddressBook validates the source before erasing the destination, copies persistent data in dependency order, verifies table counts and environment relationships, writes a completion marker, and exits. Active tour sessions and Share Pass session links are intentionally not transferred. Set `MIGRATE=false` before normal restart. Always make an independent backup first.

Schema version 10 records explicit Private Shared tour authorization at launch. Existing Private Shared sessions must be restarted after upgrading. It preserves versioned Help & Learning acknowledgement state, guild timezones, scheduled tour events, RSVP/reminder delivery records, Featured Housing, and persistent Self-Paced progress for both SQLite and MariaDB. It also reconciles readable identity columns on installations that recorded an earlier migration before every companion field was defined. The startup repair is additive and does not erase existing houses or tours. Guarded two-way transfer preserves Favorites, visit state and timestamps, saved-search versions, exact saved filter JSON, event/progress records, learning acknowledgement state, and exact ESO environment relationships.

## Installation

1. Install Node.js 22 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and enter the Discord and database settings.
4. Run `npm run db:init`.
5. Run `npm run db:seed`.
6. Run `npm run deploy:commands`.
7. Run `npm start`.

Use `DEPLOY_GLOBAL=false` with `DISCORD_GUILD_ID` for quick development command updates. Use `DEPLOY_GLOBAL=true` for global command registration. `DISCORD_CLEANUP_GUILD_IDS` may list additional legacy guild command locations to clear.

For Docker:

```bash
docker compose up -d --build
```

The supplied Compose configuration persists SQLite under `./data`. MariaDB itself is not bundled.

## Legacy data

Upgrading an older database can leave records without a known ESO environment. The first guild selection deterministically claims eligible guild-originated Server and Global records. My AddressBook offers a separate preview and confirmation to assign a member's remaining unassigned Private houses and tours to the current environment.

Housing Moderators can open **Administration → Legacy Tours** to recover Unassigned Server tours belonging to that Discord server and Global tours originating there. Recovery previews retained and removed stops, rejects stale confirmations, and records the action in the audit log. Private tours are never exposed to moderators, and tours without provable guild ownership cannot be claimed. Incompatible stops are removed only after confirmation and the remaining route is renumbered.

## Data and privacy model

- Global, Server, and Private records never cross ESO environments.
- Server records never cross Discord guilds.
- Private records remain owner-only except through a revocable Share Pass.
- Environment changes use a fresh impact calculation and reject stale confirmation screens.
- Readable Discord names are stored beside important IDs and refreshed when newer identity information is observed.
- Active tour sessions are transient and are deleted when ended or replaced.
- Secrets and database credentials are never displayed by Administration Health.

Browse Tours keeps its selected tour and navigation controls when you return from Start a Tour preflight.

Featured houses have Open House buttons for details and comments. Returning from Comments preserves expanded house details, and Back returns to the originating Featured Housing screen. In browsable house lists, expanded details also persist when using Previous and Next, including for Non-Player homes. Opening a saved result checks current visibility, guild, ESO environment, and record status so stale list entries cannot expose inaccessible houses. Surprise Me also rechecks each pick, skips inaccessible saved houses, and shows an empty state when no accessible result remains. Featured tours have Open Tour buttons. Tour cards and Start a Tour preflight return to the Featured Housing screen where they were opened.

Reordering Featured Housing retains an entry’s expiration date.

Featured Housing reorder controls stay with the selected entry after each move and stop at the end of its own House or Tour list. Changing an expiration keeps the entry in position and selected.

See `docs/AddressBook-v1.0.0-Current-State.md` and `AddressBook_v1.0.58_User_Admin_Guide.docx` for the complete user and administrator guide.
#   A d d r e s s B o o k  
 
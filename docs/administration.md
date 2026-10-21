# Administration and operations

[Back to README](../README.md)

## Administration interface

Administration can be exposed in Discord, in the companion web console, or in both places. Set `ADMIN_INTERFACE=both` (the default), `ADMIN_INTERFACE=discord`, or `ADMIN_INTERFACE=web`. Web-only mode keeps the Discord Administration entry for tools not yet offered on the web: settings, roles, environment changes, legacy tours, featured housing, Share Pass activity, and Global Moderator workflows. It directs Health, Audit Log, Maintenance, Pending Review, Problem Reports, and Export to the web console. Web-only mode requires the web console to be enabled and configured.


## Moderation and permissions

Tour editing uses AddressBook's permissions. A configured Server Housing Moderator can edit other creators' Server tours only in that tour's own Discord server. An approved Global Housing Moderator can edit Global tours and other servers' Server tours, within the ESO environment covered by their grant. Use **Housing Tours → Edit Tour** to find these administrative editing targets. Private tours and houses remain accessible only to their creator/owner, unless that owner explicitly shares them through a Share Pass. Administrator roles never override this restriction. Global permissions are refreshed on each interaction, including saving an edit form, so revocation blocks previously opened editors.

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


## Operational tools

These tools help maintain a long-running AddressBook installation:

- **Audit Log** provides Housing Moderators with a paginated, guild-scoped history of changes. Action and Entity type filters narrow the results and totals; **Download matching audit entries (CSV)** exports all matching entries, including entries beyond the visible page, with stable IDs and readable identity fields.
- **Backup & Export** provides a portable JSON export and SQLite/MariaDB backup guidance for the current guild and exact ESO environment. The JSON includes accessible Server and Global records, with their comments and stops; all Private houses and tours are excluded. It excludes unrelated guilds and environments and is not a complete database backup; older Private entries without an originating guild remain in a full database backup.
- **Administration Health** reports reminder delivery health, orphaned tour stops, duplicate destinations, environment mismatches, stale progress, stale houses, and duplicate-entry groups without exposing secrets or private event content.
- **Maintenance** lets moderators mark catalog houses verified and merge only exact-context duplicate saved entries. Merges preserve comments and compatible tour stops, archive the redundant entry, and write an audit record.

Maintenance repairs are transactional. AddressBook never merges entries merely because they share an ESO owner or house number; the destination, visibility, guild or owner context, and active status must all match.

### Optional web administration console

AddressBook remains Discord-first for members. An optional web console is available for Housing Moderators who prefer larger tables and easier administrative review. It provides Overview, Audit Log, Maintenance, Pending Review, Problem Reports, and Backup & Export pages without creating a second member workflow. It uses Discord OAuth2 and rechecks guild roles and the exact ESO environment server-side. Guild exports exclude Private records; only owners can view their Private houses and tours.

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

Register the exact redirect URI in the Discord application. Keep the console bound to localhost when using a reverse proxy, and do not expose it without HTTPS and a strong session secret. The Administration Overview now shows read-only integrity, freshness, duplicate, and reminder-health metrics. Export Data provides a read-only explanation page before downloading a JSON snapshot scoped to the current guild and exact ESO environment; Private records are excluded. Pending Review lists eligible Server and Global submissions in groups of 25 with Previous and Next controls. Approval or rejection returns to the same page. Problem Reports lists the selected guild and environment's actionable reports in groups of 25 and supports Mark reviewing, Resolve, and Dismiss. Private Share Pass reports remain redacted unless the moderator already has normal access to their target. Maintenance supports marking stale houses verified or merging exact-context duplicate entries. The Audit Log is paginated with explicit Previous and Next navigation plus Action and Entity type filters that now apply to the displayed entries and total; audit entries are scoped to the current guild, including historical entries from earlier ESO environments. Download matching audit entries (CSV) exports every matching entry across pages with spreadsheet-safe IDs and text. Every action requires a signed CSRF token, current Housing Moderator access, and a confirmation form; actions are audited with readable actor identity, guild, environment, and record identity. Maintenance excludes Private houses and cannot verify or merge them. Private submissions still bypass the web review queue.

To use the console on the same computer as AddressBook, set `DISCORD_OAUTH_REDIRECT_URI=http://127.0.0.1:8787/auth/callback` and register that **exact** redirect URI in the Discord application's OAuth2 settings. Copy `.env.example` to `.env`, enable `WEB_ADMIN_ENABLED=true`, enter a long random `WEB_SESSION_SECRET`, and fill in `DISCORD_OAUTH_CLIENT_ID` and `DISCORD_OAUTH_CLIENT_SECRET`. Keep `ADMIN_INTERFACE=both` to offer the web tools in both places, or choose `web` to move the six migrated tools to the browser while retaining Discord-only administration in the bot. Start the bot with `npm start` and open `http://127.0.0.1:8787/admin` on that computer. Sign in with a Discord account that has the configured Housing Moderator role. If you moderate more than one guild, AddressBook displays a Choose Discord Server page showing each server and its ESO environment before loading administration. The selected server is stored in the signed session; use Change Server in the navigation to switch later. The server, role, and environment are rechecked on every request. The web server starts after the bot connects to Discord.

After Discord sign-in, AddressBook returns only to local `/admin` pages. External or malformed return paths are replaced with `/admin`, keeping the sign-in callback on the administration console.

With Docker Compose, use the same `.env` settings and run `docker compose up -d --build`. Compose publishes the configured web port only on the Docker host's `127.0.0.1`, while binding the listener inside the container. Open `http://127.0.0.1:8787/admin` **on the Docker host**. For access from another computer, publish it through an HTTPS reverse proxy and register the proxy's exact `https://…/auth/callback` URI in Discord; keep the Compose host port bound to loopback. If `WEB_ADMIN_PORT` differs from `8787`, use that port in the local URL and redirect URI.

For occasional access from your own computer to a remote server, open an SSH tunnel with `ssh -L 8787:127.0.0.1:8787 your-user@your-server`, keep that connection open, and visit `http://127.0.0.1:8787/admin` on your computer. Register the loopback redirect URI shown above; the browser's OAuth callback travels through the tunnel. Use the configured web port in both places if it is not `8787`.

```env
DB_TYPE=sqlite
DATABASE_PATH=./data/eso-housing.sqlite
```

For MariaDB, set `DB_TYPE=mariadb` and the `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and password settings. AddressBook creates the configured database when it is missing if the database account has `CREATE DATABASE` permission, then applies the required schema.

## Guarded database transfer

`MIGRATE` performs a one-time, destructive transfer to the backend named by `DB_TYPE`:

- `DB_TYPE=mariadb`: SQLite to MariaDB
- `DB_TYPE=sqlite`: MariaDB to SQLite

```env
MIGRATE=true
MIGRATE_CONFIRM=ERASE_TARGET_DATABASE
```

AddressBook validates the source before erasing the destination, copies persistent data in dependency order, verifies table counts and environment relationships, writes a completion marker, and exits. Active tour sessions and Share Pass session links are intentionally not transferred. Set `MIGRATE=false` before normal restart. Always make an independent backup first.

Schema version 10 records explicit Private Shared tour authorization at launch. Existing Private Shared sessions must be restarted after upgrading. It preserves versioned Help & Learning acknowledgement state, guild timezones, scheduled tour events, RSVP/reminder delivery records, Featured Housing, and persistent Self-Paced progress for both SQLite and MariaDB. It also reconciles readable identity columns on installations that recorded an earlier migration before every companion field was defined. The startup repair is additive and does not erase existing houses or tours. Guarded two-way transfer preserves Favorites, visit state and timestamps, saved-search versions, exact saved filter JSON, event/progress records, learning acknowledgement state, and exact ESO environment relationships.


## Legacy data

Upgrading an older database can leave records without a known ESO environment. The first guild selection deterministically claims eligible guild-originated Server and Global records. My AddressBook offers a separate preview and confirmation to assign a member's remaining unassigned Private houses and tours to the current environment.

Housing Moderators can open **Administration → Legacy Tours** to recover Unassigned Server tours belonging to that Discord server and Global tours originating there. Recovery previews retained and removed stops, rejects stale confirmations, and records the action in the audit log. Private tours are never exposed to moderators, and tours without provable guild ownership cannot be claimed. Incompatible stops are removed only after confirmation and the remaining route is renumbered.


## Private content in administrative tools

Administrator roles never grant access to another creator's Private tours or houses. Administrative JSON exports omit all Private records and their comments/stops, and do not embed audit history. Explicit owner-scoped exports can include only that owner's Private records.

The audit UI and CSV export show only entries whose targets can be verified as current Server/Global records for this server, plus guild actions. They use current public names and omit historical free-form details; deleted, Private, pass, report, and unknown targets are omitted because their metadata cannot be safely disclosed. Private report context is redacted independently of authority over a related public house. Full database backups still contain Private data and must be handled separately from role-based application exports.

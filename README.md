# HearthBound

Formerly **AddressBook**; the repository is now [HearthBound](https://github.com/skperdue68/HearthBound). `/housing` remains a compatibility alias.

**Version 1.0.70** · A menu-driven Discord bot for Elder Scrolls Online housing.

Discover houses, save addresses, leave comments, and organize guided tours. Members access everything through one command:

```text
/hearth
```

[Installation](#installation) · [Configuration](#configuration) · [Features](#features) · [Documentation](#documentation)

## Features

- **Housing discovery:** Search by house, owner, tags, zone, style, size, and visibility, or choose Random House from Home.
- **My Address Book:** Save houses, Favorites, visit status, and reusable searches.
- **Housing tours:** Create Global, Server, or Private routes; run them self-paced or lead a shared tour.
- **Share Passes:** Share revocable access to a house or tour. Choose a channel, optionally select an existing active thread, then confirm before posting.
- **House galleries:** Upload up to eight screenshots from the web or Discord, choose a cover, and share the details of each build. [Upgrade and storage setup](docs/upgrade-v1.0.70.md).
- **Featured Housing:** Four Featured Houses rotate every seven days with a capped engagement boost; manually curate houses between refreshes and keep Featured Tours selected.
- **Member web portal:** Sign in with Discord to register houses, manage your collection and edit tours with drag/drop and keyboard ordering. Your Access shows each effective role and its server/environment.
- **Community insights:** Explore registration/member/ESO-owner/tour statistics and newest-first global Discord/web activity, with member and originating server names. Private activity is generic.
- **Official house catalog:** Only configured bot owners can add newly released houses through Discord or the web, without a code release.
- **Administration:** Review submissions and reports, manage roles and Server Moderator requests, inspect audit history, and export data through Discord or an optional web console.

Home offers Search Houses, Search Housing Tours, Register New House, Random House, Featured Housing, My Address Book, authorized Administration, and Support & Access.

Common house actions are available directly: Favorite, visit status, Add to a Tour, and Add Comment. My Address Book combines submitted and intentionally saved places. **Support & Access** provides access requests, feedback, and documentation.

## Installation

Requires **Node.js 22 or newer** and a Discord bot application. SQLite is the default database; MariaDB is also supported.

1. Download or clone this repository and open its application directory.
2. Run `npm ci`.
3. Copy [`.env.example`](.env.example) to `.env` and enter your Discord token, application ID, guild ID, and database settings.
4. Initialize and seed the database:

   ```sh
   npm run db:init
   npm run db:seed
   ```

5. Register the command and start the bot:

   ```sh
   npm run deploy:commands
   npm start
   ```

6. Run `/hearth` in Discord and select the server's ESO environment.

For Docker, configure `.env`, then run:

```sh
docker compose up -d --build
```

Compose persists SQLite data under `./data`. MariaDB is not bundled. See the [administration guide](docs/administration.md) for web console access with Docker.

Upgrading an existing installation? Back up your application, `.env`, and database first. See the [v1.0.62 Linux/production upgrade instructions](docs/upgrade-v1.0.62.md).

## Configuration

Use [`.env.example`](.env.example) as the complete settings reference.

| Setting | Purpose |
| --- | --- |
| `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` | Bot credentials and application ID |
| `DISCORD_GUILD_ID`, `DEPLOY_GLOBAL` | Guild command deployment for development, or global registration |
| `DB_TYPE` | `sqlite` (default) or `mariadb` |
| `DATABASE_PATH` | SQLite database location |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | MariaDB connection settings |
| `ADMIN_INTERFACE` | `both` (default), `discord`, or `web` |
| `WEB_ADMIN_ENABLED` | Existing web-console switch; OAuth and session settings are also required |
| `WEB_PORTAL_ENABLED` | Enable the member portal even when administration remains in Discord |
| `WEB_PORTAL_URL` | Public portal URL used by the Open Web Portal button in Discord |
| `WEB_SESSION_DAYS` | Remember Discord sign-in for this many days (default 30; range 1–365) |
| `BOT_OWNER_IDS` | Comma/space-separated Discord user IDs with owner capabilities, including catalog additions |

For quick development command updates, use `DEPLOY_GLOBAL=false` with `DISCORD_GUILD_ID`. Use `DEPLOY_GLOBAL=true` for global registration. `DISCORD_CLEANUP_GUILD_IDS` can identify additional legacy guild command locations to clear.

Web-only administration requires a configured web console and retains Discord-only tools in the bot. See [administration and operations](docs/administration.md) for OAuth setup, roles, backups, and database transfers.

## Visibility and privacy

Each Discord server selects an ESO environment: PC NA/EU, Xbox NA/EU, PlayStation NA/EU, or PTS. Data stays within that exact environment.

- **Global:** Available across Discord servers using the same ESO environment.
- **Server:** Available only in the originating Discord server and environment.
- **Private:** Owner-only, with revocable access available through Share Passes.

HearthBound cannot bypass ESO visitor permissions. Environment changes require confirmation and revoke affected passes. See the [member guide](docs/member-guide.md) for detailed access rules.

## Documentation

- [Member guide](docs/member-guide.md): search, houses, tours, Featured Housing, Share Passes, and privacy.
- [Administration and operations](docs/administration.md): permissions, web console, databases, exports, and legacy recovery.
- [Production upgrade instructions](docs/upgrade-v1.0.62.md): Linux deployment, schema 12, verification, and recovery.
- [HearthBound user and administrator guide (Word)](HearthBound_User_Admin_Guide.docx): current Discord, member portal, web administration, and operations.
- [Current feature reference](docs/HearthBound-current-state.md): supported web and Discord workflows and access rules.
- [Historical documentation](docs/historical-documentation.md): older AddressBook releases and design records.

## Development

Run the automated checks with `npm test`. Destination tests simulate Discord requests; verify the channel and thread flow in a test server with your actual permissions before deployment.

## Expanded web workflows

See the [HearthBound web workflow guide](docs/web-workflows.md) for personal collections, saved searches, comments, reports, deletion, self-paced tours, sharing and administration. Controls and navigation follow current HearthBound permissions; other members’ Private records remain protected.

### Catalog management update

Bot owners can now edit official houses, classification capacity profiles and reusable metadata values. See the [schema 13 upgrade guide](docs/upgrade-v1.0.63.md) before deploying.


Members can send ideas and bug reports from **Send feedback** on the website or under **Support & Access**. Configured bot owners review submissions in the **Feedback inbox**; members see only their own feedback and status. [Upgrade to 1.0.64 (schema14)](docs/upgrade-v1.0.64.md).


The [October27 UESP catalog audit](docs/catalog-audit-2026-10-27.md) adds Grotto of Desires131 and Sheogorad Chateau132 and fills verified metadata gaps. [SQLite/MariaDB SQL and Linux instructions](docs/catalog-import-2026-10-27.md) also cover existing owner-added records. Unknown prices and source conflicts remain documented rather than guessed.

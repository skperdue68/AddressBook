# AddressBook

**Version 1.0.60** · A menu-driven Discord bot for Elder Scrolls Online housing.

Discover houses, save addresses, leave comments, and organize guided tours. Members access everything through one command:

```text
/housing
```

[Installation](#installation) · [Configuration](#configuration) · [Features](#features) · [Documentation](#documentation)

## Features

- **Housing discovery:** Search by house, owner, tags, zone, style, size, and visibility, or try Surprise Me.
- **My AddressBook:** Save houses, Favorites, visit status, and reusable searches.
- **Housing tours:** Create Global, Server, or Private routes; run them self-paced or lead a shared tour.
- **Share Passes:** Share revocable access to a house or tour. Choose a channel, optionally select an existing active thread, then confirm before posting.
- **Featured Housing:** Featured Houses rotate every seven days; manually curate houses between refreshes and keep Featured Tours selected.
- **Administration:** Review submissions and reports, manage roles and Server Moderator requests, inspect audit history, and export data through Discord or an optional web console.

First-time users can take **Show Me Around**. **Help & Learning** provides feature guides and release notes.

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

6. Run `/housing` in Discord and select the server's ESO environment.

For Docker, configure `.env`, then run:

```sh
docker compose up -d --build
```

Compose persists SQLite data under `./data`. MariaDB is not bundled. See the [administration guide](docs/administration.md) for web console access with Docker.

Upgrading an existing installation? Back up your application, `.env`, and database first. See the [v1.0.60 upgrade instructions](INSTALL-v1.0.60.txt).

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
| `WEB_ADMIN_ENABLED` | Enable the optional web console; OAuth and session settings are also required |

For quick development command updates, use `DEPLOY_GLOBAL=false` with `DISCORD_GUILD_ID`. Use `DEPLOY_GLOBAL=true` for global registration. `DISCORD_CLEANUP_GUILD_IDS` can identify additional legacy guild command locations to clear.

Web-only administration requires a configured web console and retains Discord-only tools in the bot. See [administration and operations](docs/administration.md) for OAuth setup, roles, backups, and database transfers.

## Visibility and privacy

Each Discord server selects an ESO environment: PC NA/EU, Xbox NA/EU, PlayStation NA/EU, or PTS. Data stays within that exact environment.

- **Global:** Available across Discord servers using the same ESO environment.
- **Server:** Available only in the originating Discord server and environment.
- **Private:** Owner-only, with revocable access available through Share Passes.

AddressBook cannot bypass ESO visitor permissions. Environment changes require confirmation and revoke affected passes. See the [member guide](docs/member-guide.md) for detailed access rules.

## Documentation

- [Member guide](docs/member-guide.md): search, houses, tours, Featured Housing, Share Passes, and privacy.
- [Administration and operations](docs/administration.md): permissions, web console, databases, exports, and legacy recovery.
- [Upgrade instructions](INSTALL-v1.0.60.txt): installing v1.0.60 and its additive schema update.
- [User and administrator guide (Word)](AddressBook_v1.0.58_User_Admin_Guide.docx): general operation, written for v1.0.58.
- [Detailed current-state reference](docs/AddressBook-v1.0.0-Current-State.md): additional technical and behavioral detail.

## Development

Run the automated checks with `npm test`. Destination tests simulate Discord requests; verify the channel and thread flow in a test server with your actual permissions before deployment.

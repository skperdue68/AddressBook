# Upgrade to Hearthbound 1.0.62 (schema 12)

Hearthbound is the new name for AddressBook. The repository, existing database, data paths, environment variables and deployment service can retain their existing names. `/hearth` is the main Discord command; `/housing` remains an alias. No production database was changed while developing this PR.

## Before starting the upgraded release
1. Stop the existing bot using your normal Linux service/container controls. Run only one instance while upgrading.
2. Back up the live database on the machine that hosts it, plus your deployment `.env` and current application release. Verify the backup can be read/restored. Do not use the old Windows development database.
   - MariaDB: use `mariadb-dump --single-transaction --routines --triggers --databases YOUR_DATABASE > hearthbound-before-v1.0.62.sql` with credentials supplied through your secure client configuration or an interactive password prompt. Run it on a machine with authorized access to the live database. Check the exit status and keep an independent copy.
   - SQLite: with the bot stopped, copy the configured database file and any companion WAL/SHM files, or use SQLite's backup facility. Keep the original path and volume mount.
3. Pull the merged release branch on the Linux application host, or build the PR branch in an isolated staging deployment first. Run `npm ci` (or rebuild your existing Docker image).
4. Preserve the existing `DB_TYPE`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`/`DB_PASSWORD_FILE` or `DATABASE_PATH`. The database host can remain a separate machine. **Keep `MIGRATE=false`**: this upgrade does not transfer or replace your database.

## Automatic database upgrade
Pulling files alone does not change the database. On the next start, the existing startup migration system applies schema 12 to the configured live database before the bot/web listener starts. It adds `usage_events` and `owner_catalog_houses`, with indexes. Existing houses, tours, permissions and catalog IDs are retained. The application database account needs the schema creation/index privileges used by existing migrations.

Start the bot with your normal service/container controls and inspect its logs. To apply schema before starting the long-running service, `npm run db:init` uses the same configured database and migrations; run only after the backup and with the bot stopped. Do not point it at a different environment by accident.

Verify using your database client:

```sql
SELECT MAX(version) AS schema_version FROM schema_migrations;
SELECT COUNT(*) AS recorded_actions FROM usage_events;
```

The version should be **12**. Activity starts empty and accumulates after deployment. Old usage is not reconstructed. Owner-added catalog records are retained across restarts and packaged seed updates. Review any startup/schema error before allowing normal traffic; do not delete migration records to retry blindly.

## Portal and command setup
Keep existing Discord OAuth credentials and `WEB_SESSION_SECRET`. For a member portal independent of the admin presentation mode:

```dotenv
WEB_PORTAL_ENABLED=true
WEB_PORTAL_URL=https://YOUR_PUBLIC_HOST/app
```

Continue using `WEB_ADMIN_HOST`/`WEB_ADMIN_PORT`, your HTTPS reverse proxy, and Discord OAuth redirect `https://YOUR_PUBLIC_HOST/auth/callback`. Existing `WEB_ADMIN_ENABLED=true` deployments remain supported; `WEB_PORTAL_ENABLED=true` also permits member access when `ADMIN_INTERFACE=discord`. The portal still requires Discord sign-in and current guild membership. Do not expose credentials or database ports through the web proxy.

Set `BOT_OWNER_IDS` to the actual Discord user IDs of owners. Global/Server grants do not grant catalog-write access. Restart after environment changes.

Run `npm run deploy:commands` with your existing guild/global deployment settings to publish `/hearth` and retain `/housing`. This changes the application's Discord commands; global changes may take time to appear. Changing the bot's application/display name or Discord avatar is a separate owner action in the Discord Developer Portal; use the included `src/web/assets/hearthbound-logo.png` for the web brand.

## Smoke checks
- Sign in as an ordinary member, confirm Member access and absence of admin/catalog tools.
- Sign in with an owner account and check all role labels and the catalog tool.
- Register a test house; verify approval policy and Private privacy.
- Create/reorder a tour and confirm Discord sees the same order.
- Use Random House on Discord and check Recent Activity on the portal, newest first with member/server attribution.
- Verify no Private house name, ESO owner or search query is shown in activity. Generic personal usage is public to signed-in members; community activity intentionally spans connected servers.

## Retention and recovery
Raw usage is retained for 90 days, with cleanup at startup and hourly in batches of up to 1,000 records. Older rows are immediately excluded from activity views/totals even if physical cleanup needs several batches after prolonged downtime. Activity totals show only retained recorded actions; they do not measure ESO visits. Usage recording errors are logged without failing the original user action. Administrative audit entries remain separate.

Schema 12 is additive, but older releases reject newer schema versions. For rollback, stop the upgraded bot and restore the verified pre-upgrade database backup plus prior application release together. Restoring loses changes made after that backup; preserve a current backup first. Do not manually drop tables or lower the schema number as a substitute for recovery.

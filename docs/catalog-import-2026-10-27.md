# Apply the reviewed UESP catalog update on Linux

The [audit](catalog-audit-2026-10-27.md) compares the packaged catalog with UESP. Your live database may already contain some additions, including owner-added house131. The read-only queries show the actual rows before changes. No production database was accessed during development.

## What changes

- The packaged catalog includes131/132 and verified metadata additions. Normal startup seeding updates packaged, non-owner-managed rows; owner-managed definitions remain protected.
- Run the supplied SQL to fill missing metadata in existing owner-managed records such as131. Known nonblank custom fields are retained. Conditional purchase-label corrections are restricted to non-owner-managed rows matching the old label.
- New houses use the currently configured classification profiles. Explicit per-house overrides, including intentional NULL capacity overrides, remain intact. To replace an intentional override, use the owner catalog editor separately.
- Normalized lookup/override tables remain consistent. Registered houses, comments, tour stops, ownership and IDs are not deleted or renumbered.
- No schema migration or new dependency is needed. The database must already have normalized catalog schema13 or newer. SQL does not set a schema version.

## Deployment and preflight

1. Back up the **configured production database on Linux**, retaining a matching code/config backup. Use a consistent MariaDB dump, or stop the service before copying a SQLite database. Never use a local development database as a replacement.
2. After merging the PR, stop the service and update the existing installation:

```bash
cd ~/AddressBook
sudo systemctl stop hearthbound
git pull --ff-only
```

3. Select the commands below for the actual `.env` DB_TYPE. Replace placeholders with the database path or DB_HOST/DB_PORT/DB_USER/DB_NAME from your deployment. Do not paste passwords into shell command arguments. Read-only review SQL is [here](sql/catalog-2026-10-27-review.sql). Review131/132 names/classification and the rows missing known fields. A missing row is expected; a different name under131/132 needs investigation before applying. If an existing record is the same official house with an alternate name, confirm that identity and correct its official name in the catalog editor before running the import. Never renumber registered houses to make the check pass.

### SQLite

```bash
sqlite3 -header -column /absolute/path/to/production.sqlite < docs/sql/catalog-2026-10-27-review.sql
sqlite3 -bail /absolute/path/to/production.sqlite < docs/sql/catalog-2026-10-27-sqlite.sql
```

### MariaDB

```bash
mariadb --default-character-set=utf8mb4 -h HOST -P PORT -u USER -p DATABASE < docs/sql/catalog-2026-10-27-review.sql
mariadb --default-character-set=utf8mb4 -h HOST -P PORT -u USER -p DATABASE < docs/sql/catalog-2026-10-27-mariadb.sql
```

Use the normal database account with SELECT/INSERT/UPDATE and temporary-table privileges. Do not use `--force`: the new-ID collision check deliberately fails before changes when131/132 belong to another name. The SQLite command uses `-bail` for the same reason. Statements are transactional and safe to repeat. If an error occurs, stop and inspect it instead of continuing through errors.

4. Restart and check:

```bash
sudo systemctl start hearthbound
sudo journalctl -u hearthbound -n 60 --no-pager
```

Open the owner House Catalog and inspect131 and132. Confirm metadata, prices, limits and acquisition notes, and verify an existing registration/tour still opens. Grotto prices are intentionally unknown. Subzones and other nonblank custom values are retained; such records may intentionally differ from the packaged snapshot.

## Reproduce the SQL

```bash
node src/db/catalog-update-sql.js --write
```

This writes both SQL dialects and the read-only preflight from the reviewed, versioned snapshot; it does not open or modify a database and makes no network requests. The update is not a live scraper or recurring automatic UESP import.

## Rollback

Restore the matching code and production database backup if needed. Existing owner-defined catalog rows are preserved by seeding, so reverting code alone will not reverse SQL fills.

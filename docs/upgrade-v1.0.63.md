# HearthBound catalog upgrade to schema 13

This release adds bot-owner catalog editing and normalized classification profiles, reusable catalog values and per-house capacity exceptions. It upgrades the database configured on your Linux server in place. Do not copy a Windows development database to production.

Before updating, stop `hearthbound.service` and make a verified backup of the live SQLite database or a complete MariaDB dump, plus `.env`. Preserve `WEB_SESSION_SECRET`, database connection settings, and the existing systemd configuration. Keep `MIGRATE=false`; backend transfer mode is separate and destructive.

From the existing application directory, after merging the PR:

```bash
sudo systemctl stop hearthbound
git status --short
git pull --ff-only origin master
npm ci
sudo systemctl start hearthbound
sudo journalctl -u hearthbound -n 100 --no-pager
```

Preserve any local changes before pulling. Normal startup (or `npm run db:init`) applies migration 13 automatically to the selected backend. Pulling alone does not migrate data. Wait for the Discord connection and web listener before checking the portal.

The additive migration creates:

| Table | Purpose |
| --- | --- |
| `house_classifications` | Named, editable furnishing/collectible/visitor capacity profiles |
| `house_catalog_values` | Reusable styles, zones, subzones, house types, purchase types and availability values |
| `house_capacity_overrides` | Explicit capacity exceptions for individual official houses, including intentionally unknown values |

Existing house columns remain populated for Discord, search, export and tour compatibility. Existing in-game IDs, registrations and tour stops remain linked. Profiles are inserted only when absent; restarts do not reset owner-maintained defaults. Edited definitions are marked owner-managed so packaged catalog seeding preserves them. SQLite and MariaDB backend-transfer paths include the normalized tables, deriving metadata when importing older schemas.

Open **House Catalog** as a configured bot owner. Search for an existing house, edit its details and preview the changed fields before confirming. **Apply selected classification defaults** changes only the current house draft; manual values remain available for exceptions. Suggested fields accept either existing or newly typed values. New values become reusable suggestions after saving.

**Classification profiles** previews the number of affected houses before applying a shared-default change. Explicit exceptions are preserved. **Shared values** adds suggestions, previews renames across official houses, and permits removal only when the value is unused. These tools remain unavailable to ordinary members and Server/Global administrators who are not bot owners.

In Discord, bot owners can use **Administration → Edit Official House**, enter its numeric ID, open the editor, and confirm core-field changes. Use the web for full capacity, purchase and shared-value management.

Verify that schema version 13 appears in Administration health, an edited catalog entry survives restart, and ordinary accounts cannot open owner catalog URLs. Check a linked house registration/tour after an edit. No private-record permissions change.

If rollback is necessary, stop the service and restore the matching pre-upgrade database backup and previous code together. Older code rejects a newer schema; do not downgrade code alone or manually delete migration records.

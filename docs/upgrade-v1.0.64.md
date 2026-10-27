# Upgrade to HearthBound 1.0.64

This release replaces the welcome-page Open web portal button with Send feedback, adds member feedback under Help, and adds a bot-owner-only Feedback inbox. Members can see their last ten submissions/statuses. Bot owners can filter the application-wide inbox, mark feedback New/Reviewed/Resolved, and save internal notes. Internal notes are never shown to members. Feedback is separate from public usage activity and guild JSON exports.

## Debian/systemd deployment

1. Back up the live database on your Linux server and retain your current `.env` securely. For SQLite, stop HearthBound before copying the configured database file; for MariaDB, take a consistent backup with `mariadb-dump`. Keep the backup outside the checkout. Never substitute a development Windows database for the production database.
2. From the existing installation directory (often `~/AddressBook`), pull the merged release:

```bash
git pull --ff-only
npm ci
sudo systemctl restart hearthbound
sudo journalctl -u hearthbound -n 60 --no-pager
```

At startup, HearthBound automatically applies additive schema migration **14** to the configured SQLite or MariaDB database. It creates `app_feedback` and its indexes, preserving houses, tours and existing data. Repeated startup does not recreate feedback or reset review status. No new environment variables or slash-command deployment are needed. Keep `MIGRATE=false`; the schema upgrade does not require the separate destructive backend-transfer workflow. The database account needs CREATE TABLE/INDEX permission, as for previous upgrades.

## Verify

- Click Send feedback from the public welcome page, sign in, and choose a server if prompted.
- Submit an idea or bug report; confirm it appears under Your recent feedback.
- As a configured `BOT_OWNER_IDS` user, open Feedback inbox from the sidebar, expand Review feedback, and save status/notes.
- As an ordinary member or Server/Global administrator, confirm Feedback inbox is hidden and its direct URL is denied.
- Restart the service and confirm submissions/reviews remain present.

The submitter's Discord identity, selected server and ESO environment are stored with their feedback. Members must have access to a connected server to submit through the current portal. Feedback is an application inbox, not a Discord message or email notification. There are no attachments or replies in this release.

## Rollback

If rolling back to code predating schema14, restore the matching pre-upgrade database backup as well as the old code. Earlier releases reject a newer schema version. Keep a copy of post-upgrade feedback before restoring an older backup if it must be retained.

# Tour images and direct links

Each tour can have one optional cover graphic. Open the tour on the web and use **Tour cover** to upload, replace, or remove it. PNG, JPEG, and WebP images up to 5 MB are supported; uploaded images are normalized to WebP and metadata is removed.

The cover appears in tour search results, featured tour cards, at the top of the tour page, and in Discord tour information and the first tour stop. Tours without an image use the normal text layout. Discord needs **Attach Files** permission to display the artwork.

Use **Copy web link** on the tour page, then **Copy**, to share its address. Login and server selection retain the tour destination. Server-tour links include the server context. All generated links preserve the tour’s ESO platform and region; Global sharing remains within that environment. Links retain normal viewing permissions; this change does not enable anonymous viewing or expose Private tours.

## Debian / systemd upgrade

1. Back up your database and existing uploaded-image folders.
2. Pull the merged code in `/home/stephanie/HearthBound` and run `npm ci`.
3. Restart with `sudo systemctl restart hearthbound`.
4. Check startup with `sudo journalctl -u hearthbound -n 50 --no-pager`.

Startup automatically applies the additive schema-version-16 migration for SQLite or MariaDB. It creates `tour_covers`; existing houses, tours, and screenshots are retained. No manual SQL import is required. The configured database account needs the same table-creation permissions used by previous migrations.

Tour artwork is stored in `./data/tour-covers` by default, relative to the service's working directory. Optionally set `TOUR_COVER_DIR=/var/lib/hearthbound/tour-covers` in `.env`; create that directory with ownership matching the service user before restarting. Bot and web processes must use the same directory and database. Include the directory in backups, and keep it across deployments. Runtime uploads are ignored by Git.

Only the tour creator or an administrator with the appropriate existing scope can change its artwork. Private tours remain creator-only. Every image read and change rechecks current access. A missing image or unavailable Discord attachment permission does not prevent running a tour.

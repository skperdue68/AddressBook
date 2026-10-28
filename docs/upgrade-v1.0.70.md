# HearthBound 1.0.70: house screenshot galleries

Each registered house can have up to eight PNG, JPEG or WebP screenshots, up to 5 MB each. The first image is the cover; editors can choose another cover or remove images. Uploads are validated, resized to at most 1920 pixels per side, converted to WebP, and stripped of original metadata. Animated images, SVG, invalid files and images over 40 megapixels are rejected.

On the web, open a house and find **House screenshots**. Editors can upload an image and optional caption. Click any image for the full view. Cover images appear in Search Houses, Featured Housing, Random House and the self-paced tour player.

In Discord, choose **Screenshots** on a house. Gallery navigation stays in the same ephemeral message. To upload, use `/hearth`, choose the **house** option (search by nickname, house or ESO owner), attach a **screenshot**, and optionally add a **caption**. `/housing` has the same options. Editors can choose a cover or remove images from the gallery.

The same house permissions apply in both interfaces. Private houses and their web image URLs remain creator-only, including against administrators. Gallery permissions are rechecked on each request. Images are attached to a registration; copying a registration to another server does not automatically copy its screenshots.

## Deploy on Debian / systemd

Merge the preceding UI polish PR before this gallery PR. From the installed project directory:

```bash
cd ~/AddressBook
git pull --ff-only
npm ci
```

Configure persistent storage. Run `sudo systemctl edit hearthbound` and add:

```ini
[Service]
StateDirectory=hearthbound
```

In the production `.env`, add:

```dotenv
HOUSE_IMAGE_DIR=/var/lib/hearthbound/house-images
```

systemd creates `/var/lib/hearthbound` for the service user. HearthBound creates the image subdirectory when the first screenshot is uploaded. Both the Discord bot and web portal must use the same directory; this happens automatically when they run together in this service. Separate processes must share the directory and database.

If Nginx proxies the portal, put this inside its existing `server` block, then validate and reload Nginx:

```nginx
client_max_body_size 6m;
```

```bash
sudo nginx -t && sudo systemctl reload nginx
npm run deploy:commands
sudo systemctl daemon-reload
sudo systemctl restart hearthbound
sudo journalctl -u hearthbound -n 40 --no-pager
```

The command deployment adds optional screenshot options to both commands; their ordinary menu behavior is unchanged. Use your existing global/guild command-deployment configuration. Discord may take time to refresh global commands.

## Database and backups

On service startup, schema migration **15** creates `house_images` in the configured MariaDB or SQLite database. No SQL file needs to be imported manually. Existing registrations and tours are preserved. The database account needs permission to create tables and indexes, as with earlier upgrades. Take a database backup before upgrading.

Removing a screenshot removes its file immediately. Deleting a registration removes its gallery metadata; startup cleanup removes unreferenced image files once they are at least 24 hours old, so it cannot race a new upload.

The database stores gallery metadata. Image files live in `HOUSE_IMAGE_DIR`, outside Git. Back up both the database and this directory together. Database migration between SQLite and MariaDB transfers image metadata; copy the image directory separately. The development fallback `./data/house-images` is ignored by Git and should not be used as a substitute for production backups.

When testing, verify uploading from each interface, viewing the same gallery from the other, changing the cover, removing an image, and attempting to view another member's Private screenshot. Existing screenshots are not imported from old Discord messages automatically.

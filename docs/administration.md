# HearthBound administration and operations

[Back to README](../README.md) · [Member guide](member-guide.md) · [Word user and administrator guide](../HearthBound_User_Admin_Guide.docx)

HearthBound provides Discord housing discovery and tours plus a Discord-authenticated member portal. The web portal serves ordinary members and administrators; administration is a protected area inside that workspace. `/hearth` is the primary Discord command and `/housing` is an equivalent compatibility alias.

## Access and privacy

The portal header identifies the selected Discord server and exact ESO environment. **Your Access** lists every applicable role rather than only the highest role. Current Discord membership, configured Server roles, individual grants, environment-specific Global grants, and configured bot owners determine access. Native Discord Administrator permission alone does not grant HearthBound administration.

| Role | What it permits |
| --- | --- |
| Member | Browse accessible content and manage their own houses and tours. |
| Server Administrator | Manage Server houses and Server tours for their server; review eligible requests and submissions. |
| Global Administrator | Manage Global houses and Global or Server tours in the specifically approved ESO environment. It does not independently grant Server-house editing or Server-request approval. |
| Bot Owner | All configured HearthBound role capabilities, Global grant management, and official house catalog additions. |

**Private houses and tours remain owner-only**, including against Server administrators, Global administrators, and bot owners. Explicit Share Pass access is narrower than normal editing access and never grants administrative editing rights. Tour editing does not automatically grant access to its underlying houses. Server/Global administrative exports exclude Private records. Full database backups contain Private data and must be stored separately and securely.

Bot owners are configured through `BOT_OWNER_IDS` using numeric Discord user IDs, separated by commas or whitespace. No Discord roles are assigned. Restart after changing owner configuration. The portal cannot revoke a configured owner; change the environment setting and restart. Existing independent roles or grants remain valid after removing an owner ID.

Server staff can use configured Discord roles, individual approved grants, or both. The Discord native role picker supports name search; HearthBound stores IDs so role renames retain access. The web settings form uses numeric role IDs and accepts at most 25 per role category. Trusted submitters follow the registration policy without receiving general administration. Shared-tour roles allow appropriate Discord Shared Server tours without granting administration.

If no Server staff role and no individual grant exists, the existing bootstrap setup behavior permits initial settings configuration. It does not grant general tour editing or permission to approve Server moderator requests.

## Enabling the portal

Keep existing Discord and database credentials. Configure your deployed `.env` or systemd environment:

```dotenv
ADMIN_INTERFACE=both
WEB_ADMIN_ENABLED=true
WEB_PORTAL_ENABLED=true
WEB_PORTAL_URL=https://YOUR_PORTAL_HOST/app
WEB_ADMIN_HOST=127.0.0.1
WEB_ADMIN_PORT=8787
WEB_SESSION_SECRET=YOUR_STABLE_RANDOM_SECRET
WEB_SESSION_DAYS=30
DISCORD_OAUTH_CLIENT_ID=YOUR_DISCORD_APPLICATION_ID
DISCORD_OAUTH_CLIENT_SECRET=YOUR_DISCORD_OAUTH_CLIENT_SECRET
DISCORD_OAUTH_REDIRECT_URI=https://YOUR_PORTAL_HOST/auth/callback
```

Register that exact callback URI in the Discord Developer Portal and forward the public HTTPS hostname to the loopback listener through your reverse proxy. The portal starts after the bot connects to Discord. `WEB_PORTAL_URL` enables the Open Web Portal link in Discord Home and Help when the portal is enabled. For a local test or SSH tunnel, an exact loopback HTTP callback is supported; use HTTPS for normal remote access.

`ADMIN_INTERFACE=both` is the default. `discord` retains Discord administration and allows the member portal when explicitly enabled with `WEB_PORTAL_ENABLED=true`. `web` directs the migrated operational tools to the web while retaining live Discord session controls in Discord. Environment/channel/timezone changes, legacy recovery and Share Pass workflows are also available through the member portal. Web administration is also available when enabled in `both` mode. `WEB_ADMIN_ENABLED=true` remains required for `ADMIN_INTERFACE=web`.

Generate a strong secret with `openssl rand -hex 32`. `WEB_SESSION_SECRET` belongs to HearthBound; it does not match a Discord or database secret. Keep it stable across restarts. A systemd-provided environment variable takes precedence over `.env`; update the actual source rather than creating conflicting copies. Do not commit `.env` or share its contents.

## Remembered Discord login

Sign-in lasts 30 days by default, including browser closes and service restarts. `WEB_SESSION_DAYS` accepts a whole number from 1 to 365 for newly issued sessions. The signed session and browser cookie share the same duration. Expiry is fixed from issuance, or from a new server selection; it is not renewed indefinitely by every page view.

Current membership and permissions are still checked on each protected request. Sign Out clears the current browser cookie. Changing `WEB_SESSION_SECRET` invalidates all existing logins. Existing eight-hour sessions retain their old expiry; sign out and back in once after installing the remembered-login update. Changing the lifetime or secret requires a service restart. No schema migration or command deployment is needed for that login update.

## Web workspace and administration

Ordinary members use Overview, Search Houses, Register New House, Housing Tours, Random House, Featured Housing, My Address Book, Statistics, Recent Activity, and Help. Administrators see the additional authorized tools. Forms are bound to their original server and environment; reopen a form if you switch context in another tab. Every write checks permissions and CSRF server-side.

The circular Discord avatar opens an account dropdown showing identity, selected context and current access. It includes navigation shortcuts, Sign out and **Download guide (Word)**. The same guide download is available under Help & Access to all authenticated portal members. The fixed `/app/guide` endpoint serves `HearthBound_User_Admin_Guide.docx` from the application root after checking current membership; keep that tracked document in deployments. Initials provide a fallback for missing or failed avatars. Older sessions can sign out and back in to refresh their Discord profile.

### Reviews and reports

Pending Review lists eligible shared registrations in pages of 25. Approve or Reject preserves the current queue page. Private registrations bypass the shared review queue. Problem Reports offers Mark reviewing, Resolve, and Dismiss. A stale or already-reviewed record is rejected. Private Share Pass report context remains redacted unless normal access exists.

### Access and Settings

The web form manages registration policy and Server administrator, trusted submitter and Shared-tour role IDs. Policies are Open (ordinary shared submissions become active), Approval (untrusted shared submissions wait for review), or Roles (only eligible submitters may register shared content). Private submissions remain active and personal.

Open Moderator Access to review Server requests and revoke individual grants. Approval requires current Server administrator access; users cannot approve their own request and stale revisions are rejected. Revoking a grant does not revoke independent Discord role access. Members request access through Discord Help, and administrators can review through web or Discord.

Bot owners additionally see Global request and grant controls on the web access page. Global grants remain ESO-environment-specific. The legacy `GLOBAL_MODERATOR_APPROVER_USER_IDS` setting remains available for approval-only users through Discord and a dedicated web approval page; it does not make them owners or Global moderators.

### Featured Housing Settings

Add or reorder an eligible saved house or tour using its saved record ID and an optional position from 1 to 5. Remove selections from the curated list when needed. Only eligible Server/Global content in the current environment can be featured. Houses rotate on persisted seven-day cycles, including manual choices; manual changes do not reset that cycle. Tours remain curated. Back to Administration returns to the management area.

### Maintenance and exports

Health shows database connection and bounded integrity/freshness/duplicate metrics; it does not certify that a backup exists. Maintenance can mark eligible catalog houses verified or merge exact-context duplicate saved entries. Merges preserve compatible comments/stops and audit the change; Private records are excluded.

Audit Log provides paginated, guild-scoped administrative history and filterable CSV export with readable companion identities. Its privacy filtering uses current eligible Server/Global targets and omits unsafe historical/free-form metadata. Security and moderation audit records are separate from the community usage feed.

Backup and Export offers a portable guild/environment JSON snapshot of eligible Server/Global records, comments and stops. All Private records are excluded. This is not a full database backup and cannot replace a database dump for recovery. Take an independent database backup before schema upgrades, transfers or environment reassignment.

## Owner only official house catalog

Only IDs configured in `BOT_OWNER_IDS` can add or edit official ESO catalog houses. Global/Server administration and Discord Administrator status do not grant this tool. On the web, open House Catalog; in Discord, use Administration, Add Official House.

Enter the real positive in-game house ID and official name, with optional zone, classification, house type, limits, acquisition/pricing and verification/source metadata. The compact Discord form covers the core fields; the web form exposes the extended optional metadata. Unknown values stay blank. Preview and explicitly confirm the addition. Existing IDs are rejected rather than overwritten; similar names trigger a warning. This adds a shared official definition, not a player's furnished house registration.

New definitions are available for registration without a code release. Owner-added definitions retain provenance and survive startup seeds and supported database transfers. If a packaged definition later conflicts, HearthBound retains the owner definition and emits a bounded review warning. Catalog changes are audited. Existing definitions can now be edited through the owner catalog with changed-field preview, stale-save protection and confirmation; in-game IDs cannot be changed. Classification profiles and reusable metadata values are managed separately. See the [schema 13 catalog upgrade guide](upgrade-v1.0.63.md).

## Statistics and global recent activity

Statistics are scoped to the selected server and environment. They distinguish the current member's Private count, Server/Global registration counts, distinct registering members, ESO owners and distinct eligible tour appearances. Community rankings exclude Private records. Average tour length and represented official house types are current data facts, not visit telemetry from ESO.

Recent Activity deliberately spans connected servers for signed-in members. It shows the member name, action, originating server or Personal session, source and timestamp, newest first. Filter by server or action. New starts, resumes, updates and meaningful progress are distinguished; duplicate deliveries are deduplicated. Private actions use generic text and no Private target reference, destination or search text. Content links are reauthorized against current visibility. This is not the administrative audit log.

Usage begins after deployment; old history is not reconstructed. The raw window is 90 days. Cleanup runs at startup and hourly in batches of 1,000; expired records are excluded from views/totals immediately even if physical cleanup needs additional batches. Usage write failures are logged without failing the original successful action.

## Debian systemd deployment

The current repository is `https://github.com/skperdue68/HearthBound`. Existing folders and database names may retain their AddressBook-era names. Both commands use the same handler; redeploy slash commands only when command definitions change.

For an existing Git installation, stop the actual service, back up its configuration and live database, then update as the application owner:

```bash
sudo systemctl stop hearthbound
cd /YOUR/EXISTING/APPLICATION/DIRECTORY
git status --short
git fetch origin
git switch master
git pull --ff-only origin master
npm ci
sudo systemctl start hearthbound
sudo systemctl status hearthbound --no-pager
sudo journalctl -u hearthbound -n 100 --no-pager
```

If tracked local changes appear, preserve them before pulling; do not reset them. Keep the existing systemd User, WorkingDirectory, ExecStart, EnvironmentFile and database settings. Set the Git remote to the new repository URL if desired with `git remote set-url origin https://github.com/skperdue68/HearthBound.git`. If the unit has not been renamed, use its actual name, such as `addressbook`, instead of `hearthbound`. A unit-file change requires `sudo systemctl daemon-reload`; an ordinary application/configuration update does not.

Follow the [catalog upgrade guide](upgrade-v1.0.63.md) for the schema 13 update, backup, smoke checks and recovery; the [earlier production guide](upgrade-v1.0.62.md) covers schema 12. Pulling code alone does not alter the database; starting the upgraded application or running `npm run db:init` applies versioned migrations to the configured backend. Do not migrate the old Windows development database into production.

## Database support and transfer

SQLite and MariaDB are supported. Preserve `DB_TYPE` and its existing path/host/name/user/password configuration; normal upgrades keep `MIGRATE=false`. Schema 12 adds usage events and owner catalog provenance while retaining existing housing, tours, grants, progress and historical event records. Scheduled-event menus and reminder execution remain retired.

`MIGRATE=true` with `MIGRATE_CONFIRM=ERASE_TARGET_DATABASE` is a separate destructive backend transfer, not a schema upgrade. It validates the source, erases the destination, copies and checks persistent data, writes a completion marker and exits. SQLite-to-MariaDB and reverse transfer are selected through `DB_TYPE`. Active transient tour sessions and Share Pass session links are intentionally not transferred. Only use after independent verified backups, then return `MIGRATE=false` before normal start.

Older records without a known ESO environment use the existing preview/confirmation recovery workflows. A member assigns their own unassigned Private records through My Address Book; administrators recover only provably guild-linked Server/Global tours through Legacy Tours in Discord or web recovery. Incompatible stops are removed only after confirmed recovery. Never expose or claim another creator's Private records.

## Expanded web workflows

See the [HearthBound web workflow guide](web-workflows.md) for personal collections, saved searches, comments, reports, deletion, self-paced tours, sharing and administration. Controls and navigation follow current HearthBound permissions; other members’ Private records remain protected.

# HearthBound User and Administrator Guide

Discord and web workflows

Updated 28 October 2026 for the 1.0.70 feature set

HearthBound helps ESO players register decorated homes, build housing tours and save places they want to explore. Discord and the web portal use the same records. This guide explains everyday tasks, access rules and the production upgrade steps for the screenshot gallery release.

## Start with your task

- **Register a home:** choose Register New House on the web or from the Discord main menu. Add an ESO owner, description and tags, then optionally add it to a tour.
- **Build a route:** open Housing Tours, create or edit a tour, select houses and arrange the stops. The web editor supports drag and drop and notes for each stop.
- **Explore:** browse houses or tours, open Random House, or look through Featured Housing. Follow a self-paced route at your own speed.
- **Keep a collection:** Favorite a house or mark it Want to Visit or Visited. Find these places in My Address Book.

## Sign in and choose your server

Use **/hearth** in Discord. **/housing** opens the same menu and accepts the same optional screenshot arguments. Open Web Portal appears when your deployment has a public portal URL configured. On the website, continue into HearthBound and sign in with Discord.

Choose a connected Discord server, then check its ESO environment in the header. The avatar menu includes account actions and the downloadable guide; on small screens, Menu opens the grouped navigation. Your Access shows all applicable HearthBound roles and their scope.

## Understand visibility

| Visibility | Who can use the record |
| --- | --- |
| Private | Its creator. Administrators and bot owners cannot browse another creator's Private houses or tours. |
| Server | Eligible members of that Discord server, in its configured ESO environment. |
| Global | Eligible members of connected servers using that ESO environment. |

New houses and tours default to Server where registration policy permits. Visibility is separate from ESO environment. A Share Pass can grant limited, revocable viewing without granting editing rights. HearthBound links do not override the ESO house owner's in-game access settings.

<!-- page -->

## Register and manage houses

### Register from a housing link or script

1. Choose **Register New House**. You can paste an ESO Housing Link or a JumpToSpecificHouse script and select **Submit**, or find an official house by name or ID.
2. Confirm the official house and **ESO account owner**. This is the account used by the visit command, not necessarily the Discord member submitting the record.
3. Add a nickname, description and tags. Describe what visitors should look for; tags such as garden, halloween, puzzle or roleplay help others find the build. Blank lines in descriptions remain visible on the web.
4. Review visibility and register. Shared submissions may require approval or a configured role. If an accessible registration already exists at the same or a broader visibility level, HearthBound identifies the duplicate instead of creating another.
5. After an active registration is saved, choose **Add to tour** or create a new tour with it. Canceling this optional step keeps the house registered. Pending houses must be approved first.

If the official house is missing, check its name or ID. A bot owner can add a newly released official definition; registering a player build does not create an official catalog entry.

### View a house

A house page identifies its nickname, official name, ESO owner and zone. Visit commands and official catalog details are available without opening a separate house screen. Descriptions, tags, screenshots and accessible tour memberships add context. Only tours you can access appear in its membership list.

Use **Add to tour** to choose an eligible existing route and add optional tour-specific notes. These notes belong to that route; they do not change the house description. Global tours accept Global houses. Server tours accept their source server's houses and Global houses. Private tours may also include their creator's Private houses.

### Manage a registration

Authorized editors use **Manage house** for metadata, visibility and deletion. Visibility changes show their effect on incompatible tour stops before confirmation. Delete is a separate red action with an impact preview. It removes this registration, not the official catalog definition or other registrations of the same ESO destination.

Eligible administrators can copy a shared registration between servers or reassign its Discord submitter to a member of the relevant server. Search members by name and choose from the results; a member ID or mention is also accepted. If the original submitter is not in the destination server, the person copying becomes the submitter. The ESO account owner remains a separate field. These administrative tools do not reassign another creator's Private content.

If an edit fails, the web form retains entered fields and explains the problem. Check the selected server, environment and current access before retrying.

<!-- page -->

## Save discoveries and add screenshots

### Use My Address Book

**All saved** combines your submitted homes with places you intentionally saved. Favorites provide a focused collection. Submitted records, recent views, pending submissions, saved searches and tour progress have their own destinations.

Use Favorite to save a house and Unfavorite to remove it. Visit-status controls have been retired from both interfaces. On Discord house cards, open Comments to read or add a comment; the count refreshes when you return. Editors use Manage House for editing, visibility and deletion.

### Search and keep filters

Search Houses supports quick text and visibility filters, with cards or a compact list. Advanced Search adds tags, zone, style, classification and multiple values. Save useful criteria under a name rather than bookmarking a fixed set of record IDs; each run checks current access again.

Numbered pages and Jump to page preserve filters. A stale page link returns to an available page. Saved Search Run, Rename, Delete and Cancel retain the originating list page, including a results-to-house round trip. Deleting its final item returns to an earlier page if necessary.

### Leave a comment

Share a detail you enjoyed, an observation or a thank-you. The author and date appear above each comment. Discord's newest-first reader has two comments per page, navigation and a direct page jump. Comments opens the reader from a house card. Add Comment from a tour-stop card returns to that stop; adding from the reader returns to its newest page.

Comments belong to an ESO destination in one environment. Matching registrations of that owner and official house share their comment history. Current house or Share Pass access is checked before reading or submitting.

### Use the house gallery

A registration can hold **up to eight still PNG, JPEG or WebP screenshots**, up to **5 MB each**. Editors upload an image with an optional caption, choose a cover, move screenshots earlier or later, edit captions or remove images. With no image, the house stays readable as a text card; no fake screenshot is substituted.

On the web, find **House screenshots** on the house page. Drag a file onto the upload area or choose one, review the preview and upload. Progress and errors appear in the form. Click an image to enlarge it; use Previous or Next, arrow keys, or Escape to close.

In Discord, choose **Screenshots** to browse. To upload, use /hearth or /housing with the **house** option, attach a **screenshot** and optionally enter a **caption**. Search the house option by nickname, official name or ESO owner. Existing edit permissions control uploads and gallery changes. Private image URLs remain creator-only. Copying a registration does not copy its gallery automatically.

<!-- page -->

## Build and edit a housing tour

### Arrange the route on the web

1. Open **Housing Tours** and choose **Create tour**, or open a route you may edit and choose **Add houses** or **Edit tour**. Tour lists are alphabetical.
2. Enter a name, description and visibility. Explain the route's theme and what visitors can expect.
3. In **Find and add houses**, filter by house or ESO owner, tags and visibility. More filters offers zone, style, house type and classification. Filters apply while typing; Enter in a filter does not submit the tour.
4. Check houses to add them to the draft. Filtering preserves selected stops. Preview house opens another tab so the draft remains available.
5. Enter **Tour-specific notes** beside a stop. Point out a room, puzzle, viewpoint or feature relevant to this route. Drag stops or use the up/down buttons, then choose **Save tour**.

A save supports at most 250 stops. Selection order becomes stop order. Removing a stop from the draft does not delete its house registration. Changes remain a draft until saved; leaving an edited route triggers a browser warning.

### Build from Discord

Create a tour or open one you can manage, then choose **Add House**. The filter modal groups house or owner text, tags, visibility, zone and style or classification. The picker omits destinations already on the route and duplicate registration choices.

Selecting a house adds it immediately. The confirmation offers **Add Tour Notes**, **Add Another House** and **View Tour**. Add Another House retains the filter; saving notes returns to the same confirmation. Manage Stops provides ordering and stop-note editing.

When adding several saved-search results, review their numbered order before confirming. Discord does not provide reliable click history within one multiselect submission; use the ordering controls whenever the displayed sequence needs adjustment.

### Recover after a failed save

Validation errors keep the web editor open with the submitted name, description, visibility, stop order and notes. An inaccessible selected house becomes a generic removable placeholder rather than exposing its details. The recovered draft remains marked unsaved.

If another person changed the tour, the old version cannot overwrite the new one. **Open latest editor** opens a fresh editor in another tab. Compare and reapply your intended changes there; the stale editor's Save button remains disabled. Existing saved data is not replaced by an automatic merge.

<!-- page -->

## Follow tours and share creations

### Follow a self paced route

Open a tour and choose **Open self-paced tour** on the web. Start or resume your own progress, view the current house and its visit commands, and complete stops at your own pace. Screenshots appear when the registration has them. Previous/Next controls and progress history help you return later; Restart begins a completed route again.

Discord also supports Self Paced tours. The current stop includes house facts, visit commands and route-specific notes. Personal marks and direct comments do not advance your route. Expanded details and the originating progress-list page remain available when returning from comments or the tour list.

### Run a shared Discord tour

A Shared session posts the current stop in a channel. Only its initiating leader can navigate or end it. Shared-tour permissions and source-server restrictions still apply. The web self-paced player is independent of a leader-controlled Discord session.

### Share a house or tour

Use **Share house** or **Share tour** to create or post a Share Pass. Choose an accessible channel and, if offered, an optional thread, then confirm the destination. Your last successful channel or thread in that server is offered again when permissions still allow it. A pass is limited to its configured environment and can be revoked. Copy and editing actions appear only where the applicable access rules permit them.

A Private Tour Pass gives each visitor an independent private run. Revocation closes pass-derived access and blocks stale viewing, navigation and comment submissions. A pass never grants general access to the creator's other Private records.

### Discover Random and Featured houses

**Random House** gives an accessible registered destination with its official name, ESO owner, zone, classification, available tags and description, visit commands and recent comment context. Choose **More details** for the complete record. In Discord, another pick avoids the previous destination when alternatives exist; web picks may repeat.

**Featured Housing** displays richer house cards and curated tours. House selections rotate weekly. Favorites and previously recorded visit interest modestly influence selection while variety and randomness remain; popularity does not determine every result. Previous-cycle destinations are avoided when enough alternatives exist. Each featured category is capped at four entries.

HearthBound records app actions, not actual movement inside ESO. Past personal visit-state records are retained, but their controls are no longer displayed.

<!-- page -->

## Access and server administration

### Understand your HearthBound access

| Role | Scope and authority |
| --- | --- |
| Member | Browse accessible records and manage their own houses, tours and saved places. |
| Server Administrator | Manage eligible Server houses and tours, settings, requests and shared review work for that server. |
| Global Administrator | Manage Global houses and Global or Server tours in the approved ESO environment. This alone does not grant Server-house editing or Server-request approval. |
| Bot Owner | All configured HearthBound role capabilities, Global grant management and official catalog tools. Other creators' Private content remains protected. |

Discord's native Administrator permission alone is not HearthBound administration. Configured roles and individual grants can both provide Server access. Removing one individual grant does not remove access supplied by a role.

### Set up a newly connected server

Choose the server's ESO environment on first use. If no Server staff role or individual administrator grant exists, an eligible Discord server owner, member with Manage Server permission, or configured bot owner can explicitly complete first-administrator setup. Empty settings never grant general editing automatically.

An existing HearthBound Server administrator then configures staff, trusted-submitter and Shared-tour roles and the registration policy. The web role settings use numeric Discord role IDs. Discord role pickers support name search; stored IDs survive role renames. Environment changes require an impact preview and confirmation.

### Request and review access

Use **Support & Access** for Server or Global access requests, feedback and guide downloads. Current HearthBound Server administrators review Server requests for their server. Bot owners manage environment-specific Global requests and grants. Members cannot approve their own requests. Configured approval-only identities retain only their designated approval capability.

### Find the administration tools

The web Administration tabs lead through Overview, Pending review, Problem reports, Maintenance, Audit log and Backup & export, with Access & settings alongside. Count cards open the matching work queue. Approve/Reject and report-review controls stay together on their record row; wide tables scroll internally on small screens.

Audit logs and reports support numbered pages and direct jumps; audit filters persist. Pending review uses Previous/Next because its queue does not expose a total. Exports exclude Private records. A portable JSON export is not a full database backup.

<!-- page -->

## Catalog and community information

### Maintain official house definitions

Only configured bot owners use **House Catalog** or the Discord Administration catalog tools. Enter the actual positive in-game house ID and official name. Ordinary registration saves a player's build against that definition; it does not add a new definition.

Search an existing house and choose **Edit official house** to update metadata. Review changed fields and explicitly confirm. The in-game ID remains fixed. Registrations and tour stops stay linked, and saved owner edits are protected from startup seed replacement. Leave unknown catalog values blank rather than guessing.

The web catalog groups capacity, acquisition, price and source information. Classification profiles supply shared furnishing, collectible and population defaults; individual houses can retain exceptions. Applying defaults to one draft does not silently edit every house. Changing a shared profile previews its affected records before confirmation.

Reusable styles, zones, subzones, house types, purchase types and availability values offer autocomplete suggestions while permitting new text. Shared values supports adding suggestions, previewing a rename and removing unused values. Discord covers core catalog fields; use the web for full metadata and shared-value management.

### Read statistics correctly

Statistics distinguishes the official house type, the ESO account owner and the Discord submitter. Rankings can show frequently registered house types, owners with many registered houses, different registering members and appearances in tours. Numbers and ranking entries link to appropriately scoped searches where supported.

Community rankings exclude Private records. Personal counts describe your own Private data; administrators do not gain other members' Private totals or records. These figures describe HearthBound registrations and saved interactions, not visits measured inside the game.

### Follow activity and send feedback

Recent Activity lists recorded Discord and web usage newest first, with the originating server or Personal session, member, action and time. Server, action and person filters combine. **People using HearthBound** counts distinct recorded accounts during the retained period, not online Discord presence.

Private actions use generic descriptions without Private destinations or search text. Linked content is checked again when opened. Activity begins when recording is deployed and uses a 90-day window; earlier usage is not reconstructed.

Use **Send feedback** in Support & Access. Bot owners review the feedback inbox, change status and maintain internal notes. The inbox is for review, not another entry point for sending feedback. Internal notes are owner-only.

<!-- page -->

## Deployment and troubleshooting

### Keep production data and login settings

Use the existing Linux installation and configured MariaDB or SQLite backend. Preserve .env, the service account and database settings. DATABASE_PATH is the SQLite setting; DB_TYPE=mariadb uses the configured MariaDB connection instead. Do not copy an old Windows development database over production.

WEB_SESSION_SECRET is HearthBound's own secret. Generate one with **openssl rand -hex 32**, keep it stable and restart after changing the actual environment source. Changing it signs everyone out. New sessions last 30 days by default; WEB_SESSION_DAYS accepts 1 to 365. Browser cookie clearing still requires another login, and permissions remain checked on protected requests.

BOT_OWNER_IDS accepts numeric Discord user IDs separated by commas or whitespace. Owner configuration is independent of Discord roles. Keep credentials out of Git.

### Deploy the gallery release on Debian

Back up the configured production database and existing image directory first. From the actual installation folder, review local changes before pulling merged code. Keep the service's User, WorkingDirectory, ExecStart and EnvironmentFile consistent with that installation.

```bash
cd ~/AddressBook
git status --short
sudo systemctl stop hearthbound
git pull --ff-only origin master
npm ci
```

For persistent image storage, add **StateDirectory=hearthbound** under [Service] using **sudo systemctl edit hearthbound**, and set **HOUSE_IMAGE_DIR=/var/lib/hearthbound/house-images** in the production environment. Separate bot/web processes must share the database and image directory. Nginx needs **client_max_body_size 6m;** in its server block; validate its configuration before reloading.

```bash
npm run deploy:commands
sudo systemctl daemon-reload
sudo systemctl restart hearthbound
sudo journalctl -u hearthbound -n 40 --no-pager
```

Command deployment adds the optional screenshot arguments to /hearth and /housing. Startup applies schema 15 to the configured database automatically. Back up both the database and image files; a database-only backup does not contain screenshots. A backend transfer copies image metadata, so copy image files separately. Keep normal operation at MIGRATE=false; the destructive confirmed backend-transfer mode is not a routine upgrade.

### Diagnose and find the full reference

For a web 502, check **sudo systemctl status hearthbound --no-pager -l** and the journal above. Startup may still be initializing the web listener. For repeated logins, check cookies, a stable session secret, the public HTTPS URL and exact OAuth callback. For denied edits, check the selected server, environment, ownership, visibility and current role or grant.

Read [the gallery upgrade guide](https://github.com/skperdue68/HearthBound/blob/master/docs/upgrade-v1.0.70.md), [member guide](https://github.com/skperdue68/HearthBound/blob/master/docs/member-guide.md) and [administration reference](https://github.com/skperdue68/HearthBound/blob/master/docs/administration.md) for full configuration, backup and recovery details. Restore matching code, database and image backups together when rolling back a schema-changing upgrade.

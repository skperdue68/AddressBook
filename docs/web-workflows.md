# HearthBound web workflows

Sign in with Discord and select a server. The selected server and ESO environment apply to every action. Your Access and the avatar menu show your current HearthBound roles. Discord Administrator permission alone does not grant HearthBound administration.

## Permission driven navigation

Administration, settings, catalog tools and record actions appear only when your current capabilities allow them. Server administrators manage Server content in their server. Global administrators manage Global houses and shared tours in their ESO environment, including Server tours. Bot owners inherit configured administrative access and alone manage the official catalog. Another member's Private houses and tours remain excluded from browsing and administrative editing, even for bot owners. An explicit Share Pass grants revocable viewing and independent copying without changing these rules.

Every protected request checks current membership and permissions. Hidden controls are backed by authorization on direct URLs and submissions. Forms are bound to their selected server and environment. If roles, records or the active environment change, reopen the page before retrying.

## Houses and personal collections

**Register New House** supports a pasted ESO Housing Link or `JumpToSpecificHouse` command as well as the manual catalog picker. Paste the link or script, choose **Read link or script**, and review the extracted official house and ESO account owner. Choose visibility and add your nickname, description and tags, then click **Register house**. Reading a destination does not save it or execute the script. Unknown house IDs and malformed inputs show a retry message; final registration retains normal approval, role, duplicate and environment checks. After an active registration, use **Add to existing tour** on its detail page.

Open a house for ESO jump, preview and housing links, official metadata, favorites, visit state, comments and problem reports. My Address Book links to your houses, tours, favorites, Want to Visit, Visited, recently viewed, pending submissions, saved searches, progress and Share Passes.

Authorized editors can update the official house selection, ESO owner, nickname, description and tags. Change visibility previews the number of incompatible tour stops that will be removed, including incompatible server and Private-owner relationships. Confirm only after checking the impact. Private ownership remains with the original creator. Deletion requires a separate impact preview and confirmation; deleting a registration keeps the official catalog definition and other registrations of that destination.

Registration and visibility menus omit shared choices when the configured role policy does not allow you to submit them. Approval policy still permits a pending shared submission. After an active registration, add it to an eligible tour or create a tour with it.

Every active house detail page includes **Add to existing tour**. Its selector includes compatible tours you can edit, including shared tours you manage through HearthBound administrator access. A Private house can only be added to its owner's Private tours; a Server house requires a tour with the matching source server. Destinations already on a route and tours with 250 stops are omitted. If no eligible tour exists, the page explains the restriction and offers to create one instead of hiding the section. Registered houses show official information grouped into Home & location, Furnishing capacity, and Purchase & availability.

## Searches and tour editing

Advanced Search supports names, nicknames, ESO owners, tags, zones, types, classifications, styles and visibility, with optional unfurnished official houses and houses not on shared tours. Save filters, run a saved search, rename it or delete it from My Address Book. Reusing a saved search name requires explicit replacement confirmation.

Select multiple results for a tour. The web records checkbox selection order; review the numbered list and drag stops or use Move up and Move down before saving. Add the route to an eligible existing tour or create one. Save commits the route atomically; stale edits are rejected. Tour editors can also update each stop's title and notes. Tour deletion removes its stops and progress while retaining the registered houses.

## Self paced tours

Open a tour's self-paced player to start, resume, move back, complete the current stop and advance, or restart. The player shows the current destination, notes, ESO links and route. Your progress is saved and reconciled when the route changes. A repeated stale Next submission cannot skip another stop. This player does not create, join or control a live Discord session.

An explicit Private Tour Pass also opens an independent web route. Its signed navigation is checked against the active pass on every action; copy the tour to My Address Book to keep persistent personal progress. Revoking a pass closes further pass access. Copies already made remain independently owned.

## Sharing and administration

Share a house or tour by creating a revocable web link or selecting a Discord channel, optionally selecting an accessible existing thread, and confirming the destination. Nothing is posted before confirmation. Both your and the bot's channel/thread permissions are checked again before sending. Manage your own passes under My Address Book to revoke them or issue a replacement link. Replacement invalidates the old token, including old Discord cards.

Help & Access includes Server and Global moderator requests. Current HearthBound Server administrators review Server requests; configured bot owners and existing designated approvers review Global requests. Requests do not grant access automatically. Administrative pages include registration roles/policy, channel and timezone settings, featured ordering and expiration, server environment changes and legacy recovery previews. Personal legacy recovery applies only to the signed-in member's records. Environment/recovery changes require explicit impact confirmation. Configured owners manage newly released official houses.

Leader-controlled Discord session controls remain in Discord. Scheduled events remain retired. Download the current Word guide from Help or the avatar menu.

## Deployment

This update uses existing schema 12 tables; it does not require a new database migration or moving data between machines. Back up the production database as usual, pull the merged branch into the existing Linux checkout, run `npm ci`, and restart `hearthbound.service`. Preserve `.env`, database configuration and `WEB_SESSION_SECRET`. Normal startup applies any already-required versioned migrations to the configured production database. Never replace the production database with the Windows test database.

## Live tour house filters and paragraph formatting

The tour editor loads all accessible active registered houses without a 25-house cutoff. Name or ESO owner, tags and visibility filters apply immediately. More filters offers zone, style, house type and classification. Comma-separated tags must all match; Clear filters resets only the filters. The count shows matching and eligible houses, and the picker follows the current tour visibility. Selected stops and their order stay in the draft even when hidden by a filter. Enter inside the filters never submits the tour; use Save tour explicitly.

The web preserves single line breaks and blank lines when displaying descriptions, comments and tour notes. Text is still escaped as plain text. This is a web display rule only: stored descriptions and Discord rendering are unchanged.

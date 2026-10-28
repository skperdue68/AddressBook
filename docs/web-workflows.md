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

Support & Access includes Server and Global moderator requests. Current HearthBound Server administrators review Server requests; configured bot owners and existing designated approvers review Global requests. Requests do not grant access automatically. Administrative pages include registration roles/policy, channel and timezone settings, featured ordering and expiration, server environment changes and legacy recovery previews. Personal legacy recovery applies only to the signed-in member's records. Environment/recovery changes require explicit impact confirmation. Configured owners manage newly released official houses.

Leader-controlled Discord session controls remain in Discord. Scheduled events remain retired. Download the current Word guide from Support & Access or the avatar menu.

## Deployment

The current gallery release applies schema **15** automatically on startup in the configured MariaDB or SQLite database. Follow [the 1.0.70 upgrade guide](upgrade-v1.0.70.md) for persistent image storage, upload proxy limits and command deployment. Back up the production database and image directory, stop the service, pull merged code, run `npm ci`, and restart `hearthbound.service` after configuration. Preserve `.env`, database settings and `WEB_SESSION_SECRET`. Never replace the Linux production database with the Windows test database.

## Live tour house filters and paragraph formatting

The tour editor loads all accessible active registered houses without a 25-house cutoff. Name or ESO owner, tags and visibility filters apply immediately. More filters offers zone, style, house type and classification. Comma-separated tags must all match; Clear filters resets only the filters. The count shows matching and eligible houses, and the picker follows the current tour visibility. Selected stops and their order stay in the draft even when hidden by a filter. Enter inside the filters never submits the tour; use Save tour explicitly.

The web preserves single line breaks and blank lines when displaying descriptions, comments and tour notes. Text is still escaped as plain text. This is a web display rule only: stored descriptions and Discord rendering are unchanged.

## Owner catalog editing and shared defaults

Bot owners can search House Catalog, edit existing definitions, preview changed fields and explicitly confirm. Official IDs stay fixed and linked registrations/tours are retained. Classification profiles supply database-backed capacity defaults; Apply selected classification defaults changes the house draft and individual values can override it. Shared styles, zones, types and other values use editable autocomplete suggestions. Newly saved values become reusable. The profile manager previews affected houses while preserving explicit exceptions; the value manager previews renames and only removes unused values.

Catalog normalization was introduced in schema 13; the current gallery release uses schema 15. [The catalog upgrade guide](upgrade-v1.0.63.md) explains that earlier migration; preserve the Linux production database and take a verified backup first. Discord offers owner-only core catalog editing; full metadata management is on the web.


## Public welcome page and link previews

The website root (`/`) is a public HearthBound introduction with sign-in and bot invitation buttons. The workspace (`/app`) and administration (`/admin`) still require Discord login and current authorization. After signing in, users with multiple accessible servers choose one on a branded server picker.

Shared links to the root include Open Graph and Twitter preview metadata using the illustrated HearthBound banner. The welcome page displays that banner above the introduction, with a matching stars-and-hills landscape behind the page; text panels stay dark for readability. Absolute preview URLs use the origin of `DISCORD_OAUTH_REDIRECT_URI`; configure that callback with your public HTTPS hostname (for example `https://hearthbound.perdues.me/auth/callback`). No new environment variables, dependencies, or database migrations are required.

Deploy by pulling the merged code and restarting `hearthbound.service`. Ensure the reverse proxy forwards `/` and `/assets/` to HearthBound without redirecting them to Discord or requiring proxy-level login. Share the root HTTPS address for the welcome preview; Discord invitation and OAuth URLs still belong to Discord and use its previews. Existing cached previews may take time to refresh; post a fresh link with a query such as `?preview=2` to check the deployed result. The sign-in button opens the protected `/app` workspace.


## Feedback

Use **Send feedback** on the welcome page or under **Support & Access** after signing in. Choose General feedback, Bug report or Idea, enter a subject (120 characters) and description (4,000 characters), then send. Your last ten submissions show their current status. Only the author and configured bot owners can read a submission; internal review notes are owner-only.

Configured bot owners see **Feedback inbox** in the sidebar, with newest submissions first, status filtering and pages of 25. Expand **Review feedback** to mark New, Reviewed or Resolved and save internal notes. Server and Global administrators do not gain feedback review access. Feedback is retained in the database independently of public usage activity and is included in full database/backend transfers, not guild-level JSON exports. See [upgrade instructions](upgrade-v1.0.64.md).


## Default visibility for new entries

New houses and tours default to **Server** visibility in the web portal. Discord house registration preselects Server and offers Continue with Server; tour creation presents Server as the primary/default action while keeping an explicit confirmation. You can still choose Private or Global. Existing entries retain their saved visibility when edited. Role-restricted members who cannot submit shared houses default to Private, and a new tour started from a Private house also starts Private to keep its first stop compatible. Shared-house approval policies still apply. No database migration is needed for this change.


## Saved login and house visibility

The welcome page recognizes a valid saved Discord session and shows your account menu and **Continue to HearthBound**. Login persists for `WEB_SESSION_DAYS` (30 by default), including browser close/reopen. Keep the configured `WEB_SESSION_SECRET` stable. Large multi-server sessions use a compact signed cookie; old signed cookies remain accepted until their normal expiry. Permissions and membership are still checked on protected requests.

To change a house’s visibility, open its details, choose **Change visibility**, select the target and click **Preview impact**. The next screen names the original and target visibility, shows affected tour stops and approval status, and provides **Confirm change to Server/Global/Private**. To change the target, use **Choose a different visibility**. This prevents submitting an old hidden target after changing a separate dropdown.

## Copy a house between servers

On a house detail page, eligible administrators see **Copy to another server**. Choose a destination and preview, then confirm the named server. The destination must have HearthBound installed, use the same ESO environment, and be a server where you are a current member with one of these capabilities:

- Server administrator access in both source and destination;
- Bot owner access; or
- Global administrator access for that ESO environment.

The new registration has **Server** visibility, retains the nickname/description/tags, and records the acting administrator in the audit log. Source registration and tour stops remain intact. An existing destination registration is reused without overwriting its details. Comments remain associated with the same ESO destination. Other users’ Private houses cannot be accessed or copied, even by owners or administrators; copying your own Private house requires an explicit notice that the target registration is Server-visible.

After copying, **Open destination house** switches to the destination server. If the original was registered in the wrong server, **Review deleting original** is available only where your existing deletion permissions allow it, with the normal impact/confirmation screen. Copies never silently delete the original or rearrange tours.


## Submitter and tour creator reassignment

For shared records, authorized administrators see **Change submitter** on house details and **Change tour creator** on tour details. Enter a current server member’s Discord ID or mention, check the live lookup and preview, then confirm. Server administrators manage their server’s Server records; Global administrators and bot owners manage shared records within their authorized ESO environment. Private records remain creator-only and cannot be reassigned with these controls.

A house’s Discord submitter is separate from its ESO account owner. Reassignment changes creator editing rights, never the ESO visit destination or tour stops. The audit log records both identities. When copying between servers, the original submitter is retained only if they are a current member of the destination; otherwise the administrator performing the copy becomes the submitter. The preview states which identity will be used. Unavailable membership checks stop the operation so an outage cannot silently change ownership.

## Server housing statistics

Statistics includes **Most registered houses** and **ESO owners with the most registrations** for the selected server. These count active Server registrations in that server and ESO environment. ESO owner means the account in the visit command, not the Discord member who submitted the record. Private, Global, inactive and other-server records do not inflate these server rankings. Shared community statistics remain a separate section.

## Finding and adding tour stops

Open **Housing Tours**, select a tour you can edit and choose **Add houses** to jump directly to its house picker. The editor keeps selection and order in a draft until **Save tour**. Search by house or ESO owner, combine tags and visibility, and expand additional filters when needed. A registered house’s detail page also lists eligible existing tours under **Add to tour**, alongside creating a new tour.

## Duplicate house registrations

Registering a house checks the official house ID and normalized ESO account owner. An existing visible active registration at the requested scope or higher is reused by directing you to that record instead of registering a duplicate. For a Private registration, your Private, the selected server’s Server and Global registrations qualify. For Server, Server and Global qualify; for Global, only Global qualifies. Other users’ Private records and registrations in unrelated servers or ESO environments never block registration or appear in duplicate messages. Explicit administrative copying remains a separate confirmed workflow.


## House-to-tour shortcuts and returning to results

Search Houses now shows **View house** and **Add to tour** beside each active registration. On phones, each result becomes a compact card with both actions visible. Add to tour opens the house’s eligible tour picker. The detail page also offers creating a tour with the house and a shortcut that opens the copy-ready ESO visit commands.

Opening a house from normal, advanced, saved or personal search carries its filters/page in the link. **Back to search results** (or **Back to My Address Book**) restores that view, including after saving an edit, favorite, visit status or comment. Adding to a tour opens the updated route with confirmation and a return link. Return links are restricted to internal house-search/personal pages and never grant access.

House editing and administrative actions are under **Manage house**, visible only when an applicable action is authorized. Personal favorites, visit status and sharing are grouped under **Save & share**. Advanced Search shows common fields first; **More filters & multiple values** reveals the rest and automatically opens when one is active. Tour editing shows Find houses → Add stops → Arrange route → Save tour.

Discord house cards now put **Add to a Tour** first for active accessible houses. You can add another member’s shared house to an eligible tour you can edit; this does not let you edit their house. Editable tour details have a direct **Add House** shortcut. Tour returns are named **Back to Tours**, **Back to Tour** or **Main Menu**. Private ownership, visibility compatibility, moderation policies and existing permission checks continue to apply.


## Professional interface and direct actions

Version 1.0.69 groups the home page around sharing a house, building a tour, exploring, and saving favorites. Controls use shared alignment, spacing, focus styles, and text labels with semantic colors. Delete and revoke actions are red. Visit selection saves automatically; Favorite toggles to Unfavorite, and Not marked clears visit state. Feedback review status also saves in place, independently of internal notes. Both report saving, success and failure without moving away.

House visit commands and official details start expanded. Favorite and visit controls appear near the top. Visible tour memberships include accessible registrations of the same physical ESO destination. Featured cards show descriptions and useful metadata. Comments show author and timestamp first, text directly below, then space before the next entry.

Statistics numbers and ranking entries open exact, correctly scoped lists. Recent Activity’s People using HearthBound counts distinct Discord accounts recorded within 90 days from Discord or the web, not online presence; server, action and person filters combine. Numbered page controls and direct jumps preserve list filters. Support & Access retains setup, Server/Global requests, feedback and guide downloads; learning screens are retired.

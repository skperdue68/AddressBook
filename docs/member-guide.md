# HearthBound member guide

[Back to README](../README.md)

## Getting started

Use `/hearth` or `/housing` to open the main menu, or sign in to the web portal with Discord. Pick the job you want to do: register a house, build a tour, explore houses or tours, or keep favorites and visit plans in My Address Book. First use opens the normal menu; training screens have been retired.

House cards expose Favorite or Unfavorite, Want to Visit or Unmark, Visited or Unmark, and Add Comment. Personal changes preserve the current house or tour stop. On the web, the visit selector saves automatically and reports success or failure. Choose Not marked to clear visit status. A favorite is independent of visit status.

**Support & Access** contains separate Server and Global access requests, feedback, and the downloadable guide. It replaces Help & Learning.

## ESO environments

Every Discord server must choose one ESO environment the first time `/hearth` is used:

- PC NA
- PC EU
- Xbox NA
- Xbox EU
- PlayStation NA
- PlayStation EU
- PTS

Any member may complete the initial selection; the first completed selection wins. A Housing Moderator can later preview and confirm an environment change in Administration. The preview includes Server records plus Global and Private records whose `origin_guild_id` is this guild; unrelated Private records from other guilds remain where they are. A confirmed change also revalidates tour stops and revokes affected Share Passes.

Visibility and environment are separate concepts. The UI always lists visibility as **Global, Server, Private**:

- **Global** is shared only with Discord servers configured for the same exact ESO environment.
- **Server** is limited to the current Discord server and its selected ESO environment.
- **Private** belongs to one Discord user and is available only in Discord servers using the same ESO environment.

For example, a PC NA Global house, tour, comment thread, Share Pass, active run, or moderator grant is never returned in PC EU or on another platform.


## Houses and search

Search Houses initially displays all accessible houses and then lets the member open Filters. Available filters include house or nickname, owner, tags or themes, zone, architectural style, ESO classification, size or type, visibility, Non-Player Homes, and houses not already used by an applicable Server or Global tour. Attribute values are paginated so Discord's 25-option component limit does not discard results.

Filtered results can be saved by name and reopened from **My Address Book → Saved Searches**. On the web, opening results, visiting a house from them, renaming and deleting retain your original saved-search list page. If a deletion removes the last page, the return moves to the preceding page. Saved searches can be run, renamed, replaced with the current filters, or deleted. They store criteria rather than result IDs, so every run applies the current Discord server, ESO environment, and access permissions. Invalid or future-version filter data fails closed instead of becoming an unfiltered search.

**Random House** selects from the complete accessible result set, including results beyond the current 25-item Discord page. **Another Surprise** avoids immediately repeating the same destination when another result is available.

Register New House accepts an official house name or ID, an ESO Housing Link, a Jump to Specific House command, or the owner and numeric house ID portion such as:

```text
("@HouseOwner", 62)
```

The review screen shows the parsed destination before saving. House cards identify the submitter, visibility, visible associated tours, and these copy-friendly values in order:

```text
Jump in ESO
```

```text
Unfurnished Preview
```

```text
Housing Link
```

HearthBound cannot bypass ESO visitor permissions.

Comments attach to the environment-specific ESO destination, not to one visibility entry. Matching Global, Server, and Private entries for the same ESO owner and official house share their comment history inside that environment.

In Discord, Comments opens a newest-first reader with two comments per page. The author and date appear above each comment. First/Previous/Next/Last and Jump to page make older discussions reachable; Add Comment returns to the newest page, and Back returns to the house or current tour stop. Direct Add Comment on a house or stop still returns to that original card. Every page and submission rechecks access, including Share Pass revocation and changes to a tour's current stop.

Every accessible player or Non-Player house includes **Personal Actions**. A member can independently mark a destination as a Favorite and set one visit state: Want to Visit, Visited, or neither. These private preferences do not change house visibility or grant access. My Address Book provides paginated Favorites, Want to Visit, Visited, and Saved Searches lists, and inaccessible destinations are removed from personal list results at read time.


## Tours

Tour dropdowns list names alphabetically without separating uppercase and lowercase names. Sorting happens before pagination.

Tour creators can edit their own accessible tours. HearthBound's configured Server Housing Moderators can also edit Server tours belonging to their Discord server. Approved Global Housing Moderators can use **Housing Tours → Edit Tour** to edit anyone's Global or Server tours within their authorized ESO environment, including Server tours belonging to other Discord servers. Private tours and houses remain owner-only; administrator roles do not grant access to them. Administrative editing does not grant Share Pass creation or tour playback access. Discord's Administrator permission does not grant HearthBound tour-editing rights.

- A **Global Tour** is available only in the same ESO environment and contains Global houses from that environment.
- A **Server Tour** contains Global houses from the same environment and Server houses from the current Discord server.
- A **Private Tour** contains accessible Global and Server houses plus the creator's Private houses, all in one environment. Stop insertion enforces the creator's ownership of Private houses and the tour's source guild for Server houses. Search-result bulk actions recheck selected houses before creating or extending a tour; changed results require a fresh search.

Browse Tours keeps the selected list active and provides Previous Tour and Next Tour controls on each tour card. Starting a tour first opens Tour Preflight, which reports the route's visibility, ESO environment, stop count, accessibility warnings, and any blocking missing, archived, duplicate, wrong-environment, or visibility-incompatible stops. Warnings allow the tour to proceed; blocking problems must be corrected first.

Self Paced tours create a private active run for one member. Shared tours post the current stop in a channel, but only the initiating leader can navigate or end the run. Starting either mode immediately shows the complete current house card with copy-ready ESO links and Previous/Next controls. More Details shows full catalog metadata—including standard and ESO+ furnishing and collectible limits—and remains expanded while moving between stops. Comments and Show Tour List return to the same stop and expanded/compact state. When the current viewer may edit the saved house, Edit House returns to the same tour stop and detail state after saving. Share Pass tours create an independent ephemeral Self Paced run for each visitor.


Discord tour building: choose **Add House**, then **Filter houses** to narrow by house/ESO owner, tags, visibility, zone, and style/classification. Destinations already on the route are omitted. Selecting a house adds it immediately and offers **Add Tour Notes** and **Add Another House**. Notes are optional and belong only to that tour stop. Saving notes returns to the same confirmation; adding another house retains your filters. The same notes shortcut is available after adding a house from its registration/detail card, including **Back to House**. **Edit Stop / Notes** handles later changes, and **Delete Tour** is the last editor action.

## Featured Housing and progress

Housing Moderators can curate up to four eligible Global or Server player houses and tours as Featured Housing. Featured House cards include copy-ready Jump in ESO and Housing Link values. Non-Player/base houses are never selected. Featured entries are limited to the guild's exact ESO environment and are automatically hidden when the underlying content is no longer active, visible, or eligible. If a Server house or tour moves to another Discord guild, its old guild's Featured list stops displaying it. Featured Houses rotate every seven days, including manually selected houses. Selection prefers destinations outside the previous weekly list, fills up to four distinct destinations when available, and preserves its deadline across restarts. Manual changes and expiration controls do not postpone it. Existing eligible selections on upgrade get their first refresh seven days after initialization; an empty list fills immediately. Favorites, members marking Visited, and Want to Visit give a capped boost to weekly selection (at most twice the baseline chance); destinations absent last week still take priority. These are recorded HearthBound interactions, not measured visits inside ESO. Featured Tours remain manually selected.

Self-Paced starts are recorded in My Address Book → Tour Progress. Members can resume, move to the previous or next stop, restart a run, and review completion history. When several runs exist, active and completed routes are paginated five at a time, with a working Resume or View Route button for every entry. Resuming a run from a later active list page preserves that page through stop controls, details, comments, and the tour list; Back returns to the same active list page. Completion History also retains the active list page while browsing completed routes and houses, so returning to Tour Progress resumes at that page. The current progress card shows the complete house, population limit, owner, tour-specific notes, jump values, and optional expanded catalog details without requiring a separate Open House action.

Completion History remembers its list page while a member opens a route, browses its completed stops, or opens a completed house. Back returns to the page of routes they came from.


## Share Passes and copying

To share a House or Tour Pass:

1. Choose Share Pass on the house or tour.
2. Select a destination channel. Channel lists are paginated, 25 per page.
3. Optionally select an accessible active thread, or choose **Post in This Channel**.
4. Review the destination and confirm with **Post House Pass** or **Post Tour Pass**. Nothing is posted before this confirmation.

Forum and media channels require an existing thread/post because Discord does not allow direct messages in their parent channel. Thread lists are paginated; only unlocked active threads accessible to both you and HearthBound are listed. You can also paste a channel/thread link, mention, or ID. Archived unlocked threads remain available by link and may reopen when posted to. Both you and HearthBound need View Channel and the relevant sending permission; the bot also needs Embed Links and Read Message History. Cancel exits without issuing a pass.

A House or Tour Share Pass uses an opaque token; only its hash is stored. Reposting rotates the token, and revoking a pass blocks future access. A private house can be shared once without changing its normal visibility.

When a recipient sees someone else's Private house only through a Share Pass, **Copy House** can prefill nickname, description, and tags for review. The recipient chooses Global, Server, or Private only when their normal permissions allow it. A copied tour becomes a new Private tour; inaccessible stops are copied as Private houses in one transaction.

House Share Pass visitors can open and add comments, toggle More Details, and return from Copy House to the same private view. Each action verifies that the pass is still active and valid for the current ESO environment; a revoked pass cannot submit a comment.

Visitors running a private Tour Pass can return from its tour list to the current stop, read and add comments on a Private house stop, and move from Tour Information into the copy preview in the same private screen. Stop comments verify that the pass and session are still active before opening or saving.

Tour Information lists stops as **Nickname (Official House) — @Owner** when a nickname exists, or **Official House — @Owner** otherwise. A tour-specific stop title takes the nickname position. Active progress summaries, completed routes, and their house picker use the same naming order.

When a Tour Pass session is left behind after its pass link closes, its old Tour List, Details, Comments, Next, and Previous buttons close that session without displaying the private route. Session advancement checks the pass link again within its transaction.

The pass creation limit applies when issuing a new Share Pass. Viewing a house, reading comments, toggling details, reviewing a house copy, and moving between Tour Information and a tour copy preview do not consume that limit. Screen lookups have a separate, higher limit (60 per five minutes by default); set `SHARE_PASS_ACCESS_RATE_LIMIT` and `SHARE_PASS_ACCESS_RATE_WINDOW_SECONDS` if needed. Revocation and environment checks still apply on every view.

Share Passes are bound to one ESO environment. Changing a guild's environment revokes affected passes and closes active pass-derived sessions.


## Data and privacy model

- Global, Server, and Private records never cross ESO environments.
- Server records never cross Discord guilds.
- Private records remain owner-only except through a revocable Share Pass.
- Environment changes use a fresh impact calculation and reject stale confirmation screens.
- Readable Discord names are stored beside important IDs and refreshed when newer identity information is observed.
- Active tour sessions are transient and are deleted when ended or replaced.
- Secrets and database credentials are never displayed by Administration Health.

Browse Tours keeps its selected tour and navigation controls when you return from Start a Tour preflight.

Featured houses have Open House buttons for details and comments. Returning from Comments preserves expanded house details, and Back returns to the originating Featured Housing screen. In browsable house lists, expanded details also persist when using Previous and Next, including for Non-Player homes. Opening a saved result checks current visibility, guild, ESO environment, and record status so stale list entries cannot expose inaccessible houses. Random House also rechecks each pick, skips inaccessible saved houses, and shows an empty state when no accessible result remains. Featured tours have Open Tour buttons. Tour cards and Start a Tour preflight return to the Featured Housing screen where they were opened.

Reordering Featured Housing retains an entry’s expiration date.

Featured Housing reorder controls stay with the selected entry after each move and stop at the end of its own House or Tour list. Changing an expiration keeps the entry in position and selected.

See the [current feature reference](HearthBound-current-state.md) and [HearthBound user and administrator guide](../HearthBound_User_Admin_Guide.docx) for additional detail.

## Registration and tour shortcuts

After saving an active house, choose **Add to a Tour**. Select an eligible existing tour alphabetically, or choose **Create New Tour**. The house is appended to the existing route or becomes the first stop of a new tour. Canceling or failing this step keeps the registered house saved. Pending submissions explain that tour addition becomes available after approval. An unknown official name or ID shows **No matching ESO house found** with a retry action that retains your input.

Search results still support multiple selection across pages. Previously selected houses keep their positions; newly selected houses append in the order Discord sends. Discord does not supply a reliable click history within one submission. The numbered preview is authoritative: choose a stop, use **Move Up** or **Move Down**, then **Confirm Order**. Use All Saved Results starts with search-result order.

## Requesting moderator access

Open **Help → Moderator Access**. **Request Server Moderator Access** applies to the current Discord server and is reviewed by its current HearthBound Server administrators. **Request Global Moderator Access** uses the existing centralized approval workflow for the current ESO environment. Neither grant exposes another member’s Private houses or tours.

## Main menu

The main screen is ordered Search Houses, Search Housing Tours, Register New House, Random House, Featured Housing, My Address Book, Administration (when authorized), and Support & Access. Random House chooses from accessible registered Global, Server, and your own Private houses in the current ESO environment; it excludes Non-Player catalog homes and other users’ Private houses. Another Random House avoids the previous destination when alternatives exist. Back returns Home. It is no longer a search-results action.

Featured Housing is also available directly from Home. Opening a featured house or tour retains a path to that list and Home. Administrators configure Featured Housing where they do now; its management screen has Back to Administration.

## The HearthBound web portal

On a phone, use **Menu** beside the HearthBound logo to open the full navigation. Links are grouped by discovery, your places, community, management (when authorized), and support. Escape closes the menu and returns focus to its button.

Use **Open Web Portal** on the Discord main menu or in Support & Access, or visit your server's configured portal URL. Sign in with Discord and choose a server. The header shows the selected server and ESO environment. **Your Access** lists every applicable role: Member, Server Administrator with server name, Global Administrator with environment, and Bot Owner. Both `/hearth` and the `/housing` compatibility alias open the same Discord menu.

The portal remembers sign-in for 30 days by default. Sign Out clears this browser's login; membership and permissions are still checked on protected requests. Administrators can configure `WEB_SESSION_DAYS`. A browser that clears cookies or uses private browsing may require another sign-in.

Open the circular Discord avatar in the header for your name, username, selected server/environment and current access, plus shortcuts to My Address Book, Change server, Support & Access, the Word guide and Sign out. Initials appear if an avatar is unavailable. Existing sessions can sign out and back in to refresh profile information. The menu works with Enter or Space, Tab through its links, and Escape to close and return focus to the avatar.

Choose **Download guide (Word)** from the account menu or the guide download button under **Support & Access**. The current HearthBound user and administrator guide is available to signed-in members as well as administrators; downloading it does not grant additional access.

**Search Houses** searches accessible house names, ESO owners, nicknames, and zones. Filter by visibility, open a house for details and copy-ready jump/preview/housing links, or edit a house you manage. **Register New House** accepts a pasted ESO Housing Link or Jump Command: choose **Read link or script**, review the extracted official house and ESO owner, then choose **Register house** to save. The manual catalog picker is also available. Choose Private, Server, or Global visibility as permitted. Shared submissions follow the server's registration and approval policy. A missing official house is reported clearly; a bot owner can add a new release to the catalog. After saving an active house, use **Create tour with this house** or **Add to your tour**.

**Housing Tours** lists tours alphabetically. Create a tour, set its name, description, and visibility, select houses, and arrange stops by dragging or with Move up and Move down. The displayed order is the draft order; **Save tour** commits it atomically. Cancel discards the draft. A stale save is rejected if another editor changed the route; reopen it before reapplying edits. The picker loads all accessible active registrations. Filter instantly by name or ESO owner, tags, visibility, zone, style, type and classification; filtering retains selected stops and does not save the draft. Global tours accept Global houses; Server tours accept houses from their source server plus Global houses; Private tours may additionally use their creator's Private houses.

Start or resume a self-paced web tour, complete the current stop and advance, or deliberately **Restart** a completed tour. Existing progress is reconciled when stops change. Shared leader-controlled Discord tours remain available in Discord. **Random House**, **Featured Housing**, and **My Address Book** provide discovery and personal collection views; featured house selections rotate weekly.

**Statistics** separates your Private count, Server registrations, Global registrations, and accessible community tours. Official-house rankings distinguish registrations, distinct registering Discord members, normalized ESO owners, and distinct tour appearances. Private records are excluded from community rankings. Fun facts include represented official house types and average shared-tour length; these are not counts of in-game visits.

**Recent Activity** shows recorded Discord and web usage across connected servers, newest first, with the member, originating server, and source. Filter by server or activity type and use Older activity for pagination. Private activity uses generic descriptions such as using My Address Book; Private destination references and search text are not stored in the public feed. Content links still require current access. History begins after deployment and retains a 90-day window; no historic usage is fabricated.

## Expanded web workflows

See the [HearthBound web workflow guide](web-workflows.md) for personal collections, saved searches, comments, reports, deletion, self-paced tours, sharing and administration. Controls and navigation follow current HearthBound permissions; other members’ Private records remain protected.


## My Address Book and navigation

My Address Book is your intentional collection: submitted houses, favorites, places you want to visit, and visited places. Simply viewing a house does not add it. All Saved Places combines those lists without duplicate physical destinations; Submitted shows just your registrations. Clearing one mark does not delete the registered house or remove independent marks.

House details show visit commands, official information and all normally visible tours containing that destination. Private or foreign-server tours you cannot normally view are omitted. Featured Housing includes descriptions, owner, location and tour stop counts. Comments show author and timestamp above their text.

Numbered page controls and Jump to page are available when totals are known. Filtered lists retain their criteria when navigating. In Discord, paginated pickers offer Jump to Page when more than one page exists.

## Joining a new Discord server

Choose the ESO environment first. Under Support & Access, the Discord server owner or someone with Manage Server permission can confirm initial HearthBound Server administration if no administrator role or individual grant exists. HearthBound verifies current membership and authority before creating the first grant. Discord permissions only allow that initial setup; ongoing editing and moderation use HearthBound roles and approved grants.

After setup, administrators can configure Server roles and review Server access requests. Global access is a separate request for an ESO environment, reviewed by bot owners or configured approvers. It is never granted merely by installing the bot or being a Discord administrator.

Tour builders can enter optional tour-specific notes directly on each draft stop, or when adding a house from its detail page. These notes guide visitors during that tour and never replace the house description. Save tour keeps stop order and notes together.

House screenshots: open a house’s gallery on the web or select Screenshots in Discord. Add up to eight images with optional captions using the web upload form or `/hearth house:… screenshot:… caption:…` (also `/housing`). Only house editors can upload, choose the cover, or remove screenshots. Private images remain creator-only.

House discovery uses descriptive cards with Favorite, visit status, View house and Add to tour actions. Basic Search also offers Compact list. Cards and pagination retain filters; tags open matching searches. My Address Book puts All saved, Favorites, Want to Visit and Visited first on web and Discord, followed by submitted records and organizing tools.

Web lists with multiple pages offer numbered navigation and Jump to page. Stale page links return to an available page while retaining filters. If the last item on a page is deleted or no longer matches, earlier records remain reachable instead of showing a misleading empty list. Saved-place categories use the same paging controls.

House and tour editors retain entered fields when a save fails. Tour recovery keeps stop order and tour-specific notes, and marks the recovered route as unsaved. If someone changed the tour since you opened it, Save remains blocked: use Open latest editor to compare with the current version in another tab and reapply your changes there. No automatic overwrite occurs.

Recent Activity shows a full date and time for each action in your browser’s local time zone, including a zone label. Newest-first ordering is unchanged. If browser localization is unavailable, the complete timestamp remains labeled UTC.

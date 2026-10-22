# Member guide

[Back to README](../README.md)

## Getting started

First-time users can choose **Show Me Around** for a seven-screen introduction covering search and filters, flexible house registration, copy-ready ESO links, My AddressBook, tour modes, Share Passes, visibility, environment boundaries, and reporting. Each screen can open the real feature it describes after recording onboarding completion; Back from its first feature screen returns to the same introduction page, including from Search after clearing filters. Help can replay the introduction later. **Help & Learning** also includes a release-specific **What’s New** guide and shortcuts to Search, Houses, Tours, Sharing, and Administration. Acknowledging release notes does not reset or alter the original completed/skipped onboarding status.



## ESO environments

Every Discord server must choose one ESO environment the first time `/housing` is used:

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

Filtered results can be saved by name and reopened from **My AddressBook → Saved Searches**. Saved searches can be run, renamed, replaced with the current filters, or deleted. They store criteria rather than result IDs, so every run applies the current Discord server, ESO environment, and access permissions. Invalid or future-version filter data fails closed instead of becoming an unfiltered search.

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

AddressBook cannot bypass ESO visitor permissions.

Comments attach to the environment-specific ESO destination, not to one visibility entry. Matching Global, Server, and Private entries for the same ESO owner and official house share their comment history inside that environment.

Every accessible player or Non-Player house includes **Personal Actions**. A member can independently mark a destination as a Favorite and set one visit state: Want to Visit, Visited, or neither. These private preferences do not change house visibility or grant access. My AddressBook provides paginated Favorites, Want to Visit, Visited, and Saved Searches lists, and inaccessible destinations are removed from personal list results at read time.


## Tours

Tour dropdowns list names alphabetically without separating uppercase and lowercase names. Sorting happens before pagination.

Tour creators can edit their own accessible tours. AddressBook's configured Server Housing Moderators can also edit Server tours belonging to their Discord server. Approved Global Housing Moderators can use **Housing Tours → Edit Tour** to edit anyone's Global or Server tours within their authorized ESO environment, including Server tours belonging to other Discord servers. Private tours and houses remain owner-only; administrator roles do not grant access to them. Administrative editing does not grant Share Pass creation or tour playback access. Discord's Administrator permission does not grant AddressBook tour-editing rights.

- A **Global Tour** is available only in the same ESO environment and contains Global houses from that environment.
- A **Server Tour** contains Global houses from the same environment and Server houses from the current Discord server.
- A **Private Tour** contains accessible Global and Server houses plus the creator's Private houses, all in one environment. Stop insertion enforces the creator's ownership of Private houses and the tour's source guild for Server houses. Search-result bulk actions recheck selected houses before creating or extending a tour; changed results require a fresh search.

Browse Tours keeps the selected list active and provides Previous Tour and Next Tour controls on each tour card. Starting a tour first opens Tour Preflight, which reports the route's visibility, ESO environment, stop count, accessibility warnings, and any blocking missing, archived, duplicate, wrong-environment, or visibility-incompatible stops. Warnings allow the tour to proceed; blocking problems must be corrected first.

Self Paced tours create a private active run for one member. Shared tours post the current stop in a channel, but only the initiating leader can navigate or end the run. Starting either mode immediately shows the complete current house card with copy-ready ESO links and Previous/Next controls. More Details shows full catalog metadata—including standard and ESO+ furnishing and collectible limits—and remains expanded while moving between stops. Comments and Show Tour List return to the same stop and expanded/compact state. When the current viewer may edit the saved house, Edit House returns to the same tour stop and detail state after saving. Share Pass tours create an independent ephemeral Self Paced run for each visitor.


## Featured Housing and progress

Housing Moderators can curate up to five eligible Global or Server player houses and tours as Featured Housing. Featured House cards include copy-ready Jump in ESO and Housing Link values. Non-Player/base houses are never selected. Featured entries are limited to the guild's exact ESO environment and are automatically hidden when the underlying content is no longer active, visible, or eligible. If a Server house or tour moves to another Discord guild, its old guild's Featured list stops displaying it. Featured Houses rotate every seven days, including manually selected houses. Selection prefers destinations outside the previous weekly list, fills up to five distinct destinations when available, and preserves its deadline across restarts. Manual changes and expiration controls do not postpone it. Existing eligible selections on upgrade get their first refresh seven days after initialization; an empty list fills immediately. Featured Tours remain manually selected.

Self-Paced starts are recorded in My AddressBook → Tour Progress. Members can resume, move to the previous or next stop, restart a run, and review completion history. When several runs exist, active and completed routes are paginated five at a time, with a working Resume or View Route button for every entry. Resuming a run from a later active list page preserves that page through stop controls, details, comments, and the tour list; Back returns to the same active list page. Completion History also retains the active list page while browsing completed routes and houses, so returning to Tour Progress resumes at that page. The current progress card shows the complete house, population limit, owner, tour-specific notes, jump values, and optional expanded catalog details without requiring a separate Open House action.

Completion History remembers its list page while a member opens a route, browses its completed stops, or opens a completed house. Back returns to the page of routes they came from.


## Share Passes and copying

To share a House or Tour Pass:

1. Choose Share Pass on the house or tour.
2. Select a destination channel. Channel lists are paginated, 25 per page.
3. Optionally select an accessible active thread, or choose **Post in This Channel**.
4. Review the destination and confirm with **Post House Pass** or **Post Tour Pass**. Nothing is posted before this confirmation.

Forum and media channels require an existing thread/post because Discord does not allow direct messages in their parent channel. Thread lists are paginated; only unlocked active threads accessible to both you and AddressBook are listed. You can also paste a channel/thread link, mention, or ID. Archived unlocked threads remain available by link and may reopen when posted to. Both you and AddressBook need View Channel and the relevant sending permission; the bot also needs Embed Links and Read Message History. Cancel exits without issuing a pass.

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

See the [current-state reference](AddressBook-v1.0.0-Current-State.md) and [user and administrator guide](../AddressBook_v1.0.58_User_Admin_Guide.docx) for additional detail.

## Registration and tour shortcuts

After saving an active house, choose **Add to a Tour**. Select an eligible existing tour alphabetically, or choose **Create New Tour**. The house is appended to the existing route or becomes the first stop of a new tour. Canceling or failing this step keeps the registered house saved. Pending submissions explain that tour addition becomes available after approval. An unknown official name or ID shows **No matching ESO house found** with a retry action that retains your input.

Search results still support multiple selection across pages. Previously selected houses keep their positions; newly selected houses append in the order Discord sends. Discord does not supply a reliable click history within one submission. The numbered preview is authoritative: choose a stop, use **Move Up** or **Move Down**, then **Confirm Order**. Use All Saved Results starts with search-result order.

## Requesting moderator access

Open **Help → Moderator Access**. **Request Server Moderator Access** applies to the current Discord server and is reviewed by its current AddressBook Server administrators. **Request Global Moderator Access** uses the existing centralized approval workflow for the current ESO environment. Neither grant exposes another member’s Private houses or tours.

## Main menu

The main screen is ordered Search Houses, Search Housing Tours, Register New House, Random House, Featured Housing, My Address Book, Administration (when authorized), and Help. Random House chooses from accessible registered Global, Server, and your own Private houses in the current ESO environment; it excludes Non-Player catalog homes and other users’ Private houses. Another Random House avoids the previous destination when alternatives exist. Back returns Home. It is no longer a search-results action.

Featured Housing is also available directly from Home. Opening a featured house or tour retains a path to that list and Home. Administrators configure Featured Housing where they do now; its management screen has Back to Administration.

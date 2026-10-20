# AddressBook v0.8.0 Personal Discovery and Adoption Design

## Purpose

This specification defines AddressBook v0.8.0, the adoption-focused release after v0.7.0. Its purpose is to make it easier for ESO players to discover houses, remember places they care about, return to houses they want to visit, reuse searches, and move directly from onboarding into real features.

The release adds:

- interactive actions to the seven-page Show Me Around experience;
- Favorites;
- Want to Visit and Visited states;
- saved house searches;
- Surprise Me discovery;
- corresponding My AddressBook sections;
- SQLite and MariaDB schema support and two-way transfer support.

Existing visibility, ESO-environment, sharing, moderation, search, and tour rules remain authoritative. User-facing visibility choices continue to appear in Global, Server, Private order.

## Success Criteria

The release is successful when:

1. A user can mark an accessible player destination or Non-Player House as a Favorite.
2. A user can independently classify a house as Want to Visit or Visited.
3. A user can find Favorites, Want to Visit, and Visited lists in My AddressBook.
4. Personal state is private and never expands the user's access to a house.
5. Losing access hides a personal-state entry without discarding it, and regaining access makes it visible again.
6. A user can save the active Search Homes filters under a reusable name and run the saved search in the current guild and ESO environment.
7. Surprise Me selects only from houses the user can currently access and from the active filtered result set when filters are active.
8. Show Me Around can launch the feature being demonstrated and correctly records onboarding completion.
9. Lists and selectors work when more than 25 entries exist.
10. SQLite, MariaDB, normal schema upgrades, and guarded two-way database transfers preserve the new data.
11. Existing AddressBook behavior continues to pass its regression suite.

## Non-Goals

The following remain planned for v0.9.0 or v1.0.0 and are not part of this release:

- tour scheduling and RSVPs;
- optional notifications;
- featured houses or tours;
- tour progress history beyond the existing active-session behavior;
- tour preflight expansion;
- administrative audit, backup, export, integrity, and duplicate-management centers;
- automated house-freshness reminders.

## Terminology

### Personal house state

Private per-user metadata attached to a stable house target. Favorite is an independent Boolean. Visit state is exactly one of None, Want to Visit, or Visited.

### Player destination

A row in `housing_destinations`, identified by ESO environment, normalized ESO owner, and official house ID. Personal state follows the destination rather than one Global, Server, or Private saved entry.

### Non-Player House

An official catalog house from `houses`, shown without a player owner. Its target identity is the catalog `house_id`.

### Saved search

A named, user-owned template containing validated Search Homes filters. It does not contain result IDs and does not grant access to any result.

## Architectural Decision

Personal discovery data will be stored as first-class relational records rather than as Private saved-house copies or unstructured data attached to Discord interactions.

This model is preferred because:

- Favorite and visit state describe a destination, not one visibility-specific saved entry;
- it avoids creating duplicate Private house records merely to remember a house;
- it supports player destinations and Non-Player Houses consistently;
- access can be reevaluated every time a list is displayed;
- it can be transferred reliably between SQLite and MariaDB.

The feature is divided into three focused services:

1. `UserHouseStateService` manages Favorite and visit-state persistence.
2. `SavedHouseSearchService` validates, stores, names, executes, and deletes saved searches.
3. `HouseDiscoveryService` chooses Surprise Me results from the existing access-controlled search output.

The services depend on the existing destination, search, access-context, identity, and guild-environment behavior. They do not implement separate visibility rules.

## Personal State Model

### Table: `user_house_states`

The exact SQL types follow existing SQLite and MariaDB conventions.

- `id`
- `discord_user_id`
- `discord_global_name`
- `discord_display_name`
- `target_kind`, constrained to `destination` or `official`
- `target_id`
- `house_name`
- `eso_owner`, nullable for Non-Player Houses
- `is_favorite`, default false
- `visit_state`, constrained to `none`, `want_to_visit`, or `visited`
- `last_visited_at`, nullable
- `created_at`
- `updated_at`
- unique constraint on `discord_user_id, target_kind, target_id`
- index supporting user list queries by Favorite and visit state

For `destination`, `target_id` is `housing_destinations.id`. For `official`, it is `houses.house_id`. A generic target pair is used instead of two nullable foreign keys so uniqueness and upsert behavior remain consistent across SQLite and MariaDB. The service validates that the referenced target exists before inserting or updating a row.

Readable Discord, house, and ESO-owner fields are companion fields. Stable IDs remain authoritative. Existing identity-refresh behavior updates the Discord names when a later interaction provides newer names. Resolving a target refreshes cached house and owner names when authoritative data has changed.

### State rules

- Favorite is independent of visit state.
- Favorite plus Want to Visit is valid.
- Favorite plus Visited is valid.
- Want to Visit and Visited are mutually exclusive.
- Selecting Want to Visit sets `visit_state=want_to_visit` and clears `last_visited_at`.
- Selecting Mark Visited sets `visit_state=visited` and records the current database-compatible timestamp.
- Selecting Clear Visit Status sets `visit_state=none` and clears `last_visited_at`.
- Removing Favorite changes only `is_favorite`.
- A row with Favorite false and visit state None is deleted instead of retained as an empty record.

All state changes are idempotent. Repeating an action cannot create duplicates or contradictory states.

### Destination lifetime

Deleting one Global, Server, or Private saved-house entry does not delete a player destination or its personal state. If no accessible saved entry remains, the personal state is retained but hidden. It can reappear if the same destination becomes accessible later.

Personal state is removed only when the underlying `housing_destinations` or `houses` target is intentionally and permanently removed. Normal saved-entry deletion is not permanent target deletion.

## Saved Search Model

### Table: `saved_house_searches`

- `id`
- `discord_user_id`
- `discord_global_name`
- `discord_display_name`
- `name`
- `normalized_name`
- `filter_version`
- `filters_json`
- `created_at`
- `updated_at`
- unique constraint on `discord_user_id, normalized_name`
- index on `discord_user_id, updated_at`

Search names are trimmed, length-limited to fit Discord presentation, and normalized case-insensitively. Names are unique per Discord user, not globally.

`filters_json` stores only the normalized filter object accepted by the existing Search Homes flow:

- house or nickname partial text;
- owner partial text;
- tags;
- themes;
- zone;
- architectural style;
- ESO classification;
- size or type;
- house visibility;
- Non-Player House inclusion;
- not-currently-in-public-or-global-tour filter.

Pagination, selected result, Discord component state, guild ID, ESO environment, and result IDs are not stored.

`filter_version` begins at 1. Reading always parses and validates the stored JSON. If a future release cannot safely interpret a saved version, the bot explains that the search must be edited or deleted rather than running it incorrectly.

Submitting a name that already exists does not silently overwrite it. The bot presents Replace Existing and Cancel. Replacement updates the filters and timestamp while preserving the record identity.

## Access and Privacy Rules

Personal state and saved searches are visible only to their owning Discord user. They are never included in public house cards, public tour cards, moderation screens, comments, reports, or another user's AddressBook.

Personal data never grants house access. Before displaying or acting on a player destination, AddressBook reevaluates current access through existing rules:

- Global requires the current guild's ESO environment and an active matching Global entry.
- Server requires an active entry for the current Discord guild and matching ESO environment.
- Private requires the user to own an active matching entry.
- Pass-only Private access is valid only while the specific share pass is active and the interaction remains within its authorized context.
- Non-Player Houses remain catalog entries and are available according to existing search behavior.

When more than one accessible saved entry represents a destination, destination resolution chooses a display entry deterministically in Global, Server, Private order. This affects the card used for navigation, not the destination-level personal state.

A personal list opened from My AddressBook does not treat a previously used Share Pass as durable access. An inactive or revoked pass therefore cannot expose a Private house in Favorites, Want to Visit, or Visited. The state remains stored and may still be shown inside a newly authorized pass interaction or reappear in My AddressBook if normal access is later gained.

Saved searches are user-level templates, but execution is contextual. Every run uses the current guild ID, current guild ESO environment, current Discord user, current permissions, and current database contents. A saved search created in one guild may be run in another guild, but only results accessible in the new context are returned.

## Discord User Experience

### Personal Actions

Accessible player-house and Non-Player-House detail cards gain a **Personal Actions** button where component capacity allows. If an existing card is already at a safe Discord component limit, the action is placed in its existing secondary actions or More menu rather than adding another crowded row.

Pressing Personal Actions opens or updates an ephemeral panel containing:

- Add Favorite or Remove Favorite, according to current state;
- Want to Visit;
- Mark Visited;
- Clear Visit Status, when a visit state exists;
- Return to House.

The panel states that these choices are private. After an action, the same panel refreshes with the new state and a concise confirmation. The public source card is not edited to reveal personal information.

### My AddressBook

My AddressBook adds four entries:

- Favorites;
- Want to Visit;
- Visited;
- Saved Searches.

Favorites and Want to Visit use the standard house selector and card pattern. Visited sorts by `last_visited_at` descending, then by house name. Each list supports more than 25 entries through pagination. Empty states explain how to populate that section and link back to Search Houses.

Saved Searches displays a paginated selector ordered by most recently updated, then name. Selecting one shows its name and a readable summary of active filters with these actions:

- Run Search;
- Rename;
- Replace Filters with Current Search, when a current search context exists;
- Delete;
- Back.

Destructive deletion requires confirmation.

### Saving searches

Search results gain **Save Search** when at least one meaningful filter is active. Pressing it opens a modal requesting the search name. An unfiltered all-houses view is not saved because the main Search Homes entry already provides that behavior.

Successful saving returns to the current result list without discarding filters or selection. A duplicate normalized name presents a separate Replace Existing or Cancel confirmation.

### Surprise Me

Search Homes gains **Surprise Me**:

- from the initial all-houses screen, it chooses from all currently accessible houses in the current guild and ESO environment;
- from a filtered result screen, it chooses from those active results;
- from a saved-search result screen, it chooses from the results of that saved search.

The selected house appears through the normal house-details renderer and includes **Another Surprise**. Rerolling keeps the same access context and filters. Selection uses the complete logical result set before Discord's 25-option selector pagination, not merely the currently displayed page. When more than one eligible result exists, the current surprise is excluded from the immediate reroll. With one result, that result may repeat with an explanatory note.

Random choice occurs in application code after ordinary search and access filtering. This avoids backend-specific `RANDOM()` and `RAND()` behavior and prevents selecting an inaccessible row.

### Interactive Show Me Around

The existing seven informational pages retain Back, Next, Finish, and Skip navigation and gain one contextual action where appropriate:

- Find the Right House: Try Search;
- Register in Seconds: Register a House;
- Visit and Explore: Try Search;
- Your AddressBook: Open My AddressBook;
- Build and Follow Tours: Browse Tours;
- Share Without Going Public: Browse Tours;
- Visibility and Safety: Open Help or continue to Finish.

Launching a demonstrated feature records onboarding as completed before entering the target feature. Finish also records completion. Skip records skipped status. Help continues to provide Show Introduction Again regardless of prior completion or skipping.

Where Discord component limits require it, each page uses at most one row for navigation and one row for its contextual action. Existing component-limit verification remains mandatory.

## Application Flow

### Personal-state update

1. Resolve the stable target from the displayed house context.
2. Recheck that the target currently exists and the user can view it in the interaction context.
3. Normalize the requested transition.
4. Upsert or delete the personal-state row transactionally.
5. Refresh readable companion names from current authoritative context.
6. Render the refreshed ephemeral Personal Actions panel.

### Personal list

1. Load the requesting user's candidate state rows for the requested list.
2. Resolve each target in the current guild and ESO environment.
3. Apply ordinary access checks and discard inaccessible display results without deleting state.
4. Deduplicate by stable target.
5. Sort and paginate the accessible results.
6. Render the standard selector and house card.

The service must not use an unrestricted SQL join that accidentally turns stored state into access. Access filtering is explicit and testable.

### Saved-search execution

1. Load the search by ID and owner ID.
2. Parse `filters_json` and validate `filter_version`.
3. Normalize the filter object with the same validator used by Search Homes.
4. Execute through the existing current-context search path.
5. Display results using the existing result selector, filters summary, result actions, and pagination.

### Surprise selection

1. Obtain the active result set from the ordinary search path.
2. Confirm the set contains at least one accessible result.
3. Exclude the immediately previous result when possible.
4. Select one result using Node's cryptographically strong integer selection facility.
5. Render it through the normal details flow so visiting, sharing, copying, comments, tour membership, and personal actions behave consistently.

## Error Handling and Concurrency

All user-facing failures are ephemeral and actionable.

- If a target was deleted or became inaccessible after rendering, respond that it is no longer available and offer Back to Search or My AddressBook.
- If Surprise Me has no eligible result, explain that no accessible houses match and offer Filters or Clear Filters.
- If saved-search JSON is malformed or its version is unsupported, do not broaden or silently alter the search; offer Delete and Back.
- If a saved-search name conflicts, offer Replace Existing and Cancel.
- If a component is stale, reload the owning view when safe; otherwise explain that the view expired and provide a route back.
- If a database operation fails, do not show success. Log the technical error and show a short retry message.
- Concurrent personal actions rely on the unique target constraint and backend-appropriate atomic upsert behavior.
- Multi-step replacement, rename, or deletion operations use ownership checks inside the transaction rather than trusting a prior component render.

MariaDB writes use native `Date` values or database timestamp expressions. They must not bind ISO strings with a trailing `Z` into DATETIME columns.

## Schema Upgrade and Two-Way Transfer

v0.8.0 introduces schema migration version 6 for SQLite and MariaDB. The migration creates `user_house_states` and `saved_house_searches`, their constraints, and their indexes. It does not rewrite or delete existing AddressBook data.

The guarded `MIGRATE` process adds both tables to the persistent transfer manifest:

- SQLite to MariaDB copies all personal-state and saved-search rows after clearing the destination database under the existing explicit migration contract.
- MariaDB to SQLite does the same.
- Readable companion fields and timestamps are included.
- Transfer verification compares source and destination row counts for both tables.
- Runtime interaction state remains excluded according to existing policy.

The ordinary startup migration remains nondestructive. A database with a newer schema version than the running bot continues to be rejected.

## Identity Refresh

Every successful personal action or saved-search mutation records the current Discord global and display names. Existing identity refresh work will include the two new tables so that later observed name changes update associated records consistently.

House and ESO-owner companion names are refreshed when a personal target is successfully resolved. Stable IDs determine relationships; cached names never determine authorization or identity.

## Testing Strategy

Implementation follows test-driven development. Tests must cover both service behavior and Discord payload constraints.

### Personal-state tests

- create and remove Favorite;
- Favorite combined with each visit state;
- Want to Visit to Visited and Visited to Want to Visit transitions;
- clearing visit state without clearing Favorite;
- empty-row deletion;
- repeated and concurrent actions without duplicates;
- player destinations shared by multiple saved entries;
- Non-Player House targets;
- readable-name refresh.

### Access tests

- Global results restricted to the current ESO environment;
- Server results restricted to the current guild and environment;
- Private results restricted to the owner;
- inactive and revoked pass behavior;
- hidden state after access loss and reappearance after access restoration;
- no cross-user personal-state visibility;
- deterministic Global, Server, Private display-entry preference.

### Saved-search and discovery tests

- filter round-trip and validation;
- same-name normalization and replacement confirmation;
- rename and deletion ownership checks;
- contextual execution in a different guild or environment;
- current access reevaluation;
- existing not-in-tour and Non-Player filters;
- more than 25 saved searches and personal-list entries;
- Surprise Me with zero, one, and multiple results;
- reroll exclusion when possible;
- filtered Surprise Me never leaving the active result set.

### Onboarding and UI tests

- seven pages retain navigation;
- contextual button routes;
- completion before entering a demonstrated feature;
- replay from Help;
- Discord row, button, select-option, label, description, modal, and custom-ID limits;
- Personal Actions remains ephemeral and does not edit public cards with private state.

### Database tests

- SQLite schema version 6;
- MariaDB schema version 6;
- clean installation;
- upgrade from v0.7.0/schema version 5;
- two-way transfer manifests, row counts, names, filter JSON, and timestamps;
- MariaDB-compatible datetime writes;
- full existing regression suite.

## Documentation and Release

The implementation release will:

- increment application, package, lockfile, health display, and documentation versions to 0.8.0;
- update the current-state guide and user/admin guide without adding revision-history framing;
- document Favorites, visit states, saved searches, Surprise Me, and interactive onboarding;
- retain copy-ready ESO Jump, Unfurnished Preview, and Housing Link values in separate code blocks wherever those values are displayed;
- produce a clean ZIP that excludes `.git`, worktrees, `node_modules`, `.env`, local databases, secrets, and implementation-planning artifacts not intended for users;
- run the complete automated test suite and ZIP-integrity checks before release.

## Deferred Roadmap

After v0.8.0, the intended sequence remains:

- v0.9.0: tour scheduling, RSVPs, optional notifications, featured content, and engagement tools;
- v1.0.0: operational hardening, expanded preflight and progress tools, audit viewing, backup/export, data-integrity diagnostics, duplicate management, and house freshness.

Each later subsystem receives its own design and implementation review before code changes.

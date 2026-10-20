# AddressBook v1.0.58 Current State

AddressBook is a menu-driven Discord bot for ESO housing discovery, saved addresses, comments, controlled sharing, guided tours, scheduled events, Featured Housing, persistent self-paced progress, and long-term administration.

Creators can deliberately start a Private tour in Shared mode without changing its saved visibility. Session authorization is persisted at launch; spectators can view the route, return to the current stop, and comment on Private stops while only the leader advances or ends the tour. Changing tour visibility or its source server closes existing Shared sessions. Ordinary name or description edits keep the session open. Older Private Shared sessions without explicit launch authorization must be restarted. Tour Pass Information, Start, and Copy actions acknowledge Discord before database work, avoiding timeout failures. Global Moderator decisions also acknowledge immediately, refresh stale queues safely, and do not expose raw service errors.

Tour names, descriptions, stop titles, stop notes, house nicknames, house descriptions, event titles, and event descriptions are validated before database persistence for both SQLite and MariaDB. Discord modals advertise the same limits, while legacy oversized records are bounded safely when rendered. Event cards now display the optional description. Event, Featured Housing, and Tour Progress views bound each logical field and the completed Discord payload, preventing oversized imported records from causing Invalid Form Body errors. Web Audit Log page values are normalized to positive whole numbers, including fractional, infinite, negative, and nonnumeric input.

The web Audit Log filters Action and Target by case-insensitive partial text. Target searches match readable names and IDs; percent signs and underscores remain literal. Page links and CSV downloads retain the same filters.

Tour Pass Information displays the authorized route, and Copy Tour cancellation returns there without making a copy. Global Moderator grants left without an environment by older database versions are assigned only when the approved origin request identifies a guild with a known ESO environment. Unresolved legacy grants can be revoked so a member can request access again. Review requests show saved applicant and server names, falling back to known Discord identity records.

Self Paced tour List, Details, Comments, Edit, and Return controls require the session leader, including when an old button ID is reused; Shared spectators can still view their route.

Saved tour Resume, Start Over, and End controls require the original Discord server and channel. Resume and Start Over also recheck the route against current house eligibility before rendering or changing the saved session.

Shared and Self-Paced runs render the current saved-house card immediately. The card includes population capacity, tour context, owner, metadata, notes, copy-ready ESO jump values, and Previous/Next navigation. Expanded details show normal and ESO+ furnishing and collectible limits and remain expanded between stops. Authorized house editors can edit from the run and return to the same stop and display state; Shared route navigation remains leader-only.

Adding multiple stops to an existing tour commits as one transaction. Add House and saved tour picker choices recheck access and management permission when selected. Tour copies check source Private ownership and Server guild during the transaction. Shared navigation rechecks current stop eligibility before showing a card and clamps the position to the current route after a stop is removed. Self Paced progress likewise checks route eligibility before navigation and display; an invalid route shows a change notice instead of house details.

Event completion checks the current guild and ESO environment. Cancelling an event that has never started preserves an independent shared tour in the same channel. Completed-route history filters houses that no longer qualify for the tour, including houses changed to Private or moved to another environment.

Closed events reject edits and further cancellation. An event already in progress cannot be rescheduled, and event titles must remain nonempty. Concurrent Self Paced starts for the same user and tour return the existing saved run.

Event starts recheck stop eligibility and leave the event unstarted if the route is blocked. Starting, cancelling, and completing an event update its shared session in the same transaction; a failed transition restores both. The event host leads the shared session even if a moderator starts the event. Upcoming Events has five entries per page with Previous and Next navigation within Discord component limits. Featured Housing hides expired or inaccessible entries and automatically selects eligible replacements when the house list is empty. Automatic selection saves the complete refill in one transaction, so a failed insert leaves no partial selection. Global Moderator requests from all guilds are available to configured approvers through a paginated queue.

The web console requires an explicit new guild selection when access to the previously selected guild is lost; it does not silently switch administration context. In web-only mode, Discord routes the migrated tools to the console while retaining settings and other Discord-only tools. Guild exports include events only from the selected guild and omit stale Featured entries outside its ESO environment. Full database transfers preserve Private ownership, originating guild, environment, and tour stop relationships. Global Moderator grant management paginates beyond 25 grants.

Guild exports omit expired Featured entries and tour stops whose saved houses fall outside the exported house set. Global Moderator authorization refreshes the current grant before each interaction. An approval updates its permission cache only after the transaction commits, and a denial must still find the request pending when it writes its review and audit entry.

Tour Preflight runs before either mode starts. It shows visibility, exact ESO environment, route size, accessibility advisories, and blocking route problems. Warnings do not prevent a start; missing, archived, duplicate, wrong-environment, or visibility-incompatible stops do. Browse Tours retains its result list and offers Previous Tour and Next Tour navigation. Comments and route-list subviews return to the same active stop and expanded/compact detail state.

## Help and learning

Help includes a durable Help & Learning screen. Members can replay Show Me Around, review What’s New for the current release, or open a topic directly. Each Try action opens the corresponding feature; Back on its landing screen returns to the same introduction page, even when two pages open the same feature. Search keeps the return path when filters are cleared or reapplied. Replay and release-note acknowledgement are versioned per user without resetting completed or skipped onboarding.

## Optional web administration

The optional web console is Discord-authenticated and server-side permission checked. If a user moderates multiple bot guilds, the console requires an explicit Discord server selection, displays that server’s ESO environment, remembers the selection in a signed session, and offers Change Server navigation. It rechecks the selected guild, current membership, Housing Moderator role, and exact environment on every request. It exposes Overview, Audit Log, Maintenance, Pending Review, Problem Reports, and Backup & Export for authorized Housing Moderators. The Overview includes read-only integrity, freshness, duplicate, and reminder-health metrics for the current guild and exact ESO environment. Backup & Export provides a portable JSON snapshot plus safe SQLite and MariaDB backup guidance; Server and compatible Global data plus Private houses and tours originating in this guild are included; other guilds and environments are excluded. Audit Log pages show stable IDs and readable names with explicit Previous and Next navigation plus Action and Entity type filters, scoped to the current guild. A CSV download includes all matching entries across pages, with spreadsheet-safe IDs and text. Pending Review displays eligible Server and Global submissions in groups of 25 with Previous and Next controls. An audited, CSRF-protected approval or rejection returns to the same page. Problem Reports displays 25 actionable reports per page and provides CSRF-protected Mark reviewing, Resolve, and Dismiss actions. Server and Share Pass authority is rechecked against the selected guild and exact ESO environment; Private Share Pass target details remain redacted when the moderator lacks normal target access. Maintenance supports CSRF-protected verification of stale houses and exact-context duplicate merging. Private duplicate merges are available in web Maintenance when both entries originate in the current guild and have the same owner and ESO environment. When a guild has no active Featured houses, the engagement worker fills up to five house slots from eligible Public or Global entries at random for that guild and environment; it never replaces an existing Featured house. It does not expose a public directory, normal member workflows, house editing, or deletion. Configure `WEB_ADMIN_ENABLED`, `WEB_SESSION_SECRET`, and the Discord OAuth values from `.env.example`; use HTTPS or a trusted reverse proxy. `ADMIN_INTERFACE=both` keeps Discord and web administration available; `ADMIN_INTERFACE=discord` disables the web console; `ADMIN_INTERFACE=web` leaves Discord-only administration tools accessible and routes the six migrated tools to the web console; it requires the web console to be enabled.

## Operational tools

Discord OAuth return paths are limited to local `/admin` pages. The callback replaces external, protocol-relative, or malformed destinations with `/admin` before redirecting the signed-in user.

Featured lists recheck the underlying Server house or tour's guild on every read. Featured houses must be saved Server or Global player destinations; Non-Player/base houses and ownerless legacy rows are excluded. The Featured screen includes copy-ready Jump in ESO and Housing Link values. A formerly eligible Server entry moved into a different guild is hidden from the original guild immediately; an empty house list can then be replenished with eligible entries from that guild and the same ESO environment.

Housing Moderators have four v1.0 maintenance tools in Administration:

- Audit Log: a paginated history filtered to the current Discord guild. Action and Entity type selections narrow both the entries and the total across pages. Download matching audit entries (CSV) exports all matching rows, including entries beyond the visible page. Entries from earlier ESO environments within the same guild remain visible. Stable IDs remain authoritative while readable names are shown when available; CSV guards long Discord IDs and formula-like text for spreadsheet use.
- Export Data: a downloadable JSON snapshot of the current guild and exact ESO environment. Server and Global data and this guild’s Private houses and tours are included. Private entries with no known originating guild require a full database backup.
- Health: connection, schema, queue, report, pass, reminder, integrity, freshness, and duplicate-group summaries. Health never displays passwords, tokens, or private event details.
- Maintenance: mark houses verified and review or merge exact-context duplicate saved entries.
- Problem Reports: review the selected guild and environment's actionable reports, with Private Share Pass details redacted when required, and mark them reviewing, resolved, or dismissed.

## Integrity and duplicate rules

Integrity checks detect orphaned tour stops, duplicate destinations inside routes, saved-house/destination environment mismatches, and active progress pointers to missing stops. Safe structural repairs are transactional and renumber routes after removing orphan stops. Progress reconciliation advances to the next uncompleted stable stop or completes the run when none remain.

My AddressBook paginates active Tour Progress and completed route lists five at a time. Every visible run has a Resume or View Route action, and completed stop history opens with stops in route order.
Completion History retains the list page while browsing a route and its completed houses, so Back returns to the same page of completed routes.

Duplicate management is deliberately conservative. Two entries can be merged only when their destination, exact ESO environment, visibility, guild or owner context, and active status match. The kept entry receives comments and compatible stops; the redundant entry is archived; the operation is audited.

## House freshness

Catalog houses with no verification date or a verification date older than the maintenance threshold appear in the stale-house list. Marking a house verified updates the catalog timestamp and records the moderator action. Freshness does not change visibility or grant access.

## Existing AddressBook guarantees

Global, Server, and Private visibility remains ordered Global, Server, Private and is always constrained by the exact ESO environment pair. Private records remain owner-only except through controlled Share Pass or one-time sharing. House Share Pass comments, comment submission, More Details, and Copy House cancellation use the active pass for access, including a fresh check before a comment is saved. Private Tour Pass visitors can return from the tour list and add comments to the current Private stop while the pass and session remain active. Tour Information and progress routes display a stop nickname or tour-specific title before the official house name and ESO owner. Old Tour Pass controls close any leftover session whose pass link has closed; advancement checks that link in its transaction. Opening a pass or moving between its screens does not use the pass creation quota. Events, progress, comments, tours, and moderation grants never cross PC NA, PC EU, Xbox, PlayStation, or PTS boundaries.

SQLite and MariaDB remain supported. `MIGRATE=true` performs the guarded one-time transfer toward the backend selected by `DB_TYPE`; it preserves persistent IDs and relationships, validates the target, and leaves the source untouched. Active transient sessions are not transferred. Schema version 10 adds nullable launch visibility to tour sessions without granting old sessions new Private access. It preserves versioned Help & Learning acknowledgement state and additively reconciles readable identity columns that may be missing from older MariaDB or SQLite installations. Normal startup does not erase existing houses or tours.

## Release verification

The v1.0 release requires the complete automated suite, syntax checks, fresh SQLite migration smoke testing, MariaDB schema/query coverage, component-limit checks, rendered guide inspection, ZIP exclusion/integrity checks, and clean extraction/startup verification.

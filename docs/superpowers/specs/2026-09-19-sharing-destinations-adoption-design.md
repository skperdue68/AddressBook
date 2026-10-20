# AddressBook Sharing Destinations and Adoption Design

## Purpose

This specification defines the next AddressBook feature release after version 0.5.6. The release is intended to make AddressBook easier to adopt, easier to populate, and safe to use for sharing Private ESO houses and tours without converting them to Server or Global visibility.

The release adds:

- revocable House Share Passes and Tour Passes;
- private self-paced tour starts from shared Discord cards;
- contextual copying of otherwise inaccessible Private houses;
- independent copying of shared Private tours;
- registration from ESO Housing Links, jump commands, and abbreviated owner/house pairs;
- a stable housing-destination identity shared by matching saved entries and comments;
- first-use onboarding, guided empty states, resume controls, problem reporting, tour readiness checks, and administration health information.

The existing Global, Server, Private visibility model remains authoritative. User-facing visibility choices always appear in Global, Server, Private order.

## Success Criteria

The release is successful when:

1. A user can share any tour they can normally access by posting a reusable Discord card.
2. A recipient can start an independent ephemeral self-paced run from that card.
3. Private houses exposed by a pass remain absent from ordinary search and browse results.
4. Only the creator of an original Private tour can issue additional passes for that original tour.
5. A pass-only recipient can copy an exposed Private house into an independently owned entry.
6. A recipient can copy an entire shared tour into an independent Private tour.
7. A user can register a destination from a house name, numeric ID, Housing Link, jump command, or abbreviated owner/house pair.
8. Comments are shared across saved entries representing the same ESO destination.
9. Existing SQLite and MariaDB data upgrades without losing houses, tours, stops, comments, timestamps, identities, or audit history.
10. Existing AddressBook permissions, search, tour, administration, and migration behavior continues to pass its regression suite.

## Terminology

### Housing destination

A stable ESO destination identified by normalized ESO owner plus official house ID. It is independent of AddressBook visibility, nickname, description, tags, submitter, and tour membership.

### Saved house

A Global, Server, or Private AddressBook entry pointing to a housing destination. Multiple saved houses may point to the same destination.

### Share Pass

A revocable database record that authorizes limited access to one shared house or tour through a Discord message component. The Discord message contains an opaque token and no authoritative permission data.

### Normal access

Access granted by the saved entry's ordinary visibility rules:

- Global is visible bot-wide.
- Server is visible in its Discord guild.
- Private is visible to its owning Discord user.

Normal access excludes access derived solely from a Share Pass.

### Pass-only access

Temporary view access granted through an active Share Pass to content the recipient cannot normally access.

## Architectural Model

### Destination separation

AddressBook must separate stable ESO destination identity from a user's saved metadata.

`housing_destinations` owns:

- destination ID;
- canonical ESO owner;
- normalized ESO owner;
- official house ID;
- creation and update timestamps.

`saved_houses` continues to own:

- visibility;
- owning user or guild;
- origin guild;
- nickname;
- description;
- tags;
- status;
- submitter and updater identity fields;
- timestamps.

Every saved house must reference exactly one housing destination. The ESO owner and house ID may remain readable companion fields during the transition, but the destination relationship is authoritative.

### Destination uniqueness

A case-insensitive, leading-`@`-independent normalized ESO owner plus official house ID is unique in `housing_destinations`.

Examples that resolve to the same destination include:

```text
@HouseOwner + 62
houseowner + 62
|H1:housing:62:@HouseOwner|h|h
("@HouseOwner", 62)
```

### Shared comments

`house_comments` references `housing_destinations` rather than an individual `saved_houses` record. Comments therefore appear through every matching entry the viewer is allowed to see.

Each comment retains:

- comment ID;
- destination ID;
- author Discord ID and readable names;
- comment text;
- creation timestamp;
- optional edit timestamp;
- moderation/removal status;
- legacy saved-house ID when migrated from an earlier schema.

Every comments screen states that comments apply to the ESO destination and may appear through other entries for the same house.

Deleting one saved entry does not delete destination comments. A destination and its comments are retained when its last saved entry is deleted so that community information is not silently destroyed. Authorized moderation may archive or remove comments and unused destinations.

## Data Model Additions

The exact SQL types follow the existing SQLite and MariaDB conventions.

### `housing_destinations`

- `id`
- `eso_owner`
- `normalized_owner`
- `house_id`
- `created_at`
- `updated_at`
- unique constraint on `normalized_owner, house_id`

### `house_share_passes`

- `id`
- `token_hash`
- `saved_house_id`
- `created_by`
- `origin_guild_id`
- `channel_id`
- `message_id`
- `status` as active or revoked
- `usage_count`
- `created_at`
- `last_used_at`
- `revoked_at`
- `revoked_by`
- `revocation_reason`
- readable companion names for important Discord IDs

### `tour_share_passes`

The same lifecycle fields as a house pass plus `tour_id`.

### `share_pass_sessions`

Associates a self-paced tour session with the Tour Pass that authorized it. This allows revocation to close active sessions created through that pass without affecting independent sessions.

### `housing_reports`

- report ID;
- destination ID and optional saved-house, tour, stop, or pass reference;
- reporter identity and guild context;
- problem type;
- explanation;
- status;
- reviewer identity;
- created, updated, and resolved timestamps;
- readable companion names.

Only one open equivalent report from the same reporter for the same target and problem type is retained. A repeated submission updates that open report.

### `user_onboarding`

Stores whether a Discord user completed or skipped the first-use introduction and the relevant timestamps.

## Tour Pass Behavior

### Creation

A user with normal access to a tour may choose **Share Tour Pass**. Private tours may be shared only by their creator. A recipient with pass-only access cannot create another pass for the original tour.

The creator selects a Discord channel through the native channel selector. AddressBook verifies channel visibility and send permissions before posting.

The public card contains:

- tour name and description;
- stop count;
- tour visibility;
- sharer's identity;
- disclosure that Private destinations may be available only during the tour;
- **Start Self-Paced Tour**;
- **Tour Information**;
- **Copy Tour to My AddressBook**;
- **Report a Problem**.

The pass is reusable until revoked. It does not expire automatically.

### Starting a tour

Pressing **Start Self-Paced Tour** causes AddressBook to:

1. validate the opaque pass token against its stored hash;
2. verify that the pass remains active;
3. verify that the tour still exists;
4. recalculate eligible live stops;
5. create an ephemeral self-paced session for the requesting user;
6. associate the session with the pass;
7. increment pass usage and last-used information.

Every recipient receives an independent session and controls only that session.

### Live relationship

A pass points to the live original tour. New or resumed sessions use the current name, description, route, stop order, and eligible houses. Adding, removing, or reordering stops changes subsequent pass use. Deleting the original tour revokes its passes.

### Revocation

The creator can revoke one pass or all passes for a tour. Revocation:

- marks the pass revoked rather than deleting it;
- prevents new sessions;
- closes active sessions authorized by that pass;
- preserves independently copied houses and tours;
- records actor identity, time, guild/channel context, and optional reason.

Future button presses respond that the pass was revoked by its owner.

### Pass management

**Manage Share Passes** provides a paginated view containing:

- server and channel;
- Discord message status;
- active or revoked state;
- creation date;
- usage count;
- last-used date.

Actions include View Shared Message, Repost Card, Copy Message Link, Revoke Pass, and Revoke All.

A server Housing Moderator may remove a Server Tour share card from that moderator's server. This does not grant access to unrelated Private content. A Global Housing Moderator may disable abusive Global passes. Only the creator manages passes for an original Private tour.

## House Share Behavior

A user with normal access may choose **Share House** and select a channel. Sharing does not alter the saved house's visibility, search eligibility, tour eligibility, or ownership.

A Private share card states that the entry remains excluded from normal search and browsing. The pass grants view-only access to that house through the card.

The card provides the normal house information and separate code blocks for:

```text
Jump in ESO
Unfurnished Preview
Housing Link
```

It also provides contextual actions described below. The owner may revoke the House Share Pass without deleting the house.

## Contextual House Copying

**Copy to My AddressBook** appears only when a user is viewing another person's Private entry through pass-only access. It remains hidden for:

- the user's own Private entry;
- normally accessible Server entries;
- Global entries;
- any house the user can normally view without the active pass.

The pass-only card provides:

- Copy to My AddressBook;
- Comments;
- More Details;
- Report a Problem;
- Back to Tour when applicable.

It does not provide Edit, Change Visibility, Delete, Add to Tour, or Share House.

### Copy flow

The recipient selects visibility in Global, Server, Private order. Private is available to every recipient. Server and Global choices follow the current guild's normal registration permissions and approval policy. An unavailable choice remains visible but disabled with an explanation.

AddressBook prepopulates nickname, description, and tags from the shared entry. All three remain editable before saving. The screen warns that the information came from a shared Private entry and must be reviewed.

The official house and ESO owner are carried from the destination and shown in confirmation. They are not silently editable during the metadata step.

The final confirmation displays owner, official house, visibility, nickname, description, tags, and expected registration status.

The copy creates a new `saved_houses` record owned or submitted by the recipient and pointing to the same destination. It does not modify the original entry. Tour associations are not copied during an individual house copy.

If the target visibility already contains the same destination for that owner/guild context, AddressBook opens the existing entry instead of creating a duplicate.

## Copying a Shared Tour

**Copy Tour to My AddressBook** creates an independent Private tour owned by the recipient.

Before confirmation, AddressBook displays:

- total stop count;
- normally accessible entries that will be reused;
- inaccessible Private entries that will be copied;
- disclosure that the resulting records are independent.

The operation:

1. creates a new Private tour;
2. reuses accessible Global, current-server Server, or recipient-owned Private entries;
3. creates recipient-owned Private saved entries for inaccessible Private stops;
4. points every new entry to the stable destination;
5. copies tour name, description, stop titles, and stop notes;
6. allows the recipient to edit copied tour information afterward;
7. creates no dependency on the original pass.

The copied tour does not receive future updates from the original. Later revocation or deletion of the original pass does not affect the copy.

The entire operation is transactional. Any failure rolls back the tour, copied entries, stops, and audit changes.

## Destination Input Parsing

The Register New House input is labeled **House Name, ID, Housing Link, or Jump Command**.

Supported forms include:

```text
Grand Psijic Villa
62
("@HouseOwner", 62)
('@HouseOwner', 62)
@HouseOwner, 62
JumpToSpecificHouse("@HouseOwner", 62)
/script JumpToSpecificHouse("@HouseOwner", 62)
|H1:housing:62:@HouseOwner|h|h
```

Parsing tolerates:

- optional `/script` and `JumpToSpecificHouse` text;
- single or double quotation marks;
- optional leading `@`;
- extra whitespace;
- Discord code blocks;
- surrounding explanatory text;
- case differences in the function name.

The abbreviated form still requires an ESO-style account value followed by a valid numeric official house ID in the expected structure. Arbitrary text containing a username and unrelated number must not be accepted accidentally.

The owner field is optional when the primary input includes both owner and house ID. Conflicting owners from the primary input and separate owner field are displayed side by side and require an explicit choice.

The parser rejects missing owners for destination forms, missing or invalid IDs, negative or nonnumeric IDs, and unknown official house IDs with specific guidance.

### Registration review

Because Discord cannot dynamically populate modal fields while the user is typing, registration is two-stage:

1. collect the destination input;
2. parse and display official house, house ID, ESO owner, requested visibility, existing entries, and expected registration status;
3. collect editable nickname, description, and tags;
4. show final confirmation;
5. save transactionally.

Duplicate checks appear in Global, current-server Server, and user Private order. An existing entry at the requested visibility opens instead of being duplicated. An entry at another visibility does not block an independently customized entry when normal uniqueness rules allow it.

## UI and Navigation

### Normal house card

Primary actions are Comments, More Details, Add to Tour, and Share House. Edit, Change Visibility, and Delete appear only when authorized. Copy is hidden.

### Shared Private house card

The card prominently identifies pass-only Private access and shows the restricted action set defined above.

### Normal tour card

Primary actions are Start Self-Paced, Share Tour Pass, Show Tour List, and More Information. Edit Tour appears only when authorized. Existing Shared-mode permissions remain in force.

### Shared Tour Pass card

The channel message contains no shared navigation state. It only starts independent ephemeral sessions and exposes Tour Information, Copy Tour, and reporting.

### Component limits

Buttons are grouped into rows of at most five. String selectors remain limited to 25 visible options and use pagination without losing selection state.

## Adoption Improvements

### First-use introduction

On first `/housing`, a user sees Find a House, Register a House, Start a Tour, Show Me Around, and Skip. Show Me Around uses three short screens covering house discovery, ESO links, and tour modes. Completion or Skip stores user onboarding state. Help includes Show Introduction Again.

### My AddressBook continuation

My AddressBook adds a Continue section for an active self-paced tour, most recently viewed house, and recently edited personal tour. An active tour offers Resume Tour, Start Over, and End Tour.

### Guided empty states

Empty house, tour, pending, recent, and comment screens explain the next useful action and provide direct buttons instead of presenting a dead end.

### Duplicate assistance

Duplicate results display matching Global, Server, and Private entries with View Existing, Save Separate Private Copy when allowed, Request an Update, and Cancel. AddressBook never silently overwrites an entry.

### Problem reporting

House and tour-stop cards provide Report a Problem with:

- jump destination does not work;
- owner does not allow visitors;
- incorrect owner or house;
- inappropriate or misleading information;
- duplicate entry;
- other.

Reports appear in Administration with target, reporter, guild, date, status, and review actions. Server moderators do not gain unrelated Private access from a report.

### Tour readiness

Before starting or sharing, AddressBook checks that the tour has stops, every stop exists and is eligible, there are no duplicate destinations, unresolved accessibility reports are disclosed, and required Share Pass access remains valid. Blocking issues prevent starting; advisories permit starting with a warning.

### Administration health

Administration displays database backend/connection status, version, configured channel, registration policy, configured role counts, pending submissions, authorized Global Moderator requests, open reports, Share Pass counts, last database migration, and a backup reminder.

## Permission Rules

### Share creation

- A normally authorized viewer may share a Global or Server tour.
- Only a Private tour's creator may share that Private tour.
- Only a Private house owner may share that Private entry.
- Pass-only recipients cannot reshare the original house or tour through AddressBook.

### Pass recipients

Recipients may view the content represented by the active pass, start their own self-paced session, comment under the destination model, report a problem, copy an exposed Private house, and copy a shared tour.

Recipients may not edit, delete, change visibility, add the original to an unrelated tour, or issue another pass for the original Private content.

### Moderators

Server Housing Moderators may remove share cards posted in their server and manage reports within their server authority. This does not grant general access to Private records.

Global Housing Moderators may disable abusive Global passes within their existing bot-wide authority. They do not automatically own Private content.

## Error Handling

Errors must state the outcome and next action. Required messages include:

| Situation | Required response |
| --- | --- |
| Pass revoked | This Share Pass was revoked by its owner. |
| Tour deleted | This tour is no longer available. |
| House removed | This destination is no longer part of the shared tour. |
| Channel unavailable | Explain required Discord channel permissions. |
| Existing Private copy | Open the existing Private entry. |
| Existing Server or Global entry | Open the matching entry rather than duplicate it. |
| Approval required | State that the copied registration is pending review. |
| Invalid abbreviated input | Identify the missing owner or valid numeric house ID. |
| Conflicting owners | Display both and require an explicit choice. |
| Copy failure | State that nothing was copied and originals were unchanged. |
| Stale share card | State that the card is no longer connected to an active pass. |

Long-running copy operations must acknowledge the Discord interaction before completing database work so they do not time out.

## Message Deletion and Reposting

Deleting a Discord Share Pass message does not delete its audit record. AddressBook marks the message unavailable when detected. The creator may repost the card, updating stored guild, channel, and message information. Reposting rotates the opaque component token so any surviving old card becomes stale; it does not expand the pass's underlying authorization or create a second active pass.

## Abuse Prevention

- Share and report creation use reasonable per-user rate limits.
- Opaque tokens contain no authoritative IDs or permission state.
- Tokens are stored hashed.
- Every pass interaction rechecks status and current content eligibility.
- Repeated equivalent reports are merged.
- Private data is excluded from ordinary server-moderation logs.
- IDs are authoritative; readable names are informational and refreshed through the existing identity system.

## Audit Events

Permanent audit events include:

- destination created;
- house copied;
- tour copied;
- pass created, posted, reposted, used, or revoked;
- pass-authorized session closed by revocation;
- problem reported, reviewed, or resolved;
- bulk tour copy completed or rolled back.

Normal stop-to-stop navigation is not permanently audited.

## Migration

### Existing database upgrade

For both SQLite and MariaDB, startup migration must:

1. create new destination and feature tables;
2. group saved houses by normalized owner and official house ID;
3. create one destination per group;
4. populate every saved house's destination reference;
5. combine existing comments chronologically under the destination;
6. preserve legacy comment-to-saved-house reference data for audit;
7. add required constraints and indexes only after backfill succeeds;
8. verify row counts, destination references, comment counts, and foreign keys;
9. record the new schema version.

The upgrade is transactional where supported and must fail without partially applying the new model.

### SQLite and MariaDB transfer

The guarded two-way transfer includes all new persistent tables. Destination IDs and relationships are preserved. Active tour sessions and other explicitly transient state remain excluded. The destination database is erased only under the existing explicit confirmation mechanism, and post-copy table counts and foreign-key relationships are verified.

## Testing Strategy

Implementation follows test-driven development. Required tests include:

- every accepted destination syntax, including `("@owner", 62)` and `@owner, 62`;
- malformed, ambiguous, and conflicting values;
- destination normalization and uniqueness;
- comment consolidation without loss;
- contextual Copy button visibility;
- normal versus pass-only access boundaries;
- Server and Global registration policy enforcement during copy;
- pass creation, posting, use, reposting, revocation, and deletion behavior;
- prevention of pass-only resharing;
- active session closure on revocation;
- live-tour changes through a pass;
- individual house copy behavior;
- whole-tour copy reuse, copying, and transaction rollback;
- report deduplication and moderator visibility;
- tour readiness blocking and advisory conditions;
- first-use state and guided empty states;
- SQLite and MariaDB schemas and upgrades;
- SQLite-to-MariaDB and MariaDB-to-SQLite transfer;
- Discord component limits and pagination;
- complete regression coverage for existing features.

## Documentation and Release Requirements

The release must update:

- README installation, operation, schema, permissions, and migration sections;
- Word User and Administrator Guide;
- `.env.example` for any configurable rate-limit or operational settings;
- database table reference;
- user-facing version string and package version.

The deliverable is a clean versioned ZIP without `node_modules`, secrets, temporary databases, render intermediates, or development-only scratch files. The full test suite, JavaScript syntax checks, DOCX render inspection, and ZIP integrity check must pass before release.

## Out of Scope

This release does not add a public website, external URL endpoint, Discord Activity, automatic cross-server content publication, anonymous web access, or permanent access merely from knowing a database ID. It does not let server moderators browse unrelated Private entries. It does not make copied tours track later changes to their originals.

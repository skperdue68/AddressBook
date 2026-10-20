# AddressBook Sharing, Destinations, and Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release AddressBook v0.6.0 with stable housing destinations, destination-wide comments, revocable House and Tour Share Passes, safe copying of shared Private content, flexible ESO destination input, and the approved onboarding, reporting, readiness, and administration improvements.

**Architecture:** Introduce `housing_destinations` as the authoritative owner/house identity and keep `saved_houses` as visibility-specific metadata. Put pass authorization behind hashed opaque tokens and a centralized access-context service, while keeping every shared-tour run ephemeral and user-owned. Build the Discord flows from small service modules and pure UI payload functions, then extend schema upgrades and the guarded two-way database transfer before packaging v0.6.0.

**Tech Stack:** Node.js 22+, ECMAScript modules, discord.js 14.22+, built-in `node:sqlite`, MariaDB Connector/Node.js 3.4+, Node test runner, DOCX user guide.

**Spec:** `docs/superpowers/specs/2026-09-19-sharing-destinations-adoption-design.md`

## Global Constraints

- Global, Server, Private is the required display order for every visibility choice and summary.
- Private houses and tours exposed by a Share Pass remain absent from ordinary search and browse results.
- Pass tokens contain no authoritative IDs or permission state and are stored only as hashes.
- Every pass use rechecks pass state, original content existence, and current content eligibility.
- Only the creator of an original Private house or tour can issue passes for it; pass-only access never grants resharing, editing, deletion, visibility changes, or unrelated tour membership.
- Shared Tour Pass runs are independent ephemeral self-paced sessions controlled only by the user who started them.
- Copying a shared tour is transactional and creates an independent Private tour.
- Comments are attached to the stable ESO destination and survive deletion of individual saved entries.
- IDs remain authoritative; readable Discord names are informational and refreshed by the existing identity system.
- String selectors show at most 25 options and paginate without losing selection state; button rows contain at most five buttons.
- SQLite and MariaDB upgrades and guarded transfers preserve persistent data and relationships; transient sessions are not transferred.
- The destination database is erased only through the existing `ERASE_TARGET_DATABASE` confirmation mechanism.
- Release target is `0.6.0`; minimum Node.js version remains `22`.
- No public website, external URL endpoint, anonymous web access, or permanent access from a database ID is added.

## Review Focus

- Inputs containing unrelated prose, a username, and a number must not be misread as an abbreviated destination; Task 3 tests strict structure and fenced-code extraction.
- A pass token used after reposting, revocation, source deletion, or source visibility change must fail closed with the required user-facing outcome; Tasks 5 and 6 test every stale state.
- A moderator reviewing a report must not gain unrelated Private-record access; Task 9 tests server/global/private authority boundaries.
- Two simultaneous copy attempts for the same destination must resolve to one saved entry without partial tours or duplicate stops; Tasks 7 and 8 test uniqueness and rollback.
- A partially upgraded database must never be marked current; Tasks 1 and 12 test transactional rollback, row-count checks, destination references, comments, and foreign keys.

---

### Task 1: Schema v4 and destination backfill

**Files:**
- Modify: `src/db/sqlite-schema.js`
- Modify: `src/db/schema.js`
- Modify: `src/db/database.js`
- Create: `src/db/destination-migration.js`
- Create: `test/destination-schema.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `backfillDestinations(conn, dialect): Promise<{destinations:number,houses:number,comments:number}>`
- Produces: `verifyDestinationBackfill(conn): Promise<void>`
- Produces complete schema version `4`, `saved_houses.destination_id`, destination-based `house_comments`, and every persistent table needed by later v0.6.0 tasks.

- [ ] **Step 1: Write failing SQLite schema tests**

Create `test/destination-schema.test.js` with a temporary v3 SQLite database containing two differently cased saved entries for `@HouseOwner` house `62`, one entry for another destination, and one comment per duplicate entry. Assert after `migrate(db)` that schema version is `4`, both duplicates share one `destination_id`, the second destination has another ID, all comments survive in chronological order with `legacy_saved_house_id`, and every saved house has a non-null destination reference.

```js
assert.equal(Number((await one(db,'SELECT max(version) v FROM schema_migrations')).v),4);
const duplicate=await db.query("SELECT destination_id FROM saved_houses WHERE house_id=62 ORDER BY id");
assert.equal(duplicate[0].destination_id,duplicate[1].destination_id);
assert.equal((await db.query('SELECT * FROM house_comments ORDER BY created_at,id')).length,2);
assert.equal(Number((await one(db,'SELECT count(*) c FROM saved_houses WHERE destination_id IS NULL')).c),0);
```

- [ ] **Step 2: Run the focused test and confirm the pre-v4 failure**

Run: `node --test test/destination-schema.test.js`

Expected: FAIL because `housing_destinations`, `destination_id`, and schema version 4 do not exist.

- [ ] **Step 3: Add matching SQLite and MariaDB v4 definitions**

Add `SQLITE_SCHEMA_V4` and `SCHEMA_V4` with:

```sql
CREATE TABLE housing_destinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eso_owner TEXT NOT NULL,
  normalized_owner TEXT NOT NULL,
  house_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(normalized_owner,house_id),
  FOREIGN KEY(house_id) REFERENCES houses(house_id)
)
```

Use MariaDB-equivalent `BIGINT UNSIGNED`, `VARCHAR`, `TIMESTAMP`, `InnoDB`, and named foreign keys/indexes. Add nullable `saved_houses.destination_id` for backfill, then make the migration verify it before recording version 4. Rebuild SQLite `house_comments` transactionally with `destination_id`, nullable `legacy_saved_house_id`, author readable-name fields, `edited_at`, and `status`; use `ALTER TABLE` plus constraint/index creation for MariaDB. The destination foreign key must not cascade deletion from `saved_houses`, so a destination and its comments survive removal of its last saved entry.

Define the rest of schema v4 now—not in later behavior tasks—so an upgraded database can never record version 4 while missing a feature table:

```text
house_share_passes
tour_share_passes
share_pass_sessions
housing_reports
user_onboarding
```

Give both pass tables token/lifecycle/message/audit fields and readable Discord names; give `share_pass_sessions` pass/session references plus close metadata; give reports every target, workflow, identity, and timestamp field in the specification; give onboarding status and completion/skip timestamps. Add the indexes and foreign keys required by Tasks 5, 6, 9, and 10, but do not add cascading deletion where audit history must survive.

- [ ] **Step 4: Implement deterministic destination backfill and verification**

In `src/db/destination-migration.js`, export:

```js
export async function backfillDestinations(conn,dialect){
  const houses=await conn.query('SELECT id,eso_owner,normalized_owner,house_id FROM saved_houses ORDER BY id');
  for(const house of houses){
    const owner=stripLeadingAt(house.eso_owner);
    const normalized=normalizeEsoOwner(owner);
    if(!normalized||!Number.isInteger(Number(house.house_id)))throw new Error(`Saved house ${house.id} has an invalid destination.`);
    await insertDestinationIfMissing(conn,dialect,{esoOwner:owner,normalizedOwner:normalized,houseId:Number(house.house_id)});
    const destination=await one(conn,'SELECT id FROM housing_destinations WHERE normalized_owner=? AND house_id=?',[normalized,Number(house.house_id)]);
    await conn.query('UPDATE saved_houses SET destination_id=? WHERE id=?',[destination.id,house.id]);
  }
  const commentCount=await repointLegacyComments(conn,dialect);
  const destinationCount=Number((await one(conn,'SELECT count(*) c FROM housing_destinations')).c);
  return {destinations:destinationCount,houses:houses.length,comments:commentCount};
}

export async function verifyDestinationBackfill(conn){
  const missing=await one(conn,'SELECT count(*) c FROM saved_houses WHERE destination_id IS NULL');
  if(Number(missing.c)!==0)throw new Error('Destination migration left saved houses unlinked.');
  const orphanComments=await one(conn,'SELECT count(*) c FROM house_comments c LEFT JOIN housing_destinations d ON d.id=c.destination_id WHERE d.id IS NULL');
  if(Number(orphanComments.c)!==0)throw new Error('Destination migration left orphan comments.');
}
```

Define the file-local `insertDestinationIfMissing()` with SQLite `ON CONFLICT(normalized_owner,house_id) DO NOTHING` and MariaDB `INSERT IGNORE`. Define `repointLegacyComments()` to copy every legacy comment in `created_at,id` order into the rebuilt destination-based table and return the copied row count; the caller compares that count with the pre-migration count before version 4 is recorded.

Keep schema version insertion inside the same transaction as backfill and verification. Do not remove the readable transitional `eso_owner`, `normalized_owner`, or `house_id` fields from `saved_houses` in v4.

- [ ] **Step 5: Add rollback and idempotency cases**

Add tests that inject a malformed saved-house row and assert migration throws without inserting version 4, and that running `migrate(db)` twice neither duplicates destinations nor comments.

- [ ] **Step 6: Run database tests**

Run: `node --test test/destination-schema.test.js test/database-backend.test.js test/identity-schema.test.js test/mariadb-schema.test.js`

Expected: PASS.

- [ ] **Step 7: Commit the schema stage**

```bash
git add src/db/sqlite-schema.js src/db/schema.js src/db/database.js src/db/destination-migration.js test/destination-schema.test.js package.json
git commit -m "feat: add stable housing destinations"
```

If the supplied release folder is still not a Git worktree, preserve this exact stage as the first reviewed checkpoint instead of inventing repository history.

### Task 2: Destination repository and shared comments

**Files:**
- Create: `src/services/destination-service.js`
- Modify: `src/services/saved-house-service.js`
- Modify: `src/services/comment-service.js`
- Modify: `src/services/bookmark-service.js`
- Modify: `src/services/registration-service.js`
- Modify: `src/services/identity-service.js`
- Modify: `src/ui/housing-ui.js`
- Create: `test/destination-comments.test.js`

**Interfaces:**
- Consumes: schema and backfill from Task 1.
- Produces: `DestinationService.resolve({esoOwner,houseId}, conn?)` and `DestinationService.get(id, conn?)`.
- Produces: `CommentService.add({destinationId,savedHouseId,commenterUserId,text})`, `listByDestination(destinationId,limit)`, and `countByDestination(destinationId)`.

- [ ] **Step 1: Write failing destination/comment service tests**

Test that `@HouseOwner`, `houseowner`, and `HOUSEOWNER` plus house `62` resolve to one destination; comments added through Global, Server, and Private entries appear through all three; deleting one saved entry preserves the destination and comments; comment UI says comments apply to the ESO destination.

- [ ] **Step 2: Verify failures**

Run: `node --test test/destination-comments.test.js`

Expected: FAIL because services still address comments by saved-house ID.

- [ ] **Step 3: Implement `DestinationService` and wire saved-house creation**

```js
export class DestinationService {
  constructor(db){this.db=db;}
  async resolve({esoOwner,houseId},conn=this.db){
    const normalizedOwner=normalizeEsoOwner(esoOwner);
    if(!normalizedOwner||!Number.isInteger(Number(houseId)))throw new Error('A valid ESO owner and official house ID are required.');
    const existing=await one(conn,'SELECT * FROM housing_destinations WHERE normalized_owner=? AND house_id=?',[normalizedOwner,Number(houseId)]);
    if(existing)return existing;
    try{
      await conn.query('INSERT INTO housing_destinations(eso_owner,normalized_owner,house_id) VALUES(?,?,?)',[stripLeadingAt(esoOwner),normalizedOwner,Number(houseId)]);
    }catch(error){
      if(!isUniqueViolation(error))throw error;
    }
    return one(conn,'SELECT * FROM housing_destinations WHERE normalized_owner=? AND house_id=?',[normalizedOwner,Number(houseId)]);
  }
}
```

Define file-local `isUniqueViolation(error)` to recognize SQLite extended constraint code `2067` and MariaDB duplicate-key error `ER_DUP_ENTRY`, so concurrent resolves return the row created by either request.

Have every saved-house create/update path resolve and store `destination_id` in the same transaction. Duplicate checks use destination ID plus visibility ownership context, not free-text owner casing.

- [ ] **Step 4: Refactor comments to destination identity**

Resolve `destination_id` from a provided saved-house ID only after confirming the viewer has normal or explicit pass access. Insert/read/count by destination ID. Keep compatibility wrappers (`addPersonal`, `addServer`, `addGlobal`, `list`, `count`) until all handlers use the new methods.

- [ ] **Step 5: Update readable-name refresh and comments disclosure**

Extend `IdentityService.refreshInternalNames()` for new comment actor/reviewer/pass/report companion fields. Change `commentsPayload()` to include: `Comments apply to this ESO destination and may also appear through other saved entries for the same house.`

- [ ] **Step 6: Run focused and existing house tests**

Run: `node --test test/destination-comments.test.js test/saved-house-scope.test.js test/identity-service.test.js test/house-card-context.test.js`

Expected: PASS.

- [ ] **Step 7: Commit the destination service stage**

```bash
git add src/services/destination-service.js src/services/saved-house-service.js src/services/comment-service.js src/services/bookmark-service.js src/services/registration-service.js src/services/identity-service.js src/ui/housing-ui.js test/destination-comments.test.js
git commit -m "feat: share comments by housing destination"
```

### Task 3: Flexible ESO destination parsing and two-stage registration

**Files:**
- Create: `src/utils/destination-input.js`
- Create: `src/services/registration-draft-service.js`
- Modify: `src/ui/housing-ui.js`
- Modify: `src/ui/housing-menu.js`
- Create: `test/destination-input.test.js`
- Create: `test/registration-review.test.js`

**Interfaces:**
- Produces: `parseDestinationInput(value): {kind:'catalog'|'destination',houseId?:number,houseQuery?:string,esoOwner?:string}`.
- Produces: `resolveDestinationInput({input,owner}, houseService): Promise<{house,esoOwner,ownerConflict?:{parsed:string,entered:string}}>`.
- Produces: transient draft records keyed by random interaction-safe IDs and owned by one Discord user.

- [ ] **Step 1: Write parser acceptance and rejection tests**

Use a table-driven test for:

```js
[
  ['Grand Psijic Villa',{kind:'catalog',houseQuery:'Grand Psijic Villa'}],
  ['62',{kind:'catalog',houseId:62}],
  ['("@HouseOwner", 62)',{kind:'destination',esoOwner:'HouseOwner',houseId:62}],
  ["('@HouseOwner', 62)",{kind:'destination',esoOwner:'HouseOwner',houseId:62}],
  ['@HouseOwner, 62',{kind:'destination',esoOwner:'HouseOwner',houseId:62}],
  ['JumpToSpecificHouse("@HouseOwner", 62)',{kind:'destination',esoOwner:'HouseOwner',houseId:62}],
  ['/script JumpToSpecificHouse("@HouseOwner", 62)',{kind:'destination',esoOwner:'HouseOwner',houseId:62}],
  ['|H1:housing:62:@HouseOwner|h|h',{kind:'destination',esoOwner:'HouseOwner',houseId:62}]
]
```

Also test code fences, extra whitespace, mixed-case function names, surrounding explanatory text, missing owner, zero/negative/non-numeric IDs, unknown official IDs, and `please ask @HouseOwner about 62 chairs` as rejected.

- [ ] **Step 2: Run parser tests and confirm failure**

Run: `node --test test/destination-input.test.js`

Expected: FAIL because the parser module does not exist.

- [ ] **Step 3: Implement strict ordered parsing**

Strip Discord fences, then match Housing Link, optional `/script` plus optional `JumpToSpecificHouse`, parenthesized pair, bare `@owner, integer` pair, numeric house ID, then catalog name. Anchor abbreviated pair patterns to a complete trimmed line so unrelated prose cannot match. Normalize the owner with `stripLeadingAt()` but preserve a canonical display form with `ensureAt()` only at render time.

- [ ] **Step 4: Write and implement conflict/review tests**

Assert that primary input owner `@Alpha` plus separate owner `@Beta` produces an explicit conflict screen with both values and `Use @Alpha`, `Use @Beta`, and `Cancel`; matching normalized owners do not conflict. Assert review shows official house, ID, owner, requested visibility, existing Global/Server/Private entries in that order, and expected active/pending status.

- [ ] **Step 5: Split registration into destination and metadata stages**

Replace the single registration modal with:

```js
destinationInputModal(scope)
registrationDestinationReviewPayload(draft)
registrationMetadataModal(draftId,{nickname,description,tags})
registrationFinalReviewPayload(draft)
```

Validate every draft belongs to `i.user.id`, expires after 30 minutes, and is discarded after successful save or cancellation. Existing same-context destinations open instead of duplicating; other visibility entries are disclosed but do not block a valid separate entry.

- [ ] **Step 6: Run registration and regression tests**

Run: `node --test test/destination-input.test.js test/registration-review.test.js test/visibility-and-migration.test.js test/approved-ux.test.js`

Expected: PASS.

- [ ] **Step 7: Commit the input stage**

```bash
git add src/utils/destination-input.js src/services/registration-draft-service.js src/ui/housing-ui.js src/ui/housing-menu.js test/destination-input.test.js test/registration-review.test.js
git commit -m "feat: register houses from ESO destination links"
```

### Task 4: Access contexts, rate limits, and pass token primitives

**Files:**
- Create: `src/services/access-context-service.js`
- Create: `src/services/rate-limit-service.js`
- Create: `src/services/share-token-service.js`
- Create: `test/pass-access-context.test.js`
- Modify: `.env.example`

**Interfaces:**
- Produces: `AccessContextService.forHouse({userId,guildId,savedHouseId,passId?})` and `.forTour(...)`, returning `{normalAccess,passOnly,canView,canShare,canEdit,canCopy}`.
- Produces: `ShareTokenService.issue(): {token,hash}` and `.hash(token): string` using SHA-256 plus `crypto.timingSafeEqual`.
- Produces: `RateLimitService.consume({bucket,userId,limit,windowMs}): {allowed,retryAfterMs}`.

- [ ] **Step 1: Write failing access-matrix tests**

Cover Global, same-server Server, other-server Server, own Private, another user's Private, and active/revoked pass access. Assert pass-only viewers can view/comment/report/copy but cannot edit/delete/change visibility/add to unrelated tours/share the original.

- [ ] **Step 2: Write failing token and rate-limit tests**

Assert two issued tokens differ, stored hashes do not contain the token, malformed lengths fail safely, and the N+1 request is rejected until the injected clock advances beyond the window.

- [ ] **Step 3: Implement pure authorization and utility modules**

Keep Discord UI checks as consumers of `AccessContextService`; do not encode authorization in button visibility alone. Use an injectable clock in `RateLimitService` so tests are deterministic.

- [ ] **Step 4: Add operational settings**

Document and parse:

```dotenv
SHARE_PASS_RATE_LIMIT=5
SHARE_PASS_RATE_WINDOW_SECONDS=300
HOUSING_REPORT_RATE_LIMIT=5
HOUSING_REPORT_RATE_WINDOW_SECONDS=600
```

Invalid or nonpositive values fall back to these defaults.

- [ ] **Step 5: Run focused security tests**

Run: `node --test test/pass-access-context.test.js`

Expected: PASS.

- [ ] **Step 6: Commit the authorization primitives**

```bash
git add src/services/access-context-service.js src/services/rate-limit-service.js src/services/share-token-service.js test/pass-access-context.test.js .env.example
git commit -m "feat: centralize share-pass authorization"
```

### Task 5: House Share Pass lifecycle and contextual house cards

**Files:**
- Create: `src/services/share-pass-service.js`
- Create: `src/ui/share-pass-ui.js`
- Modify: `src/ui/housing-menu.js`
- Modify: `src/ui/housing-ui.js`
- Modify: `src/utils/jump-ui.js`
- Create: `test/house-share-pass.test.js`
- Create: `test/shared-house-ui.test.js`

**Interfaces:**
- Consumes: token/rate/access services from Task 4.
- Produces: `SharePassService.createHousePass`, `resolveHousePass`, `markPosted`, `repostHousePass`, `revokeHousePass`, and `listHousePasses`.
- Produces component IDs `hu:pass:house:view:<token>`, containing only the opaque token.

- [ ] **Step 1: Write pass lifecycle tests**

Test create/post/use/repost/revoke; usage count and `last_used_at`; creator-only revocation for Private entries; server moderator removal authority for Server cards; global moderator disabling authority for abusive Global passes; missing source house; deleted Discord message metadata; stale old token after repost.

- [ ] **Step 2: Lock the Task 1 house-pass schema contract with tests**

Assert `house_share_passes` has all fields in the specification, readable companion names, indexes for source/status/creator, and a unique token hash. Store `token_hash`; return the raw token only from create/repost operations. If the contract test exposes a missing column or index in Task 1, amend the v4 schema and rerun migration tests before writing service behavior.

- [ ] **Step 3: Implement transactional lifecycle methods**

```js
async createHousePass({savedHouseId,createdBy,originGuildId,channelId,names})
async resolveHousePass(token,{userId,guildId})
async repostHousePass(id,{actorId,guildId,channelId})
async revokeHousePass(id,{actorId,reason=null})
```

Every resolve checks active status, current saved entry, current access eligibility, and rate limit before incrementing usage.

- [ ] **Step 4: Write and implement shared-card UI tests**

Normal card primary actions: Comments, More Details, Add to Tour, Share House. Pass-only Private card: Copy to My AddressBook, Comments, More Details, Report a Problem, and Back to Tour when applicable. It must not contain Edit, Change Visibility, Delete, Add to Tour, or Share House.

Ensure Jump in ESO, Unfurnished Preview, and Housing Link remain separate `text` code blocks in that order.

- [ ] **Step 5: Implement channel selection and posting**

Use Discord's channel selector restricted to guild text-capable channels. Before posting, verify the bot can view the channel, send messages, embed links, and read message history. If not, reply with the missing permissions and leave the pass unposted/recoverable.

- [ ] **Step 6: Implement pass management pagination**

Show server/channel, active/revoked state, message availability, created/last-used dates, usage count, and actions View Shared Message, Repost Card, Copy Message Link, Revoke Pass, Revoke All. Paginate at 25 and preserve the owner-bound state token.

- [ ] **Step 7: Run house pass tests**

Run: `node --test test/house-share-pass.test.js test/shared-house-ui.test.js test/house-card-context.test.js test/approved-ux.test.js`

Expected: PASS.

- [ ] **Step 8: Commit the house-sharing stage**

```bash
git add src/db/sqlite-schema.js src/db/schema.js src/services/share-pass-service.js src/ui/share-pass-ui.js src/ui/housing-menu.js src/ui/housing-ui.js src/utils/jump-ui.js test/house-share-pass.test.js test/shared-house-ui.test.js
git commit -m "feat: add revocable house share passes"
```

### Task 6: Tour Passes and independent self-paced sessions

**Files:**
- Modify: `src/services/share-pass-service.js`
- Modify: `src/services/tour-session-service.js`
- Create: `src/services/tour-readiness-service.js`
- Modify: `src/ui/share-pass-ui.js`
- Modify: `src/ui/housing-menu.js`
- Create: `test/tour-share-pass.test.js`
- Create: `test/tour-pass-session.test.js`

**Interfaces:**
- Produces: `SharePassService.createTourPass`, `resolveTourPass`, `repostTourPass`, `revokeTourPass`, `revokeAllTourPasses`.
- Produces: `TourSessionService.startFromPass({passId,tourId,guildId,channelId,userId})` and `closeByPass(passId)`.
- Produces: `TourReadinessService.check(tourId,{viewerId,guildId,passId?}): {blocking:Issue[],advisories:Issue[],eligibleStops:Stop[]}`.

- [ ] **Step 1: Write failing Tour Pass authorization tests**

Assert normal viewers may share Global/Server tours; only the creator may share a Private tour; pass-only recipients cannot reissue a pass; deleted tours return `This tour is no longer available.`; removed stops are omitted or produce `This destination is no longer part of the shared tour.` in an active session.

- [ ] **Step 2: Lock the Task 1 tour-pass/session schema contract with tests**

Assert `tour_share_passes` has lifecycle fields and `share_pass_sessions(pass_id,tour_session_id,created_at,closed_at,close_reason)`. Keep active sessions out of cross-database transfer. If any field is missing, amend Task 1's v4 schema before continuing.

- [ ] **Step 3: Implement readiness checks before starting or sharing**

Blocking issues: no stops, missing saved entry/destination, ineligible stop visibility, no valid pass access for a pass-only Private stop, or duplicate destination. Advisories: unresolved accessibility reports. Return stable issue codes plus user-facing text.

- [ ] **Step 4: Implement independent ephemeral starts**

On `Start Self-Paced Tour`, defer the interaction, resolve the pass, recalculate live eligible stops, create a self-paced session owned by the clicking user, attach `share_pass_sessions`, and render ephemerally. Reuse the existing `canControlTourSession()` rule so each recipient controls only their own session.

- [ ] **Step 5: Implement revocation closure and live relationship tests**

Assert revocation marks the pass, closes only sessions derived from that pass, leaves ordinary sessions and copied tours intact, and records audit events. Assert newly added/reordered/removed stops appear on later starts without mutating already copied tours.

- [ ] **Step 6: Implement Tour Pass public card and management UI**

Include tour name/description, stop count, visibility, sharer, Private-content disclosure, Start Self-Paced Tour, Tour Information, Copy Tour to My AddressBook, and Report a Problem. The channel card stores no shared navigation state.

- [ ] **Step 7: Run tour pass regressions**

Run: `node --test test/tour-share-pass.test.js test/tour-pass-session.test.js test/tour-session-scope.test.js test/global-tour.test.js test/approved-ux.test.js`

Expected: PASS.

- [ ] **Step 8: Commit the tour-sharing stage**

```bash
git add src/db/sqlite-schema.js src/db/schema.js src/services/share-pass-service.js src/services/tour-session-service.js src/services/tour-readiness-service.js src/ui/share-pass-ui.js src/ui/housing-menu.js test/tour-share-pass.test.js test/tour-pass-session.test.js
git commit -m "feat: add private self-paced tour passes"
```

### Task 7: Contextual copying of pass-only Private houses

**Files:**
- Create: `src/services/house-copy-service.js`
- Modify: `src/ui/share-pass-ui.js`
- Modify: `src/ui/housing-menu.js`
- Create: `test/house-copy.test.js`

**Interfaces:**
- Consumes: `AccessContextService`, `DestinationService`, current guild registration policy, and active House/Tour Pass context.
- Produces: `HouseCopyService.preview({sourceSavedHouseId,userId,guildId,passId})` and `.copy({sourceSavedHouseId,userId,guildId,passId,visibility,nickname,description,tags})`.

- [ ] **Step 1: Write Copy button visibility tests**

Assert it appears only for another person's Private saved entry reached through active pass-only access. Assert it is hidden for own Private, normally accessible Server, Global, expired/revoked passes, and any entry normally visible without the pass.

- [ ] **Step 2: Write preview/policy tests**

Preview choices are Global, Server, Private. Private is always enabled. Server/Global use `GuildService.canRegister()` and the current approval policy; unavailable options remain visible and disabled with explanation. Nickname, description, and tags are prepopulated and editable; owner and official house are shown but not editable in metadata.

- [ ] **Step 3: Implement transactional copy and duplicate behavior**

```js
async copy({sourceSavedHouseId,userId,guildId,passId,visibility,nickname,description,tags}){
  return withTransaction(this.db,async conn=>{
    const access=await this.access.forHouse({userId,guildId,savedHouseId:sourceSavedHouseId,passId,conn});
    if(!access.passOnly||!access.canCopy)throw new Error('This shared Private house is no longer available to copy.');
    const source=await this.saved.get(sourceSavedHouseId,conn);
    const existing=await this.saved.findByDestinationContext({destinationId:source.destination_id,visibility,userId,guildId},conn);
    if(existing)return {existing:true,house:existing};
    const policy=await this.policy.registrationOutcome({visibility,userId,guildId});
    const house=await this.saved.createInConnection(conn,{destinationId:source.destination_id,visibility,userId,guildId,nickname,description,tags,status:policy.status,createdBy:userId});
    await this.audit.houseCopied(conn,{source,house,passId,actorId:userId,guildId});
    return {existing:false,house};
  });
}
```

Add the connection-aware `SavedHouseService.findByDestinationContext()` and `createInConnection()` methods in this task; both accept the exact objects shown above and never start their own transaction.

Do not copy tour associations. Record `house_copied` with source saved-house ID, destination ID, source pass ID, requested visibility, result status, and readable actor/guild names.

- [ ] **Step 4: Test concurrent duplicate handling and required messages**

Run two copy promises for the same destination/context and assert one entry. Test existing Private opens existing; existing Server/Global opens matching entry; pending approval explains pending state; forced failure says nothing was copied and original was unchanged.

- [ ] **Step 5: Run house-copy tests**

Run: `node --test test/house-copy.test.js test/pass-access-context.test.js test/saved-house-scope.test.js`

Expected: PASS.

- [ ] **Step 6: Commit the house-copy stage**

```bash
git add src/services/house-copy-service.js src/ui/share-pass-ui.js src/ui/housing-menu.js test/house-copy.test.js
git commit -m "feat: copy pass-only private houses"
```

### Task 8: Transactional copying of shared tours

**Files:**
- Create: `src/services/tour-copy-service.js`
- Modify: `src/services/tour-service.js`
- Modify: `src/ui/share-pass-ui.js`
- Modify: `src/ui/housing-menu.js`
- Create: `test/tour-copy.test.js`

**Interfaces:**
- Produces: `TourCopyService.preview({tourId,passId,userId,guildId})` and `.copy({tourId,passId,userId,guildId,name?,description?})`.
- Preview returns `{totalStops,reusedStops,copiedStops,stops}` with destination and source-access decisions.

- [ ] **Step 1: Write mixed-visibility preview tests**

Build a shared tour containing Global, current-server Server, recipient-owned Private, and another user's Private stops. Assert the first three are reused and only the inaccessible Private entry is copied.

- [ ] **Step 2: Write independence and rollback tests**

Assert the result is a recipient-owned Private tour preserving name, description, order, custom stop titles, and notes. After copy, revoke the pass and edit/delete original content; copied records remain unchanged. Inject a failure after the second stop and assert no new tour, houses, stops, or success audit event exists.

- [ ] **Step 3: Implement one-transaction copy**

```js
async copy(args){
  return withTransaction(this.db,async conn=>{
    const preview=await this.preview({...args,conn});
    const copiedTour=await this.tours.createInConnection(conn,{visibility:'private',creatorId:args.userId,name:args.name??preview.name,description:args.description??preview.description,tags:preview.tags});
    for(const stop of preview.stops){
      const savedHouseId=stop.reuseSavedHouseId??(await this.houses.copyPrivateInConnection(conn,{sourceSavedHouseId:stop.sourceSavedHouseId,userId:args.userId})).id;
      await this.tours.addStopInConnection(conn,{tourId:copiedTour.id,savedHouseId,position:stop.position,customTitle:stop.customTitle,notes:stop.notes});
    }
    await this.audit.tourCopied(conn,{sourceTourId:args.tourId,copiedTourId:copiedTour.id,passId:args.passId,actorId:args.userId,guildId:args.guildId});
    return copiedTour;
  });
}
```

Add `TourService.createInConnection()` and `addStopInConnection()` plus `HouseCopyService.copyPrivateInConnection()` with the exact object arguments shown above; none starts a nested transaction.

- [ ] **Step 4: Implement deferred Discord copy flow**

Before confirmation show total/reused/copied counts and independence disclosure. On confirmation call `deferUpdate()` or an ephemeral defer before database work, then edit the reply with the copied tour card or the exact no-partial-copy error.

- [ ] **Step 5: Test duplicate destinations and simultaneous requests**

Readiness blocks duplicate destinations in the source. Two concurrent copy clicks must either return one completed copied tour for the interaction draft or cleanly reject the stale second draft; neither may create a partial second tour.

- [ ] **Step 6: Run tour-copy tests**

Run: `node --test test/tour-copy.test.js test/tour-add-house.test.js test/global-tour.test.js`

Expected: PASS.

- [ ] **Step 7: Commit the tour-copy stage**

```bash
git add src/services/tour-copy-service.js src/services/tour-service.js src/ui/share-pass-ui.js src/ui/housing-menu.js test/tour-copy.test.js
git commit -m "feat: copy shared tours transactionally"
```

### Task 9: Problem reports and moderator-safe review

**Files:**
- Create: `src/services/housing-report-service.js`
- Create: `src/ui/report-ui.js`
- Modify: `src/ui/housing-menu.js`
- Modify: `src/ui/housing-ui.js`
- Modify: `src/services/tour-readiness-service.js`
- Create: `test/housing-reports.test.js`

**Interfaces:**
- Produces: `HousingReportService.submit`, `.listForModerator`, `.getForModerator`, `.review`, and `.resolve`.
- Report targets use `{destinationId,savedHouseId?,tourId?,stopId?,passId?}` and one of the six approved problem types.

- [ ] **Step 1: Write report deduplication tests**

Submitting the same open target/problem/reporter updates the explanation and timestamp instead of inserting another row. A resolved report permits a later new report. Rate limiting returns a useful retry time.

- [ ] **Step 2: Lock the Task 1 `housing_reports` schema contract with tests**

Assert the table stores every specified ID, readable companion name, status, reviewer, and timestamp and has indexes supporting open-equivalence lookup and moderator queues. Amend Task 1's v4 schema if the contract is incomplete.

- [ ] **Step 3: Implement authority-filtered queries**

Server moderators see reports for Server records/passes in their guild and public card activity in their guild, but report rows must expose only the target summary needed for review—not unrelated Private metadata. Global moderators see Global-target reports. Private-source content remains creator-managed unless separately Global/Server-visible.

- [ ] **Step 4: Implement report UI and audit events**

Offer: jump destination does not work; owner does not allow visitors; incorrect owner or house; inappropriate or misleading information; duplicate entry; other. Administration lists target, reporter, guild, date, status, and Review/Resolve actions. Log reported/reviewed/resolved events.

- [ ] **Step 5: Feed unresolved accessibility issues into readiness**

`jump destination does not work` and `owner does not allow visitors` are advisories by default; removed/missing targets remain blocking independently of reports.

- [ ] **Step 6: Run report/security tests**

Run: `node --test test/housing-reports.test.js test/global-moderator.test.js test/multi-role-admin.test.js`

Expected: PASS.

- [ ] **Step 7: Commit the reporting stage**

```bash
git add src/db/sqlite-schema.js src/db/schema.js src/services/housing-report-service.js src/services/tour-readiness-service.js src/ui/report-ui.js src/ui/housing-menu.js src/ui/housing-ui.js test/housing-reports.test.js
git commit -m "feat: add housing problem reports"
```

### Task 10: Onboarding, continuation, guided empty states, and duplicate assistance

**Files:**
- Create: `src/services/onboarding-service.js`
- Modify: `src/services/my-addressbook-service.js`
- Modify: `src/ui/housing-ui.js`
- Modify: `src/ui/housing-menu.js`
- Create: `test/onboarding-and-empty-states.test.js`
- Modify: `test/my-addressbook.test.js`

**Interfaces:**
- Produces: `OnboardingService.get(userId)`, `.complete(userId)`, and `.skip(userId)`.
- Produces: `MyAddressBookService.continueItems(userId,guildId)` returning active self-paced tour, most recently viewed house, and recently edited owned tour.

- [ ] **Step 1: Write first-use onboarding tests**

An unseen user opening `/housing` receives Find a House, Register a House, Start a Tour, Show Me Around, and Skip. The tour has exactly three short screens: discovery, ESO links, and tour modes. Completion/Skip persists; Help > Show Introduction Again displays it without clearing completion.

- [ ] **Step 2: Lock the onboarding schema contract and implement its service**

Assert Task 1's `user_onboarding` table stores `discord_user_id`, `status` (`completed`/`skipped`), `started_at`, `completed_at`, `skipped_at`, and readable names. Amend v4 if necessary, then use an upsert so repeated completion is idempotent.

- [ ] **Step 3: Add Continue cards and controls**

Query only currently accessible records. Active self-paced tour offers Resume Tour, Start Over, End Tour. Also show most recent accessible house and most recently edited personal tour; hide stale/deleted/inaccessible items.

- [ ] **Step 4: Replace dead-end empty screens**

Add direct next-action buttons for empty house results, tours, pending items, recents, and comments. Tests assert every empty payload has explanatory text, at least one useful action, and Back.

- [ ] **Step 5: Add duplicate assistance**

Show matching Global, Server, Private entries in that order with View Existing, Save Separate Private Copy when allowed, Request an Update, and Cancel. Never overwrite an existing entry. Route Request an Update through `HousingReportService` as the appropriate problem type.

- [ ] **Step 6: Run adoption tests**

Run: `node --test test/onboarding-and-empty-states.test.js test/my-addressbook.test.js test/search-homes-ux.test.js test/registration-review.test.js`

Expected: PASS.

- [ ] **Step 7: Commit the adoption stage**

```bash
git add src/db/sqlite-schema.js src/db/schema.js src/services/onboarding-service.js src/services/my-addressbook-service.js src/ui/housing-ui.js src/ui/housing-menu.js test/onboarding-and-empty-states.test.js test/my-addressbook.test.js
git commit -m "feat: add guided AddressBook onboarding"
```

### Task 11: Administration health and pass/report management

**Files:**
- Create: `src/services/admin-health-service.js`
- Modify: `src/ui/housing-ui.js`
- Modify: `src/ui/housing-menu.js`
- Modify: `src/db/database.js`
- Create: `test/admin-health.test.js`

**Interfaces:**
- Produces: `AdminHealthService.snapshot({guildId}): Promise<AdminHealthSnapshot>`.
- `AdminHealthSnapshot` contains backend/connection, version, channel, registration policy, role counts, pending submissions, Global Moderator requests, open reports, active/revoked pass counts, last migration, and backup reminder.

- [ ] **Step 1: Write health snapshot and UI tests**

Test both SQLite and mocked MariaDB status, missing configured channel, zero/many roles, report/pass counts, and no recorded backup. Assert no secret, password, host credential, or token value appears in the UI.

- [ ] **Step 2: Implement bounded health queries**

Use `SELECT 1` for connection status, `schema_migrations` for last migration, and aggregate counts rather than loading full rows. Render readable status fields and a backup reminder; do not claim a backup exists because the database is reachable.

- [ ] **Step 3: Connect administration navigation**

Add Health, Reports, and Share Passes while preserving role configuration and Global Moderator access. Keep role selectors paginated/searchable under Discord's 25-option and 100-loaded-role constraints already established in v0.5.6.

- [ ] **Step 4: Run administration tests**

Run: `node --test test/admin-health.test.js test/multi-role-admin.test.js test/global-moderator.test.js test/global-ui.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the administration stage**

```bash
git add src/services/admin-health-service.js src/ui/housing-ui.js src/ui/housing-menu.js src/db/database.js test/admin-health.test.js
git commit -m "feat: add administration health dashboard"
```

### Task 12: Two-way persistent-data transfer and migration verification

**Files:**
- Modify: `src/db/database-migration.js`
- Modify: `src/db/migrate-sqlite-to-mariadb.js`
- Modify: `test/sqlite-import.test.js`
- Modify: `test/visibility-and-migration.test.js`
- Create: `test/v4-data-transfer.test.js`

**Interfaces:**
- Consumes: every persistent v4 table from Tasks 1, 5, 6, 9, and 10.
- Produces: `transferUnifiedData(source,target)` preserving IDs and dependency order, excluding `tour_sessions` and `share_pass_sessions` as transient runtime state.

- [ ] **Step 1: Write a complete v4 fixture transfer test**

Seed destinations, three saved visibilities, destination comments, tours/stops, house/tour passes in active and revoked states, reports, onboarding, identities, settings, moderation, recent views, and audit events. Transfer SQLite→SQLite through the shared abstraction and assert exact persistent row counts and key relationships.

- [ ] **Step 2: Define explicit dependency-ordered table lists**

Copy catalog/identity/settings first; destinations before saved houses; saved houses/tours before stops/passes/reports; audit last. Exclude active session tables explicitly and assert the exclusion in tests.

- [ ] **Step 3: Preserve IDs and reset sequences safely**

Insert explicit IDs inside the existing confirmed erase transaction. After copy, set SQLite sequences and MariaDB `AUTO_INCREMENT` to `max(id)+1`. Never disable foreign keys beyond the transaction without restoring them in `finally`.

- [ ] **Step 4: Verify counts and referential integrity before commit**

Compare source/target persistent counts; assert no orphan `saved_houses.destination_id`, comment destination, tour stop, pass source, or report target; run `PRAGMA foreign_key_check` for SQLite and explicit anti-join checks for MariaDB. Any mismatch rolls back and leaves the migration marker unwritten.

- [ ] **Step 5: Exercise MariaDB→SQLite and SQLite→MariaDB adapters**

Keep unit tests backend-neutral with fakes where CI has no MariaDB, and retain schema-text assertions for MariaDB definitions. Document one optional integration command using a configured test MariaDB database without embedding credentials.

- [ ] **Step 6: Run migration tests**

Run: `node --test test/v4-data-transfer.test.js test/sqlite-import.test.js test/visibility-and-migration.test.js test/database-backend.test.js test/mariadb-schema.test.js`

Expected: PASS.

- [ ] **Step 7: Commit the transfer stage**

```bash
git add src/db/database-migration.js src/db/migrate-sqlite-to-mariadb.js test/v4-data-transfer.test.js test/sqlite-import.test.js test/visibility-and-migration.test.js
git commit -m "feat: transfer v4 AddressBook data safely"
```

### Task 13: Interaction integration, component limits, and regression hardening

**Files:**
- Modify: `src/ui/housing-menu.js`
- Modify: `src/handlers.js`
- Modify: `src/index.js`
- Create: `test/share-interactions.test.js`
- Create: `test/component-limits.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes all services and UI payloads from Tasks 1–12.
- Produces a single routed interaction surface in `createHousingMenu(db)` with owner-bound expiring transient state.

- [ ] **Step 1: Build interaction fakes for end-to-end handler tests**

Provide fake button/modal/select/channel interactions supporting `reply`, `update`, `deferReply`, `deferUpdate`, `editReply`, `showModal`, and `channel.send`. Capture ephemeral flags and posted cards without calling Discord.

- [ ] **Step 2: Test critical complete flows**

Exercise register-from-link; share Private house; pass-only view/copy; share Private tour; two recipients start and independently navigate; copy tour; revoke pass; report problem; moderator review; onboarding completion.

- [ ] **Step 3: Add stale-state and acknowledgement guards**

All transient drafts/pickers are user-bound and expire after 30 minutes. Every long database operation defers before work. Every pass/card branch returns one Discord acknowledgement. Required stale/revoked/deleted/error messages match the specification.

- [ ] **Step 4: Assert Discord limits globally**

Walk every tested payload and assert no action row exceeds five components, no string select exceeds 25 options, custom IDs are at most 100 characters, modal titles/labels/values respect Discord limits, and pagination retains selections.

- [ ] **Step 5: Register all tests in `npm test`**

Add the new test files to the existing explicit `node --test` script, retaining every v0.5.6 regression file.

- [ ] **Step 6: Run full tests and syntax checks**

Run:

```bash
npm test
find src test -name '*.js' -print0 | xargs -0 -n1 node --check
```

Expected: every test PASS and every JavaScript file exits 0.

- [ ] **Step 7: Commit integration hardening**

```bash
git add src/ui/housing-menu.js src/handlers.js src/index.js test/share-interactions.test.js test/component-limits.test.js package.json
git commit -m "test: cover sharing and adoption workflows"
```

### Task 14: Documentation, versioning, guide QA, and clean v0.6.0 release

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/ui/housing-ui.js`
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `AddressBook_v0.5.6_User_Admin_Guide.docx`
- Create final renamed guide: `AddressBook_v0.6.0_User_Admin_Guide.docx`
- Create release archive: `AddressBook-v0.6.0.zip`

**Interfaces:**
- Consumes the verified implementation from Tasks 1–13.
- Produces the clean, documented v0.6.0 release artifact.

- [ ] **Step 1: Update version sources**

Set package/package-lock version and `/housing` footer default to `0.6.0`. Search for stale user-facing `0.5.6` references and retain them only where documenting upgrade history.

- [ ] **Step 2: Update README and environment documentation**

Document the destination model, destination-wide comments, supported input formats, pass creation/use/repost/revocation, contextual copy rules, complete tour copy behavior, reporting, readiness, onboarding, admin health, rate-limit settings, v3→v4 startup upgrade, two-way database transfer, backup guidance, and permission matrix.

- [ ] **Step 3: Update the Word User and Administrator Guide**

Add user walkthroughs and administrator sections matching the README. Keep screenshots/mockups consistent with Global, Server, Private ordering and code-block treatment for Jump, Preview, and Housing Link.

- [ ] **Step 4: Render and visually inspect the guide**

Use the document rendering workflow to generate page images. Inspect every page for clipped tables, broken page breaks, missing headings, unreadable screenshots, and orphaned captions; correct the DOCX and rerender until clean.

- [ ] **Step 5: Run final verification from a clean dependency install**

```bash
npm ci
npm test
find src test -name '*.js' -print0 | xargs -0 -n1 node --check
```

Expected: install succeeds, all tests pass, and syntax checks exit 0.

- [ ] **Step 6: Build and inspect the ZIP**

Archive the `AddressBook-v0.6.0` folder while excluding `node_modules`, `.env`, secrets, databases, logs, render intermediates, temporary files, and prior ZIPs. List the archive and assert it contains source, tests, README, `.env.example`, package lock, Docker files, specification, implementation plan, and renamed guide.

```bash
unzip -l AddressBook-v0.6.0.zip
```

- [ ] **Step 7: Perform final acceptance checks**

On a fresh SQLite database, start the bot through migration/seed initialization. If a MariaDB integration environment is available, verify automatic database creation, v4 schema creation, and one guarded transfer in each direction. Confirm no real token/password exists in the folder or ZIP.

- [ ] **Step 8: Commit/tag or record final release checkpoint**

```bash
git add package.json package-lock.json src/ui/housing-ui.js README.md .env.example AddressBook_v0.6.0_User_Admin_Guide.docx docs/superpowers
git commit -m "release: AddressBook v0.6.0"
git tag v0.6.0
```

If no Git repository exists, do not initialize or tag one without authorization; use the verified versioned folder and ZIP as the final release checkpoint.

## Final Acceptance Matrix

| Area | Required proof |
| --- | --- |
| Destination identity | Case/`@` normalization, unique owner+house identity, all saved entries linked |
| Comments | Visible across matching entries; deletion of one entry preserves history |
| Input | Every approved full and abbreviated syntax; malformed/prose/conflict cases rejected or reviewed |
| House Pass | Create, post, use, repost/token rotation, revoke, stale/deleted handling |
| Tour Pass | Independent ephemeral sessions, live route, creator-only Private reissue, revocation closes derived sessions |
| House copy | Contextual button only; editable metadata; policy enforcement; duplicate opens existing |
| Tour copy | Mixed reuse/copy decisions, preserved stop metadata, complete rollback, post-copy independence |
| Reports/readiness | Deduplication, safe moderator queues, blocking/advisory checks |
| Adoption | First-use introduction, continuation controls, actionable empty states, duplicate assistance |
| Administration | Health snapshot contains approved facts and no secrets |
| Migration | v3→v4 for SQLite/MariaDB; guarded two-way v4 transfer; counts/FKs verified |
| Discord limits | ≤5 buttons/row, ≤25 select options/page, ≤100-character custom IDs |
| Release | Full tests, syntax checks, DOCX visual QA, ZIP inventory, no secrets/temp data |

# ESO Environment Partitioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Partition AddressBook houses, destinations, tours, sharing, searches, comments, reports, and Global Moderator authority into PC NA, PC EU, Xbox NA, Xbox EU, PlayStation NA, PlayStation EU, and PTS environments.

**Architecture:** Store a nullable indexed `eso_server` on guild settings and environment-owned records, with one canonical utility defining valid codes and labels. Route all setup, legacy assignment, environment changes, access checks, and query filtering through focused services so Discord handlers cannot bypass isolation. Upgrade SQLite and MariaDB with the same versioned migration, preserving deterministic legacy data and leaving ambiguous data Unassigned.

**Tech Stack:** Node.js 22+, ECMAScript modules, discord.js 14, node:test, built-in `node:sqlite`, MariaDB 3.x, SQLite and MariaDB SQL migrations.

**Spec:** `docs/superpowers/specs/2026-09-19-eso-environment-partitioning-design.md`

## Global Constraints

- Supported stored values are exactly `pc_na`, `pc_eu`, `xbox_na`, `xbox_eu`, `playstation_na`, `playstation_eu`, and `pts`.
- Display order is exactly PC NA, PC EU, Xbox NA, Xbox EU, PlayStation NA, PlayStation EU, PTS.
- `NULL` means legacy Unassigned; `unassigned` is never stored as an environment.
- Visibility remains ordered Global, Server, Private and remains independent from environment.
- Destination identity is `(eso_server, normalized_owner, house_id)`.
- Unassigned records are excluded from search, sharing, copying, normal tour execution, and moderation discovery.
- `.env` approver IDs retain bot-wide approval authority; Global Moderator grants are environment-specific.
- Initial guild selection is atomic and the first committed choice wins.
- Guild environment changes are previewed, confirmed, recalculated transactionally, audited, and all-or-nothing.
- Existing ambiguous comments follow the first-environment-claim rule and are never copied to later environments.
- Use database-native timestamps or normalized MariaDB-safe timestamps; do not write ISO `T...Z` strings directly to MariaDB datetime columns.
- Discord select menus contain at most 25 options and potentially slow interactions are deferred before database work.
- Node.js remains `>=22`; do not add a new runtime dependency.

## Review Focus

- Two users choose different environments simultaneously: exactly one selection commits, the loser sees the committed environment, and neither request partially backfills data. Covered in Task 3.
- A direct ID or old Discord button references a record from another environment: access fails without disclosing the private record's name or owner. Covered in Task 6.
- The same `@owner` and house ID are claimed concurrently in different environments: separate destinations result and legacy comments attach to exactly one. Covered in Task 2.
- A Housing Moderator confirms an environment-change preview after affected data changed: the transaction refuses the stale confirmation and performs no mutations. Covered in Task 10.
- MariaDB receives a migrated timestamp, result projection, or composite moderator row: datetime values are valid, selected column names are unique, and multiple grants survive round-trip transfer. Covered in Tasks 1, 8, and 11.

---

## File structure

### New files

- `src/utils/eso-server.js` — canonical environment codes, labels, ordering, validation, and Discord option generation.
- `src/db/environment-migration.js` — schema-v5 legacy classification, first-claim destination/comment behavior, verification, and restart-safe helpers.
- `src/services/guild-environment-service.js` — atomic first selection, assignment summaries, change previews, confirmed environment moves, pass revocation, pruning, and audit orchestration.
- `test/eso-server.test.js` — environment utility contract.
- `test/environment-schema.test.js` — SQLite/MariaDB schema and v4-to-v5 migration behavior.
- `test/guild-environment.test.js` — first selection, concurrency, assignment, previews, rollback, and audit behavior.
- `test/environment-isolation.test.js` — destination, house, search, direct-access, comments, reports, and recent-view isolation.
- `test/environment-tours.test.js` — tour creation, candidates, stops, copying, readiness, start, and advance rules.
- `test/environment-passes.test.js` — house/tour sharing, mismatch safety, revocation, and session closure.
- `test/environment-global-moderator.test.js` — per-environment requests, grants, caches, queues, and revocation.
- `test/environment-ui.test.js` — setup, home, My AddressBook assignment, and Administration component flows.
- `test/environment-transfer.test.js` — SQLite/MariaDB transfer-column and round-trip preservation coverage.

### Existing files with changed responsibilities

- `src/db/sqlite-schema.js`, `src/db/schema.js`, `src/db/database.js` — schema version 5 and migration entry point.
- `src/db/database-migration.js`, `src/db/migrate-sqlite-to-mariadb.js` — transfer all environment fields and composite moderator grants.
- `src/db/destination-migration.js` — make destination backfill environment-aware.
- `src/services/guild-service.js` — expose cached current environment without owning migration workflows.
- `src/services/destination-service.js` — require environment for normal resolution.
- `src/services/saved-house-service.js`, `registration-service.js`, `house-copy-service.js` — propagate and validate house environment.
- `src/services/house-service.js`, `visit-service.js`, `my-addressbook-service.js`, `comment-service.js` — isolate discovery and comment context.
- `src/services/tour-service.js`, `tour-copy-service.js`, `tour-readiness-service.js`, `tour-session-service.js` — require one tour environment and revalidate stops.
- `src/services/access-context-service.js`, `share-pass-service.js` — enforce environment after resolving IDs/tokens and revoke moved passes.
- `src/services/global-moderator-service.js` — composite grants, requests, queues, and cache keys.
- `src/services/housing-report-service.js`, `admin-health-service.js` — environment-filtered moderation and health summaries.
- `src/ui/housing-ui.js`, `housing-menu.js`, `share-pass-ui.js`, `report-ui.js` — setup, assignment, status, mismatch, and change-preview interactions.
- `src/handlers.js` — gate `/housing`, defer long actions, and pass the authoritative guild environment.
- `src/index.js` — construct and inject the new service where needed.
- `package.json` — include new tests in the explicit test script.
- `docs/AddressBook-v0.6.0-Current-State.md`, `.env.example`, `README.md` where present — current-state user, administration, and deployment behavior.

---

### Task 1: Canonical environments and schema version 5

**Files:**
- Create: `src/utils/eso-server.js`
- Create: `test/eso-server.test.js`
- Create: `test/environment-schema.test.js`
- Modify: `src/db/sqlite-schema.js`
- Modify: `src/db/schema.js`
- Modify: `src/db/database.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `ESO_SERVERS`, `ESO_SERVER_CODES`, `normalizeEsoServer(value)`, `requireEsoServer(value)`, `esoServerLabel(value)`, and `esoServerOptions()`.
- Produces: schema version 5 columns and indexes consumed by every later task.

- [ ] **Step 1: Write failing utility and fresh-schema tests**

Create tests that pin exact codes/order, case-insensitive normalization, rejection of `unassigned`, and fresh SQLite columns:

```js
assert.deepEqual(ESO_SERVERS.map(x=>[x.value,x.label]),[
  ['pc_na','PC NA'],['pc_eu','PC EU'],['xbox_na','Xbox NA'],['xbox_eu','Xbox EU'],
  ['playstation_na','PlayStation NA'],['playstation_eu','PlayStation EU'],['pts','PTS']
]);
assert.equal(normalizeEsoServer(' PC-NA '),'pc_na');
assert.throws(()=>requireEsoServer('unassigned'),/valid ESO environment/);

const guildColumns=new Set((await db.query('PRAGMA table_info(guild_settings)')).map(r=>r.name));
assert.equal(guildColumns.has('eso_server'),true);
assert.equal(guildColumns.has('eso_server_selected_by'),true);
assert.equal(guildColumns.has('eso_server_selected_at'),true);
```

Assert `eso_server` exists on `housing_destinations`, `saved_houses`, `tours`, `global_moderator_requests`, and `global_moderators`. Assert the destination unique index begins with `eso_server`, and moderator identity is `(discord_user_id, eso_server)`.

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
node --test test/eso-server.test.js test/environment-schema.test.js
```

Expected: FAIL because `src/utils/eso-server.js` and schema-v5 columns do not exist.

- [ ] **Step 3: Implement the environment utility**

Use one frozen definition and normalize only documented separators:

```js
export const ESO_SERVERS=Object.freeze([
  {value:'pc_na',label:'PC NA'}, {value:'pc_eu',label:'PC EU'},
  {value:'xbox_na',label:'Xbox NA'}, {value:'xbox_eu',label:'Xbox EU'},
  {value:'playstation_na',label:'PlayStation NA'},
  {value:'playstation_eu',label:'PlayStation EU'}, {value:'pts',label:'PTS'}
]);
export const ESO_SERVER_CODES=Object.freeze(ESO_SERVERS.map(x=>x.value));
export function normalizeEsoServer(value){
  const normalized=String(value??'').trim().toLowerCase().replace(/[\s-]+/g,'_');
  return ESO_SERVER_CODES.includes(normalized)?normalized:null;
}
export function requireEsoServer(value){
  const normalized=normalizeEsoServer(value);
  if(!normalized)throw new Error('Choose a valid ESO environment.');
  return normalized;
}
export const esoServerLabel=value=>ESO_SERVERS.find(x=>x.value===value)?.label??'Unassigned';
export const esoServerOptions=()=>ESO_SERVERS.map(x=>({...x}));
```

- [ ] **Step 4: Add schema-v5 definitions**

Add nullable environment columns to legacy-capable tables and non-null requirements only for new records at the service boundary. Define environment-first indexes. Replace the Global Moderator single-column primary key with a composite key in fresh schemas. Set `SCHEMA_VERSION` and `SQLITE_SCHEMA_VERSION` to 5.

For MariaDB, use `VARCHAR(32)` for environment codes and `DATETIME`/`TIMESTAMP` for selection time. For SQLite, use `TEXT` plus `CHECK(eso_server IS NULL OR eso_server IN (...))` in fresh table definitions.

- [ ] **Step 5: Run focused schema tests**

Run:

```bash
node --test test/eso-server.test.js test/environment-schema.test.js test/mariadb-schema.test.js
```

Expected: PASS, including fresh schemas and exact label order.

- [ ] **Step 6: Commit**

```bash
git add src/utils/eso-server.js src/db/sqlite-schema.js src/db/schema.js src/db/database.js test/eso-server.test.js test/environment-schema.test.js test/mariadb-schema.test.js package.json
git commit -m "feat: add ESO environment schema"
```

---

### Task 2: Restart-safe legacy environment migration

**Files:**
- Create: `src/db/environment-migration.js`
- Modify: `src/db/database.js`
- Modify: `src/db/destination-migration.js`
- Modify: `test/environment-schema.test.js`
- Modify: `test/destination-schema.test.js`

**Interfaces:**
- Consumes: `requireEsoServer()` and schema-v5 columns from Task 1.
- Produces: `assignGuildLegacyData(conn,{guildId,esoServer,actorId})`, `assignPrivateLegacyData(conn,{userId,esoServer,houseIds,tourIds,actorId})`, `inferLegacyGlobalTours(conn)`, and `verifyEnvironmentMigration(conn)`.

- [ ] **Step 1: Write failing v4-to-v5 and first-claim tests**

Build and migrate a v4 SQLite fixture with two guild-linked Server houses, a Global house with `origin_guild_id`, a Private house, comments, a resolvable Global tour, a conflicting Global tour, and two guilds claiming the same owner/house number. First assert the schema upgrade leaves legacy records Unassigned; then call `assignGuildLegacyData` to simulate the guild's first environment selection before making the assignment assertions.

Assert:

```js
assert.equal(serverHouse.eso_server,'pc_na');
assert.equal(globalHouse.eso_server,'pc_na');
assert.equal(privateHouse.eso_server,null);
assert.equal(inferredTour.eso_server,'pc_na');
assert.equal(conflictingTour.eso_server,null);
assert.equal(Number((await one(db,"SELECT count(*) c FROM house_comments WHERE destination_id=?",[firstDestination.id])).c),2);
assert.equal(Number((await one(db,"SELECT count(*) c FROM house_comments WHERE destination_id=?",[laterDestination.id])).c),0);
```

Add concurrent claim coverage using two promises against the same database and assert comments remain attached to exactly one environment-specific destination.

- [ ] **Step 2: Run migration tests and verify failure**

Run:

```bash
node --test test/environment-schema.test.js test/destination-schema.test.js
```

Expected: FAIL because v5 classification and first-claim logic are absent.

- [ ] **Step 3: Implement deterministic assignment helpers**

`assignGuildLegacyData` must run on the caller's transaction and:

```js
export async function assignGuildLegacyData(conn,{guildId,esoServer,actorId}){
  const server=requireEsoServer(esoServer);
  const houses=await conn.query(`SELECT * FROM saved_houses
    WHERE eso_server IS NULL AND (guild_id=? OR (scope='global' AND origin_guild_id=?))
    ORDER BY id FOR UPDATE`,[guildId,guildId]);
  // Claim destinations one row at a time, update houses, then assign deterministic tours.
  // Return exact counts and affected IDs for auditing and UI summaries.
}
```

Implement destination claiming so the first claim moves the legacy destination row, retaining comment foreign keys. A later environment claim creates/reuses a separate destination and repoints only that environment's saved houses. Serialize the legacy destination row before deciding which path wins.

- [ ] **Step 4: Implement tour inference and private assignment**

For each unassigned Global tour, resolve all stops. Assign only when the distinct non-null stop environments set has size one and every stop resolves. Keep empty, unresolved, or conflicting tours null.

`assignPrivateLegacyData` validates ownership, previews conflicting tour stops, assigns chosen records to the current environment, creates/reuses destinations, removes confirmed incompatible stops, compacts positions, and audits the actor and counts.

- [ ] **Step 5: Wire version 5 into `migrate()` and verify before recording**

For both backends, perform table/index alterations, call environment verification, and insert schema migration version 5 only after success. On SQLite, rebuild tables where constraints or unique indexes cannot be safely altered. On MariaDB, drop old unique/primary keys before adding composite keys and check `information_schema` so reruns are idempotent.

- [ ] **Step 6: Run focused migration tests twice for restart safety**

Run:

```bash
node --test test/environment-schema.test.js test/destination-schema.test.js test/database-backend.test.js
```

Expected: PASS, and a second `migrate(db)` leaves row/comment counts unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/db/environment-migration.js src/db/database.js src/db/destination-migration.js test/environment-schema.test.js test/destination-schema.test.js test/database-backend.test.js
git commit -m "feat: migrate legacy data into ESO environments"
```

---

### Task 3: Atomic guild setup and cached environment context

**Files:**
- Create: `src/services/guild-environment-service.js`
- Create: `test/guild-environment.test.js`
- Modify: `src/services/guild-service.js`
- Modify: `src/index.js`

**Interfaces:**
- Consumes: `assignGuildLegacyData()` from Task 2.
- Produces: `GuildEnvironmentService.get(guildId)`, `selectInitial({guildId,esoServer,actorId,names})`, `requireConfigured(guildId)`, and `invalidate(guildId)`.
- Produces: `GuildService.getEsoServer(guildId)` for lightweight synchronous reads after `ensureSettings()`.

- [ ] **Step 1: Write failing atomic-selection tests**

Create one guild with null environment, then issue `selectInitial` concurrently for `pc_na` and `pc_eu`.

```js
const results=await Promise.allSettled([
  service.selectInitial({guildId:'g1',esoServer:'pc_na',actorId:'u1'}),
  service.selectInitial({guildId:'g1',esoServer:'pc_eu',actorId:'u2'})
]);
const stored=await one(db,'SELECT eso_server FROM guild_settings WHERE guild_id=?',['g1']);
assert.ok(['pc_na','pc_eu'].includes(stored.eso_server));
assert.equal(results.filter(r=>r.status==='fulfilled'&&r.value.selected).length,1);
assert.equal(results.every(r=>r.status==='fulfilled'),true);
```

Assert the losing result is `{selected:false, esoServer:<winner>}`, legacy assignment runs once, and one `select_guild_eso_server` audit row exists.

- [ ] **Step 2: Run the test and verify failure**

Run:

```bash
node --test test/guild-environment.test.js
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement conditional first-write transaction**

Use an insert-if-missing followed by a conditional update:

```js
const result=await conn.query(`UPDATE guild_settings
  SET eso_server=?,eso_server_selected_by=?,eso_server_selected_at=CURRENT_TIMESTAMP
  WHERE guild_id=? AND eso_server IS NULL`,[server,String(actorId),String(guildId)]);
if(Number(result.affectedRows)!==1){
  const current=await one(conn,'SELECT eso_server FROM guild_settings WHERE guild_id=?',[guildId]);
  return {selected:false,esoServer:current.eso_server,assignment:null};
}
const assignment=await assignGuildLegacyData(conn,{guildId,esoServer:server,actorId});
```

Write the audit row within the same transaction. Refresh both service caches only after commit.

- [ ] **Step 4: Expose environment through `GuildService`**

Include `eso_server:null` in defaults and add:

```js
getEsoServer(guildId){return this.getSettings(guildId).eso_server||null;}
```

Ensure `ensureSettings()` keeps environment fields while parsing role arrays.

- [ ] **Step 5: Run atomic, cache, and existing guild tests**

Run:

```bash
node --test test/guild-environment.test.js test/multi-role-admin.test.js test/admin-health.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/guild-environment-service.js src/services/guild-service.js src/index.js test/guild-environment.test.js
git commit -m "feat: configure guild ESO environment atomically"
```

---

### Task 4: Environment-aware destinations and saved houses

**Files:**
- Create: `test/environment-isolation.test.js`
- Modify: `src/services/destination-service.js`
- Modify: `src/services/saved-house-service.js`
- Modify: `src/services/registration-service.js`
- Modify: `src/services/registration-draft-service.js`
- Modify: `src/services/house-copy-service.js`
- Modify: `test/destination-comments.test.js`
- Modify: `test/house-copy.test.js`
- Modify: `test/registration-review.test.js`

**Interfaces:**
- Consumes: canonical server validation from Task 1.
- Produces: `DestinationService.resolve({esoServer,esoOwner,houseId},conn)` and house methods that require `esoServer` for all new assigned records.

- [ ] **Step 1: Write failing destination and house tests**

Create the same `@Owner`, house 62 in `pc_na` and `pc_eu`. Assert two destinations, independently shared comments, and duplicate rejection only inside one environment.

```js
const na=await destinations.resolve({esoServer:'pc_na',esoOwner:'@Owner',houseId:62});
const eu=await destinations.resolve({esoServer:'pc_eu',esoOwner:'@Owner',houseId:62});
assert.notEqual(na.id,eu.id);
assert.equal(na.normalized_owner,eu.normalized_owner);
```

Assert `createPrivate`, `createPublic`, and `createGlobal` store the passed environment; new Private records store `origin_guild_id`; and copying a pass-only Private house into a mismatched environment throws the safe mismatch message.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
node --test test/environment-isolation.test.js test/destination-comments.test.js test/house-copy.test.js test/registration-review.test.js
```

Expected: FAIL because destination identity ignores environment.

- [ ] **Step 3: Change destination resolution signature and query**

Require an assigned server for normal calls:

```js
async resolve({esoServer,esoOwner,houseId},conn=this.db){
  const server=requireEsoServer(esoServer);
  // normalize owner and ID as today
  const existing=await one(conn,`SELECT * FROM housing_destinations
    WHERE eso_server=? AND normalized_owner=? AND house_id=?`,[server,normalizedOwner,numericHouseId]);
  // INSERT includes eso_server; duplicate retry repeats the three-column lookup.
}
```

Keep legacy-null claiming private to `environment-migration.js`; ordinary callers cannot create Unassigned destinations.

- [ ] **Step 4: Propagate environment through house creation and updates**

Add `esoServer` to `createPrivate`, `createPublic`, `createGlobal`, `createInConnection`, duplicate checks, and update destination resolution. Store `origin_guild_id` for Private as well as Server/Global records. Require current environment in registration drafts and final save so a draft cannot be submitted after moving to another guild context.

Visibility changes retain `current.eso_server` and validate that the target guild environment equals it before moving to Server or Global.

- [ ] **Step 5: Enforce environment in copy transactions**

Change copy preview/save to accept `targetEsoServer`; compare it with `source.eso_server` before returning prepopulated metadata or writing. Reuse only a destination in that environment and include `esoServer` in the `house_copied` audit details.

- [ ] **Step 6: Update old fixtures with explicit environments and run tests**

Where existing unit tests call creation services, insert configured guild settings or pass `esoServer:'pc_na'`. Do not weaken the new service requirement to keep old tests unchanged.

Run:

```bash
node --test test/environment-isolation.test.js test/destination-comments.test.js test/house-copy.test.js test/registration-review.test.js test/saved-house-scope.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/destination-service.js src/services/saved-house-service.js src/services/registration-service.js src/services/registration-draft-service.js src/services/house-copy-service.js test/environment-isolation.test.js test/destination-comments.test.js test/house-copy.test.js test/registration-review.test.js test/saved-house-scope.test.js
git commit -m "feat: isolate destinations and houses by environment"
```

---

### Task 5: Environment-filtered search, comments, recent views, and reports

**Files:**
- Modify: `src/services/house-service.js`
- Modify: `src/services/visit-service.js`
- Modify: `src/services/comment-service.js`
- Modify: `src/services/my-addressbook-service.js`
- Modify: `src/services/housing-report-service.js`
- Modify: `src/services/admin-health-service.js`
- Modify: `test/environment-isolation.test.js`
- Modify: `test/search-homes-ux.test.js`
- Modify: `test/my-addressbook.test.js`
- Modify: `test/housing-reports.test.js`

**Interfaces:**
- Consumes: assigned `saved_houses.eso_server` and `housing_destinations.eso_server`.
- Produces: environment-required discovery methods and environment-filtered moderator queues.

- [ ] **Step 1: Add failing discovery-isolation tests**

Seed matching Global destinations in PC NA and PC EU, plus Server/Private rows. Call searches from PC NA and assert no PC EU row appears. Add `notOnPublicTours` coverage proving that a PC EU Global tour does not exclude the PC NA copy.

Assert recent views silently omit inaccessible/mismatched records, comments load only from the selected environment destination, house details list only same-environment associated tours by tour name, report queues filter by `destination.eso_server`, and admin health counts pending requests for the current environment unless an approver explicitly requests all.

- [ ] **Step 2: Run and verify failure**

Run:

```bash
node --test test/environment-isolation.test.js test/search-homes-ux.test.js test/my-addressbook.test.js test/housing-reports.test.js test/admin-health.test.js
```

Expected: FAIL because Global queries lack an environment predicate.

- [ ] **Step 3: Require `esoServer` in discovery entry points**

Update `VisitService.search` and saved-house list methods so every assigned saved-house branch includes `s.eso_server=?`. Keep official/non-player catalog houses visible because they are not user destinations, but continue honoring the existing include/exclude toggle.

Update the not-on-tour subquery to require `t.eso_server=s.eso_server`, while retaining current-guild matching for Server tours.

- [ ] **Step 4: Filter My AddressBook and recent views**

Change normal lists and counts to include only assigned records matching the current environment. Add a separate unassigned count object:

```js
async legacyUnassigned(userId){
  const houses=await one(this.db,"SELECT count(*) c FROM saved_houses WHERE eso_server IS NULL AND owner_user_id=?",[String(userId)]);
  const tours=await one(this.db,"SELECT count(*) c FROM tours WHERE eso_server IS NULL AND creator_id=?",[String(userId)]);
  return {houses:Number(houses.c),tours:Number(tours.c)};
}
```

Do not mix those rows into `houses()`, `tours()`, `recent()`, or continue-item queries.

- [ ] **Step 5: Filter reports and health summaries**

Require the reporter guild environment to match the resolved destination/tour before creating a report. `listPending({esoServer,allEnvironments})` uses one environment unless the caller is a configured approver and explicitly requests all. Include environment labels in returned summaries without adding duplicate MariaDB projection names.

- [ ] **Step 6: Run focused tests**

Run:

```bash
node --test test/environment-isolation.test.js test/search-homes-ux.test.js test/my-addressbook.test.js test/housing-reports.test.js test/admin-health.test.js test/mariadb-query-columns.test.js
```

Expected: PASS, including `house_name`/`tour_name` projection regression tests.

- [ ] **Step 7: Commit**

```bash
git add src/services/house-service.js src/services/visit-service.js src/services/comment-service.js src/services/my-addressbook-service.js src/services/housing-report-service.js src/services/admin-health-service.js test/environment-isolation.test.js test/search-homes-ux.test.js test/my-addressbook.test.js test/housing-reports.test.js test/admin-health.test.js test/mariadb-query-columns.test.js
git commit -m "feat: filter housing discovery by environment"
```

---

### Task 6: Direct-access and authorization guardrails

**Files:**
- Modify: `src/services/access-context-service.js`
- Modify: `src/services/saved-house-service.js`
- Modify: `test/pass-access-context.test.js`
- Modify: `test/environment-isolation.test.js`
- Modify: `test/house-card-context.test.js`

**Interfaces:**
- Consumes: `esoServer` from the configured guild context.
- Produces: `forHouse({userId,guildId,esoServer,savedHouseId,passId,conn})` and `forTour({userId,guildId,esoServer,tourId,passId,conn})` with `environmentMatch`, safe `reason`, and existing permission flags.

- [ ] **Step 1: Write failing direct-ID and stale-button tests**

Resolve a PC EU Global house by ID while the request context is PC NA. Assert:

```js
const result=await access.forHouse({userId:'viewer',guildId:'na-guild',esoServer:'pc_na',savedHouseId:eu.id});
assert.equal(result.canView,false);
assert.equal(result.environmentMatch,false);
assert.equal(result.reason,'environment_mismatch');
assert.equal('record' in result,false);
```

Repeat for Private house pass, tour pass, card-details ID, comments ID, and edit/remove IDs. Assert the user-visible mismatch response contains environment labels but not nickname, owner, description, tags, or tour name.

- [ ] **Step 2: Run access tests and verify failure**

Run:

```bash
node --test test/pass-access-context.test.js test/environment-isolation.test.js test/house-card-context.test.js
```

Expected: FAIL because direct IDs treat Global records as bot-wide.

- [ ] **Step 3: Put environment check before normal/pass authorization**

After loading only the target row needed for authorization, compare `record.eso_server` with the required request environment. On mismatch return a redacted result:

```js
if(!record?.eso_server||record.eso_server!==server){
  return {normalAccess:false,passOnly:false,canView:false,canShare:false,canEdit:false,canCopy:false,
    environmentMatch:false,reason:record?.eso_server?'environment_mismatch':'unassigned'};
}
```

Only attach `record` after environment validation succeeds. Pass tokens never override this guard.

- [ ] **Step 4: Update saved-house visible lookup and callers**

Require `esoServer` in `getVisible` and add `s.eso_server=?` before visibility branches. Ensure handlers use the redacted access result rather than loading the full record again after denial.

- [ ] **Step 5: Run focused access tests**

Run:

```bash
node --test test/pass-access-context.test.js test/environment-isolation.test.js test/house-card-context.test.js test/shared-house-ui.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/access-context-service.js src/services/saved-house-service.js test/pass-access-context.test.js test/environment-isolation.test.js test/house-card-context.test.js test/shared-house-ui.test.js
git commit -m "fix: block cross-environment direct access"
```

---

### Task 7: Environment-bound tours and stop validation

**Files:**
- Create: `test/environment-tours.test.js`
- Modify: `src/services/tour-service.js`
- Modify: `src/services/tour-copy-service.js`
- Modify: `src/services/tour-readiness-service.js`
- Modify: `src/services/tour-session-service.js`
- Modify: `src/services/saved-house-service.js`
- Modify: `test/tour-add-house.test.js`
- Modify: `test/tour-copy.test.js`
- Modify: `test/global-tour.test.js`
- Modify: `test/tour-session-scope.test.js`

**Interfaces:**
- Consumes: house environment and access guardrails from Tasks 4–6.
- Produces: `TourService.create({...data,esoServer,originGuildId})`; all candidate, stop, copy, readiness, and session methods enforce one environment.

- [ ] **Step 1: Write failing tour environment tests**

Cover all visibility/environment combinations:

```js
assert.deepEqual((await tours.houseCandidates({creatorId:'u1',sourceGuildId:'g1',esoServer:'pc_na',visibility:'global'})).map(x=>x.eso_server),['pc_na']);
await assert.rejects(()=>tours.addStop(naTour.id,euHouse.id),/belongs to PC EU.*uses PC NA/);
```

Assert Global accepts only same-environment Global, Server accepts same-environment Global/Server, and Private accepts accessible same-environment Private/Server/Global. Assert copied tours remain in the source/current matching environment and cannot copy across environments.

Add readiness/start/advance tests where a stop is manually corrupted after insertion; start and advance must block with `environment_mismatch` rather than skip it.

- [ ] **Step 2: Run tour tests and verify failure**

Run:

```bash
node --test test/environment-tours.test.js test/tour-add-house.test.js test/tour-copy.test.js test/global-tour.test.js test/tour-session-scope.test.js
```

Expected: FAIL because tours and candidates are not environment-bound.

- [ ] **Step 3: Store and validate tour environment**

Require `esoServer` at creation, store `origin_guild_id` for every visibility, and include `eso_server` in `get`, list, editable-list, and candidate queries. `addStop` loads tour and house in one transaction and rejects when either is unassigned or values differ before checking `tourAllowsHouseScope`.

- [ ] **Step 4: Revalidate readiness and sessions**

Add a blocking readiness item for every stop whose `s.eso_server<>t.eso_server` or environment is null. Change session start methods to accept `esoServer`, verify the tour environment before replacing an existing session, and store no session if validation fails. `advance` loads session, tour, and current stop and refuses a stale invalid tour.

- [ ] **Step 5: Make copy transactional and environment-safe**

`TourCopyService.preview` and `copy` accept the target environment. The preview lists incompatible stops; normal copy requires zero environment mismatches. Preserve visibility-specific access rules and include source/target environment in the audit record.

- [ ] **Step 6: Run focused tour tests**

Run:

```bash
node --test test/environment-tours.test.js test/tour-add-house.test.js test/tour-copy.test.js test/global-tour.test.js test/tour-session-scope.test.js test/tour-pass-session.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/tour-service.js src/services/tour-copy-service.js src/services/tour-readiness-service.js src/services/tour-session-service.js src/services/saved-house-service.js test/environment-tours.test.js test/tour-add-house.test.js test/tour-copy.test.js test/global-tour.test.js test/tour-session-scope.test.js test/tour-pass-session.test.js
git commit -m "feat: bind tours and stops to one environment"
```

---

### Task 8: Environment-safe share passes and sessions

**Files:**
- Create: `test/environment-passes.test.js`
- Modify: `src/services/share-pass-service.js`
- Modify: `src/services/tour-session-service.js`
- Modify: `src/ui/share-pass-ui.js`
- Modify: `test/house-share-pass.test.js`
- Modify: `test/tour-share-pass.test.js`
- Modify: `test/tour-pass-session.test.js`

**Interfaces:**
- Consumes: redacted access results from Task 6 and readiness from Task 7.
- Produces: environment-required pass creation/redemption and `revokeForEnvironmentMove(conn,{houseIds,tourIds,actorId,reason})`.

- [ ] **Step 1: Write failing pass mismatch and revocation tests**

Create PC EU house/tour passes and open them from PC NA. Assert the mismatch response is redacted and usage count remains unchanged. Assert Unassigned content cannot create a pass.

Move affected IDs through `revokeForEnvironmentMove` and assert:

```js
assert.equal((await one(db,'SELECT status FROM tour_share_passes WHERE id=?',[pass.id])).status,'revoked');
assert.equal(Number((await one(db,'SELECT count(*) c FROM share_pass_sessions WHERE tour_share_pass_id=? AND closed_at IS NOT NULL',[pass.id])).c),1);
await assert.rejects(
  ()=>passes.resolveTourPass(token,{userId:'u2',guildId:'g1',esoServer:'pc_na'}),
  /environment changed.*new pass/i
);
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
node --test test/environment-passes.test.js test/house-share-pass.test.js test/tour-share-pass.test.js test/tour-pass-session.test.js
```

Expected: FAIL because pass methods lack environment context and move revocation.

- [ ] **Step 3: Require environment at pass boundaries**

Add `esoServer` to house/tour pass creation and resolution. Pass it to access and readiness services. Reject null/mismatch before incrementing usage, auditing use, returning metadata, or starting a session.

- [ ] **Step 4: Implement bulk move revocation**

Inside the caller's environment-change transaction, lock active passes for affected houses/tours, set `status='revoked'`, `revoked_at=CURRENT_TIMESTAMP`, actor, and reason `environment_changed`; close active `share_pass_sessions` with the same reason. Return exact pass/session counts for the preview verification and audit.

- [ ] **Step 5: Render safe expired-pass copy**

Map `environment_changed` to:

```text
This Share Pass is no longer valid because the house or tour moved to another ESO environment. Ask its owner for a new pass.
```

Do not include the target name or owner when access is mismatched.

- [ ] **Step 6: Run pass tests**

Run:

```bash
node --test test/environment-passes.test.js test/house-share-pass.test.js test/tour-share-pass.test.js test/tour-pass-session.test.js test/shared-house-ui.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/share-pass-service.js src/services/tour-session-service.js src/ui/share-pass-ui.js test/environment-passes.test.js test/house-share-pass.test.js test/tour-share-pass.test.js test/tour-pass-session.test.js test/shared-house-ui.test.js
git commit -m "feat: enforce environment on share passes"
```

---

### Task 9: Environment-specific Global Moderator workflow

**Files:**
- Create: `test/environment-global-moderator.test.js`
- Modify: `src/services/global-moderator-service.js`
- Modify: `src/services/my-addressbook-service.js`
- Modify: `src/services/housing-report-service.js`
- Modify: `test/global-moderator.test.js`
- Modify: `test/global-ui.test.js`
- Modify: `test/admin-health.test.js`

**Interfaces:**
- Consumes: current guild environment from Task 3.
- Produces: `requestAccess({userId,guildId,esoServer,reason})`, `isGlobalModerator(userId,esoServer)`, `approve(requestId,approverId)`, `deny(requestId,approverId)`, `revoke(userId,esoServer,approverId)`, and `listPending({esoServer=null})`.

- [ ] **Step 1: Write failing multi-grant and queue tests**

Request and approve PC NA and PC EU for one user. Assert both rows exist, authorization is true in each, Xbox is false, and revoking PC NA leaves PC EU active. Assert duplicate pending request prevention is per environment.

Prime the cache with mixed results and verify cache keys do not collide:

```js
assert.equal(await service.isGlobalModerator('u1','pc_na'),true);
assert.equal(await service.isGlobalModerator('u1','pc_eu'),true);
assert.equal(await service.isGlobalModerator('u1','xbox_na'),false);
```

Assert an `.env` approver can list all pending requests, while a regular environment moderator sees only the authorized environment's reports.

- [ ] **Step 2: Run and verify failure**

Run:

```bash
node --test test/environment-global-moderator.test.js test/global-moderator.test.js test/global-ui.test.js test/admin-health.test.js
```

Expected: FAIL because grants and cache keys use user ID alone.

- [ ] **Step 3: Convert service queries and cache keys**

Use:

```js
const cacheKey=(userId,esoServer)=>`${String(userId)}:${requireEsoServer(esoServer)}`;
```

Every request/grant query includes `eso_server`. Approval copies the request's environment into the composite moderator row. Revocation deletes one `(user,environment)` row. Audit details always include `esoServer` and `requestId` when applicable.

- [ ] **Step 4: Update status summaries and moderation checks**

My AddressBook pending counts and Global Moderator status list grants/requests grouped by environment label. Report review checks call `isGlobalModerator(userId,report.eso_server)`. Configured approvers retain all-environment review independently of grants.

- [ ] **Step 5: Run moderator tests**

Run:

```bash
node --test test/environment-global-moderator.test.js test/global-moderator.test.js test/global-ui.test.js test/admin-health.test.js test/housing-reports.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/global-moderator-service.js src/services/my-addressbook-service.js src/services/housing-report-service.js test/environment-global-moderator.test.js test/global-moderator.test.js test/global-ui.test.js test/admin-health.test.js test/housing-reports.test.js
git commit -m "feat: scope global moderators by environment"
```

---

### Task 10: First-use, legacy-assignment, and Administration UI

**Files:**
- Create: `test/environment-ui.test.js`
- Modify: `src/ui/housing-ui.js`
- Modify: `src/ui/housing-menu.js`
- Modify: `src/handlers.js`
- Modify: `src/services/guild-environment-service.js`
- Modify: `src/services/my-addressbook-service.js`
- Modify: `test/approved-ux.test.js`
- Modify: `test/component-limits.test.js`
- Modify: `test/my-addressbook.test.js`
- Modify: `test/admin-pending-review.test.js`

**Interfaces:**
- Consumes: setup and assignment services from Tasks 2–3 plus pass revocation from Task 8.
- Produces: `environmentSetupPayload()`, `legacyAssignmentPayload()`, `environmentChangePreviewPayload()`, `GuildEnvironmentService.previewChange({guildId,toEsoServer})`, and `confirmChange({guildId,toEsoServer,actorId,expectedFingerprint,names})`.

- [ ] **Step 1: Write failing Discord payload tests**

Assert an unconfigured `/housing` response shows a required setup explanation and one seven-option select in exact order. Assert home and Administration display the configured label. Assert My AddressBook shows an Unassigned migration action only when counts are nonzero.

Assert the Administration preview displays current/proposed environments and counts for houses, tours, removed stops, destinations, revoked passes, sessions, and unresolved records. Verify all rows contain no more than five buttons and every select has at most 25 options.

- [ ] **Step 2: Write failing change-transaction tests**

Seed a PC NA guild with Server/Global/Private houses, compatible/incompatible tours, passes, and comments. Call `previewChange`, mutate an affected row, then call `confirmChange` with the original preview fingerprint. Assert stale confirmation rejects and nothing moves.

Call a fresh preview and confirmation; assert provenance-linked Server/Global records move, unrelated/Private records do not, invalid stops are removed and compacted, passes revoke, comments obey destination rules, guild setting updates last, and audit details match returned counts.

- [ ] **Step 3: Run and verify failure**

Run:

```bash
node --test test/environment-ui.test.js test/guild-environment.test.js test/component-limits.test.js test/my-addressbook.test.js
```

Expected: FAIL because setup/change/assignment UI and change methods are absent.

- [ ] **Step 4: Implement setup gate and payloads**

At the start of `/housing` and every menu entry, call `ensureSettings()`. If `eso_server` is null, render setup instead of home. The selection handler defers immediately, calls `selectInitial`, then renders either the successful assignment summary or the winner message:

```text
Another member completed setup first. This server is now configured for PC NA.
```

Every normal home/admin payload receives the environment label explicitly; UI modules do not query the database.

- [ ] **Step 5: Implement legacy assignment flow**

My AddressBook shows counts and buttons **Assign to <Current Environment>** and **Not Now**. A preview lists record counts and conflicting tour-stop removals. Confirmation calls `assignPrivateLegacyData` with explicit owned IDs/fingerprint; closing or postponing makes no changes.

- [ ] **Step 6: Implement preview fingerprint and confirmed change**

`previewChange` returns stable sorted affected IDs, counts, and a SHA-256 fingerprint of the canonical JSON payload. `confirmChange` starts a transaction, locks/reloads affected records, recomputes the preview, compares fingerprints, and aborts on mismatch.

On match, execute the exact 13-step transaction in the spec: retag provenance-linked houses/tours, remap destinations, preserve/non-merge comments, prune/compact stops, revoke passes/close sessions, update guild settings, audit, commit, then invalidate caches.

- [ ] **Step 7: Defer long Discord interactions and handle errors**

Handlers for setup assignment, legacy assignment, previews, confirmation, and report queues call `deferReply`, `deferUpdate`, or the project's response wrapper before database work. Convert known errors to the approved user-facing messages and log the original exception once.

- [ ] **Step 8: Run UI and transaction tests**

Run:

```bash
node --test test/environment-ui.test.js test/guild-environment.test.js test/component-limits.test.js test/my-addressbook.test.js test/admin-pending-review.test.js test/approved-ux.test.js
```

Expected: PASS, including stale-preview rollback and interaction acknowledgment.

- [ ] **Step 9: Commit**

```bash
git add src/ui/housing-ui.js src/ui/housing-menu.js src/handlers.js src/services/guild-environment-service.js src/services/my-addressbook-service.js test/environment-ui.test.js test/guild-environment.test.js test/component-limits.test.js test/my-addressbook.test.js test/admin-pending-review.test.js test/approved-ux.test.js
git commit -m "feat: add environment setup and administration flows"
```

---

### Task 11: Cross-backend data transfer and MariaDB regressions

**Files:**
- Create: `test/environment-transfer.test.js`
- Modify: `src/db/database-migration.js`
- Modify: `src/db/migrate-sqlite-to-mariadb.js`
- Modify: `test/v4-data-transfer.test.js`
- Modify: `test/sqlite-import.test.js`
- Modify: `test/mariadb-query-columns.test.js`
- Modify: `test/database-backend.test.js`

**Interfaces:**
- Consumes: all schema-v5 fields and composite keys.
- Produces: destructive `MIGRATE` transfer parity for environment-aware records in both directions.

- [ ] **Step 1: Write failing transfer-preservation tests**

Seed all seven environment codes across guild settings, destinations, saved houses, tours, requests, and grants. Include two moderator grants for one user, comments on same owner/house in two environments, and MariaDB-safe timestamp assertions.

After transfer, compare normalized row projections:

```js
assert.deepEqual(await target.query('SELECT discord_user_id,eso_server FROM global_moderators ORDER BY 1,2'),[
  {discord_user_id:'u1',eso_server:'pc_eu'},
  {discord_user_id:'u1',eso_server:'pc_na'}
]);
assert.equal((await target.query('SELECT count(*) c FROM housing_destinations'))[0].c,2);
```

Assert active tour sessions and share-pass sessions remain intentionally excluded as current transfer policy requires.

- [ ] **Step 2: Run transfer tests and verify failure**

Run:

```bash
node --test test/environment-transfer.test.js test/v4-data-transfer.test.js test/sqlite-import.test.js test/mariadb-query-columns.test.js
```

Expected: FAIL because transfer column maps omit environment fields and composite grants.

- [ ] **Step 3: Extend transfer table maps and insert statements**

Add environment and guild selection columns to `TRANSFER_TABLES`/equivalent maps in dependency order. Include `housing_destinations` before saved houses/comments. Copy `origin_guild_id`/names for tours and Private houses. Copy moderator rows using both key fields.

Use the existing timestamp normalization helper for selection, approval, review, revocation, and audit times. Never pass an ISO `T...Z` string directly to MariaDB.

- [ ] **Step 4: Verify destructive transfer before success**

Prevalidate source schema and required columns before clearing the destination. After copy, verify per-table counts, environment group counts, orphan checks, destination/house environment equality, tour/stop environment equality, and moderator composite-row counts. Return these counts in the migration summary.

- [ ] **Step 5: Remove duplicate result projections**

Review every changed MariaDB query using `SELECT *` plus aliases. Replace collisions with explicit aliases such as `current_tour_name` and `catalog_house_name`, then normalize the returned object exactly once. Extend `test/mariadb-query-columns.test.js` to reject duplicate `house_name`, `tour_name`, and `eso_server` projections.

- [ ] **Step 6: Run backend transfer tests**

Run:

```bash
node --test test/environment-transfer.test.js test/v4-data-transfer.test.js test/sqlite-import.test.js test/mariadb-query-columns.test.js test/database-backend.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/db/database-migration.js src/db/migrate-sqlite-to-mariadb.js test/environment-transfer.test.js test/v4-data-transfer.test.js test/sqlite-import.test.js test/mariadb-query-columns.test.js test/database-backend.test.js
git commit -m "feat: preserve environments across database migration"
```

---

### Task 12: End-to-end handler wiring and audit identities

**Files:**
- Modify: `src/ui/housing-menu.js`
- Modify: `src/handlers.js`
- Modify: `src/index.js`
- Modify: `src/services/identity-service.js`
- Modify: `src/services/registration-service.js`
- Modify: `src/services/visit-service.js`
- Modify: `src/services/tour-service.js`
- Modify: `test/environment-ui.test.js`
- Modify: `test/identity-service.test.js`
- Modify: `test/identity-schema.test.js`
- Modify: `test/approved-ux.test.js`

**Interfaces:**
- Consumes: every environment-aware service signature established in Tasks 3–11.
- Produces: one authoritative request context `{guildId,userId,esoServer}` passed through all Discord actions.

- [ ] **Step 1: Add failing end-to-end menu tests**

Use mocked Discord interactions to exercise `/housing`, search, registration, details, comments, tour create/add/start/advance, share/copy, reporting, Global Moderator request/review, My AddressBook, and Administration.

For each action assert either:

```js
assert.equal(captured.esoServer,'pc_na');
```

or, for an unconfigured guild, assert only the setup payload is rendered and the underlying service was not called.

Add a renamed guild/user fixture and assert environment audits retain IDs while readable guild, global, and display names update through `IdentityService` without changing authorization keys.

- [ ] **Step 2: Run handler tests and verify failure**

Run:

```bash
node --test test/environment-ui.test.js test/approved-ux.test.js test/identity-service.test.js test/identity-schema.test.js
```

Expected: FAIL at call sites still using old service signatures.

- [ ] **Step 3: Create one request-context helper**

In `housing-menu.js` or a focused local helper, after `guilds.ensureSettings(i.guildId)`, construct:

```js
const contextFor=i=>({
  guildId:String(i.guildId),
  userId:String(i.user.id),
  esoServer:guilds.getEsoServer(i.guildId)
});
```

Use it for every service boundary. Do not infer environment from a selected record, token, or user input.

- [ ] **Step 4: Update all call sites and authorization checks**

Pass `esoServer` into search, registration, direct access, comments, tours, sessions, copying, passes, reports, recent views, and Global Moderator methods. Global moderation checks always include the target record/request environment; configured approver checks remain environment-independent.

- [ ] **Step 5: Refresh readable identities after environment actions**

Call existing identity capture around initial selection, environment change, assignment, moderation request/review, and pass revocation. Ensure audit rows contain IDs plus current names, while IDs remain the relationship keys.

- [ ] **Step 6: Run handler, identity, and UX tests**

Run:

```bash
node --test test/environment-ui.test.js test/approved-ux.test.js test/identity-service.test.js test/identity-schema.test.js test/search-homes-ux.test.js test/tour-add-house.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/housing-menu.js src/handlers.js src/index.js src/services/identity-service.js src/services/registration-service.js src/services/visit-service.js src/services/tour-service.js test/environment-ui.test.js test/identity-service.test.js test/identity-schema.test.js test/approved-ux.test.js
git commit -m "feat: wire environment context through Discord flows"
```

---

### Task 13: Documentation, package verification, and release readiness

**Files:**
- Modify: `docs/AddressBook-v0.6.0-Current-State.md`
- Modify: `.env.example`
- Modify: `README.md` if present
- Modify: `package.json`
- Test: all files under `test/`

**Interfaces:**
- Consumes: completed behavior from Tasks 1–12.
- Produces: accurate current-state documentation and a reproducible verification result.

- [ ] **Step 1: Add all new tests to the explicit npm test script**

Append these exact files to `scripts.test`:

```text
test/eso-server.test.js
test/environment-schema.test.js
test/guild-environment.test.js
test/environment-isolation.test.js
test/environment-tours.test.js
test/environment-passes.test.js
test/environment-global-moderator.test.js
test/environment-ui.test.js
test/environment-transfer.test.js
```

- [ ] **Step 2: Update current-state and deployment documentation**

Document all seven environments, required first-use selection, visibility versus environment, Global isolation, legacy assignment, moderator grants, environment-change impact/pass revocation, and SQLite/MariaDB migration behavior. State that `GLOBAL_MODERATOR_APPROVER_USER_IDS` remains comma-separated and bot-wide.

Keep AddressBook version `0.6.0` consistent in `package.json`, `/housing`, the current-state guide, and the eventual release archive. Do not add a revision-history section.

- [ ] **Step 3: Run static consistency checks**

Run:

```bash
rg -n "PC NA|PC EU|Xbox NA|Xbox EU|PlayStation NA|PlayStation EU|PTS" docs src
rg -n "scope" docs src/ui src/services
rg -n "GLOBAL_MODERATOR_APPROVER_USER_IDS" .env.example docs src
```

Expected: all seven labels appear in the canonical utility and documentation; user-facing text uses **visibility** rather than **scope** except internal schema/code names; approver documentation matches implementation.

- [ ] **Step 4: Run the complete automated suite**

Run:

```bash
npm test
```

Expected: all tests PASS with zero unhandled rejections.

- [ ] **Step 5: Perform a fresh SQLite smoke test**

Run with a temporary database and development guild, then manually verify:

```text
/housing -> environment setup -> PC NA -> home shows PC NA
Register Global house -> search finds it in PC NA
Change test guild to PC EU -> preview counts -> confirm -> old pass reports environment change
My AddressBook -> Unassigned prompt appears only for seeded legacy Private data
```

- [ ] **Step 6: Perform a MariaDB smoke test**

Using a disposable database name, run startup migration, register/search a house, create/start a tour, request/approve PC NA moderation, grant the same user PC EU, and verify both grants remain. Confirm application logs contain no duplicate-field or incorrect-datetime errors.

- [ ] **Step 7: Inspect the final diff and commit documentation**

Run:

```bash
git status --short
git diff --check
git diff --stat
```

Expected: only planned source, test, and documentation files are changed; `git diff --check` prints nothing.

Commit:

```bash
git add package.json docs/AddressBook-v0.6.0-Current-State.md .env.example README.md
git commit -m "docs: explain ESO environment partitioning"
```

If `README.md` is absent, omit it from `git add`; do not create a redundant second guide.

---

## Final verification gate

Before reporting implementation complete:

1. Run `npm test` and retain the passing count/output.
2. Run `git diff --check` and confirm no whitespace errors.
3. Inspect schema version 5 on both backends.
4. Confirm all seven environment codes round-trip through SQLite/MariaDB transfer.
5. Confirm mismatched direct IDs and passes reveal no private metadata.
6. Confirm the first-claim comment test passes under concurrent claims.
7. Confirm stale environment-change confirmation rolls back without mutation.
8. Confirm one user can hold and independently lose multiple environment moderator grants.
9. Confirm all normal Discord entry points are gated for unconfigured guilds.
10. Confirm documentation, `/housing`, `package.json`, and release filename say `0.6.0`.

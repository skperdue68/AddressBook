# AddressBook v0.8.0 Personal Discovery and Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship AddressBook v0.8.0 with private Favorites and visit states, reusable saved searches, Surprise Me discovery, and interactive onboarding on both SQLite and MariaDB.

**Architecture:** Store destination-level personal state and versioned saved-search templates in two schema-v6 tables. Add focused services for state, saved searches, and random discovery; route every display through the existing access-controlled `VisitService`, and add compact ephemeral Discord panels rather than crowding public cards.

**Tech Stack:** Node.js 22+, ECMAScript modules, discord.js 14, built-in `node:sqlite`, MariaDB 3, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-20-personal-discovery-adoption-design.md`

## Global Constraints

- Release target is `0.8.0`; schema target is version `6` for SQLite and MariaDB.
- Minimum Node.js version remains `22`; add no production dependency for this release.
- Stable player targets use `housing_destinations.id`; Non-Player targets use `houses.house_id` with internal kind `official`.
- Personal state and saved searches are owner-only and never grant access.
- Global, Server, Private remains the user-facing visibility order everywhere.
- Jump in ESO, Unfurnished Preview, and Housing Link values remain in separate code blocks.
- `MIGRATE` continues to erase the destination only after the existing explicit confirmation and transfers the two new persistent tables in both directions.
- The ordinary startup migration remains additive and nondestructive.
- User-facing documentation remains current-state documentation with no revision-history section.
- The release ZIP excludes `.git`, worktrees, `node_modules`, `.env`, databases, secrets, and `docs/superpowers`.

## File Structure

- `src/db/schema.js`, `src/db/sqlite-schema.js`, `src/db/database.js` — schema-v6 definitions and ordered startup migration.
- `src/db/database-migration.js` — two-way persistent transfer manifest and verification.
- `src/utils/house-target.js` — canonical target construction and keys for player and Non-Player houses.
- `src/utils/search-filters.js` — one validator/normalizer for live and saved Search Homes filters.
- `src/services/user-house-state-service.js` — Favorite and visit-state transitions plus access-filtered personal lists.
- `src/services/saved-house-search-service.js` — named saved-search ownership, conflict, version, and persistence rules.
- `src/services/house-discovery-service.js` — backend-neutral random selection from already-authorized results.
- `src/services/visit-service.js` — include stable destination identity in search rows and consume normalized filters.
- `src/services/my-addressbook-service.js` — personal discovery counts for the dashboard.
- `src/services/identity-service.js` — refresh companion Discord and target names in the new tables.
- `src/ui/housing-ui.js` — Personal Actions, personal lists, saved-search views/modals, Surprise Me, and onboarding payloads.
- `src/ui/housing-menu.js` — interaction routing and ephemeral per-user state.
- `test/personal-discovery-schema.test.js` — schema-v6 and upgrade coverage.
- `test/user-house-state.test.js` — state transitions, access isolation, deterministic resolution, and datetime behavior.
- `test/personal-discovery-ui.test.js` — Personal Actions and My AddressBook payload/handler behavior.
- `test/saved-house-search.test.js` — filter validation and saved-search persistence.
- `test/saved-house-search-ui.test.js` — saving, conflict confirmation, pagination, running, renaming, and deleting.
- `test/surprise-me.test.js` — complete-result selection, rerolls, and empty results.
- Existing onboarding, identity, component-limit, transfer, backend, and release tests — regression and integration coverage.

## Review Focus

- One destination represented by Global, Server, and Private entries must appear once, preferring Global without changing its personal state; Task 2 pins this.
- A stale or another user's component ID must never mutate personal state or a saved search; Tasks 3 and 5 pin this.
- Malformed, oversized, unknown-version, or unknown-key saved filters must fail closed instead of becoming an unfiltered search; Task 4 pins this.
- Twenty-six or more personal entries or saved searches must paginate without exceeding Discord's 25-option limit; Tasks 3 and 5 pin this.
- MariaDB DATETIME writes and concurrent duplicate actions must use native dates/atomic uniqueness rather than ISO `Z` strings or duplicate rows; Tasks 2 and 8 pin this.

---

### Task 1: Schema Version 6 and Two-Way Transfer

**Files:**
- Modify: `src/db/schema.js`
- Modify: `src/db/sqlite-schema.js`
- Modify: `src/db/database.js`
- Modify: `src/db/database-migration.js`
- Create: `test/personal-discovery-schema.test.js`
- Modify: `test/environment-schema.test.js`
- Modify: `test/mariadb-schema.test.js`
- Modify: `test/environment-transfer.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: schema version 5 and the existing `migrate(db)` / `migrateDatabaseData()` ordering.
- Produces: `SCHEMA_V6`, `SQLITE_SCHEMA_V6`, schema version constants equal to `6`, and transferable `user_house_states` / `saved_house_searches` tables.

- [ ] **Step 1: Write failing clean-install and v5-upgrade tests**

Create a temporary SQLite database, run `migrate(db)`, and assert the exact columns, uniqueness, and version. Also create a v5 fixture before migration and prove its existing house/tour counts do not change.

```js
const tables=new Set((await db.query("SELECT name FROM sqlite_master WHERE type='table'")).map(r=>r.name));
assert.ok(tables.has('user_house_states'));
assert.ok(tables.has('saved_house_searches'));
assert.equal(Number((await one(db,'SELECT max(version) v FROM schema_migrations')).v),6);
assert.deepEqual(
  (await db.query('PRAGMA table_info(user_house_states)')).map(r=>r.name),
  ['id','discord_user_id','discord_global_name','discord_display_name','target_kind','target_id','house_name','eso_owner','is_favorite','visit_state','last_visited_at','created_at','updated_at']
);
```

Extend MariaDB schema-string tests to require both tables, `UNIQUE KEY uq_user_house_target(discord_user_id,target_kind,target_id)`, the visit-state constraint/enum, and per-user indexes. Add both new test files to the explicit `npm test` command.

- [ ] **Step 2: Run schema tests and verify the intended failure**

Run:

```bash
node --test test/personal-discovery-schema.test.js test/environment-schema.test.js test/mariadb-schema.test.js
```

Expected: FAIL because schema version 6 and the new tables do not exist.

- [ ] **Step 3: Define equivalent SQLite and MariaDB v6 tables**

Export `SQLITE_SCHEMA_V6` with these SQLite definitions:

```sql
CREATE TABLE IF NOT EXISTS user_house_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_user_id TEXT NOT NULL,
  discord_global_name TEXT,
  discord_display_name TEXT,
  target_kind TEXT NOT NULL CHECK(target_kind IN ('destination','official')),
  target_id INTEGER NOT NULL,
  house_name TEXT,
  eso_owner TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN (0,1)),
  visit_state TEXT NOT NULL DEFAULT 'none' CHECK(visit_state IN ('none','want_to_visit','visited')),
  last_visited_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(discord_user_id,target_kind,target_id)
);
CREATE TABLE IF NOT EXISTS saved_house_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_user_id TEXT NOT NULL,
  discord_global_name TEXT,
  discord_display_name TEXT,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  filter_version INTEGER NOT NULL DEFAULT 1,
  filters_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(discord_user_id,normalized_name)
);
```

Export `SCHEMA_V6` with MariaDB equivalents using `BIGINT UNSIGNED NOT NULL AUTO_INCREMENT`, `VARCHAR(32)` Discord IDs, `VARCHAR(255)` companion names, `ENUM('destination','official')`, `ENUM('none','want_to_visit','visited')`, `TINYINT(1)`, `DATETIME`, `LONGTEXT`, `TIMESTAMP ... ON UPDATE CURRENT_TIMESTAMP`, InnoDB, and utf8mb4. Name the unique keys `uq_user_house_target` and `uq_saved_search_name`.

Add indexes for `(discord_user_id,is_favorite,updated_at)`, `(discord_user_id,visit_state,last_visited_at)`, and `(discord_user_id,updated_at)`. Do not add polymorphic foreign keys; target existence is service-validated.

- [ ] **Step 4: Wire ordered, idempotent migration and transfer**

Import the v6 arrays in `database.js`. Execute each array only when version 6 is absent, then insert version 6 after successful creation. Increase both schema constants only after the migration exists.

Add transfer manifest entries with exact column order:

```js
['user_house_states',['id','discord_user_id','discord_global_name','discord_display_name','target_kind','target_id','house_name','eso_owner','is_favorite','visit_state','last_visited_at','created_at','updated_at']],
['saved_house_searches',['id','discord_user_id','discord_global_name','discord_display_name','name','normalized_name','filter_version','filters_json','created_at','updated_at']],
```

Place both entries in `TABLES` immediately after `housing_destinations`, so catalog and destination rows already exist when personal rows are inserted. Add both names near the beginning of the explicit child-first deletion array, before `housing_destinations` and `houses`. Extend transfer verification to compare row counts and representative JSON/timestamps in both directions.

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
node --test test/personal-discovery-schema.test.js test/environment-schema.test.js test/mariadb-schema.test.js test/environment-transfer.test.js
```

Expected: PASS.

```bash
git add src/db/schema.js src/db/sqlite-schema.js src/db/database.js src/db/database-migration.js test/personal-discovery-schema.test.js test/environment-schema.test.js test/mariadb-schema.test.js test/environment-transfer.test.js package.json
git commit -m "feat: add personal discovery schema"
```

### Task 2: Canonical House Targets and Personal-State Service

**Files:**
- Create: `src/utils/house-target.js`
- Create: `src/services/user-house-state-service.js`
- Modify: `src/services/visit-service.js`
- Modify: `src/services/my-addressbook-service.js`
- Create: `test/user-house-state.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `VisitService.search({...context,limit:null})` and schema-v6 tables.
- Produces: `houseTarget(row)`, `houseTargetKey(target)`, and `UserHouseStateService` methods `get`, `setFavorite`, `setVisitState`, `list`, and `counts`.

- [ ] **Step 1: Write failing target and transition tests**

Cover player and Non-Player identities, independent Favorite/visit state, row deletion when empty, idempotent repetition, and MariaDB dates.

```js
assert.deepEqual(houseTarget({scope:'global',destination_id:44}),{kind:'destination',id:44});
assert.deepEqual(houseTarget({scope:'official',house_id:62}),{kind:'official',id:62});

await states.setFavorite({...ctx,target:{kind:'destination',id:44},favorite:true,visibleTarget:row});
await states.setVisitState({...ctx,target:{kind:'destination',id:44},visitState:'visited',visibleTarget:row,visitedAt:when});
const stored=await states.get('u1',{kind:'destination',id:44});
assert.equal(Number(stored.is_favorite),1);
assert.equal(stored.visit_state,'visited');
assert.equal(Date.parse(stored.last_visited_at),when.getTime());
```

Add fixtures where the same destination has Global, Server, and Private saved entries. Assert `list()` returns one row and chooses Global, then Server, then Private as access changes. Add a concurrent `Promise.all` duplicate Favorite call and assert one database row. In a MariaDB query spy, assert `last_visited_at` is a native `Date`, never an ISO string.

- [ ] **Step 2: Run the service tests and confirm failure**

```bash
node --test test/user-house-state.test.js
```

Expected: FAIL because target utilities and `UserHouseStateService` are missing.

- [ ] **Step 3: Implement canonical target utilities and stable search identity**

Add `destination_id` to every saved-house projection in `VisitService`; retain `house_id` for both target kinds.

```js
export function houseTarget(row){
  if(row?.scope==='official')return {kind:'official',id:Number(row.house_id??row.id)};
  const id=Number(row?.destination_id);
  if(!Number.isSafeInteger(id)||id<1)throw new Error('This house does not have a stable destination.');
  return {kind:'destination',id};
}
export const houseTargetKey=target=>`${target.kind}:${Number(target.id)}`;
```

- [ ] **Step 4: Implement atomic state transitions and access-filtered lists**

Use backend-specific upsert statements behind one private method. Validate `target.kind`, positive integer ID, target existence, the matching `visibleTarget`, and allowed visit states before writing.

Implement these exact public methods: `get(userId,target)`, `setFavorite({userId,target,favorite,globalName,displayName,visibleTarget})`, `setVisitState({userId,target,visitState,globalName,displayName,visibleTarget,visitedAt})`, `list({userId,guildId,esoServer,kind})`, and `counts({userId,guildId,esoServer})`. The constructor is `constructor(db,{visitService=new VisitService(db)}={})`.

For `list()`, build an access map from `VisitService.search({userId,guildId,esoServer,includeNonPlayer:true,limit:null})`. Because VisitService returns Global, then Server, then Private, retain the first row per target key. Never use the stored state row itself as proof of access. Sort Favorites/Want to Visit by display name and Visited by `last_visited_at DESC`, then display name.

Update `MyAddressBookService.summary()` or the dashboard composition to include `favorites`, `wantToVisit`, `visited`, and `savedSearches` counts without exposing inaccessible state.

- [ ] **Step 5: Run tests and commit**

```bash
node --test test/user-house-state.test.js test/search-homes-ux.test.js test/my-addressbook.test.js
```

Expected: PASS.

```bash
git add src/utils/house-target.js src/services/user-house-state-service.js src/services/visit-service.js src/services/my-addressbook-service.js test/user-house-state.test.js test/search-homes-ux.test.js test/my-addressbook.test.js package.json
git commit -m "feat: add private house favorites and visit states"
```

### Task 3: Personal Actions and My AddressBook Personal Lists

**Files:**
- Modify: `src/ui/housing-ui.js`
- Modify: `src/ui/housing-menu.js`
- Create: `test/personal-discovery-ui.test.js`
- Modify: `test/component-limits.test.js`
- Modify: `test/house-card-context.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `UserHouseStateService`, `houseTarget()`, existing house cards, picker pagination, `AccessContextService`, and Share Pass validation.
- Produces: `personalActionsPayload`, personal dashboard routes, and owner-checked component handlers.

- [ ] **Step 1: Write failing payload and handler tests**

Assert saved and Non-Player house cards include Personal Actions; the resulting panel is ephemeral/private in handler responses; and buttons reflect current state.

```js
const panel=personalActionsPayload({target:{kind:'destination',id:7},state:{is_favorite:1,visit_state:'want_to_visit'},backId:'hu:home'});
assert.deepEqual(labels(panel),['Remove Favorite','Want to Visit','Mark Visited','Clear Visit Status','Return to House']);
```

Test the dashboard labels `Favorites`, `Want to Visit`, `Visited`, and `Saved Searches`. Create 26 favorites and assert page one has 25 options, page two has one, and navigation works. Simulate a state token belonging to `u1` being pressed by `u2`; expect an ephemeral ownership error and no database update. Simulate a deleted/inaccessible target after render; expect `That house is no longer available.` and no update.

- [ ] **Step 2: Run the UI tests and confirm failure**

```bash
node --test test/personal-discovery-ui.test.js test/component-limits.test.js test/house-card-context.test.js
```

Expected: FAIL because the new payloads and routes do not exist.

- [ ] **Step 3: Add compact Personal Actions payloads**

Extend `destinationMenuPayload` and `officialHousePayload` with an optional `personalTarget` and add one `Personal Actions` button. Put it in an existing secondary row if the primary row would exceed five components.

```js
export function personalActionsPayload({target,state,backId}){
  const favorite=Number(state?.is_favorite)===1;
  const visit=state?.visit_state||'none';
  return {
    embeds:[embed('⭐ Personal Actions','Only you can see these preferences.')],
    components:buttonRows([
      {customId:personalId('favorite',target,backId),label:favorite?'Remove Favorite':'Add Favorite',style:favorite?'secondary':'success'},
      {customId:personalId('want',target,backId),label:'Want to Visit',style:visit==='want_to_visit'?'success':'secondary'},
      {customId:personalId('visited',target,backId),label:'Mark Visited',style:visit==='visited'?'success':'secondary'},
      {customId:personalId('clear',target,backId),label:'Clear Visit Status',style:'secondary',disabled:visit==='none'},
      {customId:backId,label:'Return to House',style:'primary'}
    ])
  };
}
```

Use a short server-side state token in custom IDs rather than embedding long return routes; bind each token to user ID and creation time.

- [ ] **Step 4: Wire handlers and paginated personal lists**

Instantiate `UserHouseStateService` in `createHousingMenu`. Before each mutation, reload the target through the normal saved-house access path, official catalog, or current active Share Pass context. Pass that newly validated row as `visibleTarget`.

Use the existing picker engine with dedicated kinds `personal-favorites`, `personal-want`, and `personal-visited`. Store only authorized rows in picker state. Return to My AddressBook from empty states and include Search Houses as the useful action.

```js
if(id==='hu:my:favorites'){
  const rows=await personalStates.list({...contextFor(i),kind:'favorites'});
  return i.update(createPicker(i,{kind:'personal-favorites',rows,backId:'hu:my',extra:{title:'My Favorites'}}));
}
```

Ensure all mutations use the interaction user, ignore any user ID supplied by a custom ID, and refresh the same panel after success.

- [ ] **Step 5: Run focused tests and commit**

```bash
node --test test/personal-discovery-ui.test.js test/component-limits.test.js test/house-card-context.test.js test/my-addressbook.test.js
```

Expected: PASS.

```bash
git add src/ui/housing-ui.js src/ui/housing-menu.js test/personal-discovery-ui.test.js test/component-limits.test.js test/house-card-context.test.js test/my-addressbook.test.js package.json
git commit -m "feat: add personal discovery controls"
```

### Task 4: Versioned Search Filters and Saved-Search Service

**Files:**
- Create: `src/utils/search-filters.js`
- Create: `src/services/saved-house-search-service.js`
- Modify: `src/ui/housing-menu.js`
- Create: `test/saved-house-search.test.js`
- Modify: `test/search-homes-ux.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: current advanced-search filter shape and `saved_house_searches`.
- Produces: `normalizeSearchFilters(raw)`, `hasMeaningfulSearchFilters(filters)`, `parseSavedSearchFilters(row)`, and `SavedHouseSearchService` ownership methods.

- [ ] **Step 1: Write failing normalization and persistence tests**

Pin whitespace trimming, case-insensitive name conflicts, canonical visibility order, unknown-key removal, array deduplication, and failure-closed parsing.

```js
assert.deepEqual(normalizeSearchFilters({name:' moon ',visibilities:['private','global','global'],includeNonPlayer:true}),{
  name:'moon',visibilities:['global','private'],includeNonPlayer:true
});
assert.equal(hasMeaningfulSearchFilters({}),false);
assert.equal(hasMeaningfulSearchFilters({includeNonPlayer:true}),true);

assert.throws(()=>parseSavedSearchFilters({filter_version:2,filters_json:'{}'}),/newer version/i);
assert.throws(()=>parseSavedSearchFilters({filter_version:1,filters_json:'not-json'}),/cannot be read/i);
assert.throws(()=>parseSavedSearchFilters({filter_version:1,filters_json:'{"name":"'+ 'x'.repeat(101) +'"}'}),/too long/i);
```

Test `save()` returns `{status:'conflict'}` without overwriting, then `{status:'replaced'}` only when `replace:true`. Test `getOwned`, `rename`, and `delete` with another user and assert no mutation.

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test test/saved-house-search.test.js test/search-homes-ux.test.js
```

Expected: FAIL because shared normalization and persistence do not exist.

- [ ] **Step 3: Implement one strict filter codec**

Allow only the current filter keys. Limit each text/value to 100 characters, each multi-select array to 25 unique items, and encoded JSON to 16 KiB. Coerce only the two known booleans.

```js
export const SEARCH_FILTER_VERSION=1;
const TEXT_KEYS=['query','name','nickname','owner','tag','zone','houseType','classification','category','style'];
const ARRAY_KEYS=['names','owners','tags','zones','houseTypes','classifications','styles'];
const BOOLEAN_KEYS=['includeNonPlayer','notOnPublicTours'];
const VISIBILITY_ORDER=['global','public','private'];
const KNOWN=new Set([...TEXT_KEYS,...ARRAY_KEYS,...BOOLEAN_KEYS,'visibilities']);
const text=value=>{
  const result=String(value??'').trim();
  if(result.length>100)throw new Error('A saved-search value is too long.');
  return result;
};
const array=value=>{
  const result=[...new Set((Array.isArray(value)?value:[]).map(text).filter(Boolean))];
  if(result.length>25)throw new Error('A saved-search selection has too many values.');
  return result;
};
export function normalizeSearchFilters(raw={}, {strict=false}={}){
  if(!raw||Array.isArray(raw)||typeof raw!=='object')throw new Error('Saved-search filters must be an object.');
  if(strict){const unknown=Object.keys(raw).filter(key=>!KNOWN.has(key));if(unknown.length)throw new Error(`Unknown saved-search filter: ${unknown[0]}`);}
  const out={};
  for(const key of TEXT_KEYS){const value=text(raw[key]);if(value)out[key]=value;}
  for(const key of ARRAY_KEYS){const value=array(raw[key]);if(value.length)out[key]=value;}
  const visibilitySet=new Set(array(raw.visibilities).filter(value=>VISIBILITY_ORDER.includes(value)));
  if(visibilitySet.size)out.visibilities=VISIBILITY_ORDER.filter(value=>visibilitySet.has(value));
  for(const key of BOOLEAN_KEYS)if(raw[key]===true)out[key]=true;
  return out;
}
export const hasMeaningfulSearchFilters=filters=>Object.keys(normalizeSearchFilters(filters)).length>0;
export function parseSavedSearchFilters(row){
  if(Number(row.filter_version)!==SEARCH_FILTER_VERSION)throw new Error('This saved search uses a newer version.');
  if(String(row.filters_json).length>16384)throw new Error('This saved search is too large.');
  let raw;try{raw=JSON.parse(row.filters_json);}catch{throw new Error('This saved search cannot be read.');}
  return normalizeSearchFilters(raw,{strict:true});
}
```

Keep `searchCriteria` exported from `housing-menu.js` for compatibility, but have it consume normalized filters or move its implementation to the utility and re-export it.

- [ ] **Step 4: Implement owner-safe saved-search CRUD**

Implement these exact public methods: `save({userId,name,filters,globalName,displayName,replace})`, `getOwned(id,userId)`, `list(userId,{limit=25,offset=0}={})`, `count(userId)`, `rename({id,userId,name,replace})`, `delete({id,userId})`, and `filters(row)`. The constructor is `constructor(db)` and `filters(row)` delegates directly to `parseSavedSearchFilters(row)`.

Use a backend-compatible normalized name produced from trimmed lowercase whitespace. Empty names and names over 80 characters fail before SQL. All UPDATE/DELETE statements include `discord_user_id=?`.

- [ ] **Step 5: Run tests and commit**

```bash
node --test test/saved-house-search.test.js test/search-homes-ux.test.js
```

Expected: PASS.

```bash
git add src/utils/search-filters.js src/services/saved-house-search-service.js src/ui/housing-menu.js test/saved-house-search.test.js test/search-homes-ux.test.js package.json
git commit -m "feat: add reusable saved house searches"
```

### Task 5: Saved-Search Discord Flow

**Files:**
- Modify: `src/ui/housing-ui.js`
- Modify: `src/ui/housing-menu.js`
- Modify: `src/services/my-addressbook-service.js`
- Create: `test/saved-house-search-ui.test.js`
- Modify: `test/component-limits.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `SavedHouseSearchService`, normalized filters, existing advanced-search states, modals, and picker pagination.
- Produces: Save Search, conflict confirmation, Saved Searches dashboard, run/rename/replace/delete flows.

- [ ] **Step 1: Write failing end-to-end interaction tests**

Assert filtered results include Save Search while an unfiltered all-houses view does not. Submit the name modal, retain current results, and verify the saved record. Assert duplicate names show Replace Existing and Cancel, and Cancel leaves the old search untouched.

Create 26 saved searches and assert 25 selector options on page one and one on page two. Press a saved-search button as another user and assert an ownership error. Run a saved search in a second guild/environment and assert only the second context's accessible results appear.

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test test/saved-house-search-ui.test.js test/component-limits.test.js
```

Expected: FAIL because the Discord flow is absent.

- [ ] **Step 3: Add saved-search payloads and modal builders**

Add exports with short token-based custom IDs:

```js
savedSearchNameModal(token,{name='',mode='create'}={})
savedSearchListPayload({rows,page,pages})
savedSearchDetailPayload({row,filters,hasCurrentSearch=false})
savedSearchConflictPayload({token,name})
savedSearchDeleteConfirmPayload({id,name})
```

The detail view shows a readable `searchCriteria('Saved Search',filters)` summary and actions Run Search, Rename, Replace Filters with Current Search when available, Delete, and Back.

- [ ] **Step 4: Wire save, run, rename, replace, and delete handlers**

Extend advanced-search state with the normalized current filters. Add Save Search only when `hasMeaningfulSearchFilters(filters)` is true. Bind all temporary tokens to `i.user.id` and reject mismatches.

Running a saved search must call the same advanced search executor used by live filters:

```js
const row=await savedSearches.getOwned(searchId,i.user.id);
if(!row)return i.reply({content:'That saved search is no longer available.',flags:MessageFlags.Ephemeral});
const filters=savedSearches.filters(row);
return startAdvanced(i,'saved',filters,{title:row.name});
```

Malformed/unsupported stored filters render a closed error state with Delete and Back; never call `VisitService.search` with `{}` as a fallback. Delete requires confirmation. After save or replacement, return to the existing filtered results state.

- [ ] **Step 5: Run tests and commit**

```bash
node --test test/saved-house-search-ui.test.js test/saved-house-search.test.js test/search-homes-ux.test.js test/component-limits.test.js test/my-addressbook.test.js
```

Expected: PASS.

```bash
git add src/ui/housing-ui.js src/ui/housing-menu.js src/services/my-addressbook-service.js test/saved-house-search-ui.test.js test/component-limits.test.js test/my-addressbook.test.js package.json
git commit -m "feat: add saved search Discord workflow"
```

### Task 6: Surprise Me Discovery

**Files:**
- Create: `src/services/house-discovery-service.js`
- Modify: `src/ui/housing-ui.js`
- Modify: `src/ui/housing-menu.js`
- Create: `test/surprise-me.test.js`
- Modify: `test/component-limits.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: complete access-controlled `VisitService` result arrays and `houseTargetKey()`.
- Produces: `HouseDiscoveryService.choose(rows,{previousTargetKey})`, Search Homes Surprise Me, and Another Surprise.

- [ ] **Step 1: Write failing deterministic selection tests**

Inject a deterministic integer function and prove selection never leaves the supplied rows, excludes the immediate previous target when another exists, permits the only result to repeat, and returns `null` for an empty array.

```js
const discovery=new HouseDiscoveryService({randomInt:max=>max-1});
assert.equal(discovery.choose([a,b],{previousTargetKey:houseTargetKey(houseTarget(a))}).id,b.id);
assert.equal(discovery.choose([]),null);
```

Add handler tests proving an initial Surprise uses `limit:null`, a filtered Surprise uses the entire logical state array rather than the current 25-item page, and no-results offers Filters/Clear Filters rather than throwing.

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test test/surprise-me.test.js
```

Expected: FAIL because the discovery service and buttons are absent.

- [ ] **Step 3: Implement backend-neutral selection**

```js
import crypto from 'node:crypto';
import { houseTarget,houseTargetKey } from '../utils/house-target.js';

export class HouseDiscoveryService{
  constructor({randomInt=crypto.randomInt}={}){this.randomInt=randomInt;}
  choose(rows,{previousTargetKey=null}={}){
    const eligible=rows.filter(row=>houseTargetKey(houseTarget(row))!==previousTargetKey);
    const pool=eligible.length?eligible:rows;
    return pool.length?pool[this.randomInt(pool.length)]:null;
  }
}
```

- [ ] **Step 4: Add Surprise Me and Another Surprise flows**

Add Surprise Me to the initial Search Homes result actions and filtered/saved result actions. The unfiltered path calls `VisitService.search({...contextFor(i),includeNonPlayer:true,limit:null})` using the current default Non-Player inclusion policy from Search Homes; the filtered path reuses the full `state.rows` array.

Render the selected row through `housePickerDetail`/normal house card code. Add optional `surpriseToken` to player and Non-Player detail payloads so Another Surprise is shown without duplicating the renderer. Store `{userId,rows,previousTargetKey,backId,created}` server-side. Reject foreign/expired tokens.

- [ ] **Step 5: Run tests and commit**

```bash
node --test test/surprise-me.test.js test/search-homes-ux.test.js test/component-limits.test.js test/house-card-context.test.js
```

Expected: PASS.

```bash
git add src/services/house-discovery-service.js src/ui/housing-ui.js src/ui/housing-menu.js test/surprise-me.test.js test/search-homes-ux.test.js test/component-limits.test.js test/house-card-context.test.js package.json
git commit -m "feat: add Surprise Me house discovery"
```

### Task 7: Interactive Show Me Around

**Files:**
- Modify: `src/ui/housing-ui.js`
- Modify: `src/ui/housing-menu.js`
- Modify: `test/onboarding-and-empty-states.test.js`
- Modify: `test/component-limits.test.js`

**Interfaces:**
- Consumes: `OnboardingService.complete()`, existing seven pages, and existing Search/Register/My AddressBook/Tours routes.
- Produces: one contextual action per onboarding page and completion-before-navigation behavior.

- [ ] **Step 1: Write failing contextual-action tests**

```js
assert.ok(labels(onboardingPayload({page:1})).includes('Try Search'));
assert.ok(labels(onboardingPayload({page:2})).includes('Register a House'));
assert.ok(labels(onboardingPayload({page:4})).includes('Open My AddressBook'));
assert.ok(labels(onboardingPayload({page:5})).includes('Browse Tours'));
```

For each action, simulate a first-time user and assert `user_onboarding.status='completed'` before the target payload is returned. Verify Finish remains completion, Skip remains skipped, and replay from Help does not erase either status.

- [ ] **Step 2: Run onboarding tests and verify failure**

```bash
node --test test/onboarding-and-empty-states.test.js test/component-limits.test.js
```

Expected: FAIL because contextual actions do not exist.

- [ ] **Step 3: Add per-page action definitions**

Use exact actions:

```js
const onboardingActions={
  1:{customId:'hu:onboarding:go:search',label:'Try Search'},
  2:{customId:'hu:onboarding:go:register',label:'Register a House'},
  3:{customId:'hu:onboarding:go:search',label:'Try Search'},
  4:{customId:'hu:onboarding:go:addressbook',label:'Open My AddressBook'},
  5:{customId:'hu:onboarding:go:tours',label:'Browse Tours'},
  6:{customId:'hu:onboarding:go:tours',label:'Browse Tours'},
  7:{customId:'hu:onboarding:go:help',label:'Open Help'}
};
```

Keep navigation in one action row and the contextual action in another when needed.

- [ ] **Step 4: Complete onboarding before dispatching the target**

In the handler, call `await onboarding.complete(i.user.id,onboardingNames(i))` first, then invoke the same internal rendering function used by the ordinary feature route. Do not synthesize a second interaction or recursively call the button handler.

- [ ] **Step 5: Run tests and commit**

```bash
node --test test/onboarding-and-empty-states.test.js test/component-limits.test.js
```

Expected: PASS.

```bash
git add src/ui/housing-ui.js src/ui/housing-menu.js test/onboarding-and-empty-states.test.js test/component-limits.test.js
git commit -m "feat: make onboarding interactive"
```

### Task 8: Identity Refresh, Integration Hardening, and Full Regression

**Files:**
- Modify: `src/services/identity-service.js`
- Modify: `test/identity-schema.test.js`
- Modify: `test/identity-service.test.js`
- Modify: `test/database-backend.test.js`
- Modify: `test/mariadb-query-columns.test.js`
- Modify: `test/environment-transfer.test.js`
- Modify: relevant new tests from Tasks 1–7 when integration exposes gaps

**Interfaces:**
- Consumes: completed schema and feature services.
- Produces: companion-name refresh, backend-safe SQL, complete transfer assertions, and a green full suite.

- [ ] **Step 1: Write failing identity-refresh and backend tests**

Seed stale companion names in both new tables, sync a newer Discord identity, and assert both update.

```js
await identity.syncInteraction(interactionFor({userId:'u1',globalName:'New Name',displayName:'New Display'}));
assert.deepEqual(await one(db,'SELECT discord_global_name,discord_display_name FROM user_house_states WHERE discord_user_id=?',['u1']),{
  discord_global_name:'New Name',discord_display_name:'New Display'
});
```

Rename a catalog house and player destination owner, call `refreshInternalNames()`, and assert `house_name`/`eso_owner` refresh. Add MariaDB query-spy assertions that writes use `Date` values/database timestamp expressions. Reassert two-way transfer keeps `filter_version`, exact `filters_json`, visit state, and last-visited time.

- [ ] **Step 2: Run the integration tests and verify failure**

```bash
node --test test/identity-schema.test.js test/identity-service.test.js test/database-backend.test.js test/mariadb-query-columns.test.js test/environment-transfer.test.js
```

Expected: FAIL until the identity refresh and backend queries include the new tables.

- [ ] **Step 3: Extend companion-name refresh**

In `IdentityService.refreshCompanionNames()`, update every `user_house_states` row from `discord_users`, then resolve destination targets from `housing_destinations JOIN houses` and official targets from `houses`.

```js
for(const row of await conn.query('SELECT * FROM user_house_states')){
  const target=row.target_kind==='destination'?destinations.get(Number(row.target_id)):official.get(Number(row.target_id));
  await patchRow(conn,'user_house_states','id',row,{
    discord_global_name:users.get(String(row.discord_user_id)),
    house_name:target?.house_name,
    eso_owner:target?.eso_owner??null
  });
}
for(const row of await conn.query('SELECT * FROM saved_house_searches'))
  await patchRow(conn,'saved_house_searches','id',row,{discord_global_name:users.get(String(row.discord_user_id))});
```

Use current guild membership only when an interaction provides a trustworthy display name; do not copy one guild's display name into another user's unrelated context merely from a cached guild choice.

- [ ] **Step 4: Run the complete suite and repair only feature-related regressions**

```bash
npm test
```

Expected: all tests pass. If a regression concerns an existing query alias, component limit, or access path touched by this release, add a focused test before repairing it. Do not perform unrelated refactors.

- [ ] **Step 5: Commit the hardening pass**

```bash
git add src/services/identity-service.js test/identity-schema.test.js test/identity-service.test.js test/database-backend.test.js test/mariadb-query-columns.test.js test/environment-transfer.test.js test
git commit -m "test: harden personal discovery integration"
```

### Task 9: Version 0.8.0 Documentation and Verified Release

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/ui/housing-menu.js`
- Modify: `src/services/admin-health-service.js`
- Modify: `.env.example` only if behavior/configuration text needs clarification
- Modify: `README.md`
- Rename/Modify: `docs/AddressBook-v0.7.0-Current-State.md` to `docs/AddressBook-v0.8.0-Current-State.md`
- Rename/Modify: `AddressBook_v0.7.0_User_Admin_Guide.docx` to `AddressBook_v0.8.0_User_Admin_Guide.docx`
- Modify: version-sensitive tests
- Create outside repository: `../AddressBook-v0.8.0.zip`

**Interfaces:**
- Consumes: all implemented and verified v0.8.0 behavior.
- Produces: consistent version strings, current-state documentation, visually verified guide, and clean downloadable ZIP.

- [ ] **Step 1: Write/adjust version assertions, then bump every runtime version**

Change package/package-lock, `AdminHealthService`, and `createHousingMenu` to `0.8.0`. Update version-sensitive tests first so they fail on `0.7.0`, then pass after the bump.

```js
assert.equal(new AdminHealthService(db).version,'0.8.0');
assert.match(JSON.stringify(homePayload()),/0\.8\.0/);
```

Search user-facing sources for stale release values:

```bash
rg -n "0\.7\.0|v0\.7\.0|AddressBook_v0\.7\.0" --glob '!docs/superpowers/**' --glob '!node_modules/**'
```

Expected after updates: no stale user-facing v0.7.0 references except intentionally historical test fixtures, if any.

- [ ] **Step 2: Update current-state documentation**

Document:

- Personal Actions and privacy;
- Favorite independent from Want to Visit/Visited;
- My AddressBook lists and pagination;
- saving, replacing, running, renaming, and deleting searches;
- contextual current-guild/current-environment execution;
- Surprise Me and Another Surprise;
- interactive Show Me Around;
- schema version 6 and two-way transfer preservation.

Retain Global, Server, Private ordering and current deployment/backup guidance. Do not add a changelog or revision-history section.

- [ ] **Step 3: Update and visually verify the DOCX guide**

Rename the guide to v0.8.0, update screenshots/text or Discord-style examples, render it to page images with the document workflow, and inspect every page for clipping, overlap, orphan headings, stale version labels, and unreadable code blocks. Iterate until clean.

Required examples keep these as separate copy-ready code blocks:

```text
/script JumpToSpecificHouse("@HouseOwner", 62)
```

```text
/script JumpToHousePreview(62)
```

```text
|H1:housing:62:@HouseOwner|h|h
```

- [ ] **Step 4: Run final verification**

```bash
npm test
node --check src/ui/housing-menu.js
node --check src/ui/housing-ui.js
node --check src/services/user-house-state-service.js
node --check src/services/saved-house-search-service.js
node --check src/services/house-discovery-service.js
```

Expected: every command exits 0.

Also run a temporary SQLite smoke test that creates schema version 6 and exercises Favorite, Visited, saved-search execution, and Surprise Me. If a MariaDB test instance is configured, run the corresponding integration smoke test; otherwise rely on MariaDB schema/query-spy tests and state that limitation precisely.

- [ ] **Step 5: Build and inspect a clean ZIP**

Create a temporary staging directory named `AddressBook-v0.8.0`, copy only runtime/source/docs/deployment files, and zip that directory to `../AddressBook-v0.8.0.zip`. Do not package from an unresolved glob and do not overwrite the v0.7.0 archive.

Inspect it:

```bash
unzip -t ../AddressBook-v0.8.0.zip
unzip -Z1 ../AddressBook-v0.8.0.zip | rg '(^|/)(\.git|node_modules|\.env$|data/|docs/superpowers|.*\.(sqlite|db))' && exit 1 || true
unzip -Z1 ../AddressBook-v0.8.0.zip | rg 'AddressBook-v0\.8\.0/(package\.json|README\.md|docs/AddressBook-v0\.8\.0-Current-State\.md|AddressBook_v0\.8\.0_User_Admin_Guide\.docx)$'
sha256sum ../AddressBook-v0.8.0.zip
```

Expected: archive test passes, forbidden-path search returns no matches, all required files appear, and a SHA-256 value is recorded.

- [ ] **Step 6: Commit the release checkpoint**

```bash
git add package.json package-lock.json src/ui/housing-menu.js src/services/admin-health-service.js .env.example README.md docs/AddressBook-v0.8.0-Current-State.md AddressBook_v0.8.0_User_Admin_Guide.docx test
git add -u docs/AddressBook-v0.7.0-Current-State.md AddressBook_v0.7.0_User_Admin_Guide.docx
git commit -m "release: AddressBook v0.8.0"
```

Before reporting completion, confirm `git status --short` contains only the known untracked local `node_modules` symlink and no product or documentation changes.

## Final Acceptance Checklist

- [ ] Favorites and visit states work for player and Non-Player targets.
- [ ] Favorite is independent from the mutually exclusive Want to Visit/Visited state.
- [ ] Personal lists reevaluate access and do not leak inactive Share Pass content.
- [ ] Saved searches validate strictly and execute in the current guild/environment.
- [ ] Surprise Me selects from the complete authorized result set and rerolls correctly.
- [ ] Show Me Around launches real features and records completion first.
- [ ] More than 25 personal/saved-search items paginate within Discord limits.
- [ ] SQLite/MariaDB schema version 6 and two-way transfer tests pass.
- [ ] Identity companion names refresh without becoming authorization inputs.
- [ ] All automated tests and syntax checks pass.
- [ ] Current-state documentation and the DOCX guide say v0.8.0 and pass visual QA.
- [ ] The v0.8.0 ZIP passes integrity and exclusion checks.

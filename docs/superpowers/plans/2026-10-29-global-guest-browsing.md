# Global guest browsing

Guest visitors can explore HearthBound before signing in. Only active Global houses and Global tours are public. No fake Discord membership, author identity, admin permissions, writes, or saved progress will be assigned to guests.

## Experience

- Landing page offers Browse houses and tours alongside Sign in with Discord.
- Guest navigation: Discover, Houses, Tours, Random House, Sign in.
- Platform/region selector defaults to PC NA, remembers the visitor's choice, and labels every house/tour clearly. Direct entry links infer the entry's actual environment; guests need no guild membership to read Global entries.
- Search Global houses by name/ESO owner/zone and tag; search tours by name. Use existing polished card, screenshot, capacity badge, pagination, and metadata patterns.
- House details show description, tags, jump commands, cover/gallery and Global tour associations. Tour details show image, description, ordered stops, capacities and tour-specific notes. Guest self-paced navigation is read-only and does not save progress.
- Login banner and personal-action prompts return to the same house/tour with normal authenticated access. Server/Private links prompt login; they never expose names, images, stops, notes or comments anonymously.
- Restrict anonymous image endpoints by fresh Global/active checks; no public storage-folder URLs. Non-GET guest requests are rejected. Read-only pages do not contain mutation forms or admin navigation.

## Implementation

1. New GuestBrowseService with explicit Global-only SQL predicates and projections. No calls that synthesize a signed-in context. Check record scope afresh for each image read and tour stop.
2. New guest rendering/routes at /browse, /browse/houses, /browse/tours and individual details/media. Existing /app house/tour links route unauthenticated GETs to these views if the record is Global; otherwise preserve the normal login flow.
3. Reuse the public-page shell, houseMetadata, capacity badges, jump-command helpers and pagination. Add a guest-region cookie with validated enum values and no identity data.
4. Keep login return targets under /app; direct-link platform/region context remains intact. Authenticated normal app routes retain current membership enforcement.
5. Tests: Global-only visibility across every platform/region, archived/pending exclusion, malformed Global tours containing restricted stops, scope change revoking media, non-GET rejection, OAuth return, search/pagination and desktop/mobile browser checks. Independent access review and full suite before a separate PR.

Production record conversion was separately completed on 2026-10-29: 112 active/23 archived houses and 10 tours now Global, all retaining PC NA; backup under /home/stephanie/.local/state/hearthbound/backups/globalize-2026-10-29T05-38-28.096Z. No conversion-on-startup migration will be added: future Private/Server registrations must remain supported.

## Completion ledger

- Implemented dedicated read-only GuestBrowseService; no fake member context or guest write methods.
- Public browse routes, Global clean entry links, preferences, images, read-only tour steps, login return and stored-environment inference tested.
- Real Chrome desktop/mobile browsing and remembered-region checks pass.
- Independent review found cover requests unnecessarily loading all tour stops; fixed, regression-tested and reviewed again.
- Final full suite after merging PR50: 791/791 passed, zero failures or skipped tests.
- Guest comments remain behind login to avoid exposing source-record identity or discussion information; no account data is included in anonymous views.
- Follow-up requests (OAuth styling, approval audit, access preview, card placeholder/hearts and broader site polish) are separate PRs.

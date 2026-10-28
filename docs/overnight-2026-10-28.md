# HearthBound overnight review — October 28, 2026

Work is proposed in reviewable PRs. Nothing is merged or deployed by the agent.

## Ready first: discovery and tour polish (PR #27)

- Four weekly featured houses, with a capped engagement boost from favorites and recorded visit/interest state. Randomness and preference for destinations absent last week remain.
- Richer Random House information and recent comments; clearer registration examples and Submit label.
- Tour actions prioritize visiting/sharing, with Delete last. Tour-specific notes are editable while adding/arranging stops.
- Validation: 41 focused selection/web/component checks, 39 engagement/navigation checks, and desktop/mobile Chrome checks including an actual inline-note save.

## Round 1: house screenshot galleries

- One shared web/Discord gallery per registration, with up to eight screenshots, optional captions and a selected cover.
- Covers appear in Search, Featured, Random and the web tour player. Discord has image embeds and Previous/Next controls, plus screenshot attachment options on both slash commands.
- Existing house editing and Private ownership rules apply to uploads, images, cover changes and removal. Images have protected URLs, validated content and persistent storage outside Git.
- Automatic migration 15 supports existing MariaDB and SQLite installations. See [upgrade instructions](upgrade-v1.0.70.md).
- Validation: full suite 716/716 passed, followed by a targeted 3-test gallery rerun after an independent review found and corrected animated PNG acceptance. Browser checks covered desktop/mobile gallery layout and discovery covers. Tests use local fixtures, not the production database or a live Discord server.

## Research informing the next rounds

- [ESO Housing](https://esohousing.com/) presents builders, homes, stories and themed collections. Proposed application: consistent image-led house cards and clear creator/house identity.
- [Wanderlog](https://wanderlog.com/) keeps route planning and discovery together. Proposed application: keep finding houses, adding stops and writing tour notes in one editor.
- [Airbnb wishlists](https://www.airbnb.co.uk/help/article/1236) expose direct saving and existing/new collection choices. Proposed application: keep Favorite and Add to tour visible near the house rather than behind management flows.

Next candidates: polish gallery upload/empty states and caption editing; unify discovery and saved-house actions; shorten Discord tour-building paths. Each round should preserve permissions, return context and unsaved work, and use an appropriately scoped PR with evidence.

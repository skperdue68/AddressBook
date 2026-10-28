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

## Round 2: browsing and managing galleries

- Images open in an enlarged in-page viewer with Previous/Next, arrow keys, Escape, and focus returned to the original thumbnail. Ordinary image links still work without JavaScript.
- The upload form supports choosing or dropping one file, previewing it, and seeing upload progress. Server/network errors stay beside the form and preserve the file and caption for retry.
- Existing captions can be edited on the web or through a Discord modal. Discord returns to the same image rather than another menu. Navigation and editing controls use separate bounded rows.
- Research: [GOV.UK file upload](https://design-system.service.gov.uk/components/file-upload/) supports standard choosing and drag/drop with clear errors; [W3C modal dialogs](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) specifies keyboard focus, Escape and focus return. These informed progressive enhancement and the viewer's interaction design.
- No schema, storage, slash-command definition or environment changes beyond the gallery foundation. Merge after the gallery PR; pull and restart.

Round 2 verification: 717/717 full-suite tests passed. An additional targeted gallery rerun passed after upload controls were disabled during an in-flight request. Real Chrome verified an actual AJAX upload, enlarged-viewer arrow keys, and desktop/mobile layouts. Independent review found no actionable defects. The gallery foundation is [PR #28](https://github.com/skperdue68/HearthBound/pull/28); review PRs in dependency order.

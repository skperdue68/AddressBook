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

## Round 3: consistent house discovery and saved places

- Search, advanced/saved searches and My Address Book use the same descriptive cards: official house name, ESO owner, zone, classification, style, tags, short description and available cover image. Tags link to a matching search. Text-only houses do not get fake images.
- Cards expose reversible Favorite and visit-state controls alongside View house and Add to tour. Updates stay on the filtered list; the non-JavaScript form fallback also returns to that list. A compact-list option remains available for basic search, preserving filters and pagination.
- My Address Book leads with All saved, Favorites, Want to Visit and Visited. Submitted records and organizing tools come next. Empty legacy recovery links are hidden. Discord follows the same saved-first order and ends with Main Menu.
- Research: [ESO Housing's community gallery](https://esohousing.com/gallery) combines build identity, owner, classification/style, summaries and discovery filters. Its transferable lesson is to make the home understandable before opening it. HearthBound keeps its own permissions and tour-oriented actions.
- Batched cover/current-user-state loading avoids per-card calls. Privacy checks remain in the existing listing/action services, and image requests retain their own permission checks.
- Review caught a stray house-layout variable in the tour-list route; both Housing Tours and Your Tours now have a direct HTTP regression check. Focused tests and real Chrome checks cover filtered saves, compact view, mobile overflow and action-row alignment.

Gallery experience improvements are [PR #29](https://github.com/skperdue68/HearthBound/pull/29), following #28 and #27.

Round 3 verification: 721/721 full-suite tests passed. A final targeted rerun covered the clearer empty-list messages. Real Chrome verified Favorite/visit autosave without navigation, compact list, return-preserving filters, mobile overflow and alignment before/after saving. Independent review confirmed the tour-list fix and found no further actionable issues. Empty personal lists now explain how to populate that particular list.

## Round 4: Discord tour building

- Add House has one filter modal for house/owner, tags, visibility, zone and style/classification. Current filters are summarized in the picker. Already-used destinations and duplicate registrations are omitted.
- Selecting a house still adds it immediately. The next card makes optional tour-specific notes prominent and provides Add Another House without losing the filter. Saving notes returns to that same card. Adding from a house/registration card also exposes notes and preserves Back to House.
- Notes update the tour stop, not the underlying house description. Cleared/empty filters remain safe to reopen; empty results do not create an invalid dropdown. Context, current tour permissions and house eligibility are rechecked.
- Discord tour-editor controls now prioritize adding/arranging stops, name Edit Stop / Notes clearly, and put Back to Tour just before Delete Tour at the end.
- Review found a null-filter reopening error; it was fixed with a failing-then-passing regression and a complete blank-filter submit/reopen test. Independent final review found no further actionable issues.

Discovery and saved-place improvements are [PR #30](https://github.com/skperdue68/HearthBound/pull/30).

## Reviewing the PR sequence

These PRs are stacked so each diff shows only its round. Start with #27. Before merging the next PR, its target must be retargeted/rebased to `master` after the preceding merge. Do not merge a later round into its predecessor's feature branch. The agent will handle this restacking and verify the resulting diff during the morning review. Nothing is deployed automatically.

Round 4 verification: 723/723 full-suite tests passed. A final targeted run verified maximum Discord custom-ID/embed limits and the blank-filter regression. The complete interaction test covers filtering, adding, multiline notes, retained filters, clearing/reopening filters and rejecting another user. Registration-flow tests also confirm Back to House survives a notes edit. No new schema, environment or slash-command definition changes.

## Round 5: mobile wayfinding

- Replaced the horizontally clipped portal navigation with a compact mobile Menu. The same permission-filtered links are grouped in two columns, with a separate Support group; the desktop sidebar remains visible.
- The disclosure supports click/keyboard activation, optional ArrowDown into links, Escape with focus return, outside-click/focus dismissal, and responsive focus handling. Without JavaScript, navigation stays visible as wrapped links.
- Research: [W3C disclosure navigation guidance](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/) informed semantic navigation and disclosure states; this is ordinary navigation, not an ARIA menu widget.
- Verification: 25 targeted renderer/auth/account/onboarding/gallery/discovery/browser checks passed. Real Chrome at 320px and 390px verified all owner/admin destinations, no horizontal overflow and 44px touch targets; desktop was checked at 1440px. Independent review found no actionable issues. No backend/permissions/schema/dependency/environment changes.

Discord tour-building improvements are [PR #31](https://github.com/skperdue68/HearthBound/pull/31). As with the other rounds, restack the next PR to master during review rather than merging into a predecessor's feature branch.


Mobile navigation improvements are [PR #32](https://github.com/skperdue68/HearthBound/pull/32).

## Round 6: administration workspace

- Added selected-section tabs inside the existing HearthBound frame. Overview count cards lead directly to pending submissions, reports, stale houses and duplicate groups. Owner-only Global request counts link to Access & settings. Removed retired scheduled-event reminder metrics from this overview.
- Review actions stay together on each row, with destructive choices visually distinct. Wide tables scroll inside a keyboard-focusable region rather than widening the whole page.
- Audit logs and problem reports gain numbered pages and direct page jumps. Audit filters persist, and stale out-of-range links return to the last available page. Pending review retains its honest Previous/Next model because that service does not provide a total count.
- Browser verification covered all six administration sections, a real pending submission and problem report, aligned moderation controls, 320/390px layouts and 1440px desktop. Existing authorization and Private-record exclusion paths are unchanged. Independent review found no actionable issues.

Round 6 verification: the full suite passed with no failures, followed by a final two-test renderer check after removing an unused import. HTTP regressions cover filtered page jumps and out-of-range redirects; browser checks cover eight administration layouts. No schema, dependency, environment or permission changes.


Administration workspace improvements are [PR #33](https://github.com/skperdue68/HearthBound/pull/33).

## Round 7: Discord comments reader

- Found that the previous reader loaded only the newest 25 comments and sliced the combined discussion at Discord's description limit. Added a newest-first reader with two comments per page, separate author/date headers and enough room for supported 2,000-character comments.
- First/Previous/Next/Last and a validated Jump to page modal reach older comments. Add Comment returns to the newest page; Back preserves the original house or tour-stop destination. Existing direct quick-comment actions continue to restore the original house/stop card.
- Reader tokens are bound to user, guild, channel and ESO environment with a 30-minute lifetime. Every interaction rechecks ordinary visibility or the original House/Tour Share Pass. A changed destination or current tour stop cannot be used through stale controls.
- Regression checks cover discussions beyond 25 comments, long text, wrong-user navigation, invalid page jumps, a house becoming Private, revoked passes before paging/submission, changed tour stops, and MariaDB Date/SQLite timestamp formats. No schema, slash-command, environment or dependency changes.

Discord layout reference: [Discord message/embed limits](https://github.com/discord/discord-api-docs/blob/main/developers/resources/message.mdx) informed the bounded reader layout rather than slicing a whole discussion into one description.

Round 7 verification: all 732 tests passed. Four focused reader tests passed again after final formatting. Independent review found no remaining actionable issues. Two existing return-navigation tests were updated for the clearer Back to house label and still verify expanded details and house-list navigation.


Discord comments improvements are [PR #34](https://github.com/skperdue68/HearthBound/pull/34).

## Round 8: reliable list pagination

- Found that several lists clamped their displayed page number while still querying the stale requested offset. This could show an empty screen alongside a valid page number, especially after deleting the last item on a page.
- House/submitted/saved-place/feedback queries now use the same available-page calculation as the controls. Tours, saved searches and the owner catalog also calculate their page from the authorized matching total before fetching or slicing records.
- Explicit stale/invalid web page URLs redirect to the available page with the complete filter/layout query retained. Favorites, Want to Visit, Visited, Recently viewed and Pending collections now share the existing library pagination rather than rendering an arbitrarily long unpaged list.
- Tests cover a final page beyond the first 25 houses, deletion of its remaining items, genuinely empty results, other users' Private records, filtered feedback, all seven affected web routes, preserved search/layout parameters and owner-only restrictions. Chrome desktop/mobile checks follow stale links and submit real page-jump forms while retaining filters. Independent review found no actionable issues.
- Follow-up found during this pass: Saved Search Rename/Delete/Run links still return to the first saved-search page; handle their originating page as a separate navigation improvement rather than weakening return-location validation.

Round 8 verification: 735/735 full-suite tests passed; 21 focused pagination/library/feedback/catalog checks passed before the full run. Real Chrome verified desktop/mobile stale-page correction, filter retention, page-jump submission and Private-record exclusion. No schema, dependency, environment or permission changes.


Reliable list pagination is [PR #35](https://github.com/skperdue68/HearthBound/pull/35).

## Round 9: saved-search return navigation

- Followed up the saved-search return issue found in Round 8. Run, Rename and Delete now carry a numeric originating list page. Results → house → results → saved searches restores that page; Cancel and successful changes do too.
- After a deletion, the remaining authorized count determines a valid return page. The list confirms saved/deleted actions. Rename/Delete controls share a row; delete confirmation is clearly named, red and placed after Cancel.
- Return validation accepts the numeric list-page value only on saved-search result routes. Arbitrary/external destinations remain rejected, and existing ownership, CSRF and server/ESO checks remain in place.
- HTTP tests cover 26 saved searches, result/house return metadata, rename/cancel, deletion of the only item on the last page and malicious source-page input. Chrome followed the actual mobile results/house/back/rename/delete path and submitted forms successfully. Independent review found no actionable issues.

Round 9 verification: all 737 tests passed. A final 15-test return/navigation rerun passed after the concise save notice. Real Chrome completed the mobile navigation and mutation sequence; independent review found no actionable issues. No schema, dependency, environment or permission changes.

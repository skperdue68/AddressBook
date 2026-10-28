# HearthBound house-to-tour flow cleanup

User authorization: proceed with judgment and skip design questions. Keep the current Node SSR web and Discord.js architecture, navy HearthBound design and existing permissions.

## Approach
Improve the existing journeys together. A broad navigation redesign would disrupt familiar menus and is deferred. Web search results should offer a clear Add to tour action for active registered houses; details should show an immediate tour shortcut and distinct management section. Preserve the originating search filters/page through detail, edit and personal-action round trips, using validated internal return URLs only. Advanced, saved and personal searches should use the same links. Empty eligible-tour states must explain visibility compatibility.

Discord should offer Add to a Tour for every accessible active registered house, independently of source-house edit rights. Management remains permission checked. Editable tour details should link directly to Add House; names for tour/back actions should explain destinations. Retain existing IDs/state/session checks, row limits and private boundaries.

## Constraints
No new dependencies, schema migrations or production DB changes. /hearth and /housing remain equivalent. Never expose other users' Private records. Return links cannot navigate to external URLs or alter authorization. Selected-server/environment checks continue on every POST. Keep draft selection/order behavior.

## Acceptance
Search -> house -> add to existing eligible tour is discoverable; Back to Results restores the URL filters/page. A non-owner can add a shared house to their compatible tour but cannot edit the source. Ineligible/pending/private/expired cases continue to fail safely. Management actions are visually separated. Narrow/mobile pages remain usable. New work is published as its own PR from merged #24.

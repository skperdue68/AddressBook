# HearthBound site and Discord polish

User explicitly requested a professional, simple experience and previously authorized proceeding without design questions. Build on merged #25, with existing Node SSR, plain browser JS and Discord.js; no new dependencies or schema changes.

## Shared experience
Use consistent primary (navigate/commit), positive (save/favorite/visit), secondary (cancel/back), and danger (delete/revoke) styles, always with text labels. Adjacent actions align horizontally with spacing and wrap gracefully on phones. Entering a form carries a validated internal origin; completion/cancel restores that origin where still applicable. Destructive operations retain impact confirmation; only harmless personal state saves automatically.

## Houses and personal collection
On the web, show visit commands and official details expanded by default. Discord keeps the core house facts and visit commands visible; advanced capacity and purchase fields stay under More Details to keep native cards readable. List every normally visible tour containing the registered house, never hidden Private/foreign server tours. Put reversible Favorite and visit-state controls directly on house screens on both platforms. Web visit selection saves immediately with progress, success and failure feedback, restoring truthful UI on failure. My Address Book combines things submitted by the member and intentionally saved favorites/want-to-visit/visited entries, deduplicated and permission filtered; browsing alone does not add an item. Keep submitted and personal category views easy to access.

## Discovery and support
Clickable statistics open correctly scoped exact house/account/tour lists. Preserve Private, guild and environment boundaries. Remove Help & Learning/onboarding training from live navigation; keep account/support access requests, feedback and guide download as direct useful tools. No loss of role-management workflows.

## Delivery
Test behavior with HTTP, Discord interactions and real Chrome desktop/mobile; verify personal state toggles, async failures, tour visibility and statistic drilldowns. Review changes then create a separate GitHub PR, leaving production untouched. Provide Linux pull/restart instructions.

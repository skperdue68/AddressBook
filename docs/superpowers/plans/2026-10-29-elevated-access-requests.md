# Request Elevated Access cleanup

Use shared eligibility rules for web and Discord: Server only in a connected guild, exclude currently held roles/owner access and pending requests; Global applies to the selected ESO environment. Approval/setup/review permissions remain unchanged. Profile request link is hidden when nothing can be requested and points directly to the sole eligible kind when only one exists. Web request pages show only requested eligible forms, with equal-width cards/buttons; successful/pending/held direct URLs show concise state instead of inactive duplicate panels.

Enrich the selected web context with requestable kinds (not every available guild). Actual grants remain authoritative during lower-permission previews; requests remain read-only there. Recheck eligibility in WebActionsService before submission. Support links follow the same rules.

Discord Support offers Request Elevated Access only when eligible. One available kind opens its request modal directly; two available kinds use a single full-width choice menu. Stale request controls still recheck current eligibility. Existing server/global administration screens retain their review tools, but hide disabled request buttons.

Verify owners, role/individual admins, ordinary members, pending/denied requests, personal workspaces, environment isolation, direct links, selected-kind forms, equal geometry, stale submissions and Discord row limits. Publish separately after review and appropriate checks.

# Tour route information columns

Render shared aligned route tables on signed-in tour details, self-paced route lists and guest tour pages. Columns: house/nickname (with optional existing thumbnail and stop number), ESO owner, official house, short description and maximum visitors; preserve editor actions and mark the current stop. Label tour-specific notes separately. Use responsive labeled cells on small screens.

Enrich visible getTourDraft stops with explicit registration nickname/description and clear both on restricted rows. Guest tours attach only cover IDs from already verified Global houses. Render no restricted house metadata or images. Escape user text and preserve actual route order.

Discord route summaries retain existing nickname/official-house/owner/capacity fields and add short descriptions only when the complete enriched route fits the current field budget. No new menus or permission changes. Verify info/notes, missing values, restricted rows, guest image authorization, Discord limits and mobile geometry; publish separately.

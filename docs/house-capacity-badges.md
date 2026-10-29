# House capacity at a glance

A compact people icon and number show the catalog's recorded `population_limit` beside houses on the web: search cards, compact results, My Address Book, saved/advanced search results, details, Random House, Featured Housing, tour house pickers, draft stops, tour routes and the self-paced player. The accessible label and hover text identify it as the maximum house capacity in players.

Discord keeps its existing capacity-bearing house and current-stop titles, and now also includes capacity in house-picker descriptions, tour routes, selected-stop review/reorder views, and shared-tour information. Longer labels continue to respect Discord limits.

The badge uses the individual house's stored limit, including catalog exceptions. Missing, zero, negative or malformed values are omitted rather than inferred from classification. This displays maximum capacity, not current occupancy, and does not estimate how many people can currently enter. Tour organizers can use it to plan staggered visits to smaller stops.

Visibility and edit permissions are unchanged. Restricted web tour stops receive no capacity or image metadata. No database migration or command redeployment is required; merge, pull and restart HearthBound.

# HearthBound current feature reference

HearthBound is the current name of the former AddressBook bot. Use `/hearth` or its equivalent `/housing` alias. The current web workspace supports ordinary Discord members and authorized administrators through the same scoped housing/tour policies.

See the [member guide](member-guide.md) for Discord and web workflows, [administration and operations](administration.md) for configuration, permissions, catalog tools, activity and deployment, and [production upgrade guide](upgrade-v1.0.62.md) for schema 12 and recovery. A current [Word guide](../HearthBound_User_Admin_Guide.docx) covers members and administrators together.

The portal includes house registration/editing, alphabetical tour browsing, atomic draft saves and keyboard/drag ordering, self-paced progress and explicit restart, discovery, personal collection, statistics and newest-first named global usage. Administrator tools include reviews, reports, settings/grants, Featured, maintenance, audit and exports. Only configured bot owners can add official house definitions. Private content remains owner-only.

Discord login is remembered for 30 days by default with configurable `WEB_SESSION_DAYS`. Keep `WEB_SESSION_SECRET` stable; current membership and permissions are still rechecked. Database schema migrations run against the configured backend at startup; no old local database should replace the live Linux data.

Older versioned documents and engineering plans describe historical releases, not the current interface. See [historical documentation](historical-documentation.md).

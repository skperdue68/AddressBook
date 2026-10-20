# AddressBook Companion Administration and Learning Design

## Intent

AddressBook remains Discord-first for normal members. A companion web console provides a readable, permission-checked administration surface for work that is cumbersome in Discord. In Discord, Help becomes a durable learning center with replayable onboarding and release-specific “What’s New” guidance.

## Scope

### Included in the first implementation

- Versioned onboarding state that preserves existing completed/skipped status.
- A Help & Learning menu with:
  - Show Me Around Again
  - What’s New
  - topic shortcuts for Search, Houses, Tours, Sharing, and Administration
- Contextual learning buttons on major AddressBook screens.
- A small HTTP companion service with Discord OAuth2 session authentication.
- Read-only web administration pages for Health, Audit Log, Maintenance, Pending Review, and Export.
- Server-side checks for Discord guild membership, Housing Moderator access, Global Moderator access, and exact ESO-environment scope.

### Explicitly excluded from the first implementation

- A public house directory.
- Web-based member search, registration, comments, tour running, or Share Pass consumption.
- A second role or permission model.
- Direct browser access to the database.
- Web mutation actions until the read-only console has been validated.

## Discord learning experience

The existing seven-page introduction remains the full walkthrough. Add a version identifier and feature acknowledgements without resetting a user’s original completion status. Help exposes a dedicated “Help & Learning” view. The full walkthrough can be replayed at any time; “What’s New” shows only the current release highlights and can be acknowledged independently.

Each learning topic uses the existing ephemeral interaction model and includes Back, Next, Skip/Close, and an optional action that opens the related AddressBook screen. Contextual help must not make a user repeat the entire walkthrough.

## Companion web architecture

The web console is a separate HTTP surface in the same Node application, sharing database repositories and services with Discord. The browser only receives view models returned by those services. It never receives database credentials or unrestricted SQL access.

### Authentication and authorization

- Login uses Discord OAuth2 Authorization Code flow with state and short-lived, secure, HTTP-only cookies.
- Every request resolves the Discord user, guild membership, configured Housing Moderator roles, and current ESO environment server-side.
- Global moderation pages require the existing centralized approver or environment-specific Global Moderator grant.
- All queries are constrained by guild ID and exact ESO environment before rendering.
- Private houses, private tours, and private comments are excluded from guild administration views.
- Read-only page views are logged only where the existing audit model already supports an administrative action; no content is copied into a second store.

### First pages

- **Overview:** configured environment, database backend, pending queues, stale/duplicate counts, and last migration.
- **Audit Log:** paginated guild-scoped administrative history.
- **Maintenance:** stale houses and exact-context duplicate candidates.
- **Pending Review:** pending Server/Global house submissions visible to authorized moderators.
- **Export:** a guarded download of the existing guild/environment export.

All pages show the guild name, ESO environment, current user, and a clear “read-only” indicator in the first release.

## Error and limit handling

- Discord payloads must never exceed five top-level action rows or five components in a row.
- Web tables paginate server-side and show a useful empty state.
- Unauthorized, missing-guild, and environment-mismatch requests return the same non-leaking authorization response.
- OAuth failures expire the session and provide a safe retry link.

## Verification

- Unit tests cover versioned onboarding reads/writes and replay behavior.
- UI tests cover Help & Learning and contextual topic navigation.
- HTTP tests cover OAuth state validation, guild/role authorization, environment scoping, pagination, and exclusion of Private records.
- Existing full Discord test suite remains green.

## Delivery sequence

1. Fix and lock down Discord component-row limits.
2. Add versioned Help & Learning behavior.
3. Add read-only web service, OAuth callback, and overview/audit/maintenance/review/export pages.
4. Add deployment configuration and operator documentation.
5. Reassess controlled web write actions after the read-only console is used in practice.

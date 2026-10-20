# AddressBook v0.9.0 Current State

AddressBook is a menu-driven Discord bot for ESO housing discovery, saved addresses, comments, controlled sharing, guided tours, scheduled tour events, Featured Housing, and persistent self-paced progress.

## Runtime requirements

- Node.js 22 or newer
- SQLite by default, or MariaDB when `DB_TYPE=mariadb`
- Discord environment configuration selected once per guild: PC NA, PC EU, Xbox NA, Xbox EU, PlayStation NA, PlayStation EU, or PTS
- `/housing` is the user-facing command

## Visibility and environment rules

Visibility is always displayed Global, Server, Private. Global records are available only inside the same exact ESO environment. Server records remain in their Discord guild. Private records belong to their creator except when exposed through a revocable Share Pass or one-time share. Comments belong to the environment-specific ESO destination and are shared across the matching visibility records.

Tours follow the same environment boundary. Global tours contain only Global houses. Server tours contain Global and Server houses. Private tours can contain Private houses and eligible Global or Server houses owned or submitted by the creator.

## Engagement features

Tour creators and authorized Housing Moderators can schedule events using the guild timezone. Event cards display title, tour, host, environment, local timezone, Discord absolute and relative timestamps, RSVP counts, and reminder state. Going and Interested RSVPs are independent from optional DM reminders. Only the host or authorized moderator controls event lifecycle actions. Terminal events reject stale RSVP, reminder, edit, start, complete, and cancel mutations.

Housing Moderators can curate up to five eligible Global or Server houses and tours as Featured Housing. Entries can be reordered, removed, or assigned an expiration date. Expired and inaccessible entries are hidden automatically.

Self-Paced tours create durable user-owned progress. Members can resume, advance, go back, restart, open the current house, and review completion history. Removing the current stop triggers reconciliation to the next available stop or completion. Progress never bypasses current tour access, environment checks, or Share Pass validity.

## Administration and health

Administration supports server timezone, multi-role permissions, pending review, reports, legacy-tour recovery, Featured Housing, Share Pass counts, and health checks. Health output includes backend connection, schema version, queues, reports, reminder stale-claim and failed-delivery counts, and channel availability without exposing secrets or private event content.

## Migration and release

Schema version 7 is supported by SQLite and MariaDB. `MIGRATE=true` performs a guarded, destructive transfer toward the backend selected by `DB_TYPE`; it validates the source and target, preserves persistent IDs and relationships, transfers engagement records, and leaves the source untouched. Set `MIGRATE=false` before normal startup. Active transient sessions are not transferred.

Release verification requires the full test suite, syntax checks, fresh SQLite migration smoke test, MariaDB schema/query tests, component-limit checks, guide rendering, and a clean extraction/startup check for `AddressBook-v0.9.0.zip`.

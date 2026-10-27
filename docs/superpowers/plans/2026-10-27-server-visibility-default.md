# Default new entries to Server

Change new member web house/tour defaults to Server, preserving explicit selections and existing edits. Registration restricted to Private falls back to Private, and tours seeded with Private houses remain compatible. Discord preselects Server with a continue action and makes Server the primary tour creation button; confirmation and backend permission checks remain. Never migrate existing visibility. Test UI selections, services, fresh permissions, editing old Private tours, and Discord payloads; run full regression suite and publish a separate PR.

Validation:610 full-suite tests passed, then final12 targeted tests passed including the additional Home/Help/onboarding permission fallback regression. Existing Private fixtures now specify their intended visibility explicitly. Independent review identified the two secondary Discord entry points; one shared permission-aware helper now covers all three. New entries only; no database migration.

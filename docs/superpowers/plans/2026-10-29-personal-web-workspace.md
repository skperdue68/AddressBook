# Personal web workspace

Allow a real Discord-authenticated user to use HearthBound without installing the bot in a guild. Reuse the existing house/tour/collection services with an explicit personal workspace context: real user ID, validated ESO environment, no guild ID, no fabricated guild/roles, Global and Private scopes only.

- [x] Add service and HTTP tests for a user with no bot guilds, Global/Private registration and tour editing, environment selection, forbidden Server scope and administrative access.
- [x] Add personal context to ContentPolicyService; preserve it on fresh permission checks. Explicitly deny Server registration/tour creation in that context.
- [x] Add authenticated personal fallback/selection and remember the chosen environment/workspace in the signed session. Leave explicit inaccessible guild requests forbidden.
- [x] Adjust navigation/forms to show personal environment controls and only available scopes/tools. Keep Discord posting/server administration in connected guilds.
- [x] Label guest browsing clearly and label inviting the bot as optional only once standalone web flows pass.
- [x] Verify representative house/tour/image/favorite flows, review access boundaries, run the full suite, document and publish a separate PR.

No new database schema or fake guild row. The existing Discord identity is the account; no additional password/account signup system is needed. Private records remain creator-only and Global records remain platform/region-specific.

Final verification: 794/794 tests passed with zero skipped. Independent review identified Private tour source, workspace-switch persistence, and search-to-tour scope defaults; all fixed with regression checks and re-reviewed without important remaining issues. HTTP tests independently blocked for reviewer by localhost sandbox, but passed in the full parent run.

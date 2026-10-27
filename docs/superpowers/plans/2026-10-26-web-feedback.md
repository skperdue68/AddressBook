# Stored web feedback

Replace the welcome page's redundant Open web portal action with Send feedback, linking to an authenticated member form. Keep Discord sign-in, context selection and CSRF protections. Members submit a Bug report, Idea or General feedback with a subject and description, and see their own recent submissions/status. Bot owners alone can review the application-wide inbox, filter by status, and update status/internal notes; server/global administrators do not gain this access. Feedback text stays out of public activity and exports.

Use a dedicated FeedbackService, small feedback routes module, and additive schema migration14 for SQLite/MariaDB. Preserve feedback in backend transfer tools; older databases without feedback import as empty. Persist author/server/environment snapshots and review metadata, escape user text, enforce field limits and stale-review protection. No attachments or external messages.

Implementation: write failing service/HTTP tests; implement schema/service/routes/navigation; run relevant and full tests; inspect browser member/owner/mobile flows; independently review and publish a separate PR. Update version1.0.64 and production upgrade instructions. Never change live production data during development.

Validation: full suite602 passed, then final focused6 feedback tests passed after adding pagination/Unicode coverage and preserving ISO timestamps across backend transfers. Browser native submission/review tested at1440px and390px; own-history status and owner-only notes verified. Independent review identified a multi-guild destination issue, fixed with a failing-before/passing-after HTTP regression. SQLite migration and transfers exercised locally; MariaDB DDL/dialect inspected, no production MariaDB connection used.

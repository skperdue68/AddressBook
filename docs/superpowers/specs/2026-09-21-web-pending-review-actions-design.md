# Web Pending Review Moderation Actions

## Intent

Extend the companion web administration console with the first controlled write workflow: approve or reject pending Server and Global house submissions. Discord remains the source of the permission model and continues to support the existing workflow.

## Scope

### Included

- A server-rendered Pending Review page with explicit Approve and Reject forms.
- `POST /admin/pending/:id/approve` and `POST /admin/pending/:id/deny` routes.
- Server-side revalidation of Discord membership, configured Housing Moderator roles, guild, and exact ESO environment for every request.
- A signed, short-lived CSRF token tied to the authenticated session.
- Confirmation-required forms; GET requests remain read-only.
- Review-time checks that the record is still pending and belongs to the current guild’s Server or Global queue.
- Audit entries containing the action, saved-house ID, guild, ESO environment, actor ID, actor global name, actor display name, and house identity.
- Safe stale-result handling when another moderator processes the record first.
- Tests for successful approval/rejection, authorization failures, CSRF failures, stale records, scope isolation, and audit data.

### Excluded

- Web editing or deletion of houses.
- Web review of Private records.
- A new web-specific role or permission system.
- Arbitrary guild or ESO-environment selection from query strings or form fields.
- Direct database access from the browser.

## Authorization and data flow

1. The browser requests `/admin/pending` through the existing signed Discord OAuth session.
2. The server resolves current Discord membership and roles, then obtains the guild’s configured ESO environment.
3. The form contains only the pending record ID and a CSRF token. Guild and environment values are never trusted from the browser.
4. On POST, the server revalidates the session, membership, roles, guild, and environment before loading the record.
5. The moderation service confirms the record is pending and is either a Server record owned by the guild or a Global record originating in the guild.
6. The service calls the existing registration status transition, writes the audit entry in the same logical operation, and returns the updated result.
7. The response redirects back to Pending Review with a one-time success or stale/error message.

The existing `RegistrationService` remains responsible for the status transition. `WebAdminService` owns web-specific queue scoping, actor context, and audit details so the browser cannot bypass repository rules.

## CSRF and session behavior

The signed session receives a CSRF value when the authenticated session is created. The Pending Review form includes that value as a hidden field. POST handlers compare the submitted value using a constant-time comparison and reject missing, malformed, or mismatched values. The token is not accepted from a URL query parameter.

The existing HTTP-only, SameSite cookie behavior remains unchanged. A rejected POST does not mutate data and returns a non-leaking error page.

## UI behavior

- Pending rows show house name, owner, visibility, submitter, and submission time.
- Each row has separate Approve and Reject buttons.
- Reject requires an explicit confirmation step; no free-form rejection reason is added in this slice because the current Discord workflow has no reason field.
- The page displays a clear “moderation actions enabled” label while retaining the existing security context header.
- After a successful action, the page reloads the current queue and reports the action without exposing private records.

## Error handling

- Unauthorized users receive the existing non-leaking 403 response.
- Wrong guild, wrong environment, private scope, missing record, and malformed IDs use the same safe unavailable response.
- A record no longer in `pending` is reported as already reviewed; no second transition occurs.
- Database failures produce the existing generic administration error page and never reveal credentials or SQL.

## Verification

- Unit tests cover queue ownership checks, status transitions, audit fields, stale records, and scope/environment isolation.
- HTTP tests cover GET rendering, POST confirmation, CSRF rejection, unauthorized access, successful redirects, and stale responses.
- The complete existing test suite remains green.

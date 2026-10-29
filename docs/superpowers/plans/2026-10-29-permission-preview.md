# Lower-permission web preview

## Design
The signed-in account remains unchanged. A signed session preference selects Guest, Member, Server administrator or Global administrator; choices are limited to current real grants. Each fresh workspace context reapplies the cap, drops privileged role IDs/setup authority and exposes only selected-role badges. Revoked grants fall back to Member. Normal mode restores live permissions.

All preview requests are read-only, enforced before handlers including admin and media. Guest preview routes through existing Global-only browsing and image authorization. Persistent banners and an account-menu selector allow exit. No Discord grants or database migrations.

## Implementation
1. Add permission-preview helpers and failing tests for role intersection, revoked access and refresh propagation.
2. Add CSRF-protected session preference route, read-only guard and guest routing/restore banner. Protect owner-only and admin GET routes using effective access.
3. Render accessible profile selector and preview banner. Test member menus, guest visibility, direct privileged URLs, mutation rejection, CSRF, restore and permission revocation.
4. Run targeted tests and full suite, obtain review, publish an independent PR against master.

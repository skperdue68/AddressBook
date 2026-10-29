# Browsing HearthBound without signing in

Use **Browse Global houses & tours** on the landing page, or open `/browse`. Guests can search Global houses and tours, inspect descriptions and tags, see available screenshots and cover images, copy ESO jump commands, and explore tour stops at their own pace. Guest tour exploration does not save progress.

The **Platform / region** selector defaults to PC NA and remembers the selected environment in a preference cookie. Every entry displays its own environment. Global means shared across HearthBound communities within the same ESO environment, not across PC/Xbox/PlayStation or NA/EU.

Clean links such as `/app/houses/158` and `/app/tours/14` look up the stored record's environment automatically. An `esoServer` or guild query parameter is no longer required. A Global entry opens for guests; a Server or Private entry requires Discord sign-in and appropriate membership/ownership. Signing in returns to the same entry. Authenticated access remains governed by current guild and ESO environment rules.

Only **active Global houses** and **Global tours** are anonymously visible. Pending and archived houses are excluded. A restricted, pending, archived, missing, or differently assigned house on a tour becomes an unavailable stop; its title, owner, notes and screenshots are not shown. Media endpoints check current visibility each time and do not expose the storage folder. Changing an entry away from Global revokes anonymous image access.

Favorites, comments, registration, editing, administration, and saved tour progress still require sign-in. Guest pages do not create a fake Discord identity or grant write permissions. Direct `/browse` writes are rejected.

## Deployment

Pull after merging, run `npm ci` as usual, restart `hearthbound`, and refresh the browser. No database migration or new environment variable is required. This feature does not change existing or future registration visibility.

The separately authorized production visibility conversion was completed with a database backup on 2026-10-29. It is not a recurring startup migration: future Server and Private registrations continue to be supported.

## Verify

- Open the landing page in a private browser window and choose Browse.
- Search houses or tours, switch platform/region, and reopen the browser to check the preference.
- Open a Global house/tour using its clean `/app/.../ID` link. It should display without Discord login and identify the entry's environment.
- Open a Server/Private link: login and normal access checks should apply.
- Sign in from a Global entry and verify you return to it with your normal permissions.
- Mark a house Pending or change an entry's visibility in a test environment, then verify its guest detail and images become unavailable.

# HearthBound 1.0.67 web workflows and registration improvements

This update fixes the welcome page looking logged out despite a valid cookie and reduces oversized multi-server login cookies. Sessions now carry both Max-Age and Expires; the welcome page displays your saved identity and Continue to HearthBound. Existing valid signed sessions remain accepted, and current membership/permissions are still checked.

House visibility now separates target selection from impact preview/confirmation. Changing a dropdown can no longer confirm a different hidden target with no error. Authorized administrators can also copy a house to another server within the same ESO environment, preserving the source and tour links. See [web workflows](web-workflows.md#copy-a-house-between-servers).

## Linux deployment

After merging this PR, run from the existing installation:

```bash
cd ~/AddressBook
git pull --ff-only
sudo systemctl restart hearthbound
sudo journalctl -u hearthbound -n 40 --no-pager
```

No SQL, database migration, new dependency, environment change or Discord command redeployment is needed. Keep your existing WEB_SESSION_SECRET; changing it deliberately logs out existing sessions. If your old cookie was never stored because it was too large, sign in once after deployment to receive the smaller persistent cookie. Old valid cookies do not need replacement.

Verify:

1. Sign in, close the browser, then reopen the root website. Your avatar/account menu and Continue to HearthBound should appear.
2. Change an editable house from Server to Global or Private: Preview impact, verify the named target, then confirm. Other users’ Private houses remain unavailable.
3. As a multi-server administrator/owner/Global administrator, open Copy to another server, verify the destination name and ESO environment, then confirm. Check that the new Server registration exists and the original/tour stops are retained.
4. Check that members without the required access have no copy control and cannot use its direct URL.

The production database is not accessed by these deployment instructions beyond the application’s normal startup. Existing deployment backup practices still apply.


This release also includes the Server-default registration/tour change, shared-record reassignment, destination membership-aware copying, selected-server ESO owner/popular house statistics, clearer tour editing navigation and duplicate registration checks. No additional SQL is required for these features.

Additional checks after deployment:

5. On a shared house/tour, check **Change submitter/Change tour creator** with a current server member; confirm the preview. Private records must have no reassignment control.
6. Visit Statistics and compare the server’s official-house and ESO-account owner rankings. Discord submitter names are not used for ESO owner rankings.
7. Edit a tour, use Add houses, apply name/owner, tag and visibility filters, select and reorder stops, then save. Filtering must preserve selected stops and draft order.
8. Try registering the same ESO owner and house at Server level when an active Server/Global entry is already visible. The page should identify the duplicate and offer the existing record, without creating a new entry.

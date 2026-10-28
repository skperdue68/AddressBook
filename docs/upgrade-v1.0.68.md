# HearthBound 1.0.68 flow cleanup

This release improves web and Discord house-to-tour navigation. It follows merged PR #24 (1.0.67).

## Deploy on Linux

From your existing installation, preserving .env and WEB_SESSION_SECRET:

```bash
cd ~/AddressBook
git pull --ff-only
sudo systemctl restart hearthbound
sudo journalctl -u hearthbound -n 40 --no-pager
```

No database migration, SQL, dependency installation or slash-command redeployment is needed. Both /hearth and /housing continue to work.

## What to test

1. Search for a house with filters, choose Add to tour, and add it to an eligible existing tour. Return to search results and check that the filters/page remain.
2. From the same detail view, save a favorite, visit state or comment; the return link should remain. As the submitter/admin, check editing under Manage house.
3. Open Advanced Search; common filters appear first and additional active criteria open More filters automatically. Saved searches also offer house-to-tour shortcuts.
4. On a phone, house search results show View house and Add to tour without horizontal table scrolling.
5. In Discord, view another member’s Server or Global house. Add to a Tour should be available, but Edit House/Delete House remain absent without access. Add it to your compatible tour and verify the route.
6. Open an editable tour in Discord and use Add House directly. Check Back to Tour/Back to Tours/Main Menu navigation.
7. Confirm other users’ Private houses/tours remain unavailable and pending registrations cannot be added before approval.

See [web workflows](web-workflows.md#house-to-tour-shortcuts-and-returning-to-results).

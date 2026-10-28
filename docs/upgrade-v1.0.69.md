# HearthBound 1.0.69 interface and access update

This release follows merged PR #25 and improves the web and Discord journeys for sharing homes, creating tours, exploring and saving places. It uses existing database tables and requires no SQL migration or new dependencies.

## Linux deployment

From the existing checkout, preserve .env, database credentials and WEB_SESSION_SECRET:

```bash
cd ~/AddressBook
git pull --ff-only
sudo systemctl restart hearthbound
sudo journalctl -u hearthbound -n 50 --no-pager
```

No slash-command redeployment is needed. Both /hearth and /housing remain available. Production data is not replaced or copied from Windows.

## First Server administrator

Existing configured roles and approved grants continue to work. If a server has neither, it now requires an explicit setup confirmation in Support & Access. The current Discord server owner, a member with Manage Server permission, or a configured bot owner can claim the first HearthBound Server administrator grant. Current Discord authority is checked at confirmation; concurrent claims cannot both succeed. Normal editing still requires HearthBound access, and Private records stay creator-only.

Configure administrator roles or review individual Server requests under Access & Settings. Global requests remain separate and are reviewed by the configured owners/approvers for the ESO environment.

## Full role-holder names

Access & Settings always lists configured roles and individual grants. To also enumerate everyone holding those roles, enable **Server Members Intent** in Discord Developer Portal → HearthBound → Bot → Privileged Gateway Intents. The existing Gateway connection does not automatically request new intents. A blocked or incomplete roster is clearly labeled; it is never substituted with a partial cache. [Discord documentation](https://github.com/discord/discord-api-docs/blob/main/developers/resources/guild.mdx).

## Checks after deployment

- Web: Favorite/Unfavorite and Want to Visit/Visited/Not marked save in place. A failed save restores the last saved selection.
- House: visit commands, official details and visible tour memberships appear upfront; no other user’s Private tour is exposed.
- My Address Book: submitted and marked places appear together, but merely viewed houses do not.
- Feedback inbox: change status directly; notes remain independent; filters and scroll remain.
- Statistics and activity: follow numeric links; combine server/person/action filters; use numbered pagination and page jumps.
- Server onboarding: test ordinary member denial, eligible first setup, existing administrator review and separate Global requests.
- Discord: mark/unmark directly, add a comment through one modal, and return to the same house or tour stop. Check revocation and stale-access behavior.
- Desktop/mobile: filter buttons align with their controls; action rows wrap without overlap or horizontal page overflow.

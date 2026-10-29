# Use HearthBound without installing the Discord bot

Sign in with your Discord account. You do not need to invite the bot to a server or create a separate password. If you have no connected HearthBound servers, the site opens your **Personal web workspace** automatically. Existing users can choose **Personal web workspace** from their account menu.

Choose your ESO **Platform / region** in the workspace header. The choice is remembered in the signed login session. Houses and tours remain assigned to the environment in which they were created; switching this preference does not move records between platforms or regions.

In a personal workspace you can register Global or Private houses, edit your own entries, upload screenshots, create/edit tours, favorite houses, comment, and use saved self-paced tour progress. New entries default to Global because there is no Discord server context. Private entries remain creator-only. Global visibility stays within the entry's ESO environment.

Server visibility, server roles/administration, curated server Featured selections, and Discord posting require a connected Discord server. Those functions are not granted by a personal web workspace. To use them, add the optional bot and choose a connected server. Existing Server-level registrations keep their normal access rules.

The landing page distinguishes **Browse as a guest** (read-only Global browsing) from **Sign in with Discord** (your personal account) and **Add the optional Discord bot** (server integration).

## Deployment

Pull after merging, run `npm ci` as usual, restart `hearthbound`, and refresh your browser. No schema change or extra environment variable is required. Existing OAuth configuration and the stable `WEB_SESSION_SECRET` remain in use. No synthetic Discord guilds or new membership grants are created.

## Test

Use a Discord account that is not a member of any bot-connected server. Sign in, choose an environment, register Global/Private houses, create a tour, favorite a house, and save tour progress. Verify that Server visibility and Server administration remain unavailable. Then test an existing account's switch between personal and connected-server workspaces.

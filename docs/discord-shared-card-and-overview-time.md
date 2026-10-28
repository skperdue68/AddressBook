# Shared Discord house cards and Overview activity times

Discord house screenshots and their information now share a single card container. The image appears first, uses the card's available width, and is omitted entirely when no screenshot is available. The existing Screenshots gallery uses the same layout.

Favorite updates retain the image. Management, Comments, modal submissions and Back navigation understand nested controls and keep the original custom IDs. The transport keeps editing shared-card messages in Discord's required component format; unrelated new messages keep their existing rendering. Converted text never sends mention notifications. Screenshot access still goes through the house/gallery permission checks.

Overview recent activity now includes a full date/time for every row, newest first. It uses the same timestamp renderer and browser local-time formatter as the full activity page, including a time-zone label and an explicit UTC fallback before JavaScript loads. Desktop and mobile layouts are supported.

## Deploy

Merge the PR, pull master in the existing checkout and restart hearthbound. There are no new dependencies, database migrations or command-option changes. Existing images need no reimport. Reopen `/hearth` or `/housing` to begin a fresh bot session when testing the new layout.

## Verification

All 772 automated tests passed. Focused tests exercise shared media/text layout, no-image fallback, component limits, long text, attachment retention, Favorite toggling, management, comments and returning to the main menu. Independent review found no actionable issues. Discord.js payload serialization was checked without sending Discord messages. Browser checks verified Overview dates/times on desktop and mobile in America/Chicago and Australia/Sydney; existing tests cover daylight-saving offsets.

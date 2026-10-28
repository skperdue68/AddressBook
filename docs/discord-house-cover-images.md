# Discord house cover images

Opening a registered house on Discord now includes its first gallery screenshot automatically. The Screenshots button still opens the full gallery. Changing the cover on the web or Discord changes the image used when reopening the house.

Images are read through the existing house/gallery permission checks and uploaded as Discord attachments. Private web image URLs are not exposed. Houses without images stay readable as text cards. When Attach Files is denied, the card explains the missing permission instead of failing to open.

Message updates clear stale uploads when leaving a house or opening a house without a screenshot. Quick-comment refreshes retain the current attachment; management actions restore the correct house cover.

The public invite now requests Attach Files alongside the existing permissions. Existing servers can enable **Attach Files** for HearthBound in the relevant channel or role; Administrator access is unnecessary.

After merging the preceding UI polish PR and this fix, pull master and restart hearthbound using the existing deployment procedure. No database migration or reimport is needed. Elden Cottage’s existing gallery will be picked up automatically.

# Discord house cover images

Opening a registered house on Discord now shows its first gallery screenshot above the house information. The full gallery also puts the image before its title and caption. The Screenshots button still opens the full gallery. Changing the cover on the web or Discord changes the image used when reopening the house.

Images are read through the existing house/gallery permission checks and uploaded as Discord attachments. Private web image URLs are not exposed. Houses without images stay readable as text cards, with no empty image block or placeholder. When Attach Files is denied, the card explains the missing permission instead of failing to open.

Message updates clear stale uploads when leaving a house or opening a house without a screenshot. Quick-comment refreshes retain the current attachment; management actions restore the correct house cover.

The public invite now requests Attach Files alongside the existing permissions. Existing servers can enable **Attach Files** for HearthBound in the relevant channel or role; Administrator access is unnecessary.

After merging the preceding UI polish PR and this fix, pull master and restart hearthbound using the existing deployment procedure. No database migration or reimport is needed. Elden Cottage’s existing gallery will be picked up automatically.

## Upload a screenshot in Discord

Select `/hearth` (or `/housing`) from Discord’s slash-command menu. Add the **house** option, search for a registered house and select it. Add **screenshot** to choose a PNG, JPEG or WebP file up to 5 MB; **caption** is optional. Submit the command to upload. Existing editing permissions apply.

If the house/screenshot/caption options are missing after an upgrade, the application’s command definitions need to be registered with Discord again. Run the existing command-registration procedure with the installation’s intended global/guild settings; restarting the Node service alone does not register changed options. Reload Discord if it continues to display cached command fields.

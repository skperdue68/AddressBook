# Automatic tour-cover uploads

Use the existing tour-cover service and house-uploader visual language. Choosing or dropping one supported image uploads it immediately and replaces the current cover. No caption or separate Replace action. Preserve the upload area's viewport position and update the image in place. Keep an explicit Remove action and a standard POST fallback without JavaScript.

- [x] Add failing HTTP JSON-response and real-browser drag/drop/replacement tests.
- [x] Return authorized cover markup as JSON; preserve CSRF/context checks and normal POST redirects.
- [x] Add a small delegated upload controller, validation, progress/status, retry, and in-place rendering.
- [x] Verify success/failure/removal, repeat uploads, permissions, scroll position and existing workflows; review and open a PR.

No schema change. The owner-authorized production Global conversion is already complete; guest browsing is the next larger feature after this additional requested uploader improvement.

Final verification: 786/786 tests passed. Independent review found missing context fields in refreshed forms; fixed and tested consecutive upload/remove with the returned form. Follow-up review found no important issues. User additions: editor below tour list/link, image retained at top, solid capacity icon.

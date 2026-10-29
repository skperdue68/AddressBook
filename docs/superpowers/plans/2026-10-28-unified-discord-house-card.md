# Unified Discord House Card Implementation Plan

**Goal:** Keep the screenshot above the information at the same card width, with no media placeholder when absent.

**Architecture:** Retain existing permission-checked house/gallery payload construction. Mark photo payloads for a transport formatter that emits one Discord Components V2 Container with Media Gallery, Text Displays and existing action rows. Discord's V2 flag cannot be removed, so edits of these messages must continue through the formatter, including Back, Comments and management flows. Unrelated fresh messages retain legacy rendering. Never ping mentions when converting embed text.

**Tech stack:** Existing discord.js, native component JSON, node:test.

- [x] Add failing wire-format tests: one shared container, image first, no media without a photo, <=40 components, preserved custom IDs, legacy-to-V2 navigation and attachment retention for partial edits.
- [x] Implement formatter and recursive control helpers in a focused module; preserve field text, code fences, footer and attachment references. Keep a separate identifiable comments-count text component.
- [x] Integrate via the existing interaction response wrapper. Cover direct gallery command entry and V2 follow-up edits without changing modal or defer behavior.
- [x] Update Favorite, Manage House and comment snapshot handling for nested controls. Do not lose screenshots on partial button updates.
- [x] Run end-to-end mocked Discord interaction flows and full suite; independent review. Publish a PR targeting master. No production source edits or unsolicited Discord messages.

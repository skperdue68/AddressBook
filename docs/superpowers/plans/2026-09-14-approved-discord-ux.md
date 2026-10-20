# Approved Discord UX Implementation Plan

**Goal:** Apply the approved beginner-friendly Discord presentation and enforce leader-only shared-tour control.

**Architecture:** Keep the existing menu/service design. Centralize tour control authorization in one exported predicate, pass the package version into the home payload, and standardize house action field labels and ordering in the renderer.

**Tech Stack:** Node.js 22, discord.js 14, Node test runner, SQLite/MariaDB storage adapters.

## Tasks

- [x] Add failing tests for version/about copy, ESO action block order, and initiator-only tour control.
- [x] Implement the smallest renderer and handler changes that satisfy those tests.
- [x] Improve shared-tour leader messaging without adding join/leave state; retain the existing accurate closed-session response.
- [x] Update current-state documentation and package metadata for v0.4.5.
- [x] Run the complete test suite and package the release ZIP.

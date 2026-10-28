# HearthBound Site and Discord Polish Implementation Plan

**Goal:** Put common actions upfront, preserve context, and make the shared collection feel coherent and professional.
**Spec:** docs/superpowers/specs/2026-10-28-site-discord-polish.md
**Architecture:** Existing SSR and Discord services, small focused rendering/navigation modules, existing user_house_states storage. No dependencies/schema changes.

1. Web personal workflow agent owns web-actions routes/browser handlers and a new personal-library service. Add regression tests first for autosave/reversals/library/privacy and return behavior. Preserve CSRF/context and explicit destructive confirmations.
2. Discord agent owns UI handlers/payloads/menu specs: direct reversible actions, intentional collection, retired learning/onboarding, useful Support & Access. Recheck stale visibility and fit Discord component limits.
3. Statistics agent owns exact scoped service filters and extracted statistics renderer. Test click-through result membership against counts, including private/foreign/env exclusions.
4. Root owns shared button variants/styles, validated action-return helpers, expanded house details/membership, Support web shell, route integration and non-personal workflows. Add route tests and Chrome desktop/mobile verification.
5. Integrate without shared-file overwrites, run full suite, independent review, fix regression findings, document version/deployment and publish PR.

## Review focus
Async personal saves must never leave a false success state. Clearing a mark removes only that mark, not the registration. Library union must not expose other users’ Private entries, including through destination duplicates. Statistics must use exact IDs/accounts and correct scope. Help removal must not orphan access requests/approvals or feedback/guide. Return URLs must not allow external redirects or skip current authorization.


## Verification and review evidence

- Actual Chrome caught hidden form input `action` shadowing HTMLFormElement.action, which broke personal and feedback AJAX request URLs. Regression mocks reproduced it RED; attribute-based URL lookup passes, and real Chrome now verifies favorite/unfavorite, all visit states and feedback review in place.
- Browser checks cover expanded house details, access-info focus/Escape, control alignment on tours/activity/feedback, and 390px viewport bounds. The mobile personal select width was corrected after reproducing overflow.
- First complete suite passed 706 tests before the last browser/navigation regressions were added.
- Independent review found two P2 regressions: Discord library foreign registrations before dedup, and partial Discord-post warning discarded by return redirects. Both were reproduced RED and fixed with focused tests before the final suite.
- Design ruling: full official catalog metadata opens automatically on web; Discord core facts and commands stay visible while advanced capacity/purchase details remain optional, preserving readable native cards and component limits.

- Final verification: npm test 708/708 passed, zero skipped. Real Chrome covers personal and feedback autosave/reversal, tooltip keyboard access, row alignment and 390px viewport. Independent review had no critical findings; both important findings were reproduced and fixed. No minor findings deferred.

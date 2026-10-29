# Guest platform/region auto-apply

Changing Platform / region while browsing as a guest now submits the existing GET preference form immediately. The server still validates the environment and stores the existing guest preference cookie. Detail pages switch to the chosen environment’s house list, matching the previous Browse action. Browse remains available inside noscript for browsers without JavaScript. No account, access or database changes.

Verification exercises the actual dropdown in Chrome, confirms PC EU replaces PC NA results, follows the retained environment into Tours, then verifies a clean PC NA house link infers its own environment. Existing guest privacy/media and mobile checks remain in place.

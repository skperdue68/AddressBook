# House cards: dim logo and hearts

Use the existing original gold/cream HearthBound logo on a navy cover area at reduced brightness and opacity whenever a house card has no uploaded picture. Real images always take priority. No tour placeholder is added. Compact rows retain their existing thumbnail behavior.

Move card favorites to an upper-right accessible heart: outline when unsaved, filled when saved. Keep the existing authorized, CSRF-protected in-place favorite endpoint and non-JavaScript POST fallback. Guest cards link the heart to Discord sign-in with the matching return page. Detail-page text controls remain unchanged.

Implement shared cover/guest-heart markup; add a heart variant to personalControls; preserve SVG during successful asynchronous saves; apply to search, personal and featured house cards plus guest cards. Verify fallback/photo precedence, toggle labels/state, guest return links, no tour placeholder, responsive layout and full suite before a separate PR.

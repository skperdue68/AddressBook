# House covers and statistics pages

House details now show the first gallery image beside the house identity, above the actions. The image links to the full gallery. On narrow screens it moves below the identity and fills the available width. Houses without images have no placeholder.

Search cards, compact results, My Address Book, saved/advanced searches, Random House, Featured Housing and the tour player retain their existing screenshots. This change also adds covers to tour candidates, existing and newly selected draft stops, tour route summaries, search-to-tour selection/reordering, and pending registration review. Restricted tour stops do not receive cover metadata. Image delivery continues to recheck permissions and uses private, non-cacheable responses.

Each statistics ranking displays 15 entries per page. Official house, ESO owner and community rankings have independent numbered links, Previous/Next and direct page input. Links retain the chosen metric and the other rankings' page selections, then return to the relevant ranking. Ranking data and visibility rules are unchanged.

No database migration, new dependency or Discord command registration is needed. After merging, pull the latest code and restart the existing HearthBound service.

## Existing registrations enriched on October 28, 2026

These are production data changes already applied, not seed data or a migration. All are existing shared PC NA registrations in Alphabet Mafia. Each keeps its nickname, tags, submitter and original description, with attributed showcase notes appended. Images are stored through the application's normal gallery service.

| Registration | ESO owner | Screenshots added | Public source |
| --- | --- | ---: | --- |
| 156 — The Kokedama | MoonPile | 3 | [Creator showcase](https://moonpile.tumblr.com/post/788659514638516224/the-kokedama-a-home-goods-only-build-at-the-fair) |
| 152 — The Celestial Gardens | MoonPile | 3 | [Creator showcase](https://moonpile.tumblr.com/post/784008222307729408/the-celestial-gardens-moon-sugar-meadow-eso) |
| 151 — The Blackfeather Court | MoonPile | 3 | [Creator showcase](https://moonpile.tumblr.com/post/765182952552480768/the-blackfeather-court-at-hakkvilds-high-hall) |
| 60 — The Borg | Totes1 | 1 | [Contest results](https://forums.elderscrollsonline.com/en/discussion/648405/divine-design-alliance-housing-contest-open-to-pc-na-housing-enthusiasts), screenshot credited to ZeniMax/Bethesda and Totes1 via PC Gamer |
| 148 — Halloween Town | drpeppermd87 | 3 | [Creator showcase](https://eso-hub.com/en/house-showcase/drpeppermd87/0199700a-73df-725a-beaa-1eb7e978f936/halloween-town-the-nightmare-before-christmas) |
| 150 — Super Mario Adventure! | drpeppermd87 | 3 | [Creator showcase](https://eso-hub.com/en/house-showcase/drpeppermd87/01996fef-80e8-727e-b1e8-08ef82f6d1d1/super-mario-adventure) |
| 117 — Beetlejuice! | drpeppermd87 | 3 | [Creator showcase](https://eso-hub.com/en/house-showcase/drpeppermd87/01996ff7-2e2b-708e-b737-2185b04b09e5/beetlejuice-beetlejuice-beetlejuice) |
| 145 — A Bloomin’ Blunder! | MoonPile | 3 | [Creator showcase](https://moonpile.tumblr.com/post/785996834420277249/a-bloomin-blunder-at-the-wizards-tower) |
| 155 — The Journey | MoonPile | 3 | [Creator showcase](https://moonpile.tumblr.com/post/773260354902949888/the-journey-a-druidic-reskin-of-daggerfall) |

A Bloomin’ Blunder! was corrected from Autumn's-Gate (28) to Exorcised Coven Cottage (49), following the creator's stated base house and destination. No duplicate registration or duplicate destination within a linked tour was found before correction. The Journey stays at Daggerfall Overlook (38): its creator's page names that house, but mistakenly supplies Lucky Cat Landing's ID (73). That inconsistent link was not imported.

Selected-record backups, source/image manifests and receipts are retained on the Linux host under `data/import-backups/enrichment-2026-10-28/`. Each update has an `enrich_house_showcase` audit entry. All nine live house pages and all 25 new image endpoints were verified successfully. No other registrations were changed.

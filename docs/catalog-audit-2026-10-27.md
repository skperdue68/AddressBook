# UESP housing catalog audit — October 27, 2026

Compared **120 packaged HearthBound houses** against **122 distinct houses** in the live [UESP Player Housing tables](https://en.uesp.net/wiki/Online:Player_Housing). All 122 individual house pages were checked through UESP’s public API. The main page revision is3646506; its transcluded house data comes from individual revisions recorded below. This is a comparison with the packaged source, not a claim that the Linux production database has the same contents. In particular, house131 may already exist as an owner-added record.

## Findings

- **131 Grotto of Desires**: add or complete Notable / Manor, Blackwood, Daedric/Sanguine, event-fragment acquisition. Prices and some fragment release dates remain unknown; UESP marks it prerelease/unavailable. No price is invented.
- **132 Sheogorad Chateau**: add or complete Notable / Large, Vvardenfell, Hlaalu, 10,400/13,000 Crowns. Its documented first sale was September30–October15,2026; this is not a promise it is available today.
- **95 missing subzones**, **9 existing houses missing house type**, **12 missing 3,000-gold inn-room prices**, and **7 existing houses missing known unfurnished Crown prices**.
- **17 packaged acquisition labels** no longer express known purchase routes. Corrections apply only when the live value equals the old packaged label and the row is not owner-managed.
- Fill acquisition details for Night’s Den124 and Rogue’s Refuge128.
- No existing packaged name, zone, style or classification differs from the main table. No extra unsupported house IDs are created.

## Known uncertainties

- Night’s Den124: the individual page does not establish house size. Keep its existing Large Home label for now, clearly treat it as unverified, and do not infer Manor.
- Theater of the Ancestors119: main table says Notable but individual summary says Classic. Preserve the packaged Notable classification/capacities; filling Manor Home size is independent of classification.
- IDs126,127,130 are not in UESP’s table. Gaps do not justify inventing houses.
- Blank/N/A prices do not mean free. Unknown prices remain NULL. Missing furnished prices are not derived from unfurnished prices.
- Many old availability notes on UESP refer to past sales. This update does not relabel every house as currently available/unavailable or replace those existing notes.
- Some fields, such as subzones for island homes, remain unspecified by UESP. They are not guessed.

## Apply safely

See [Linux SQL instructions](catalog-import-2026-10-27.md). Read-only preflight queries compare the prepared changes against the actual configured production database. The update statements preserve nonblank owner data, explicit per-house capacity overrides, registrations and tour links. New house capacities follow the existing classification profiles. Metadata dropdown tables are populated as well.

## Reviewed rows

Only affected fields are listed. `purchase_type (known old label)` is the conditional correction described above. Every individual revision is linked for review.

| ID | House | Changes | Individual source |
|---:|---|---|---|
| 1 | Mara's Kiss Inn Room | subzone, gold_price; purchase_type (known old label) | [revision 3520806](https://en.uesp.net/w/index.php?oldid=3520806) |
| 2 | The Rosy Lion | subzone, gold_price; purchase_type (known old label) | [revision 3520812](https://en.uesp.net/w/index.php?oldid=3520812) |
| 3 | The Ebony Flask Inn Room | subzone, gold_price; purchase_type (known old label) | [revision 3520811](https://en.uesp.net/w/index.php?oldid=3520811) |
| 4 | Barbed Hook Private Room | subzone | [revision 3520814](https://en.uesp.net/w/index.php?oldid=3520814) |
| 5 | Sisters of the Sands Apartment | subzone | [revision 3520816](https://en.uesp.net/w/index.php?oldid=3520816) |
| 6 | Flaming Nix Deluxe Garret | subzone | [revision 3520815](https://en.uesp.net/w/index.php?oldid=3520815) |
| 7 | Black Vine Villa | subzone | [revision 3520819](https://en.uesp.net/w/index.php?oldid=3520819) |
| 8 | Cliffshade | subzone | [revision 3520822](https://en.uesp.net/w/index.php?oldid=3520822) |
| 9 | Mathiisen Manor | subzone | [revision 3520865](https://en.uesp.net/w/index.php?oldid=3520865) |
| 11 | The Ample Domicile | subzone | [revision 3520844](https://en.uesp.net/w/index.php?oldid=3520844) |
| 12 | Stay-Moist Mansion | subzone | [revision 3520875](https://en.uesp.net/w/index.php?oldid=3520875) |
| 13 | Snugpod | subzone | [revision 3520843](https://en.uesp.net/w/index.php?oldid=3520843) |
| 14 | Bouldertree Refuge | subzone | [revision 3520820](https://en.uesp.net/w/index.php?oldid=3520820) |
| 15 | The Gorinir Estate | subzone | [revision 3520877](https://en.uesp.net/w/index.php?oldid=3520877) |
| 16 | Captain Margaux's Place | subzone | [revision 3520821](https://en.uesp.net/w/index.php?oldid=3520821) |
| 17 | Ravenhurst | subzone | [revision 3582860](https://en.uesp.net/w/index.php?oldid=3582860) |
| 18 | Gardner House | subzone | [revision 3520858](https://en.uesp.net/w/index.php?oldid=3520858) |
| 19 | Kragenhome | subzone | [revision 3520835](https://en.uesp.net/w/index.php?oldid=3520835) |
| 20 | Velothi Reverie | subzone | [revision 3520847](https://en.uesp.net/w/index.php?oldid=3520847) |
| 21 | Quondam Indorilia | subzone | [revision 3520873](https://en.uesp.net/w/index.php?oldid=3520873) |
| 23 | Sleek Creek House | subzone | [revision 3520842](https://en.uesp.net/w/index.php?oldid=3520842) |
| 24 | Dawnshadow | subzone | [revision 3520853](https://en.uesp.net/w/index.php?oldid=3520853) |
| 25 | Cyrodilic Jungle House | subzone | [revision 3520823](https://en.uesp.net/w/index.php?oldid=3520823) |
| 26 | Domus Phrasticus | subzone | [revision 3520824](https://en.uesp.net/w/index.php?oldid=3520824) |
| 27 | Strident Springs Demesne | subzone | [revision 3520876](https://en.uesp.net/w/index.php?oldid=3520876) |
| 28 | Autumn's-Gate | subzone | [revision 3520818](https://en.uesp.net/w/index.php?oldid=3520818) |
| 29 | Grymharth's Woe | subzone | [revision 3520830](https://en.uesp.net/w/index.php?oldid=3520830) |
| 30 | Old Mistveil Manor | subzone | [revision 3520871](https://en.uesp.net/w/index.php?oldid=3520871) |
| 31 | Hammerdeath Bungalow | subzone | [revision 3520831](https://en.uesp.net/w/index.php?oldid=3520831) |
| 32 | Mournoth Keep | subzone | [revision 3520839](https://en.uesp.net/w/index.php?oldid=3520839) |
| 33 | Forsaken Stronghold | subzone | [revision 3520857](https://en.uesp.net/w/index.php?oldid=3520857) |
| 34 | Twin Arches | subzone | [revision 3520845](https://en.uesp.net/w/index.php?oldid=3520845) |
| 35 | House of the Silent Magnifico | subzone | [revision 3520833](https://en.uesp.net/w/index.php?oldid=3520833) |
| 37 | Serenity Falls Estate | subzone | [revision 3520874](https://en.uesp.net/w/index.php?oldid=3520874) |
| 38 | Daggerfall Overlook | subzone | [revision 3520852](https://en.uesp.net/w/index.php?oldid=3520852) |
| 39 | Ebonheart Chateau | subzone | [revision 3520855](https://en.uesp.net/w/index.php?oldid=3520855) |
| 40 | Grand Topal Hideaway | subzone | [revision 3600772](https://en.uesp.net/w/index.php?oldid=3600772) |
| 41 | Earthtear Cavern | subzone | [revision 3520892](https://en.uesp.net/w/index.php?oldid=3520892) |
| 42 | Saint Delyn Penthouse | subzone, gold_price; purchase_type (known old label) | [revision 3520809](https://en.uesp.net/w/index.php?oldid=3520809) |
| 43 | Amaya Lake Lodge | subzone | [revision 3520849](https://en.uesp.net/w/index.php?oldid=3520849) |
| 44 | Ald Velothi Harbor House | subzone | [revision 3620037](https://en.uesp.net/w/index.php?oldid=3620037) |
| 45 | Tel Galen | subzone | [revision 3581869](https://en.uesp.net/w/index.php?oldid=3581869) |
| 47 | Coldharbour Surreal Estate | crown_price_unfurnished, crown_price; purchase_type (known old label) | [revision 3520851](https://en.uesp.net/w/index.php?oldid=3520851) |
| 48 | Hakkvild's High Hall | subzone | [revision 3520860](https://en.uesp.net/w/index.php?oldid=3520860) |
| 49 | Exorcised Coven Cottage | subzone | [revision 3648092](https://en.uesp.net/w/index.php?oldid=3648092) |
| 54 | Pariah's Pinnacle | subzone | [revision 3581874](https://en.uesp.net/w/index.php?oldid=3581874) |
| 58 | Golden Gryphon Garret | subzone, gold_price; purchase_type (known old label) | [revision 3520804](https://en.uesp.net/w/index.php?oldid=3520804) |
| 59 | Alinor Crest Townhouse | subzone | [revision 3520848](https://en.uesp.net/w/index.php?oldid=3520848) |
| 61 | Hunter's Glade | subzone | [revision 3581868](https://en.uesp.net/w/index.php?oldid=3581868) |
| 63 | Enchanted Snow Globe Home | subzone | [revision 3520894](https://en.uesp.net/w/index.php?oldid=3520894) |
| 65 | Frostvault Chasm | subzone | [revision 3581863](https://en.uesp.net/w/index.php?oldid=3581863) |
| 66 | Elinhir Private Arena | subzone | [revision 3581871](https://en.uesp.net/w/index.php?oldid=3581871) |
| 68 | Sugar Bowl Suite | subzone, gold_price; purchase_type (known old label) | [revision 3519401](https://en.uesp.net/w/index.php?oldid=3519401) |
| 69 | Jode's Embrace | subzone | [revision 3621938](https://en.uesp.net/w/index.php?oldid=3621938) |
| 70 | Hall of the Lunar Champion | subzone | [revision 3520861](https://en.uesp.net/w/index.php?oldid=3520861) |
| 71 | Moon-Sugar Meadow | subzone, crown_price_unfurnished, crown_price, purchase_type | [revision 3520906](https://en.uesp.net/w/index.php?oldid=3520906) |
| 72 | Wraithhome | subzone | [revision 3520933](https://en.uesp.net/w/index.php?oldid=3520933) |
| 75 | Forgemaster Falls | subzone | [revision 3535062](https://en.uesp.net/w/index.php?oldid=3535062) |
| 76 | Thieves' Oasis | subzone | [revision 3588569](https://en.uesp.net/w/index.php?oldid=3588569) |
| 77 | Snowmelt Suite | subzone, gold_price; purchase_type (known old label) | [revision 3520810](https://en.uesp.net/w/index.php?oldid=3520810) |
| 78 | Proudspire Manor | subzone | [revision 3520872](https://en.uesp.net/w/index.php?oldid=3520872) |
| 79 | Bastion Sanguinaris | subzone | [revision 3654234](https://en.uesp.net/w/index.php?oldid=3654234) |
| 80 | Stillwaters Retreat | subzone, crown_price_unfurnished, crown_price, purchase_type | [revision 3520919](https://en.uesp.net/w/index.php?oldid=3520919) |
| 81 | Antiquarian's Alpine Gallery | subzone, crown_price_unfurnished, crown_price; purchase_type (known old label) | [revision 3520882](https://en.uesp.net/w/index.php?oldid=3520882) |
| 82 | Shalidor's Shrouded Realm | subzone | [revision 3548092](https://en.uesp.net/w/index.php?oldid=3548092) |
| 85 | Kushalit Sanctuary | subzone | [revision 3548735](https://en.uesp.net/w/index.php?oldid=3548735) |
| 87 | Pilgrim's Rest | subzone, gold_price; purchase_type (known old label) | [revision 3520807](https://en.uesp.net/w/index.php?oldid=3520807) |
| 88 | Water's Edge | subzone | [revision 3520879](https://en.uesp.net/w/index.php?oldid=3520879) |
| 89 | Pantherfang Chapel | subzone | [revision 3548200](https://en.uesp.net/w/index.php?oldid=3548200) |
| 90 | Doomchar Plateau | subzone | [revision 3520854](https://en.uesp.net/w/index.php?oldid=3520854) |
| 91 | Sweetwater Cascades | subzone | [revision 3520922](https://en.uesp.net/w/index.php?oldid=3520922) |
| 92 | Ossa Accentium | subzone | [revision 3581873](https://en.uesp.net/w/index.php?oldid=3581873) |
| 93 | Agony's Ascent | subzone | [revision 3520881](https://en.uesp.net/w/index.php?oldid=3520881) |
| 95 | Ancient Anchor Berth | subzone, gold_price; purchase_type (known old label) | [revision 3519904](https://en.uesp.net/w/index.php?oldid=3519904) |
| 96 | Highhallow Hold | subzone | [revision 3581872](https://en.uesp.net/w/index.php?oldid=3581872) |
| 98 | Fogbreak Lighthouse | subzone | [revision 3520895](https://en.uesp.net/w/index.php?oldid=3520895) |
| 99 | The Fair Winds | subzone | [revision 3636397](https://en.uesp.net/w/index.php?oldid=3636397) |
| 100 | Journey's End Lodgings | subzone, gold_price; purchase_type (known old label) | [revision 3520805](https://en.uesp.net/w/index.php?oldid=3520805) |
| 101 | Emissary's Enclave | subzone | [revision 3520856](https://en.uesp.net/w/index.php?oldid=3520856) |
| 103 | Sword-Singer's Redoubt | subzone | [revision 3581881](https://en.uesp.net/w/index.php?oldid=3581881) |
| 104 | Kelesan'ruhn | subzone | [revision 3581885](https://en.uesp.net/w/index.php?oldid=3581885) |
| 106 | Tower of Unutterable Truths | subzone | [revision 3520930](https://en.uesp.net/w/index.php?oldid=3520930) |
| 109 | Rosewine Retreat | subzone, gold_price; purchase_type (known old label) | [revision 3520808](https://en.uesp.net/w/index.php?oldid=3520808) |
| 110 | Merryvine Estate | subzone | [revision 3530633](https://en.uesp.net/w/index.php?oldid=3530633) |
| 111 | Seabloom Villa | subzone, house_type | [revision 3629315](https://en.uesp.net/w/index.php?oldid=3629315) |
| 112 | Haven of the Five Companions | subzone | [revision 3520862](https://en.uesp.net/w/index.php?oldid=3520862) |
| 113 | Kthendral Deep Mines | subzone | [revision 3605760](https://en.uesp.net/w/index.php?oldid=3605760) |
| 115 | Shattered Mirror Isle | subzone, crown_price_unfurnished, crown_price; purchase_type (known old label) | [revision 3581891](https://en.uesp.net/w/index.php?oldid=3581891) |
| 116 | Castle Skingrad | subzone | [revision 3559327](https://en.uesp.net/w/index.php?oldid=3559327) |
| 117 | Bismuth Steam Baths | subzone | [revision 3520850](https://en.uesp.net/w/index.php?oldid=3520850) |
| 118 | The Sleepy Sloth | subzone, house_type, gold_price; purchase_type (known old label) | [revision 3520813](https://en.uesp.net/w/index.php?oldid=3520813) |
| 119 | Theater of the Ancestors | subzone, house_type | [revision 3570817](https://en.uesp.net/w/index.php?oldid=3570817) |
| 120 | Hiddenspring Cottage | house_type | [revision 3581866](https://en.uesp.net/w/index.php?oldid=3581866) |
| 121 | Wildgrown Chapel of Julianos | house_type | [revision 3530651](https://en.uesp.net/w/index.php?oldid=3530651) |
| 122 | Cradle of the Worm Colossus | subzone, house_type | [revision 3574798](https://en.uesp.net/w/index.php?oldid=3574798) |
| 123 | Druidspring Conservatory | subzone, house_type, crown_price_unfurnished, crown_price; purchase_type (known old label) | [revision 3574800](https://en.uesp.net/w/index.php?oldid=3574800) |
| 124 | Night's Den | subzone, purchase_type, requirements, availability | [revision 3581852](https://en.uesp.net/w/index.php?oldid=3581852) |
| 125 | Buccaneer Bay | house_type | [revision 3550778](https://en.uesp.net/w/index.php?oldid=3550778) |
| 128 | Rogue's Refuge | subzone, purchase_type, requirements, availability | [revision 3593434](https://en.uesp.net/w/index.php?oldid=3593434) |
| 129 | Dancing Waters Wellspring | house_type, crown_price_unfurnished, crown_price; purchase_type (known old label) | [revision 3585631](https://en.uesp.net/w/index.php?oldid=3585631) |
| 131 | Grotto of Desires | New house; house_type, zone, classification, style, category, uesp_url, purchase_type, requirements, availability | [revision 3658249](https://en.uesp.net/w/index.php?oldid=3658249) |
| 132 | Sheogorad Chateau | New house; house_type, crown_price_unfurnished, crown_price_furnished, crown_price, purchase_type, zone, classification, style, category, uesp_url, requirements, availability | [revision 3643417](https://en.uesp.net/w/index.php?oldid=3643417) |

## Data and attribution

The machine-readable [review dataset](../src/db/catalog-updates/uesp-2026-10-27.json) contains the verified factual additions, expected old labels and source revision links. Requirements are summarized, not copied as wiki prose. Source: UESP contributors, [Player Housing](https://en.uesp.net/wiki/Online:Player_Housing) and the linked individual house pages. Raw HTML, API responses, furnishing lists, and images are not included in the repository.

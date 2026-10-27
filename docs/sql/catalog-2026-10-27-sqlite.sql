-- HearthBound catalog review 2026-10-27. Source: https://en.uesp.net/wiki/Online:Player_Housing
-- Requires migrated schema >=13. Back up the actual Linux database first.
-- Fills missing fields. Known packaged purchase labels are corrected only for non-owner-managed houses.
-- Existing nonblank custom values, registrations, tours and explicit capacity overrides are retained.
-- Stop on errors (sqlite3 -bail; do not use mariadb --force). A conflicting new house ID aborts before updates.
BEGIN IMMEDIATE;
CREATE TEMP TABLE _hearthbound_catalog_guard_20261027 (ok INTEGER NOT NULL CHECK(ok=1));
INSERT INTO _hearthbound_catalog_guard_20261027(ok) SELECT CASE WHEN EXISTS (SELECT 1 FROM houses WHERE (house_id=131 AND LOWER(TRIM(name))<>LOWER('Grotto of Desires')) OR (house_id=132 AND LOWER(TRIM(name))<>LOWER('Sheogorad Chateau'))) THEN 0 ELSE 1 END;

-- #1 Mara's Kiss Inn Room. Evidence: https://en.uesp.net/w/index.php?oldid=3520806
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Iluvamir' ELSE subzone END,gold_price=CASE WHEN gold_price IS NULL THEN 3000 ELSE gold_price END,purchase_type=CASE WHEN ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))) THEN 'Quest or Gold' ELSE purchase_type END WHERE house_id=1 AND ((subzone IS NULL OR TRIM(subzone)='') OR gold_price IS NULL OR ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))));

-- #2 The Rosy Lion. Evidence: https://en.uesp.net/w/index.php?oldid=3520812
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Daenia' ELSE subzone END,gold_price=CASE WHEN gold_price IS NULL THEN 3000 ELSE gold_price END,purchase_type=CASE WHEN ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))) THEN 'Quest or Gold' ELSE purchase_type END WHERE house_id=2 AND ((subzone IS NULL OR TRIM(subzone)='') OR gold_price IS NULL OR ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))));

-- #3 The Ebony Flask Inn Room. Evidence: https://en.uesp.net/w/index.php?oldid=3520811
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Zabamat' ELSE subzone END,gold_price=CASE WHEN gold_price IS NULL THEN 3000 ELSE gold_price END,purchase_type=CASE WHEN ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))) THEN 'Quest or Gold' ELSE purchase_type END WHERE house_id=3 AND ((subzone IS NULL OR TRIM(subzone)='') OR gold_price IS NULL OR ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))));

-- #4 Barbed Hook Private Room. Evidence: https://en.uesp.net/w/index.php?oldid=3520814
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Calambar' ELSE subzone END WHERE house_id=4 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #5 Sisters of the Sands Apartment. Evidence: https://en.uesp.net/w/index.php?oldid=3520816
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Myrkwasa' ELSE subzone END WHERE house_id=5 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #6 Flaming Nix Deluxe Garret. Evidence: https://en.uesp.net/w/index.php?oldid=3520815
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Lagomere' ELSE subzone END WHERE house_id=6 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #7 Black Vine Villa. Evidence: https://en.uesp.net/w/index.php?oldid=3520819
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Silvenar Vale' ELSE subzone END WHERE house_id=7 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #8 Cliffshade. Evidence: https://en.uesp.net/w/index.php?oldid=3520822
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Wilderking Court' ELSE subzone END WHERE house_id=8 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #9 Mathiisen Manor. Evidence: https://en.uesp.net/w/index.php?oldid=3520865
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Calambar' ELSE subzone END WHERE house_id=9 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #11 The Ample Domicile. Evidence: https://en.uesp.net/w/index.php?oldid=3520844
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Reticulated Spine' ELSE subzone END WHERE house_id=11 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #12 Stay-Moist Mansion. Evidence: https://en.uesp.net/w/index.php?oldid=3520875
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Leafwater' ELSE subzone END WHERE house_id=12 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #13 Snugpod. Evidence: https://en.uesp.net/w/index.php?oldid=3520843
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Green Hall' ELSE subzone END WHERE house_id=13 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #14 Bouldertree Refuge. Evidence: https://en.uesp.net/w/index.php?oldid=3520820
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Drowned Coast' ELSE subzone END WHERE house_id=14 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #15 The Gorinir Estate. Evidence: https://en.uesp.net/w/index.php?oldid=3520877
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Green Hall' ELSE subzone END WHERE house_id=15 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #16 Captain Margaux's Place. Evidence: https://en.uesp.net/w/index.php?oldid=3520821
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Daenia' ELSE subzone END WHERE house_id=16 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #17 Ravenhurst. Evidence: https://en.uesp.net/w/index.php?oldid=3582860
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Westmark Moor' ELSE subzone END WHERE house_id=17 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #18 Gardner House. Evidence: https://en.uesp.net/w/index.php?oldid=3520858
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Menevia' ELSE subzone END WHERE house_id=18 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #19 Kragenhome. Evidence: https://en.uesp.net/w/index.php?oldid=3520835
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Varanis' ELSE subzone END WHERE house_id=19 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #20 Velothi Reverie. Evidence: https://en.uesp.net/w/index.php?oldid=3520847
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Redolent Loam' ELSE subzone END WHERE house_id=20 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #21 Quondam Indorilia. Evidence: https://en.uesp.net/w/index.php?oldid=3520873
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Redolent Loam' ELSE subzone END WHERE house_id=21 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #23 Sleek Creek House. Evidence: https://en.uesp.net/w/index.php?oldid=3520842
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Jodewood' ELSE subzone END WHERE house_id=23 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #24 Dawnshadow. Evidence: https://en.uesp.net/w/index.php?oldid=3520853
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Dawnmead' ELSE subzone END WHERE house_id=24 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #25 Cyrodilic Jungle House. Evidence: https://en.uesp.net/w/index.php?oldid=3520823
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Silvenar Vale' ELSE subzone END WHERE house_id=25 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #26 Domus Phrasticus. Evidence: https://en.uesp.net/w/index.php?oldid=3520824
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Elinhir Region' ELSE subzone END WHERE house_id=26 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #27 Strident Springs Demesne. Evidence: https://en.uesp.net/w/index.php?oldid=3520876
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Northern Woods' ELSE subzone END WHERE house_id=27 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #28 Autumn's-Gate. Evidence: https://en.uesp.net/w/index.php?oldid=3520818
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Ragged Hills' ELSE subzone END WHERE house_id=28 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #29 Grymharth's Woe. Evidence: https://en.uesp.net/w/index.php?oldid=3520830
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Giant''s Run' ELSE subzone END WHERE house_id=29 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #30 Old Mistveil Manor. Evidence: https://en.uesp.net/w/index.php?oldid=3520871
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Smokefrost Peaks' ELSE subzone END WHERE house_id=30 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #31 Hammerdeath Bungalow. Evidence: https://en.uesp.net/w/index.php?oldid=3520831
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Menevia' ELSE subzone END WHERE house_id=31 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #32 Mournoth Keep. Evidence: https://en.uesp.net/w/index.php?oldid=3520839
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Mournoth' ELSE subzone END WHERE house_id=32 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #33 Forsaken Stronghold. Evidence: https://en.uesp.net/w/index.php?oldid=3520857
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Mournoth' ELSE subzone END WHERE house_id=33 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #34 Twin Arches. Evidence: https://en.uesp.net/w/index.php?oldid=3520845
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Fallen Wastes' ELSE subzone END WHERE house_id=34 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #35 House of the Silent Magnifico. Evidence: https://en.uesp.net/w/index.php?oldid=3520833
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Myrkwasa' ELSE subzone END WHERE house_id=35 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #37 Serenity Falls Estate. Evidence: https://en.uesp.net/w/index.php?oldid=3520874
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Dawnmead' ELSE subzone END WHERE house_id=37 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #38 Daggerfall Overlook. Evidence: https://en.uesp.net/w/index.php?oldid=3520852
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Daenia' ELSE subzone END WHERE house_id=38 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #39 Ebonheart Chateau. Evidence: https://en.uesp.net/w/index.php?oldid=3520855
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Daen Seeth' ELSE subzone END WHERE house_id=39 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #40 Grand Topal Hideaway. Evidence: https://en.uesp.net/w/index.php?oldid=3600772
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Long Coast' ELSE subzone END WHERE house_id=40 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #41 Earthtear Cavern. Evidence: https://en.uesp.net/w/index.php?oldid=3520892
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Belkarth Region' ELSE subzone END WHERE house_id=41 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #42 Saint Delyn Penthouse. Evidence: https://en.uesp.net/w/index.php?oldid=3520809
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Ascadian Isles' ELSE subzone END,gold_price=CASE WHEN gold_price IS NULL THEN 3000 ELSE gold_price END,purchase_type=CASE WHEN ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))) THEN 'Quest or Gold' ELSE purchase_type END WHERE house_id=42 AND ((subzone IS NULL OR TRIM(subzone)='') OR gold_price IS NULL OR ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))));

-- #43 Amaya Lake Lodge. Evidence: https://en.uesp.net/w/index.php?oldid=3520849
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Ascadian Isles' ELSE subzone END WHERE house_id=43 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #44 Ald Velothi Harbor House. Evidence: https://en.uesp.net/w/index.php?oldid=3620037
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'West Gash' ELSE subzone END WHERE house_id=44 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #45 Tel Galen. Evidence: https://en.uesp.net/w/index.php?oldid=3581869
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Azura''s Coast' ELSE subzone END WHERE house_id=45 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #47 Coldharbour Surreal Estate. Evidence: https://en.uesp.net/w/index.php?oldid=3520851
UPDATE houses SET last_verified='2026-10-27',crown_price_unfurnished=CASE WHEN crown_price_unfurnished IS NULL THEN 5600 ELSE crown_price_unfurnished END,crown_price=CASE WHEN crown_price IS NULL THEN 5600 ELSE crown_price END,purchase_type=CASE WHEN ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Gold' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))) THEN 'Gold or Crowns' ELSE purchase_type END WHERE house_id=47 AND (crown_price_unfurnished IS NULL OR crown_price IS NULL OR ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Gold' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))));

-- #48 Hakkvild's High Hall. Evidence: https://en.uesp.net/w/index.php?oldid=3520860
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Elinhir Region' ELSE subzone END WHERE house_id=48 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #49 Exorcised Coven Cottage. Evidence: https://en.uesp.net/w/index.php?oldid=3648092
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Cambray Hills' ELSE subzone END WHERE house_id=49 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #54 Pariah's Pinnacle. Evidence: https://en.uesp.net/w/index.php?oldid=3581874
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Icy Shore' ELSE subzone END WHERE house_id=54 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #58 Golden Gryphon Garret. Evidence: https://en.uesp.net/w/index.php?oldid=3520804
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Alinor' ELSE subzone END,gold_price=CASE WHEN gold_price IS NULL THEN 3000 ELSE gold_price END,purchase_type=CASE WHEN ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))) THEN 'Quest or Gold' ELSE purchase_type END WHERE house_id=58 AND ((subzone IS NULL OR TRIM(subzone)='') OR gold_price IS NULL OR ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))));

-- #59 Alinor Crest Townhouse. Evidence: https://en.uesp.net/w/index.php?oldid=3520848
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Alinor' ELSE subzone END WHERE house_id=59 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #61 Hunter's Glade. Evidence: https://en.uesp.net/w/index.php?oldid=3581868
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Smokefrost Peaks' ELSE subzone END WHERE house_id=61 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #63 Enchanted Snow Globe Home. Evidence: https://en.uesp.net/w/index.php?oldid=3520894
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Giant''s Run' ELSE subzone END WHERE house_id=63 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #65 Frostvault Chasm. Evidence: https://en.uesp.net/w/index.php?oldid=3581863
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Giant''s Run' ELSE subzone END WHERE house_id=65 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #66 Elinhir Private Arena. Evidence: https://en.uesp.net/w/index.php?oldid=3581871
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Elinhir Region' ELSE subzone END WHERE house_id=66 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #68 Sugar Bowl Suite. Evidence: https://en.uesp.net/w/index.php?oldid=3519401
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Tenmar Borderlands' ELSE subzone END,gold_price=CASE WHEN gold_price IS NULL THEN 3000 ELSE gold_price END,purchase_type=CASE WHEN ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))) THEN 'Quest or Gold' ELSE purchase_type END WHERE house_id=68 AND ((subzone IS NULL OR TRIM(subzone)='') OR gold_price IS NULL OR ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))));

-- #69 Jode's Embrace. Evidence: https://en.uesp.net/w/index.php?oldid=3621938
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'High Savannah' ELSE subzone END WHERE house_id=69 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #70 Hall of the Lunar Champion. Evidence: https://en.uesp.net/w/index.php?oldid=3520861
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Tenmar Borderlands' ELSE subzone END WHERE house_id=70 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #71 Moon-Sugar Meadow. Evidence: https://en.uesp.net/w/index.php?oldid=3520906
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Tenmar Borderlands' ELSE subzone END,crown_price_unfurnished=CASE WHEN crown_price_unfurnished IS NULL THEN 6400 ELSE crown_price_unfurnished END,crown_price=CASE WHEN crown_price IS NULL THEN 6400 ELSE crown_price END,purchase_type=CASE WHEN (purchase_type IS NULL OR TRIM(purchase_type)='') THEN 'Crowns / special availability' ELSE purchase_type END WHERE house_id=71 AND ((subzone IS NULL OR TRIM(subzone)='') OR crown_price_unfurnished IS NULL OR crown_price IS NULL OR (purchase_type IS NULL OR TRIM(purchase_type)=''));

-- #72 Wraithhome. Evidence: https://en.uesp.net/w/index.php?oldid=3520933
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Westmark Moor' ELSE subzone END WHERE house_id=72 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #75 Forgemaster Falls. Evidence: https://en.uesp.net/w/index.php?oldid=3535062
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Morkul Plain' ELSE subzone END WHERE house_id=75 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #76 Thieves' Oasis. Evidence: https://en.uesp.net/w/index.php?oldid=3588569
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Fallen Wastes' ELSE subzone END WHERE house_id=76 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #77 Snowmelt Suite. Evidence: https://en.uesp.net/w/index.php?oldid=3520810
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Haafingar' ELSE subzone END,gold_price=CASE WHEN gold_price IS NULL THEN 3000 ELSE gold_price END,purchase_type=CASE WHEN ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))) THEN 'Quest or Gold' ELSE purchase_type END WHERE house_id=77 AND ((subzone IS NULL OR TRIM(subzone)='') OR gold_price IS NULL OR ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))));

-- #78 Proudspire Manor. Evidence: https://en.uesp.net/w/index.php?oldid=3520872
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Haafingar' ELSE subzone END WHERE house_id=78 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #79 Bastion Sanguinaris. Evidence: https://en.uesp.net/w/index.php?oldid=3654234
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Greymoor Cavern' ELSE subzone END WHERE house_id=79 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #80 Stillwaters Retreat. Evidence: https://en.uesp.net/w/index.php?oldid=3520919
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Hjaalmarch' ELSE subzone END,crown_price_unfurnished=CASE WHEN crown_price_unfurnished IS NULL THEN 7000 ELSE crown_price_unfurnished END,crown_price=CASE WHEN crown_price IS NULL THEN 7000 ELSE crown_price END,purchase_type=CASE WHEN (purchase_type IS NULL OR TRIM(purchase_type)='') THEN 'Crowns / special availability' ELSE purchase_type END WHERE house_id=80 AND ((subzone IS NULL OR TRIM(subzone)='') OR crown_price_unfurnished IS NULL OR crown_price IS NULL OR (purchase_type IS NULL OR TRIM(purchase_type)=''));

-- #81 Antiquarian's Alpine Gallery. Evidence: https://en.uesp.net/w/index.php?oldid=3520882
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Hjaalmarch' ELSE subzone END,crown_price_unfurnished=CASE WHEN crown_price_unfurnished IS NULL THEN 7000 ELSE crown_price_unfurnished END,crown_price=CASE WHEN crown_price IS NULL THEN 7000 ELSE crown_price END,purchase_type=CASE WHEN ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))) THEN 'Crowns / special availability' ELSE purchase_type END WHERE house_id=81 AND ((subzone IS NULL OR TRIM(subzone)='') OR crown_price_unfurnished IS NULL OR crown_price IS NULL OR ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))));

-- #82 Shalidor's Shrouded Realm. Evidence: https://en.uesp.net/w/index.php?oldid=3548092
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Hjaalmarch' ELSE subzone END WHERE house_id=82 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #85 Kushalit Sanctuary. Evidence: https://en.uesp.net/w/index.php?oldid=3548735
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Ashlands' ELSE subzone END WHERE house_id=85 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #87 Pilgrim's Rest. Evidence: https://en.uesp.net/w/index.php?oldid=3520807
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Niben Forest' ELSE subzone END,gold_price=CASE WHEN gold_price IS NULL THEN 3000 ELSE gold_price END,purchase_type=CASE WHEN ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))) THEN 'Quest or Gold' ELSE purchase_type END WHERE house_id=87 AND ((subzone IS NULL OR TRIM(subzone)='') OR gold_price IS NULL OR ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))));

-- #88 Water's Edge. Evidence: https://en.uesp.net/w/index.php?oldid=3520879
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Niben Forest' ELSE subzone END WHERE house_id=88 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #89 Pantherfang Chapel. Evidence: https://en.uesp.net/w/index.php?oldid=3548200
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Blackwood Bog' ELSE subzone END WHERE house_id=89 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #90 Doomchar Plateau. Evidence: https://en.uesp.net/w/index.php?oldid=3520854
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Broken Coast' ELSE subzone END WHERE house_id=90 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #91 Sweetwater Cascades. Evidence: https://en.uesp.net/w/index.php?oldid=3520922
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Niben Forest' ELSE subzone END WHERE house_id=91 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #92 Ossa Accentium. Evidence: https://en.uesp.net/w/index.php?oldid=3581873
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Fargrave' ELSE subzone END WHERE house_id=92 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #93 Agony's Ascent. Evidence: https://en.uesp.net/w/index.php?oldid=3520881
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'The Sever' ELSE subzone END WHERE house_id=93 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #95 Ancient Anchor Berth. Evidence: https://en.uesp.net/w/index.php?oldid=3519904
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Sapphire Coast' ELSE subzone END,gold_price=CASE WHEN gold_price IS NULL THEN 3000 ELSE gold_price END,purchase_type=CASE WHEN ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))) THEN 'Quest or Gold' ELSE purchase_type END WHERE house_id=95 AND ((subzone IS NULL OR TRIM(subzone)='') OR gold_price IS NULL OR ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))));

-- #96 Highhallow Hold. Evidence: https://en.uesp.net/w/index.php?oldid=3581872
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Sapphire Coast' ELSE subzone END WHERE house_id=96 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #98 Fogbreak Lighthouse. Evidence: https://en.uesp.net/w/index.php?oldid=3520895
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Oakenvald' ELSE subzone END WHERE house_id=98 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #99 The Fair Winds. Evidence: https://en.uesp.net/w/index.php?oldid=3636397
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Vastyr' ELSE subzone END WHERE house_id=99 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #100 Journey's End Lodgings. Evidence: https://en.uesp.net/w/index.php?oldid=3520805
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Padomaic Crest' ELSE subzone END,gold_price=CASE WHEN gold_price IS NULL THEN 3000 ELSE gold_price END,purchase_type=CASE WHEN ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))) THEN 'Quest or Gold' ELSE purchase_type END WHERE house_id=100 AND ((subzone IS NULL OR TRIM(subzone)='') OR gold_price IS NULL OR ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))));

-- #101 Emissary's Enclave. Evidence: https://en.uesp.net/w/index.php?oldid=3520856
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Necrom' ELSE subzone END WHERE house_id=101 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #103 Sword-Singer's Redoubt. Evidence: https://en.uesp.net/w/index.php?oldid=3581881
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Tigonus' ELSE subzone END WHERE house_id=103 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #104 Kelesan'ruhn. Evidence: https://en.uesp.net/w/index.php?oldid=3581885
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Fungal Lowlands' ELSE subzone END WHERE house_id=104 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #106 Tower of Unutterable Truths. Evidence: https://en.uesp.net/w/index.php?oldid=3520930
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Endless Library' ELSE subzone END WHERE house_id=106 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #109 Rosewine Retreat. Evidence: https://en.uesp.net/w/index.php?oldid=3520808
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Gold Road' ELSE subzone END,gold_price=CASE WHEN gold_price IS NULL THEN 3000 ELSE gold_price END,purchase_type=CASE WHEN ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))) THEN 'Quest or Gold' ELSE purchase_type END WHERE house_id=109 AND ((subzone IS NULL OR TRIM(subzone)='') OR gold_price IS NULL OR ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))));

-- #110 Merryvine Estate. Evidence: https://en.uesp.net/w/index.php?oldid=3530633
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Colovian Highlands' ELSE subzone END WHERE house_id=110 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #111 Seabloom Villa. Evidence: https://en.uesp.net/w/index.php?oldid=3629315
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Iluvamir' ELSE subzone END,house_type=CASE WHEN (house_type IS NULL OR TRIM(house_type)='') THEN 'Medium Home' ELSE house_type END WHERE house_id=111 AND ((subzone IS NULL OR TRIM(subzone)='') OR (house_type IS NULL OR TRIM(house_type)=''));

-- #112 Haven of the Five Companions. Evidence: https://en.uesp.net/w/index.php?oldid=3520862
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Colovian Highlands' ELSE subzone END WHERE house_id=112 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #113 Kthendral Deep Mines. Evidence: https://en.uesp.net/w/index.php?oldid=3605760
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Dark Moon Grotto' ELSE subzone END WHERE house_id=113 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #115 Shattered Mirror Isle. Evidence: https://en.uesp.net/w/index.php?oldid=3581891
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Fargrave City District' ELSE subzone END,crown_price_unfurnished=CASE WHEN crown_price_unfurnished IS NULL THEN 8000 ELSE crown_price_unfurnished END,crown_price=CASE WHEN crown_price IS NULL THEN 8000 ELSE crown_price END,purchase_type=CASE WHEN ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))) THEN 'Crowns / special availability' ELSE purchase_type END WHERE house_id=115 AND ((subzone IS NULL OR TRIM(subzone)='') OR crown_price_unfurnished IS NULL OR crown_price IS NULL OR ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))));

-- #116 Castle Skingrad. Evidence: https://en.uesp.net/w/index.php?oldid=3559327
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'The Gold Road' ELSE subzone END WHERE house_id=116 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #117 Bismuth Steam Baths. Evidence: https://en.uesp.net/w/index.php?oldid=3520850
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Western Solstice' ELSE subzone END WHERE house_id=117 AND ((subzone IS NULL OR TRIM(subzone)=''));

-- #118 The Sleepy Sloth. Evidence: https://en.uesp.net/w/index.php?oldid=3520813
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Western Solstice' ELSE subzone END,house_type=CASE WHEN (house_type IS NULL OR TRIM(house_type)='') THEN 'Inn Room' ELSE house_type END,gold_price=CASE WHEN gold_price IS NULL THEN 3000 ELSE gold_price END,purchase_type=CASE WHEN ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))) THEN 'Quest or Gold' ELSE purchase_type END WHERE house_id=118 AND ((subzone IS NULL OR TRIM(subzone)='') OR (house_type IS NULL OR TRIM(house_type)='') OR gold_price IS NULL OR ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))));

-- #119 Theater of the Ancestors. Evidence: https://en.uesp.net/w/index.php?oldid=3570817
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Niben Forest' ELSE subzone END,house_type=CASE WHEN (house_type IS NULL OR TRIM(house_type)='') THEN 'Manor Home' ELSE house_type END WHERE house_id=119 AND ((subzone IS NULL OR TRIM(subzone)='') OR (house_type IS NULL OR TRIM(house_type)=''));

-- #120 Hiddenspring Cottage. Evidence: https://en.uesp.net/w/index.php?oldid=3581866
UPDATE houses SET last_verified='2026-10-27',house_type=CASE WHEN (house_type IS NULL OR TRIM(house_type)='') THEN 'Medium Home' ELSE house_type END WHERE house_id=120 AND ((house_type IS NULL OR TRIM(house_type)=''));

-- #121 Wildgrown Chapel of Julianos. Evidence: https://en.uesp.net/w/index.php?oldid=3530651
UPDATE houses SET last_verified='2026-10-27',house_type=CASE WHEN (house_type IS NULL OR TRIM(house_type)='') THEN 'Manor Home' ELSE house_type END WHERE house_id=121 AND ((house_type IS NULL OR TRIM(house_type)=''));

-- #122 Cradle of the Worm Colossus. Evidence: https://en.uesp.net/w/index.php?oldid=3574798
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Eastern Solstice' ELSE subzone END,house_type=CASE WHEN (house_type IS NULL OR TRIM(house_type)='') THEN 'Manor Home' ELSE house_type END WHERE house_id=122 AND ((subzone IS NULL OR TRIM(subzone)='') OR (house_type IS NULL OR TRIM(house_type)=''));

-- #123 Druidspring Conservatory. Evidence: https://en.uesp.net/w/index.php?oldid=3574800
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Oakenvald' ELSE subzone END,house_type=CASE WHEN (house_type IS NULL OR TRIM(house_type)='') THEN 'Manor Home' ELSE house_type END,crown_price_unfurnished=CASE WHEN crown_price_unfurnished IS NULL THEN 8000 ELSE crown_price_unfurnished END,crown_price=CASE WHEN crown_price IS NULL THEN 8000 ELSE crown_price END,purchase_type=CASE WHEN ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))) THEN 'Crowns / special availability' ELSE purchase_type END WHERE house_id=123 AND ((subzone IS NULL OR TRIM(subzone)='') OR (house_type IS NULL OR TRIM(house_type)='') OR crown_price_unfurnished IS NULL OR crown_price IS NULL OR ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))));

-- #124 Night's Den. Evidence: https://en.uesp.net/w/index.php?oldid=3581852
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'Night Market' ELSE subzone END,purchase_type=CASE WHEN (purchase_type IS NULL OR TRIM(purchase_type)='') THEN 'Quest, event, promotion, or special acquisition' ELSE purchase_type END,requirements=CASE WHEN (requirements IS NULL OR TRIM(requirements)='') THEN 'Complete Those Who Would Rule while the Night Market is open. The reward is furnished; no unfurnished version is listed.' ELSE requirements END,availability=CASE WHEN (availability IS NULL OR TRIM(availability)='') THEN 'Acquisition is tied to Night Market seasons; owned houses remain accessible afterward.' ELSE availability END WHERE house_id=124 AND ((subzone IS NULL OR TRIM(subzone)='') OR (purchase_type IS NULL OR TRIM(purchase_type)='') OR (requirements IS NULL OR TRIM(requirements)='') OR (availability IS NULL OR TRIM(availability)=''));

-- #125 Buccaneer Bay. Evidence: https://en.uesp.net/w/index.php?oldid=3550778
UPDATE houses SET last_verified='2026-10-27',house_type=CASE WHEN (house_type IS NULL OR TRIM(house_type)='') THEN 'Manor Home' ELSE house_type END WHERE house_id=125 AND ((house_type IS NULL OR TRIM(house_type)=''));

-- #128 Rogue's Refuge. Evidence: https://en.uesp.net/w/index.php?oldid=3593434
UPDATE houses SET last_verified='2026-10-27',subzone=CASE WHEN (subzone IS NULL OR TRIM(subzone)='') THEN 'King''s Guard' ELSE subzone END,purchase_type=CASE WHEN (purchase_type IS NULL OR TRIM(purchase_type)='') THEN 'Quest, event, promotion, or special acquisition' ELSE purchase_type END,requirements=CASE WHEN (requirements IS NULL OR TRIM(requirements)='') THEN 'Collect and use four notes: Wherenow Code Key (A Guild Grows In Glenumbra), Indecipherable Sai Note (Thieves Troves or Safeboxes), Baffling Baan Dar Note (Dynamic Encounter rewards), and Mysterious Nocturnal Note (Thieves Guild Heist rewards).' ELSE requirements END,availability=CASE WHEN (availability IS NULL OR TRIM(availability)='') THEN 'Earned by collecting all four required notes.' ELSE availability END WHERE house_id=128 AND ((subzone IS NULL OR TRIM(subzone)='') OR (purchase_type IS NULL OR TRIM(purchase_type)='') OR (requirements IS NULL OR TRIM(requirements)='') OR (availability IS NULL OR TRIM(availability)=''));

-- #129 Dancing Waters Wellspring. Evidence: https://en.uesp.net/w/index.php?oldid=3585631
UPDATE houses SET last_verified='2026-10-27',house_type=CASE WHEN (house_type IS NULL OR TRIM(house_type)='') THEN 'Large Home' ELSE house_type END,crown_price_unfurnished=CASE WHEN crown_price_unfurnished IS NULL THEN 8000 ELSE crown_price_unfurnished END,crown_price=CASE WHEN crown_price IS NULL THEN 8000 ELSE crown_price END,purchase_type=CASE WHEN ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))) THEN 'Crowns / special availability' ELSE purchase_type END WHERE house_id=129 AND ((house_type IS NULL OR TRIM(house_type)='') OR crown_price_unfurnished IS NULL OR crown_price IS NULL OR ((purchase_type IS NULL OR TRIM(purchase_type)='') OR (purchase_type='Quest, event, promotion, or special acquisition' AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id))));

-- #131 Grotto of Desires. Evidence: https://en.uesp.net/w/index.php?oldid=3658249
INSERT INTO houses(house_id,name,normalized_name,house_type,zone,classification,style,category,uesp_url,purchase_type,requirements,availability,last_verified,furnishing_limit,furnishing_limit_plus,special_furnishing_limit,special_furnishing_limit_plus,collectible_limit,collectible_limit_plus,special_collectible_limit,special_collectible_limit_plus,population_limit,population_limit_plus) SELECT 131,'Grotto of Desires','grotto of desires','Manor Home','Blackwood','Notable Home','Daedric, Sanguine','Notable Home','https://en.uesp.net/wiki/Online:Grotto_of_Desires','Quest, event, promotion, or special acquisition','Combine the Roseblood Bat pet with five Grotto of Desires event fragments from the Impresario.','UESP marks this house pre-release and unavailable as of 2026-10-27; fragment release dates are incomplete.','2026-10-27',(SELECT furnishing_limit FROM house_classifications WHERE name='Notable Home'),(SELECT furnishing_limit_plus FROM house_classifications WHERE name='Notable Home'),(SELECT special_furnishing_limit FROM house_classifications WHERE name='Notable Home'),(SELECT special_furnishing_limit_plus FROM house_classifications WHERE name='Notable Home'),(SELECT collectible_limit FROM house_classifications WHERE name='Notable Home'),(SELECT collectible_limit_plus FROM house_classifications WHERE name='Notable Home'),(SELECT special_collectible_limit FROM house_classifications WHERE name='Notable Home'),(SELECT special_collectible_limit_plus FROM house_classifications WHERE name='Notable Home'),(SELECT population_limit FROM house_classifications WHERE name='Notable Home'),(SELECT population_limit_plus FROM house_classifications WHERE name='Notable Home') WHERE NOT EXISTS (SELECT 1 FROM houses WHERE house_id=131);
UPDATE houses SET last_verified='2026-10-27',house_type=CASE WHEN (house_type IS NULL OR TRIM(house_type)='') THEN 'Manor Home' ELSE house_type END,zone=CASE WHEN (zone IS NULL OR TRIM(zone)='') THEN 'Blackwood' ELSE zone END,classification=CASE WHEN (classification IS NULL OR TRIM(classification)='') THEN 'Notable Home' ELSE classification END,style=CASE WHEN (style IS NULL OR TRIM(style)='') THEN 'Daedric, Sanguine' ELSE style END,category=CASE WHEN (category IS NULL OR TRIM(category)='') THEN 'Notable Home' ELSE category END,uesp_url=CASE WHEN (uesp_url IS NULL OR TRIM(uesp_url)='') THEN 'https://en.uesp.net/wiki/Online:Grotto_of_Desires' ELSE uesp_url END,purchase_type=CASE WHEN (purchase_type IS NULL OR TRIM(purchase_type)='') THEN 'Quest, event, promotion, or special acquisition' ELSE purchase_type END,requirements=CASE WHEN (requirements IS NULL OR TRIM(requirements)='') THEN 'Combine the Roseblood Bat pet with five Grotto of Desires event fragments from the Impresario.' ELSE requirements END,availability=CASE WHEN (availability IS NULL OR TRIM(availability)='') THEN 'UESP marks this house pre-release and unavailable as of 2026-10-27; fragment release dates are incomplete.' ELSE availability END WHERE house_id=131 AND ((house_type IS NULL OR TRIM(house_type)='') OR (zone IS NULL OR TRIM(zone)='') OR (classification IS NULL OR TRIM(classification)='') OR (style IS NULL OR TRIM(style)='') OR (category IS NULL OR TRIM(category)='') OR (uesp_url IS NULL OR TRIM(uesp_url)='') OR (purchase_type IS NULL OR TRIM(purchase_type)='') OR (requirements IS NULL OR TRIM(requirements)='') OR (availability IS NULL OR TRIM(availability)=''));

-- #132 Sheogorad Chateau. Evidence: https://en.uesp.net/w/index.php?oldid=3643417
INSERT INTO houses(house_id,name,normalized_name,house_type,crown_price_unfurnished,crown_price_furnished,crown_price,purchase_type,zone,classification,style,category,uesp_url,requirements,availability,last_verified,furnishing_limit,furnishing_limit_plus,special_furnishing_limit,special_furnishing_limit_plus,collectible_limit,collectible_limit_plus,special_collectible_limit,special_collectible_limit_plus,population_limit,population_limit_plus) SELECT 132,'Sheogorad Chateau','sheogorad chateau','Large Home',10400,13000,10400,'Crowns / special availability','Vvardenfell','Notable Home','Hlaalu','Notable Home','https://en.uesp.net/wiki/Online:Sheogorad_Chateau','Limited-time Crown Store purchase; first documented sale September 30–October 15, 2026.','Limited-time Crown Store sale; check the current showcase for availability.','2026-10-27',(SELECT furnishing_limit FROM house_classifications WHERE name='Notable Home'),(SELECT furnishing_limit_plus FROM house_classifications WHERE name='Notable Home'),(SELECT special_furnishing_limit FROM house_classifications WHERE name='Notable Home'),(SELECT special_furnishing_limit_plus FROM house_classifications WHERE name='Notable Home'),(SELECT collectible_limit FROM house_classifications WHERE name='Notable Home'),(SELECT collectible_limit_plus FROM house_classifications WHERE name='Notable Home'),(SELECT special_collectible_limit FROM house_classifications WHERE name='Notable Home'),(SELECT special_collectible_limit_plus FROM house_classifications WHERE name='Notable Home'),(SELECT population_limit FROM house_classifications WHERE name='Notable Home'),(SELECT population_limit_plus FROM house_classifications WHERE name='Notable Home') WHERE NOT EXISTS (SELECT 1 FROM houses WHERE house_id=132);
UPDATE houses SET last_verified='2026-10-27',house_type=CASE WHEN (house_type IS NULL OR TRIM(house_type)='') THEN 'Large Home' ELSE house_type END,crown_price_unfurnished=CASE WHEN crown_price_unfurnished IS NULL THEN 10400 ELSE crown_price_unfurnished END,crown_price_furnished=CASE WHEN crown_price_furnished IS NULL THEN 13000 ELSE crown_price_furnished END,crown_price=CASE WHEN crown_price IS NULL THEN 10400 ELSE crown_price END,purchase_type=CASE WHEN (purchase_type IS NULL OR TRIM(purchase_type)='') THEN 'Crowns / special availability' ELSE purchase_type END,zone=CASE WHEN (zone IS NULL OR TRIM(zone)='') THEN 'Vvardenfell' ELSE zone END,classification=CASE WHEN (classification IS NULL OR TRIM(classification)='') THEN 'Notable Home' ELSE classification END,style=CASE WHEN (style IS NULL OR TRIM(style)='') THEN 'Hlaalu' ELSE style END,category=CASE WHEN (category IS NULL OR TRIM(category)='') THEN 'Notable Home' ELSE category END,uesp_url=CASE WHEN (uesp_url IS NULL OR TRIM(uesp_url)='') THEN 'https://en.uesp.net/wiki/Online:Sheogorad_Chateau' ELSE uesp_url END,requirements=CASE WHEN (requirements IS NULL OR TRIM(requirements)='') THEN 'Limited-time Crown Store purchase; first documented sale September 30–October 15, 2026.' ELSE requirements END,availability=CASE WHEN (availability IS NULL OR TRIM(availability)='') THEN 'Limited-time Crown Store sale; check the current showcase for availability.' ELSE availability END WHERE house_id=132 AND ((house_type IS NULL OR TRIM(house_type)='') OR crown_price_unfurnished IS NULL OR crown_price_furnished IS NULL OR crown_price IS NULL OR (purchase_type IS NULL OR TRIM(purchase_type)='') OR (zone IS NULL OR TRIM(zone)='') OR (classification IS NULL OR TRIM(classification)='') OR (style IS NULL OR TRIM(style)='') OR (category IS NULL OR TRIM(category)='') OR (uesp_url IS NULL OR TRIM(uesp_url)='') OR (requirements IS NULL OR TRIM(requirements)='') OR (availability IS NULL OR TRIM(availability)=''));
UPDATE houses SET furnishing_limit=(SELECT p.furnishing_limit FROM house_classifications p WHERE p.name=houses.classification) WHERE house_id IN (131,132) AND furnishing_limit IS NULL AND NOT EXISTS (SELECT 1 FROM house_capacity_overrides o WHERE o.house_id=houses.house_id AND o.field='furnishing_limit');
INSERT OR IGNORE INTO house_capacity_overrides(house_id,field,value) SELECT h.house_id,'furnishing_limit',h.furnishing_limit FROM houses h JOIN house_classifications p ON p.name=h.classification WHERE h.house_id IN (131,132) AND h.furnishing_limit IS NOT p.furnishing_limit;
UPDATE houses SET furnishing_limit_plus=(SELECT p.furnishing_limit_plus FROM house_classifications p WHERE p.name=houses.classification) WHERE house_id IN (131,132) AND furnishing_limit_plus IS NULL AND NOT EXISTS (SELECT 1 FROM house_capacity_overrides o WHERE o.house_id=houses.house_id AND o.field='furnishing_limit_plus');
INSERT OR IGNORE INTO house_capacity_overrides(house_id,field,value) SELECT h.house_id,'furnishing_limit_plus',h.furnishing_limit_plus FROM houses h JOIN house_classifications p ON p.name=h.classification WHERE h.house_id IN (131,132) AND h.furnishing_limit_plus IS NOT p.furnishing_limit_plus;
UPDATE houses SET special_furnishing_limit=(SELECT p.special_furnishing_limit FROM house_classifications p WHERE p.name=houses.classification) WHERE house_id IN (131,132) AND special_furnishing_limit IS NULL AND NOT EXISTS (SELECT 1 FROM house_capacity_overrides o WHERE o.house_id=houses.house_id AND o.field='special_furnishing_limit');
INSERT OR IGNORE INTO house_capacity_overrides(house_id,field,value) SELECT h.house_id,'special_furnishing_limit',h.special_furnishing_limit FROM houses h JOIN house_classifications p ON p.name=h.classification WHERE h.house_id IN (131,132) AND h.special_furnishing_limit IS NOT p.special_furnishing_limit;
UPDATE houses SET special_furnishing_limit_plus=(SELECT p.special_furnishing_limit_plus FROM house_classifications p WHERE p.name=houses.classification) WHERE house_id IN (131,132) AND special_furnishing_limit_plus IS NULL AND NOT EXISTS (SELECT 1 FROM house_capacity_overrides o WHERE o.house_id=houses.house_id AND o.field='special_furnishing_limit_plus');
INSERT OR IGNORE INTO house_capacity_overrides(house_id,field,value) SELECT h.house_id,'special_furnishing_limit_plus',h.special_furnishing_limit_plus FROM houses h JOIN house_classifications p ON p.name=h.classification WHERE h.house_id IN (131,132) AND h.special_furnishing_limit_plus IS NOT p.special_furnishing_limit_plus;
UPDATE houses SET collectible_limit=(SELECT p.collectible_limit FROM house_classifications p WHERE p.name=houses.classification) WHERE house_id IN (131,132) AND collectible_limit IS NULL AND NOT EXISTS (SELECT 1 FROM house_capacity_overrides o WHERE o.house_id=houses.house_id AND o.field='collectible_limit');
INSERT OR IGNORE INTO house_capacity_overrides(house_id,field,value) SELECT h.house_id,'collectible_limit',h.collectible_limit FROM houses h JOIN house_classifications p ON p.name=h.classification WHERE h.house_id IN (131,132) AND h.collectible_limit IS NOT p.collectible_limit;
UPDATE houses SET collectible_limit_plus=(SELECT p.collectible_limit_plus FROM house_classifications p WHERE p.name=houses.classification) WHERE house_id IN (131,132) AND collectible_limit_plus IS NULL AND NOT EXISTS (SELECT 1 FROM house_capacity_overrides o WHERE o.house_id=houses.house_id AND o.field='collectible_limit_plus');
INSERT OR IGNORE INTO house_capacity_overrides(house_id,field,value) SELECT h.house_id,'collectible_limit_plus',h.collectible_limit_plus FROM houses h JOIN house_classifications p ON p.name=h.classification WHERE h.house_id IN (131,132) AND h.collectible_limit_plus IS NOT p.collectible_limit_plus;
UPDATE houses SET special_collectible_limit=(SELECT p.special_collectible_limit FROM house_classifications p WHERE p.name=houses.classification) WHERE house_id IN (131,132) AND special_collectible_limit IS NULL AND NOT EXISTS (SELECT 1 FROM house_capacity_overrides o WHERE o.house_id=houses.house_id AND o.field='special_collectible_limit');
INSERT OR IGNORE INTO house_capacity_overrides(house_id,field,value) SELECT h.house_id,'special_collectible_limit',h.special_collectible_limit FROM houses h JOIN house_classifications p ON p.name=h.classification WHERE h.house_id IN (131,132) AND h.special_collectible_limit IS NOT p.special_collectible_limit;
UPDATE houses SET special_collectible_limit_plus=(SELECT p.special_collectible_limit_plus FROM house_classifications p WHERE p.name=houses.classification) WHERE house_id IN (131,132) AND special_collectible_limit_plus IS NULL AND NOT EXISTS (SELECT 1 FROM house_capacity_overrides o WHERE o.house_id=houses.house_id AND o.field='special_collectible_limit_plus');
INSERT OR IGNORE INTO house_capacity_overrides(house_id,field,value) SELECT h.house_id,'special_collectible_limit_plus',h.special_collectible_limit_plus FROM houses h JOIN house_classifications p ON p.name=h.classification WHERE h.house_id IN (131,132) AND h.special_collectible_limit_plus IS NOT p.special_collectible_limit_plus;
UPDATE houses SET population_limit=(SELECT p.population_limit FROM house_classifications p WHERE p.name=houses.classification) WHERE house_id IN (131,132) AND population_limit IS NULL AND NOT EXISTS (SELECT 1 FROM house_capacity_overrides o WHERE o.house_id=houses.house_id AND o.field='population_limit');
INSERT OR IGNORE INTO house_capacity_overrides(house_id,field,value) SELECT h.house_id,'population_limit',h.population_limit FROM houses h JOIN house_classifications p ON p.name=h.classification WHERE h.house_id IN (131,132) AND h.population_limit IS NOT p.population_limit;
UPDATE houses SET population_limit_plus=(SELECT p.population_limit_plus FROM house_classifications p WHERE p.name=houses.classification) WHERE house_id IN (131,132) AND population_limit_plus IS NULL AND NOT EXISTS (SELECT 1 FROM house_capacity_overrides o WHERE o.house_id=houses.house_id AND o.field='population_limit_plus');
INSERT OR IGNORE INTO house_capacity_overrides(house_id,field,value) SELECT h.house_id,'population_limit_plus',h.population_limit_plus FROM houses h JOIN house_classifications p ON p.name=h.classification WHERE h.house_id IN (131,132) AND h.population_limit_plus IS NOT p.population_limit_plus;
INSERT OR IGNORE INTO house_catalog_values(field,value) SELECT DISTINCT 'zone',zone FROM houses WHERE house_id IN (1,2,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,19,20,21,23,24,25,26,27,28,29,30,31,32,33,34,35,37,38,39,40,41,42,43,44,45,47,48,49,54,58,59,61,63,65,66,68,69,70,71,72,75,76,77,78,79,80,81,82,85,87,88,89,90,91,92,93,95,96,98,99,100,101,103,104,106,109,110,111,112,113,115,116,117,118,119,120,121,122,123,124,125,128,129,131,132) AND zone IS NOT NULL AND TRIM(zone)<>'';
INSERT OR IGNORE INTO house_catalog_values(field,value) SELECT DISTINCT 'subzone',subzone FROM houses WHERE house_id IN (1,2,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,19,20,21,23,24,25,26,27,28,29,30,31,32,33,34,35,37,38,39,40,41,42,43,44,45,47,48,49,54,58,59,61,63,65,66,68,69,70,71,72,75,76,77,78,79,80,81,82,85,87,88,89,90,91,92,93,95,96,98,99,100,101,103,104,106,109,110,111,112,113,115,116,117,118,119,120,121,122,123,124,125,128,129,131,132) AND subzone IS NOT NULL AND TRIM(subzone)<>'';
INSERT OR IGNORE INTO house_catalog_values(field,value) SELECT DISTINCT 'house_type',house_type FROM houses WHERE house_id IN (1,2,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,19,20,21,23,24,25,26,27,28,29,30,31,32,33,34,35,37,38,39,40,41,42,43,44,45,47,48,49,54,58,59,61,63,65,66,68,69,70,71,72,75,76,77,78,79,80,81,82,85,87,88,89,90,91,92,93,95,96,98,99,100,101,103,104,106,109,110,111,112,113,115,116,117,118,119,120,121,122,123,124,125,128,129,131,132) AND house_type IS NOT NULL AND TRIM(house_type)<>'';
INSERT OR IGNORE INTO house_catalog_values(field,value) SELECT DISTINCT 'style',style FROM houses WHERE house_id IN (1,2,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,19,20,21,23,24,25,26,27,28,29,30,31,32,33,34,35,37,38,39,40,41,42,43,44,45,47,48,49,54,58,59,61,63,65,66,68,69,70,71,72,75,76,77,78,79,80,81,82,85,87,88,89,90,91,92,93,95,96,98,99,100,101,103,104,106,109,110,111,112,113,115,116,117,118,119,120,121,122,123,124,125,128,129,131,132) AND style IS NOT NULL AND TRIM(style)<>'';
INSERT OR IGNORE INTO house_catalog_values(field,value) SELECT DISTINCT 'purchase_type',purchase_type FROM houses WHERE house_id IN (1,2,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,19,20,21,23,24,25,26,27,28,29,30,31,32,33,34,35,37,38,39,40,41,42,43,44,45,47,48,49,54,58,59,61,63,65,66,68,69,70,71,72,75,76,77,78,79,80,81,82,85,87,88,89,90,91,92,93,95,96,98,99,100,101,103,104,106,109,110,111,112,113,115,116,117,118,119,120,121,122,123,124,125,128,129,131,132) AND purchase_type IS NOT NULL AND TRIM(purchase_type)<>'';
INSERT OR IGNORE INTO house_catalog_values(field,value) SELECT DISTINCT 'availability',availability FROM houses WHERE house_id IN (1,2,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,19,20,21,23,24,25,26,27,28,29,30,31,32,33,34,35,37,38,39,40,41,42,43,44,45,47,48,49,54,58,59,61,63,65,66,68,69,70,71,72,75,76,77,78,79,80,81,82,85,87,88,89,90,91,92,93,95,96,98,99,100,101,103,104,106,109,110,111,112,113,115,116,117,118,119,120,121,122,123,124,125,128,129,131,132) AND availability IS NOT NULL AND TRIM(availability)<>'';
DROP TABLE _hearthbound_catalog_guard_20261027;
COMMIT;
SELECT house_id,name,classification,zone,subzone,house_type,gold_price,crown_price_unfurnished,crown_price_furnished FROM houses WHERE house_id IN (1,2,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,19,20,21,23,24,25,26,27,28,29,30,31,32,33,34,35,37,38,39,40,41,42,43,44,45,47,48,49,54,58,59,61,63,65,66,68,69,70,71,72,75,76,77,78,79,80,81,82,85,87,88,89,90,91,92,93,95,96,98,99,100,101,103,104,106,109,110,111,112,113,115,116,117,118,119,120,121,122,123,124,125,128,129,131,132) ORDER BY house_id;

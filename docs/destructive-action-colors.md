# Destructive action colors

Destructive controls use the existing red danger style. This pass fixes the missing styles on tour-stop removal (existing and newly added stops), curated Featured selection removal, and Global grant revocation. Removing a tour stop only changes the draft until the tour is saved.

House/tour deletion, saved-search deletion, screenshot and cover removal, Discord deletion confirmations and grant revocation already use danger styling. Ordinary filter changes and unfavoriting remain normal reversible controls. Existing permission and confirmation checks are unchanged.

No database or environment changes are required.

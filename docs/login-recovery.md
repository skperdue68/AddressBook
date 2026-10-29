# Login recovery

Cancelled Discord sign-in uses HearthBound's branded public layout and offers **Try signing in again**, **Continue browsing**, and **Home**. When the validated login state identifies a house or tour, browsing returns to its guest page; its normal Global/Server/Private access restrictions still apply.

Expired, already-used or invalid sign-in states show a branded recovery page. Failed token exchanges use a generic retry message instead of provider diagnostics. No failed or cancelled login creates an authenticated session. Sign-out clears the login cookie and returns to the public homepage.

Deploy by pulling after merge and restarting `hearthbound`. No schema or configuration changes. Validation: 36 focused OAuth, HTTP administration, recovery and persistent-session tests passed; independent source review found no actionable issues.

# Resume changed tours without losing completed stops

## Root cause
Completed progress returns immediately without checking for newly added/unvisited stops. Advance chooses only a later position and can complete a reordered route despite earlier unvisited stops. Web completed views offer only Restart.

## Design
Read-only reconciliation of a completed run reports whether unvisited stops remain; it does not reset or reopen progress merely by viewing. Explicit Continue/startOrResume reopens that same run at the first unvisited stop, preserving completed-stop rows and completion history. Advance chooses the next unvisited stop after the current position, wrapping to the earliest remaining stop if needed. Completion occurs only when no unvisited stops remain. Restart retains its existing explicit reset behavior. No migration or production repair script.

Web details/player offer Continue alongside Restart for a previously completed route with remaining stops. Discord progress cards do the same, and Resume explicitly invokes authorized startOrResume. Completed unchanged routes retain Restart-only behavior. New resumes still recheck visibility, ESO environment and readiness.

Reproduce added-stop and reordered-route failures first; test read-only inspection, history preservation, explicit resume, no skipped stops, unchanged-tour completion, stale controls and access revocation; run relevant web/Discord and full suite; publish separately.

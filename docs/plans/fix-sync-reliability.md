# Fix sync reliability while keeping onboarding removed

## Summary

Onboarding and cycle-settings screens were intentionally removed; their absence is **not a bug**. Remove their leftover UI code while preserving saved settings, calculation defaults, and settings synchronization.

Review baseline: **35 targeted sync tests passed**. No files changed.

## Sync fixes

- Fix repeat sync and edits after completion: negotiate a fresh session on both peers, coordinated by the lower device ID.
- Correlate snapshot acknowledgements with `snapshotId`; require incoming snapshot application, outgoing snapshot acknowledgement, change acknowledgements, and exchanged completion before updating `lastSyncedAt`.
- Serialize session startup and outbound work; prevent callbacks from detached sessions affecting replacement connections.
- Keep retries running while conflicts await review; report stalled transfers without claiming completion.
- Add the required session-request and acknowledgement fields to the protocol, increment its version, and preserve explicit incompatibility errors.
- Query all unresolved conflicts independently of the 20-record history limit.
- Show actual conflicting log fields, notes, cycle lengths, and deletion state. Refresh review status after resolution.
- Stop queuing local profile preferences for sync; exclude historical profile changes from pending totals while preserving saved preferences.

## UI and update fixes

- Remove unused onboarding components, guards, route comments, and their obsolete tests.
- Remove unused cycle-settings form controls, save handlers, dependencies, and associated UI tests from Profile.
- Preserve `CycleSettingsService`, stored settings, existing defaults, dashboard calculations, and the `cycleSettings` sync entity.
- Keep Home, Calendar, and Profile accessible without setup.
- Replace automatic update reload with an update notification and explicit “Reload to update” action.
- Give the profile section a valid accessible heading/name.
- Replace the selected-mood background with theme-aware colors: current light-mode text contrast is approximately **2.38:1**, below AA.
- Localize new update controls and conflict details in English and Russian.

## Validation

- Paired transport tests: initial sync, repeat sync from either peer, simultaneous requests, and edits after completion.
- Delayed/missing snapshot acknowledgements must prevent successful completion and timestamp updates.
- Reconnection during storage work must not allow stale callbacks to alter the new session.
- Mocked `db`/`liveQuery` tests: more than 20 unresolved conflicts, both resolution choices, preserved cycle-settings sync, and excluded profile pending counts.
- Verify updates never reload automatically.
- Verify fresh users can navigate without setup; existing settings and default calculations remain functional.
- Run the production build, relevant regression tests, and AXE/keyboard checks in both themes and languages.
- On test failure, inspect logs, request developer assistance, and record details in `AGENTS.md` during implementation, as required by repository instructions.

# Olympus 0.9.0 local installation receipt

Installed 2026-09-08 from release commit `0c61f96`; local master and the implementation worktree were fast-forwarded together. No remote push.

- Windows executable reports 0.9.0; installed and release binaries match after the installer bundle marker is normalized.
- SQLite integrity: ok. All 30 pre-existing message rows and every settings key/value match the pre-install backup exactly after application launch. Existing table counts are preserved; additive diagnostic tables exist.
- Backup and machine-readable verification: workspace `output/olympus-0.9.0-install/`.
- Production TypeScript/Vite and MSI build passed. 211 Rust tests passed; the two paid suites were separately exercised (eight live scenarios total). 55 voice protocol checks and the model selector/diagnostics fixture passed.
- The automated console fixture did not pass its opening-focus assertion in the in-app browser. Native automation failed to attach with `foreground window did not report a process id`; a real installed conversation and its restart provenance were therefore not manually verified. Backend persistence/provenance tests passed. Physical microphone, interruption and subjective voice quality require operator acceptance.
- Existing build warnings remain: gray-matter eval/browser buffer, large frontend bundle, and one unused Anthropic content field. No configured lint script exists.

The app is open for operator testing. Use Next answer to choose Deep Analysis or Claude comparison; the selection resets to Sol after one request. Preferences contains Model diagnostics. See MODEL-ROUTING.md for the complete routing contract.

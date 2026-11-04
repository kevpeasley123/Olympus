# Olympus Gmail recovery

## Incident and next action

On November 3, 2026, the enabled installed account reported authentication required. A separate opt-in refresh through the native Olympus adapter reached Google's token endpoint and received invalid_grant. The probe did not open mail or change account state. This establishes that the current grant cannot refresh. It does not identify why Google invalidated it.

1. Identify the Google Cloud project that owns the configured desktop OAuth client. Check its audience and publishing status. An external app in Testing requesting Gmail access can receive a seven-day refresh grant. Follow Google's applicable production and verification requirements before relying on a replacement grant. Do not broaden the scope. See [Google OAuth refresh-token expiration](https://developers.google.com/identity/protocols/oauth2#expiration).
2. Complete Google consent through Communications → Reconnect. Confirm that an automatic sync finishes successfully and advances the account's last-success time and history cursor. Report only state and timestamps.
3. Verify automatic incremental sync after an access-token renewal, app restart, network interruption and sleep/wake. Verify again after the previous seven-day boundary. A temporarily locked credential store or rejected access token should recover on the cadence. A rejected refresh grant or missing credential needs operator action. Keep cached mail and the last committed cursor intact on failure.
4. Evaluate the opening brief separately. With current mail, use one representative supported change to check what changed, why it matters and whether Kevin has a specific action. Keep model/spending gates intact. Report any unavailable analysis explicitly.
5. Distinguish an app-open sync cadence from closed-app operation. If unattended coverage while Olympus is closed is required, qualify a user-session background worker with one sync owner, persistent retry state, and a bounded catch-up on resume before claiming continuous operation.

## Development checks

The native grant-only test is ignored by default and uses the installed account only when explicitly requested. It never prints credentials or message bodies. The ordinary cadence and refresh-classification tests use offline fixtures. Live recovery requires successful automatic sync; an offline test pass or a fresh consent dialog alone does not establish recovery.

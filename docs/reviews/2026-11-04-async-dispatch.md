# Asynchronous dispatch qualification — 2026-11-04

Other Communications session was read first: idle, Celestial Observatory changes
in its separate checkout. No shared workspace or running application was changed.

Added cfg(test)-only asynchronous orchestration over in-memory SQLite and a fake
provider. Reserve under DB-then-owner locks, release both before awaiting, then
recheck the original capability, source revision, fresh clock and policy before
acceptance. The yielding runner asserts both locks are available. Cases cover
revocation, removed evidence, withdrawn policy, expiry and unchanged completion.
Reservation means cancellation may prevent adoption but cannot promise prevention
of work already released to a provider. No production transport is connected.

Production integration prerequisites, in order:

1. Define native canonical composition and receipt mapping. Frontend currently
   adds protected corrections and expands combined receipts/project cursors after
   synthesis. A native issuer must not sign this reconstructed text blindly.
   Evidence IDs must map explicitly to eligible displayed receipt IDs/cursors.
2. Extract a transaction-taking persistence helper; compose, issue binding,
   consume result and persist message/provenance/receipts in one transaction,
   with final source/scope validation under the same lease. Existing persistence
   consumption is atomic, but binding issuance remains absent.
3. Wire native scope grants to authoritative conversation/account lifecycle.
   UI currently revokes only. Preserve DB-before-owner lock order and never
   retain SQLite or lifecycle locks over provider awaits.
4. Connect a bounded asynchronous provider transport only after enforceable
   spending protection, plugin isolation and applicable consent are established.
   Both production gates stay closed. The aggregate caller-packet IPC remains
   unqualified and cannot be used as the native source authority.

Steps 1–3 are engineering work, not requests for user permission. Spending and
consent qualification are separate live-use boundaries; Firefox/provider-settings
access remains denied. No OS-denied inspection was retried. Olympus was not opened.

The fake adoption callback still rolls back its read transaction and does not
prove durable production adoption, restart recovery or semantic briefing quality.

Verification: full offline native suite 725 passed, 26 ignored, real-vault diagnostic filtered. Independent source review found no blocker in this test-only addition. No live inference or durable-adoption claim.

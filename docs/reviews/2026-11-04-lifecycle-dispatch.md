# Lifecycle and dispatch qualification — 2026-11-04

No Firefox or alternate provider-settings route was attempted. No accounts, credentials, provider requests, consent, installed app or production data were changed.

Native startup now manages a revoked briefing NativeSession initialized from the existing backend-owned ApprovalState session. Selection is native-only and requires the stored native operator session, a saved nonlegacy conversation, and the native selected enabled/connected readonly Gmail account. Missing/invalid scope revokes. No command or frontend input can select this adapter; UI conversation/new/Temporary/account lifecycle hooks remain engineering work. Defaults do not infer scope from a recent chat.

A cfg(test) dispatch/result harness rechecks original opaque issuance, owner generation, expiry, source revision and injected policy before the fake runner and before result acceptance. Pending results are consumed. Tests cover stale/deleted sources, changed content, privacy toggles, revocation, expiration, policy refusal and foreign owners. This is synthetic sequencing evidence only: it does not reserve provider quota, make real requests, or atomically persist output. Its read transaction rolls back. The source qualification and generation gates remain closed.

No new user decision is required for the remaining isolated engineering. Real provider settings remain unverified under the explicit control denial; do not retry access by another route. Live model qualification will still require separately established spending and consent conditions.

Independent review found a lifecycle race: validation could finish after clear, or a concurrent selection could replace the scope before capability return. A channel-synchronized regression reproduced it. The adapter now serializes validation, apply and capability creation with clear under one transition mutex, and its raw owner accessor is test-only. Account-switch coverage uses the legal schema transition: gmail_one_enabled prevents two enabled rows, and disabling the old account invalidates its source scope independently of memory preferences.

Final verification: 719 Rust unit tests passed, 26 ignored (live-account tests remain ignored), real-vault diagnostic explicitly filtered out. Guidance and whitespace checks passed. Independent review confirmed the serialization fix and withdrew its account-switch concern after checking the unique-enabled-account schema invariant. No live integration or production recovery claim is made.

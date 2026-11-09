# Memory and workflow implementation acceptance

Branch: feature/source-backed-working-memory. Base: 66b732e87364caba0d518bb3c6cd794d1602b8e9. Installed app remains 0.52; this branch is not installed.

Implemented explicit engine/model/account-bound research, immutable source-backed learned assertions, bounded conversation/project checkpoints, and resumable researcher/verifier stages with parent-owned publication. Existing SQLite and Obsidian storage are reused; no dependency or service was added.

The full Rust suite passed 891 tests after final-review fixes. TypeScript and guidance checks passed. Native synthetic Codex research completed both stages and saved a reusable provisional finding (23.65 seconds, roughly 12 seconds research and 11 seconds verification). This is a cost/latency observation, not evidence of a universal quality advantage over a single agent.

Final review identified first-compaction loss, unpublished correction suppression, and unrelated stale-record suppression. Regression coverage and fixes preserve unclassified operator source IDs, ignore unpublished correction relations, and validate learned records individually. Published corrections remain durable reversals; invalidating their later source does not silently revive an older fact.

Temporary chats remain excluded. Source edits, route changes, operator file edits, and cancellation fail closed. Local research is not qualified. Checkpoint regeneration after arbitrary transcript edits remains explicit rather than automatic. The existing whole-note writer is used only to finish old prepared jobs; new learning writes assertions. Remove compatibility only after old prepared jobs are drained and legacy authored content has a deliberate migration policy.

Final results: 891 Rust tests passed, zero failures, 41 opt-in tests skipped by the normal suite. Three selected synthetic native tests were run separately and passed: research publication (23.65 seconds), checkpoint compaction/restoration (6.42 seconds), and learned preference/decision extraction (10.55 seconds). TypeScript, production frontend build, and documentation guidance checks passed. The build retains its existing large-chunk warning. The checkpoint schema now bounds source citations consistently with the validator. A test assertion was corrected because an explicit request to continue comparing databases legitimately permits that read-only next step; it does not authorize deployment.

No desktop installer was built or installed, no Gmail operation was performed, and no private mail was transmitted for these checks. Claude transport dispatch is covered by fixtures; this acceptance used Codex for real inference. Quality beyond these bounded synthetic cases remains subject to everyday use.

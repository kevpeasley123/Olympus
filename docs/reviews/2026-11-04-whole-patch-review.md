# Whole-patch review and remaining readiness — 2026-11-04

## Correctness changes

Project scope is now independent of Gmail. Native saved operator session and
conversation checks grant a separate project capability; it cannot authorize mail
retrieval. Mail/project scope changes revoke old capabilities. Tests run without
Gmail accounts and with stale/auth-required Gmail, through synthetic project
composition and durable persistence. No IPC activation is added.

Project tracking now enumerates locally reachable commit OIDs without a date
filter. An exact native namespaced OID ledger records only displayed commits.
New backdated commits and newly reachable older branches remain eligible.
Eight-item pages retain undisplayed work; acknowledgments survive receipt-history
or conversation removal. No prior timestamp is treated as proof of display.
Capacity is explicitly bounded at 4,096 reachable/acknowledged OIDs; overflow fails
closed rather than silently truncating or evicting. A synthetic 301-commit repo
verifies paging beyond the earlier 256 cap. Filesystem revalidation remains a
fresh observation, not an atomic Git/SQLite snapshot.

The native OID namespace cannot be written through ordinary frontend display plans:
store_display requires exact consumed native model binding and matching origin/
delivery; display-time union checks prevent queued acknowledgments exceeding capacity.

Independent broad review also found two defects in the actual deterministic UI
fallback. Current signature-matched handled/dismissed/active-snoozed threads now
suppress raw notices. Newer same-thread or explicitly matched-order cancellation
and negation suppress older positive shipment claims. Expired/stale resolutions and
unrelated cancellations do not suppress. Root independently inspected these fixes;
the regression tests passed. This remains deterministic projection, not reasoning.

## Integration conflicts

Other Communications thread was idle when inspected. Its checkout has additional
uncommitted dashboard, Gmail and briefing work beyond the Observatory visuals.
Scratch three-way previews were created only in output/integration-review using
common base fee95035e37740fbe1cbc4268744cf858172f1e1. No merge was applied.
All six overlapping files conflict:

- docs/NEXT-SESSION.md: reconcile current handoff, do not replace either history.
- src-tauri/src/commands/gmail/mod.rs: preserve bounded multi-message evidence and
  label exclusions while retaining the other checkout's auth/sync work.
- src/hooks/useDashboardData.ts: preserve generation leases, revocation waits,
  final active checks and briefing provenance in both constructors. Reconcile the
  other checkout's vaultRecall handler with its stream contract.
- src/services/briefingDelivery.ts: retain authority, protected corrections and
  combined items, bounded synthesis and provenance; no sender-only grouping.
- src/services/briefingIntelligence.ts: retain extracted transaction projection,
  new resolution/contradiction fixes, explicit authority and full corrections.
- src/services/briefingIntelligence.harness.ts: preserve authority and product-label
  assertions alongside the other harness changes.

Blanket ours/theirs selection is unsafe. Integrated merge/build remains outstanding.

## Real functionality without provider settings

Existing deterministic local briefing, source review, sync-status surfaces and
operator-resolution behavior do not require a model provider. Their improvements
can be integrated and installed without enabling paid generation. Native project
adapters now pass Gmail-independent tests, but their production UI entrypoint and
trusted activation remain unconnected. The new protected OID ledger currently
requires the native synthesis binding; a future deterministic native writer would
need an equally authenticated receipt contract, not a fabricated model record.

Genuine contextual model briefs remain blocked: production transport/result-envelope
issuance, trusted lifecycle activation, enforceable no-extra-spend and plugin
isolation, applicable consent and real quality acceptance remain unqualified.
Provider settings remain inaccessible under the Firefox denial; no retry or alternate
route was used. No installed-app recovery claim follows from synthetic tests.
The latest prior live observation showed Olympus stopped; this phase did not launch
it or check fresh Gmail status. Restart/network/seven-day recovery remains open.

## Review scope

Independent review covered native evidence/lifecycle, asynchronous dispatch tests,
composition, model-record immutability, atomic persistence/receipts, project mapping,
frontend scope/provenance and fallback logic, plus semantic conflict previews.
Review findings were reproduced/fixed and final focused source review found no new
blocker. It is not certification of installed behavior, actual provider spending,
live filesystem mutation, model reasoning quality or an integrated merged build.
All work stays in the isolated branch, uncommitted/uninstalled; live gates unchanged.

Final verification: 747 offline native tests passed, 26 ignored, real-vault diagnostic explicitly filtered. Focused fallback/situation/delivery/synthesis/scope/UI-ack tests, TypeScript and production build passed (existing bundle-size advisory remains). Final independent source review accepted the updated4096 bounds and project-only scope; no integrated merge or live verification performed.

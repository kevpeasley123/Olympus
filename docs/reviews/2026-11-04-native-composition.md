# Native composition and transactional binding — 2026-11-04

Isolated implementation, not installed or connected to IPC. Trusted activation,
native source qualification and live generation gates remain closed. No accounts,
credentials, provider calls, app launches or denied inspection retries occurred.

The native compositor supports explicit one-to-one mail receipts. It composes all
model text/explanation/action/uncertainty fields, preserving repeated qualifiers
per item. Exact operator corrections are retained only for cited native threads,
with a bounded subject label; uncited threads are not displayed or receipted.
Remembered context and corrections can inform attribution but never produce mail
receipts themselves. Combined-item expansion and project cursor mapping are
unsupported and fail explicitly if requested as deliverable evidence. An empty
valid model result returns no message, without a deterministic fallback.

Adoption revalidates the original native capability, source revision, freshness
and policy while holding the owner lease. The lease spans transaction commit;
revocation before that boundary rejects, while revocation concurrent with commit
waits and cannot undo the committed message. No lock is held during provider wait
in the separate asynchronous harness.

The model record must match purpose/status/provider/model and a stored exact
briefing_result envelope: packet revision, original preparation time, SHA-256 of
serialized validated output. This prevents substituting an unrelated completed
request. A real dispatcher still must issue that envelope; this task only creates
synthetic envelopes in tests. Generic diagnostic saves must preserve it.

Binding issuance, consumption, message/provenance, pending-display receipts and
index all share the extracted transaction-taking persistence helper. Late errors
roll back both new binding and all message effects. Receipt confirmation remains
the existing separate display acknowledgment operation.

Review found and fixed delayed-adoption timestamp rejection, loss of repeated
qualifiers, unrelated correction inclusion, missing packet/output request binding,
and missing fresh policy check. Envelope immutability is included in final checks.

Coverage: successful and delayed (>60s) adoption; revocation; changed source;
unknown citation; provider mismatch; expiry; policy withdrawal; missing envelope;
late delivery failure; empty output; repeated qualifiers; multi-thread correction
filtering; receipt deduplication; replay rejection; outer transaction rollback.

Remaining: production dispatcher/envelope writer, trusted scope activation,
combined/project native composition, enforced spending and plugin isolation,
applicable consent, live inference quality and Gmail recovery criteria. No semantic
truth guarantee follows merely from structural citation/digest validation.

Final verification: 729 native tests passed, 26 ignored, real-vault diagnostic
explicitly filtered; guidance and whitespace checks passed. Independent source
review confirmed all reported fixes, including result-envelope immutability.
No frontend changed in this phase. Private unconnected adoption currently produces
an expected dead-code warning. The source remains uncommitted and uninstalled.

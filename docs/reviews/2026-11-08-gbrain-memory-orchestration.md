# Gbrain and Olympus: memory and agent orchestration review

Review date: November 8, 2026, America/Phoenix. This is a scoped code review and proposed borrowing strategy, not an implementation approval or a comprehensive audit of gbrain.

## Recommendation

Borrow bounded context assembly, explicit memory lifecycle, and recoverable agent results. Extend Olympus's existing Rust/SQLite/Obsidian implementation. Do not install gbrain, introduce another database or scheduler, or start autonomous recursive agents.

The biggest Olympus gap is connecting the pieces already present: learned conversation memory, curated indexed knowledge, task progress, agent results and explicitly selected reasoning engines. Briefing quality is one consumer of that connection; research, project continuation and ordinary conversations are equally important.

## Evidence and scope

- Olympus checkout: `olympus-skill-backbone`, clean at review start, commit `66b732e87364caba0d518bb3c6cd794d1602b8e9`, version 0.52.0.
- Gbrain source pinned to [555b73a8079de8d7061884358652e19d37f7acdf](https://github.com/garrytan/gbrain/commit/555b73a8079de8d7061884358652e19d37f7acdf). Initial directory discovery used master; substantive source excerpts below were fetched at the pinned revision through the GitHub connector.
- Read the actual implementation of the cited functions, their callers where described, and selected test bodies. Large modules were reviewed selectively; this is not a claim to have read every line or validated every dependency.
- Gbrain was not installed, executed, or benchmarked. Its test code was inspected, not run. No private Olympus data was sent to gbrain or another model.
- Olympus synthetic memory and research/verification tests were run locally. No current installed-app, live-provider, Gmail or coding-delegate test was performed for this review.

## Findings

### 1. High priority: learned memory is still a whole-note rewrite

Olympus `commands/chat_memory.rs:399-515` loads the beginning of one learned-memory note (16,000-character cap), supplies its current body to the model and asks for a complete replacement. The prompt asks the model to merge or drop less useful bullets to stay under 2,000 words. `checked()` validates title/length/heading shape, not the evidentiary support of each remembered assertion.

`chat_memory_jobs.rs` does preserve input message IDs, fingerprints, provider binding and prepared output. That is valuable batch-level provenance and crash recovery. It does not create an addressable, source-bound lifecycle for each assertion within the replacement prose. Retention and contradiction handling therefore depend heavily on repeated model rewrites. A valid JSON result is not evidence that every important decision survived.

Gbrain's [fact withdrawal code](https://github.com/garrytan/gbrain/blob/555b73a8079de8d7061884358652e19d37f7acdf/src/core/facts/withdrawal.ts#L91-L158) transactionally records source/visibility/subject-scoped withdrawals and expires matching active facts. Its [forget implementation](https://github.com/garrytan/gbrain/blob/555b73a8079de8d7061884358652e19d37f7acdf/src/core/facts/forget.ts#L118) also reconciles source representations. This is substantially more explicit than rewriting a paragraph. It is also substantially more complex than Olympus needs.

**Borrow:** stable identity, source references, explicit correction/withdrawal, and a readable projection derived from those records. Keep Olympus's existing contribution journal and vault write protections. Do not port gbrain's multi-source publication and belief-ledger infrastructure.

### 2. High priority: active-task continuity is weaker than durable note storage

Olympus `assistant.rs::prepare_messages` drops oldest turns to satisfy message/character limits. The quiet-chat memory pass runs after ten minutes and deliberately skips momentary details. Those are different needs: an unfinished investigation can require a discarded early constraint before the chat becomes quiet. The code inspected does not preserve a dedicated structured working checkpoint before trimming ordinary conversation history.

Gbrain has real context machinery beyond a shared notebook. [Core memory](https://github.com/garrytan/gbrain/blob/555b73a8079de8d7061884358652e19d37f7acdf/src/core/core-memory.ts#L184-L216) selects whole pages by priority within a budget. [Turn context assembly](https://github.com/garrytan/gbrain/blob/555b73a8079de8d7061884358652e19d37f7acdf/src/core/context/turn-context.ts#L612-L708) combines scoped entity cards, facts and open threads, with deadline handling and a frozen delivered snapshot. [Checkpoint harvesting](https://github.com/garrytan/gbrain/blob/555b73a8079de8d7061884358652e19d37f7acdf/src/core/context/checkpoint-harvest.ts#L400-L505) preserves compaction-boundary material and publishes verified links from a receipt on retry.

**Borrow:** separate core preferences, active task state and retrieved knowledge; preserve source IDs and open questions through trimming and restart. Do not copy the many hooks, IPC transports, salience heuristics or background harvest lanes. A durable Olympus checkpoint and one context assembler are enough for the initial slice.

### 3. Preserve: Olympus already has a credible curated-memory foundation

`memory/record.rs` models record identity, project references, source/observation dates, corrections, supersession and source revisions. `memory/retrieve.rs` performs project-scoped full-text search, reserves project milestones, carries related correction records together and refuses stale/incomplete evidence bundles. `memory/mod.rs` supplies background indexing and request evidence receipts. `memory/index.rs` is a derived SQLite index, not the source archive.

The gap is that learned chat bullets are a separate path. The correct response is to make new contributions compatible with the existing reader, not build another vector store alongside it.

**Borrow:** gbrain's consistent context boundary. **Keep:** Olympus's current source-of-record choices, index, correction traversal and conservative evidence checks. Evaluate semantic retrieval only after measuring actual misses.

### 4. High priority: routing consolidation is incomplete

`execution.rs::structured` supports explicit Codex, Claude and local routes. But `research_verification.rs::research` and `verification` still call `subscription_jobs::run`, whose wrapper defaults to Claude. `delegation.rs` directly launches Claude Code and resumes its session; it is a distinct coding execution path, not a generic tool-enabled use of `execution.rs`.

This explains an architectural mismatch with equal engines: selecting Codex for conversation does not establish that research or coding work uses Codex. A role's name is also not its model identity.

**Borrow:** a consistent task contract. Route the existing research pair explicitly through the common structured executor and record the selected/actual engine per stage. Keep coding delegation separate until a real Codex coding adapter has equivalent tool, workspace, cancellation and recovery semantics. Do not pretend a JSON completion adapter is a coding runtime.

### 5. Gbrain's execution durability is stronger than a claim of smarter teamwork

The [Minions queue](https://github.com/garrytan/gbrain/blob/555b73a8079de8d7061884358652e19d37f7acdf/src/core/minions/queue.ts#L1454-L1502) atomically claims work, advances a claim generation and stamps lease/deadline state. Its [subagent replay](https://github.com/garrytan/gbrain/blob/555b73a8079de8d7061884358652e19d37f7acdf/src/core/minions/handlers/subagent.ts#L644-L745) reuses completed tool results and refuses an uncertain pending non-idempotent operation. Parent/child jobs have explicit terminal outcomes.

However, the actual [aggregator handler](https://github.com/garrytan/gbrain/blob/555b73a8079de8d7061884358652e19d37f7acdf/src/core/minions/handlers/subagent-aggregator.ts#L44-L107) collects child outcomes and renders a deterministic summary. It does not itself reason over disagreements or perform an LLM synthesis. This does not exclude richer reasoning elsewhere; it means this path is not proof of superior agent judgment.

Olympus already has `research_verification.rs`: a bounded researcher/verifier exchange, identity-bound packets, exact-source validation, one clarification round, deadlines and cancellation. Restart deliberately interrupts it. Coding delegation preserves an isolated worktree and uses operator-mediated resume. Memory contributions already use attempt fencing and prepared-result recovery.

**Borrow:** small resumable stage receipts and safe retry classification for the existing read-only pair. Do not introduce a general Postgres job queue, recursive fan-out, event bus or replacement executor. There is no comparative quality benchmark establishing that gbrain orchestrates reasoning better.

### 6. Agent output is not yet a demonstrated corpus-contribution loop

Olympus's research definitions explicitly prohibit memory writes. The chat learner skips batches with no operator turn. This preserves authority, but means completed agent findings do not automatically become durable knowledge through that path. Prior 0.52 acceptance produced no new live memory contribution.

Gbrain's [oneshot synthesis runner](https://github.com/garrytan/gbrain/blob/555b73a8079de8d7061884358652e19d37f7acdf/src/core/minions/handlers/subagent-oneshot.ts#L321-L404) supports model-produced structured output, validated writes and ledger-first recovery. It illustrates an important simplification: a bounded task need not become a long tool-calling conversation.

**Borrow:** a validated result envelope and idempotent parent-owned publication. The specialist proposes findings; the parent verifies source identity and publishes a provisional record. Do not equate verification-model agreement with truth, turn advice into a commitment, or let child agents write arbitrary vault files. Preserve the user's automatic-learning experience without asking for approval on every benign memory item.

### 7. Retrieval feedback is useful later, but not the first fix

Gbrain [rateAnswer](https://github.com/garrytan/gbrain/blob/555b73a8079de8d7061884358652e19d37f7acdf/src/core/feedback/rate.ts#L110-L179) binds ratings to retrieved pages, skips stale revisions and limits who can change ranking. The stored weights adjust retrieval; they do not train the model or establish personal relevance by themselves.

**Defer:** learned ranking. First retain source-use receipts and build a regression set from actual errors. An explicit statement such as “that newsletter is irrelevant to this question” can correct the scoped case without inferring a permanent preference. Do not require rating buttons or another learning dashboard.

### 8. Complexity is a real reason to borrow selectively

The reviewed gbrain queue and subagent handler alone contain roughly 2,548 and 1,924 lines; its context assembler has 1,030. Those counts describe this pinned review only, not quality. The machinery addresses multiple database engines, remote clients, permissions, ingestion systems and deployment modes Olympus does not need.

Its best transferable ideas are invariants, not modules: a result names its evidence; a correction survives rebuild; an interrupted operation cannot silently become success; a context packet fits its budget; a worker being alive is not proof of progress.

## Alternatives considered

1. **Prompt-only refinement:** lowest immediate effort, but cannot solve whole-note retention, task checkpointing or inconsistent routing. Useful for prose, insufficient for this request.
2. **Extend existing components — recommended:** retain storage and executors; make learned records compatible with curated retrieval; add bounded working state; upgrade one research workflow and demonstrate useful contribution.
3. **Adopt gbrain or build a general agent framework:** potentially broad capability, but adds overlapping storage, runtime, scheduling and maintenance responsibilities. Rejected for this proposal because Kevin explicitly asked to borrow ideas without adopting the project or accumulating more complexity.

## Acceptance examples beyond briefings

- Resume a long investigation after restart with its objective, constraints, checked evidence and unresolved question intact.
- Recall the current decision and explain its correction without presenting the superseded decision as current.
- Switch projects without contaminating another project's context, including projects with similar names.
- Run the researcher/verifier using the selected eligible subscription; save a source-linked finding once; use it in a later ordinary conversation.
- Cancel or exhaust the route budget without silent fallback, fabricated success or repeated publication.
- Rebuild the derived memory index and retain corrections and withdrawals.

## Verification performed

- `cargo test --lib commands::memory::tests -- --test-threads=1`: 19 passed, 2 ignored.
- `cargo test --lib commands::chat_memory -- --test-threads=1`: 29 passed, 1 ignored.
- `cargo test --lib commands::research_verification -- --test-threads=1`: 19 passed.
- Initial restricted memory run: 16 passed, 3 failed on fixture renames/recovery. Same unchanged test suite passed outside the sandbox. No product fix was made for those environment-specific failures.
- Existing compiler warnings remained. Gbrain test sources inspected included `test/core-memory.test.ts`, `test/context-engine-checkpoint.serial.test.ts`, and `test/minions/subagent-pending-write-runners.test.ts`; they were not executed.
- These checks establish selected synthetic invariants, not semantic quality, production reliability or superiority of one product.

## Proposed next work

See [the staged borrowing plan](../superpowers/plans/2026-11-08-memory-orchestration-borrowing.md). It is a proposal for review, not authorization to install gbrain or start new background collection. No implementation, deployment or live-provider inference was performed in this review.

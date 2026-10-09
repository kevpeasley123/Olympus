# Cross-project memory continuity

Implemented October 8, 2026: vault projections reconciled, historical versions retained, stronger templates, local Codex guidance and an olympus-memory skill for session capture and conflict-aware writes. The development backend now also provides [indexed curated-memory retrieval](MEMORY-RETRIEVAL.md).

Canonical local procedure: vault `09 - System/Vault Maintenance Protocol.md`; adoption and gaps: `09 - System/Memory Coverage.md`. Session records live in `08 - Daily Briefs/Sessions/`, current project summaries in `01 - Projects/`. Use unique records and expected-content hashes when reconciling shared projections. Preserve source/authority distinctions and exact project identity.

The development app reads stable system configuration and a bounded, project-scoped packet of project/session/decision/research passages. It saves backend evidence receipts and exposes them inside response Details. Legacy Decision Log/catalog context remains an explicit rollback path. This is retrieval of contributed records, not automatic collection of other chats. Installed desktop behavior and live-provider acceptance must be verified separately.

Personal Codex guidance is installed in `~/.codex/AGENTS.md`, following https://learn.chatgpt.com/docs/agent-configuration/agents-md . New instruction discovery does not prove adoption by already-open chats or other clients. No scheduled automation or paid call was added.

# Cross-project memory continuity

Implemented October 8, 2026: vault projections reconciled, historical versions retained, stronger templates, local Codex guidance and an olympus-memory skill for session capture and conflict-aware writes. This is a file workflow, not a new native service or retrieval endpoint.

Canonical local procedure: vault `09 - System/Vault Maintenance Protocol.md`; adoption and gaps: `09 - System/Memory Coverage.md`. Session records live in `08 - Daily Briefs/Sessions/`, current project summaries in `01 - Projects/`. Use unique records and expected-content hashes when reconciling shared projections. Preserve source/authority distinctions and exact project identity.

The app still reads fixed system/index notes, bounded recent Decision Log context and selected research excerpts. It does not recursively retrieve session/project bodies. Do not claim automatic cross-session recall or live-provider acceptance. Future runtime work should add bounded, relevant session/project retrieval with provenance and tests for conflicts, stale evidence and unknown project commitments.

Personal Codex guidance is installed in `~/.codex/AGENTS.md`, following https://learn.chatgpt.com/docs/agent-configuration/agents-md . New instruction discovery does not prove adoption by already-open chats or other clients. No scheduled automation or paid call was added.

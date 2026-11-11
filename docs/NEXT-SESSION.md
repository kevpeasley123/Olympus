# Next session

## Olympus 0.53.0 - installed November 9, 2026

PR33 merged at `738a9e8901575c69f9fb44b033b2bfcef7a8e831`; `npm run update`
installed and launched 0.53.0. See
[installed acceptance](reviews/2026-11-09-installed-memory-workflow-acceptance.md).
Active checkout: `olympus-skill-backbone`; registered human-edited checkout preserved.

## Direction change - November 11, 2026

Kevin set a new direction: Olympus is an orchestrating harness over Codex, Claude
Code and local models, with all agent work visible. Briefing and Gmail-analysis
work is paused while the harness is built. The opening brief is the first workflow
to move onto it. He approved engines using Olympus's own read-only tools and
retiring the paid API routes and the ChatGPT plan prototype.

Built on `claude/harness-core` (unreleased, not installed, never run in the app):

- One agent event stream, stored and shown in Command's Agent activity
  ([AGENT-EVENTS.md](AGENT-EVENTS.md)). Fed by Claude Code delegation, by every
  background job's start and outcome, and by skill runs. The Pantheon figures
  move on it.
- A read-only tool server inside the executable ([OLYMPUS-TOOLS.md](OLYMPUS-TOOLS.md)).
- A skill runner, a tool mode for the Claude subscription transport, and the
  opening brief as a trial skill ([SKILL-RUNNER.md](SKILL-RUNNER.md)).

First things to do on the PC, in order:

1. Run the full release gate on `claude/harness-integration` (everything above
   plus pull requests 35 and 36, already merged together).
2. In `npm run tauri dev`, open Agent activity and run the opening-brief trial on
   Claude Code. This is the first real tool run. If it stops with an isolation
   message, the cause is most likely that `--safe-mode` or `--restricted` does not
   load the server named by `--mcp-config`; SKILL-RUNNER.md lists what is unproven.
3. Check what one trial cost against the Claude headless credit.

Not done, deliberately: retiring the paid API routes. They are woven into the main
chat dispatch in `assistant.rs` (and `voice.rs` separately uses an OpenAI key for
realtime speech, which is not a reasoning route). Removing them unverified would
risk the working chat; it needs a session that can run the app. Also not built:
Codex and local models as skill engines, cancelling a run, live usage telemetry.

`Desktop/Projects/Olympus` is the only checkout; the former active checkout is
archived under `Documents/New project`. The uncommitted Claude memory acceptance
notes are on local branch `codex/053-claude-memory-acceptance` there. The
fresh-turn recall gap seen November 9 is addressed for skills by the
`recall_memory` tool, which returns learned records with their file paths; chat
recall itself is unchanged.

## Delivered architecture

- Explicit subscription/local routes, independent extraction/briefing/memory choices,
  account-bound preflight, and no paid API or silent provider fallback.
- Source-backed learned assertions in `09 - System/Learned`, immutable provenance,
  publication receipts, exact-file vault commits, and rebuildable derived retrieval.
- Scoped working-context checkpoints before history trimming, preserving operator
  source identities and separating suggestions from commitments.
- Researcher/verifier workflow with explicit engine selection, saved evidence,
  reusable completed stages, and parent-owned provisional memory publication.
- Existing SQLite/vault stores are reused; no gbrain dependency or service added.

## Verification - November 9, 2026, America/Phoenix

- Release gates: 891 Rust tests passed, 41 opt-in tests ignored; additional exact-file
  Git publication integration passed. All 89 scripts, frontend/MSI builds, 21 visual
  scenarios and 22 Organizer checks passed. Preview-port/locked-module environment
  failures were resolved and rerun, not suppressed.
- Installed executable is 0.53.0; its only difference from the built executable is
  Tauri's MSI bundle marker. SQLite quick_check passed and migration 7 is present.
- Installed saved conversation retained Kevin's briefing preference and explicit
  adoption requirement for decisions. Working checkpoint revision 2 retained sources
  and contained no invented committed next steps.
- Two actual installed research runs completed using Codex/gpt-6.1-sol, with two
  stages each and five supported findings each. First took 61.17 seconds; second
  72.81 seconds. The second reused five prior findings with original source evidence.
- Publication receipts, original source fingerprints, manifest contents and exact
  vault Git tracking passed independent read-only checks. App restart preserved
  both runs, the conversation, learned files, selected engines and checkpoint.
- The second run finished before close; interrupted-run/resume and checkpoint
  compaction have synthetic native coverage, not installed acceptance in this session.

## Immediate remaining check

Codex reached 92% of its included weekly allowance, zero purchased credits;
Olympus's 90% preflight ceiling blocks new requests. Startup correctly retained
its dated prior brief rather than claiming a fresh result. This is not Gmail auth.
Memory is explicitly selected to Codex. At 22:56 the automatic worker archived the
acceptance conversation after ten quiet minutes, then its learning request hit the
allowance gate. The failed receipt is retained and memory watermark remains zero;
live learned-assertion extraction/recall are not yet proven.
Permission was requested to finish through Claude using this acceptance conversation
and relevant saved Olympus research/memory context. Do not switch or transmit that
private context to Claude until answered. Do not bypass the allowance ceiling.

Acceptance conversation: `023d6d61-ffc9-4023-bb8a-7bdfd946f763`.
Read-only checker/logs are under ignored
`.superpowers/sdd/2026-11-08-memory-orchestration-borrowing/`.
Never backdate production conversation rows to accelerate quiet-time testing.

## Continuing quality boundaries

Kevin wants concise conversational briefs: relevant changes, implications, whether
he needs to act, recent actual work and useful suggested next steps. Do not force
Olympus into every brief or include routine "About this brief" prose. That requested
copy/composition refinement remains pending; this release focused on memory/workflow.

Earlier 0.52 installed checks verified automatic Gmail sync and Codex extraction/
investigative briefing, but only a narrow personal baseline. Local qwen3:8b extraction
and qwen3:14b investigation remain unqualified for semantic reliability. CPU extraction
also timed out. Do not describe local analysis as repaired or silently fall back.

No mailbox mutation, live OAuth revoke/re-add, paid API or private-vault push occurred.
Google OAuth publishing mode and multi-day grant durability remain unverified.
Olympus must be open and the PC awake for background work. Private Claude acceptance
and coding delegation are separate from the completed research pilot. Sources and
recommendations never grant authority. Do not collect other chats automatically.

Reference review: `docs/reviews/2026-11-08-gbrain-memory-orchestration.md`.
Kevin approved borrowing ideas incrementally, not adopting gbrain.

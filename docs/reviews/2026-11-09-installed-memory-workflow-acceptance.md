# Installed memory and workflow acceptance

Observed November 9, 2026, America/Phoenix. Release PR33 merged as
`738a9e8901575c69f9fb44b033b2bfcef7a8e831`; `npm run update` installed and launched
Olympus 0.53.0. These checks used the installed WebView2 app and its real SQLite
database and vault, not the browser harness.

## Release verification

The release passed 891 normal Rust tests (41 opt-in tests ignored), the additional
exact-file publication Git integration test, all 89 script checks, production
frontend/MSI builds, and visual review (21 scenarios and 22 Organizer checks).
Legacy-port script failures were rerun against the shared preview server; none
were disabled. The first updater attempt hit a locked Rolldown module; closing
the preview server allowed the complete updater to succeed.

The installed executable reports 0.53.0. Its bytes match the built executable
except the three-character Tauri bundle marker (`MSI` installed versus `UNK`
in the unbundled executable). SQLite `quick_check` returned `ok`, and the
working-checkpoint migration is present.

## Installed observations

- Conversation and memory engines were explicitly selected to Codex. A saved
  conversation restated Kevin's existing conversational briefing preference and
  the distinction between assistant suggestions and operator decisions. Both
  replies preserved that distinction. No invented personal preference was used.
- The conversation produced an `olympus`-scoped checkpoint, revision 2, with
  source message identities and revisions. Unclassified operator context remained
  intact and the checkpoint contained no invented committed next steps.
- An actual Research Verification run used three saved research excerpts and two
  Codex subscription requests, both reporting `gpt-6.1-sol`. It completed in
  61.17 seconds with five supported claims. The claims described source material
  and its limitations, rather than treating proposed designs as implementation
  or safety guarantees.
- The parent published five provisional learned records. Their publication
  receipt fingerprints, manifest contents, original source fingerprints and
  exact-file vault Git tracking were verified independently.
- Repeating the question supplied all five prior findings to the second run.
  Both stages again used Codex; the run completed in 72.81 seconds and published
  its supported findings with valid receipts. Prior findings were accompanied by
  original sources, not counted as independent corroboration.
- After closing and relaunching the installed app, both completed runs, learned
  records, engine selection, conversation and working checkpoint remained. The
  second run finished before the close took effect; this is persistence coverage,
  not an installed interrupted-run/resume test.

## Remaining live acceptance

After restart, Codex reported 92% of its included weekly allowance used, no
purchased credits, and no spend limit reached. Olympus's 90% preflight ceiling
blocked new reasoning requests. The startup brief retained its dated previous
version and did not falsely report a fresh result. This is an allowance gate,
not a Gmail authentication failure.

At 22:56 Phoenix, after the normal ten-minute quiet interval, the automatic
worker saved the conversation to Obsidian and attempted learning. Its Codex
request was blocked by the allowance preflight; the journal records failure and
the memory watermark stayed at zero. No learned assertions were fabricated. Claude authorization for the
remaining acceptance conversation and relevant saved research/memory context
was requested; no silent provider fallback was made. Automatic conversation
learning and fresh-turn recall remain pending until that check finishes.

Synthetic native tests already cover interruption recovery, checkpoint compaction,
and source-backed extraction; those do not substitute for the pending installed
conversation-learning check. No mailbox mutation, OAuth revoke/re-add, paid API,
or private-vault push was performed. Broader personal usefulness and the requested
briefing prose improvements remain separate work.

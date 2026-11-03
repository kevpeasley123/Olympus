# Olympus current-state review — November 2, 2026 (America/Phoenix)

Reviewed development HEAD 316f72b and all 39 initially modified/untracked paths.
The code remains gated/offline; this is a preservation checkpoint, not live readiness.

## Independent review findings

- `src-tauri/src/commands/chatgpt_plan/tokens.rs`, audience validation: a present
  mismatched authorized-party (`azp`) claim is ignored for scalar/single-item `aud`.
  Reject mismatched `azp` in every representation and add a signed regression before
  live activation. This review did not change token validation or open consent.
- `src-tauri/src/commands/chatgpt_plan/connection.rs`, connect commit boundary:
  cancellation can arrive after the last check while metadata is saving, after
  which credentials still persist. Coordinate cancellation and commit, and cover
  that interleaving before activation. Production currently refuses before effects.
- Design step 4 (Olympus access-token/custom-provider handoff to app-server) is
  incomplete. `subscription.rs` retains the old app-server command. Do not describe
  connection scaffolding as a working subscription conversation.

No closed production-gate bypass or fixture-to-production trust crossover was found.
Review is source evidence, not proof of vendor endpoint behavior or billing safety.

## Test fixture disposition

`test-signing-key.pk8` is a 2048-bit RSA fixture, referenced only within `cfg(test)`.
Its public modulus/exponent match `fixture.json`; synthetic subject/client values
are used. SHA-256: f7516d9aa0be6aab6de5fba61cf99a0dc58e7c545a15f5cb24b4e9bc5cc6a7a5.
Earlier source provenance explicitly records generated synthetic material; all 14
files in that native-source receipt still match. It is retained with its test,
not treated as a real account or production signing key. No private bytes printed.

## Fresh verification

- `cargo test --offline --locked --lib --manifest-path src-tauri/Cargo.toml`:
  625 passed, 24 ignored, zero failed. No broad `--ignored` run.
- `npm run build`: passed, existing chunk-size warning.
- `test-chatgpt-connection-browser.mjs`, `test-subscription-selection.mjs`,
  `test-guidance-docs.mjs`: passed.
- `npm run visual:review`: 21/21 captures, 14 functional, 22 Organizer checks passed.
  Narrow connection panel and Command screenshot inspected; no horizontal clipping.
- Original checkout `test-pantheon-figures.mjs`: passed. Its Zeus change remains there.
- Only two inspected read-only real-vault tests were separately selected by exact
  name: Research parser and temporary memory-index recall. Both passed. Research
  parser recognized the 14 imported works. Index reported four existing metadata
  issues outside the import; these were preserved and not silently repaired.

The prior synthetic-native receipt matches current source. Native/real-provider
acceptance was not rerun. Installed version 0.42.0 was read from executable metadata;
the app was not launched. No authentication, generation, billing, install or publish.

## Preserved work and remote facts

Development origin is the original local repository. GitHub subscription tip is
02db976; existing 5fa4341 and 316f72b are unpublished there. GitHub master 5d4c75d
is 14 commits beyond original master 218e6e0. Local tracking refs were stale; direct
ls-remote supplied current remote facts. No remote ref was changed.

Original master has three Zeus source/docs edits. Five other registered worktrees
were clean except the detached 0.30 install tree's three modifications; the temporary
acceptance tree has many missing tracked files. None were reset, cleaned or pruned.
Process-name inspection found Codex/node activity but no running Olympus/Claude/
Cargo/Rust process before testing. This does not prove other sessions are inactive.
Source hashes are rechecked before committing; no other chat history was collected.

## Research receipt

Source: https://alignment.anthropic.com/2026/anthropic-residency/.
Seven groups, 14 works; fresh source capture rather than the abandoned ZIP.
14 notes and their attachments were created exclusively in the existing vault.
Nine PDFs total 403 pages; five article-only full texts; 108 source images plus 218
rendered PDF figure/table-context pages. Total extracted primary text: 1,456,025
characters. Original URLs, file hashes and extraction limits are saved per source.
Source claims remain unevaluated; no generated summaries, invented graph values,
paid retrieval or model calls. Interactive applications and videos were not run.

Local review artifacts and import receipt:
`C:/Users/kevpe/OneDrive/Documents/New project/output/olympus-current/`.
Private vault history/profile/cache changes are excluded from application staging.

# Olympus 0.19.0 — independent code review

Date: 2026-09-28. Reviewer: Claude Code (cloud session), read-only.

| File | Contents |
| --- | --- |
| [FINDINGS.md](FINDINGS.md) | Every finding, ranked, with location, evidence, failure scenario and proposed fix |
| [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) | What the code actually is at 0.19.0 |
| [DOCUMENTATION-DRIFT.md](DOCUMENTATION-DRIFT.md) | Stale or contradictory documentation, kept separate from code defects |

## What was reviewed

- **Commit:** `e4669c9` on `origin/agent/curated-memory`, "Release Olympus 0.19.0 with runtime inspection and operational agent catalog". It is 11 commits ahead of `origin/master` (`8731ef7`, 0.11.1), and `master` has no commits the branch lacks. This matches the local state described in the handoff.
- **Checkout:** a clean detached worktree in a Linux cloud container. The Windows paths in the handoff (`Olympus Memory Worktree`, the other worktrees, and the vault) were **not accessible**. Unpushed local changes on the operator's machine, if any, were not seen.
- **Scope:**
  - The whole `src-tauri/src` and `src` trees, about 37k lines, split into six areas:
    - security and the write gate
    - model routing and chat
    - Gmail and Communications
    - delegation and agents
    - frontend state and rendering
    - documentation
  - Tauri configuration and capabilities, `schema.sql`, `package.json`, `Cargo.toml`.
  - The feature documents listed in the handoff prompt.
- **Not reviewed:** the Obsidian vault contents, PowerShell scripts in `scripts/` beyond grep, and the root `*-harness.html` pages except to confirm they are not bundled.
- **No production code was changed.** These reports are the only files added.

## Verification actually performed

| Check | Result |
| --- | --- |
| `npm ci` | Passed |
| `npm run build` (tsc + vite) | **Passed.** Warnings: direct `eval` in `gray-matter` (see S-1); main chunk 1,248 kB, `hybridScene` chunk 681 kB |
| `cargo test --lib` (Linux, after installing GTK/WebKit dev libraries) | **329 passed, 10 failed, 2 ignored.** All 10 failures are environmental: 9 assert the owner's real vault exists at its hardcoded Windows path, and 1 (`vault_write::rejects_absolute_and_unc_paths`) asserts Windows path semantics. On the owner's machine this adds up to the 339 passed the docs report. See finding Q-1. |
| Rust compiler warnings | 3: unused import `std::process::Command`, unused variable `app_id`, field `text` never read |
| Proof-of-concept probes | `gray-matter` runs `eval` on a `---js` block. `react-markdown` + `rehype-raw` output keeps `<iframe srcdoc="<script>…">` intact. Git's `diff-tree --name-only` quotes non-ASCII paths. All three were run in Node or git in the container. |

**Not performed:** launching the desktop app, any installed-build acceptance, any live OpenAI, Anthropic or Gmail call, and anything that needs Windows (keyring, `cmd /C start`, `taskkill`, WebView2). A finding marked CONFIRMED means the code path was traced by reading, and in the cases named above reproduced in isolation. It does not mean it was observed in the running app.

## Executive summary

The codebase is careful in the places it set out to be careful:

- Delegation approvals are backend-issued, single-use and bound to the full subject, and the approval tables have immutability triggers.
- Gmail OAuth uses PKCE, a loopback listener on 127.0.0.1, an exact `gmail.readonly` scope, and a route allowlist.
- API keys stay in Rust.
- SQL is parameterized.
- `memory_promotion` is a model writer.
- Structured model outputs are validated strictly.

The most serious problems sit at the edges of those designs.

1. **Research notes can run script in the privileged webview** (S-1, S-2). CSP is `null`, the Library renders note bodies with `rehype-raw`, and `gray-matter` `eval`s `---js` blocks. Any script in the webview can call every one of the 76 IPC commands. That includes resolving the operator's own write-gate dialog, copying any local file (such as `.env`) into the OneDrive-synced vault, and writing `.git/hooks` in the vault without confirmation. The fix is small: drop `rehype-raw` and `gray-matter`, and set a CSP.
2. **Silent data-loss paths in writers.** The Profile Observations appender treats "could not read" as "empty" and would replace the whole note (S-3). `write_memory_artifact` and `pantheon_migrate` behave the same way. Non-ASCII file names make every vault commit fail after the file is already written (M-6).
3. **Gmail sync and analysis have permanent-failure modes that occur with normal use.**
   - One spam message with an unknown charset wedges incremental sync forever (G-2).
   - The unpruned message table passes the 2,000-row analysis cap within months, after which Analyze and run history fail permanently (G-1).
   - Background situation analysis can retry paid calls every five minutes on errors that will always recur (M-16).
4. **Coding Delegate containment is weaker than documented** (S-4). The allowed `npm run build` and `cargo test` tools execute code the agent itself can edit, with `ANTHROPIC_API_KEY` in the environment. The operator-triggered checks then inherit the full environment, including `OPENAI_API_KEY`. A string mismatch (`'completed'` against `'complete'`) also means the catalog can never report a completed delegation (M-9).
5. **The hydration invariant has a hole on the error path.** One undecodable conversation side-row makes the load fall back to seed defaults, which are then saved over real settings (M-1).
6. **The documents agents read first are the most out of date.**
   - `CLAUDE.md` lists already-built approval work as "Next".
   - `docs/HANDOFF.md` stops at 0.15.0.
   - `README.md` names the wrong primary model.
   - `ARCHITECTURE.md` lists 29 of 76 commands and states falsely that the opener plugin is never called.

   See DOCUMENTATION-DRIFT.md.

Counts: 6 High, 25 Medium, and the rest Low.

## Recommended order of work

Proposals only; nothing here has been implemented.

1. **Close the webview script path** (S-1, S-2):
   - Remove `rehypeRaw` and render wikilinks as React elements.
   - Remove `gray-matter` and have Rust return `sourceLabel`.
   - Set a CSP and add a Tauri `on_navigation` guard (M-21).
   - Then make `save_attachment_to_vault` and `extract_pdf_text` accept only an opaque token from `pick_attachment_file`.
   - Restrict `write_memory_artifact` to an enum of derived artifacts.
   - Reject `.git` and `.obsidian` path components.
2. **Make every writer fail closed on read errors and recheck exact bytes after approval**, following the `memory_promotion` pattern (S-3, M-8). Add `-c core.quotePath=false` and `--literal-pathspecs` to vault git (M-6).
3. **Gmail robustness:**
   - Lossy MIME decode with a degraded status.
   - Scope checks before body decode.
   - A signature filtered to in-scope rows, plus pruning.
   - Fallback to full sync on the page limit.
   - Check the situation limit before the model call, with backoff.

   Covers G-1, G-2, M-14–M-17.
4. **Hydration error path:** keep a desktop load failure from marking state hydrated, and tolerate bad side-rows (M-1).
5. **Delegation hardening before any Coding pilot:**
   - Pass `--tools`, `--setting-sources` and `--strict-mcp-config`.
   - Add `env_clear` to the check runner.
   - Use a Job Object with a wall-clock limit.
   - Store PID plus creation time.
   - Fix the `'completed'` string.

   Covers S-4, M-9–M-13.
6. **Anthropic stream correctness:** byte-buffered SSE, plus handling for `error` events and a missing `message_stop` (M-2, M-3).
7. **Documentation:** rewrite the entry points (`CLAUDE.md` State of play and Next, `HANDOFF.md` header, README model ID, ARCHITECTURE command table and process audit). Rename older "Latest" headings in `NEXT-SESSION.md` to "Historical".
8. **Test hygiene:** mark the real-vault tests `#[ignore]`, or gate them on an env var, and make the Windows-path test `#[cfg(windows)]` (Q-1). Add regression tests for M-9, G-1, G-2 and S-3.

## Handoff prompt note

The prompt I received ended after section 3, "Product and architectural orientation". Its description mentioned review priorities, testing instructions and required report names that did not arrive. I used the structure above in their place. If those sections specified different report files, the content here can be rearranged without re-running the review.

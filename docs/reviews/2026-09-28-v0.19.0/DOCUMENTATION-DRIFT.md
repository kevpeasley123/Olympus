# Documentation drift — Olympus 0.19.0

This file lists places where documentation is stale or contradictory. Code defects are in FINDINGS.md. Test counts quoted by the docs are historical snapshots and were not re-run. Only "339 passed + 2 ignored" matches the 341 test attributes in the current source.

The largest problem is that the files agents are told to read first are the most out of date.

## Entry points (fix first)

| Doc:line | Says | Actually | Impact | Correction |
| --- | --- | --- | --- | --- |
| `CLAUDE.md:100` | "Next: review OPERATOR-APPROVAL-DESIGN.md, then implement verified approval…before any delegation pilot" | Implemented for 0.3.0 (`OPERATOR-APPROVAL-DESIGN.md:3`; `approvals.rs`). The pilot prerequisite was removed (`NEXT-SESSION.md:34-35`). | High: agents may rebuild existing machinery, which already happened once (`HANDOFF.md:92-97`) | State the current next step: a scoped paid Research run once credit is available, then Home semantic navigation |
| `CLAUDE.md:102`, `AGENTS.md:10` | `docs/HANDOFF.md` is the current handoff | `HANDOFF.md:1` stops at 0.15.0, and its body at 0.8.1 | High | Point to `NEXT-SESSION.md` §"Release 0.19.0", or rewrite HANDOFF |
| `CLAUDE.md:89` | Chat is "an actual Anthropic call" | OpenAI Responses is primary (`models.rs:8`). `CLAUDE.md:43` itself says so. | Medium: the file contradicts itself | Mark as historical |
| `CLAUDE.md:88` | Three tables | 43 | Low | Reference `schema.sql` |
| `CLAUDE.md:109` | "`cargo test --lib` and `npm run build` both pass on this branch" | 10 tests fail off the owner's machine (FINDINGS Q-1). `NEXT-SESSION.md:659` mentions a parallel HTTP fixture failure. | Medium | Qualify the claim, or cite the release receipt |
| `CLAUDE.md:47` | `claude-opus-5` is called "from `assistant.rs`" | Defined in `models.rs:10`; `assistant.rs:14` aliases it | Low | Say where it is defined |
| `CLAUDE.md:64` vs `OLYMPUS-MANUAL.md:166-178,225` | "It does not speak first… Not now" | The manual lists a proactive briefing as stage 1, and background situation analysis is approved | Medium: product intent is ambiguous | Reconcile. The manual is canonical. |
| `docs/HANDOFF.md:1-15` | Several "Latest" banners (0.15.0, 0.10.x, 0.9.0); "enable Dimensional core" | Current release is 0.19.0; the toggle was removed | High | Replace the header; archive the body |
| `docs/NEXT-SESSION.md` headings at :8, :54, :73, :87, :100, :113, :126, :300, :331, :343, :532 | At least 8 sections headed "Latest" or "Current" | Only :1–:8 are current. :548–649 is a stale embedded handoff ("installed 0.11.2", "3D-only…ask operator"). | High | Rename older headings "Historical"; archive :532–653 |

## README and architecture

| Doc:line | Says | Actually | Correction |
| --- | --- | --- | --- |
| `README.md:118` | Default Sol is `gpt-5.6-sol` | `gpt-6-sol` (`models.rs:8`) | Fix the ID |
| `README.md:155-157` | Preferences → Dimensional core toggle; SVG is the default | Removed; Command is 3D-only (`COMMAND-3D-LIFECYCLE.md:5`) | Rewrite |
| `README.md:21` | Modules: Command, Project, Pantheon, chat | Four modes, including Communications | Update |
| `README.md:143-149` | Five-row persistence table | 43 tables | Summarise by area |
| `README.md:9-14` | The delegation contract comes "before any launcher is allowed to execute"; the July 27 audit is the verified baseline | The launcher exists; the audit is historical | Date it |
| `ARCHITECTURE.md:47-57` | Command table of 29 | 76 registered (`lib.rs:341-397`); all Gmail, situation, communication, research-verification, knowledge-audit, model, delegation-review and voice-session commands are missing | Regenerate from `lib.rs` |
| `ARCHITECTURE.md:103-170` | "Three areas start a process" | Also `cmd /C start` (`lib.rs:231`), vault git (`vault_git.rs:28`), `npm`/`cargo` checks (`delegation_review.rs:93-111`), `tasklist`/`taskkill` (`delegation.rs:677,691`) | Re-audit every `Command::new` |
| `ARCHITECTURE.md:168` | The opener plugin "is registered…but never called" | Called at `gmail/auth.rs:165` and `gmail/situations/documents.rs:36` | Correct this; it is a security claim |
| `ARCHITECTURE.md:107,119-125,141,167` | Line citations in `lib.rs`, `projects.rs`, `useDashboardData.ts`, `assistant.rs`; "all four call sites" | Every cited line has moved; there are 8 git call sites | Cite function names instead |
| `ARCHITECTURE.md:1` vs `:7` | Communication Intelligence v3 "supersedes"; "No model calls" | v4 is live and makes model calls (`intelligence_v3.rs:5`) | Merge into one current section |
| `ARCHITECTURE.md:28` | Runtime dependency list | Missing `three`, `gray-matter`, `react-markdown`, `remark-gfm`, `rehype-raw`, `simple-icons`, `@fontsource/cinzel` | Update (and see FINDINGS S-1) |
| `ARCHITECTURE.md:223-227`, `.env.example:3-8` | Only `ANTHROPIC_API_KEY` is needed; OpenAI is "optional…voice" | `OPENAI_API_KEY` is required for primary chat | Swap which is required |
| `ARCHITECTURE.md:237` | Operator approval design is "proposed, not implemented" | Implemented | Fix |
| `ARCHITECTURE.md:254` | OAuth acceptance pending Google configuration | OAuth configured and first import done (`NEXT-SESSION.md:379,383`) | List the real remaining items |
| `ARCHITECTURE.md:264` | "Five" situation tables; "installed 0.17.0 unchanged" | Six (`schema.sql:248`); 0.19.0 released | Update |
| `ARCHITECTURE.md:35` | Layout shows `src-tauri/src/main.rs` | Real entry is `lib.rs` plus about 30 `commands/` modules | Update the layout |
| `VOICE.md:6` | "Keep ANTHROPIC_API_KEY: Olympus still uses its existing reasoning backend" | Reasoning is OpenAI | Rewrite |
| `OLYMPUS-MANUAL.md:72-110` | Surfaces: Command, Projects, Research | Communications is a fourth mode, mentioned only at `:221-233` | Add a Communications section |
| `OLYMPUS-MANUAL.md:177-178` | Priority 2 is coding delegation | Operator redirected to Research/Verification | Record the change |

## Feature docs

| Doc:line | Says | Actually | Correction |
| --- | --- | --- | --- |
| `docs/GMAIL.md:46`, `docs/COMMUNICATIONS.md:69,92` | Model calls happen only on a user question or explicit Analyze; "No background model jobs" | Background discovery and briefing run every 5 minutes (`situations.rs:287-297`), as intended by `COMMUNICATION-SITUATIONS.md:267-269` | Update |
| `docs/GMAIL.md:68` | An MIME failure "fails the batch" | And never recovers (FINDINGS G-2) | Document or fix |
| `docs/GMAIL.md:106` | Remove cache clears the mailbox | Derived communication data survives (FINDINGS M-19) | Document or fix |
| `docs/GMAIL-ACCEPTANCE.md:5` | PARTIAL, blocked by missing OAuth configuration | OAuth configured, import succeeded | Add a dated update |
| `docs/COMMUNICATIONS.md:1`, `GMAIL.md:1`, `COMMUNICATION-INTELLIGENCE.md:1`, `COMMUNICATION-ARCHITECTURE-CRITIQUE.md:1`, `KNOWLEDGE-WORKFLOWS.md:1-5` | Prepended banners call v3 "current development"; KNOWLEDGE-WORKFLOWS has v2 "No model calls" text above its title | v4 is released | Use one status line per doc |
| `docs/COMMUNICATION-SITUATIONS.md:1` | Opens with "## Latest: executive prioritization" | That belongs in `EXECUTIVE-PRIORITIZATION.md` | Move it |
| `docs/NEXT-SESSION.md:54-64`, `COMMAND-AGENT-CATALOG.md:3`, `RESEARCH-VERIFICATION-AGENTS.md:3` | "Not packaged/installed", "not an installed release" | Shipped in 0.19.0 | Mark as released |
| `docs/COMMAND-3D-IMPLEMENTATION.md:1-3` | Optional toggle, SVG default | Removed | Add a historical banner |
| `docs/AGENT-DELEGATION.md:4,107` | Driver is Claude Code 2.1.220 | 2.1.222 (`command_agents.rs:57`) | Reconcile |
| `docs/AGENT-DELEGATION.md` | "Pass only the minimum required environment"; "pauses and offers to protect" uncommitted work; a $5 run ceiling | The check runner inherits the full environment; dirty work produces an error; the budget is per launch (FINDINGS S-4, M-13) | Correct, or implement |
| `docs/OPERATOR-APPROVAL-DESIGN.md` | Runs record "unresolved issues" | Completion requires the field to be empty and never stores it (`delegation_review.rs:337`) | Correct |
| `docs/MODEL-ROUTING.md:44-46` | GPT-6 install should wait for live acceptance | 0.19.0 shipped GPT-6 without it | Record the decision |
| `schema.sql` vs `README.md:138` | The schema is `schema.sql` | Two tables live outside it; six are unused | See FINDINGS L-25 |

## Broken references

- All Markdown links (`[..](..)`) in the repository resolve.
- Plain-text references to missing files are all intentional:
  - `OLYMPUS-BRIEF.md` and `STATE-REVIEW.md` (`CLAUDE.md:103`) are deleted, with a note saying so.
  - `HOME-SOURCE-REVIEW.md`, `output/waku-agent-review/REVIEW.md` and the `output/olympus-*-install` receipts are private, outside the repository.
- Line-number citations in `ARCHITECTURE.md` are effectively broken (see above).

## Verification limits the docs themselves admit

These are still open.

- **Models:** paid acceptance for GPT-6 is unproven, with no completion, quality, latency or cost comparison (`MODEL-ROUTING.md:42-46`; `RELEASE-0.19.0.md:21-22`).
- **Coding Delegate:** no completed run; delegation acceptance (plan, checkpoint, edit, review, cancel, restart recovery) is open (`HANDOFF.md:47,74,100`).
- **Memory:** desktop acceptance of promotion approve/decline and of re-reading promoted memory is open (`HANDOFF.md:46,98,100-101`).
- **Gmail:** only the initial import is proven. MIME review, incremental sync and restart, grounded answers and disconnect are open (`NEXT-SESSION.md:379`). The SQLite database is unencrypted and BitLocker state is unverified (`:387`).
- **Voice:** barge-in, playback and acoustics need operator-only acceptance.
- **Visual:** real-data visual acceptance after 0.11.2 is unverified (`NEXT-SESSION.md:636-638`).
- **Diagnostics retention:** `model_requests` has no retention policy (`MODEL-ROUTING.md:34`).
- **Project scan:** `projectsRootPath` is still supplied by the frontend, and the git-config execution risk is rated "low while locally configured" (`ARCHITECTURE.md:125-140`).

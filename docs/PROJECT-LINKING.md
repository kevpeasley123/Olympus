# Project linking and dashboard membership

Implemented on `codex/project-command-presentation` following the approved October 11 project-linking design. This feature has not been installed by this session.

## Operator flow

- **Add project** accepts an existing folder, an HTTPS repository URL, or an idea name. Folders can live outside the discovery root. Existing links open the original project; removed links offer Restore.
- Olympus inspects a bounded set of source documents and shows the excerpts it found. Purpose, priority and constraints remain editable drafts until saved. A missing or private source does not prevent keeping the project.
- **Evaluate with Olympus** attaches the visible excerpts and saved answers to the existing conversation. Send remains explicit. Supplementary project context is restricted to that project's stable identity; normal conversation history remains available. Evaluation does not authorize work.
- **Use this brief** previews the complete proposed purpose and constraints through the existing vault confirmation dialog. Confirmed intent is published only after the reviewed bytes are written. The recorded next step is not silently adopted from a recommendation.
- **Remove from dashboard** preserves files, notes, tasks, research and work history. Undo and the durable removed-project list restore the same project. Active work and unreviewed results block removal.

## Storage and recovery

SQLite owns membership, source aliases, draft answers and revisions. First successful discovery adopts the existing portfolio; later discoveries wait for Add. Removed memberships remain tombstones. Separate legacy identities that share a Git common directory are preserved; an ambiguous new worktree requires choosing the intended project. A folder name cannot claim a note-only project's identity.

Membership changes update the shared dashboard state immediately. Failed membership reads show no unverified rows, and a slow scan cannot revive a removal or overwrite a newer brief.

Before an approved brief reaches disk, `project_brief_writes` reserves its identity and stores the reviewed before/after bytes. Registry publication is transactional. Recovery recognizes exactly written content without writing it again; changed or missing notes retain their project association and require a fresh review for another write. This does not promise cross-machine locking against Obsidian or OneDrive.

Local inspection is limited to twelve named text files, 32 KiB per file and 128 KiB total, with canonical path containment and UTF-8 checks. Public GitHub/GitLab README requests use fixed hosts, no credentials, no redirects, a 15-second timeout and a 32 KiB response ceiling. Private and unsupported repositories remain saved links with an explicit inspection limitation. No cloning, source execution or automatic model request is introduced.

## Verification

- Production TypeScript/Vite build passed; the existing large-bundle warning remains.
- Full Rust suite: **513 passed, 18 ignored**. The ignored checks require a machine-specific environment or provider acceptance.
- Project board derivation: 50 checks; delegation review: 31; attached turns: 17; Organizer contracts: 10; actual assessment-request/shared-membership contracts: 3.
- Project presentation: 24 existing browser checks and responsive screenshots passed. An initial browser startup timeout passed on a sequential rerun.
- New browser workflow covers folder picker contract, repository URL, idea, duplicate restore, removal guard, Undo, retained answers on failure, saved answers after navigation, explicit assessment handoff, responsive layout, Escape/focus return, and unavailable membership after failed refresh/navigation.
- Final visual regression: **21/21 scenarios, 57 functional checks and 22 Organizer browser checks passed**. Evidence is recorded in `output/project-linking/visual-final-stable.log` and `output/visual-review/latest/report.md`. A Windows buffer error in the test server's hot-reload socket prompted disabling hot reload for capture-only servers; normal development behavior is unchanged.

The screenshots were visually inspected. Button contrast was corrected, the brief was made more compact, and established project briefs were placed behind a disclosure. Browser fixtures use synthetic IPC; they do not establish native file-dialog/WebView2 acceptance. Live Git-host responses, real provider evaluation, and installed-app acceptance remain unverified. No live provider call, production project mutation, merge, push, packaging or installation was performed.

## Independent review

One fresh reviewer identified four important issues: stale shared membership, legacy alias ambiguity, extra assessment context, and interrupted brief publication. All were addressed with focused regressions, including actual request payload checks and injected database failures. The legacy identity and scope regressions were observed failing before their fixes. A source-revision test and recoverable-publication test were also observed failing before implementation.

Escape/focus behavior was treated as required accessibility under the approved specification and corrected after a failing browser assertion. Successful membership reloads now clear their error as part of the failure-recovery path. No review findings remain deferred.

## Implementation decisions

1. The Windows execution ledger and artifacts live under ignored `output/project-linking` instead of the shell-only skill helper. This keeps the work reviewable without new tooling; the cost is manual bookkeeping and retained local evidence files.
2. Membership and intake share the first backend commit because their command registration and revision guards are coupled. The tradeoff is a coarser rollback boundary.
3. Evaluation reuses the existing conversation and requires Send. This preserves the established approval boundary at the cost of one deliberate click.
4. Initial inspection prefers the first linked local folder over a remote README, with exact sources shown. Additional links are retained but are not all automatically inspected.
5. Capture-only servers disable hot reload. This avoids irrelevant socket failures on a busy Windows machine; source edits are intentionally not reflected during a capture run.

The named branch and worktree remain available for a later merge/install request. The installed application is not evidence of this branch's behavior.

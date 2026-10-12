> Archived on 2026-10-12: Superpowers plan or spec for work that has shipped. Current: `docs/ORGANIZER.md`, `docs/PROJECT-LINKING.md`, `docs/ELEVENLABS-VOICE.md`. Historical record; links inside it are not maintained.

# Project linking, assessment and dashboard membership

Status: proposed implementation specification, grounded in Kevin's approved conversational flow on October 11, 2026. This document needs review under the installed architectural workflow before implementation. It does not authorize live provider tests or destructive project deletion.

## Outcome

Make the Projects dashboard a deliberately managed portfolio. Kevin can add a folder, a Git repository link, or an idea with minimal input; review Olympus's understanding; answer essential gaps; and choose a next action. Removing a project means removing dashboard membership, with recovery, never deleting its files or history.

Preserve the presentation implemented in 80a56e0: name, project vision, recommendation and one work action. Management controls remain secondary. Do not introduce a setup wizard before the project can be saved.

## Existing code and the missing boundary

- `src-tauri/src/commands/projects.rs` scans direct child folders and unmatched vault project notes, with a 60-second cache. It currently derives IDs from names. A UI-only remove would reappear at the next scan; same-name folders cannot safely become separate memberships without stable identity.
- `project_notes.rs` supplies declared vision and next action. `TrackedProject` and the project board distinguish source facts, operator intent and recommendations.
- `schema.sql` already has a projects table, but the scanner does not use it as an enrollment registry. Add narrowly scoped membership/source/intake tables instead of silently reinterpreting historical rows.
- `useDashboardData.ts` supplies the same projects to the dashboard and assistant context. All consumers must see a consistent membership result.
- Existing native file dialogs, the assistant's explicit-send/context attachment path, Organizer, and vault compare-and-confirm writes can be reused.

## User experience

### Add project

An **Add project** button beside the Projects heading opens a small accessible dialog with three choices:

1. **Folder** — choose a folder using the native picker or paste its path. The folder can be outside the configured discovery root. Name defaults to the folder name; rename is optional. Canceling the picker leaves the draft intact.
2. **Git repository** — paste a repository URL. Infer a suggested name, show the normalized destination, and let the user save without requiring a clone. A later local folder can be linked to the same project.
3. **Start with an idea** — name is required; a short description is optional. There is no repository prerequisite.

One **Add project** action saves membership and opens its initial assessment. Saving succeeds even if a source cannot be inspected; the result states exactly what was unavailable and offers a retry or another source. There is no automatic execution or provider call from saving a project.

If the source is already linked, offer **Open existing project**. If it belongs to a removed project, offer **Restore project**. Distinct projects with identical display names remain distinct. Ambiguous existing discovery aliases require a choice rather than silently moving tasks or merging projects.

### Understand the project

The project workspace initially presents one compact **Project understanding** section:

- **What Olympus found:** a draft description with links to the bounded source excerpts supporting it, plus facts about available project material.
- **What needs your input:** at most three questions at once, chosen from missing purpose/outcome, current priority, and constraints. Answered questions persist and are not repeated after restart. Optional answers can be skipped; skips remain unknown rather than being invented.
- **Suggested next step:** clearly labeled advice. **Continue project** opens existing Organizer work; it does not start a paid or delegated run.

Initial inspection is local/source-based and labeled accordingly. **Evaluate with Olympus** deliberately sends the selected, inspectable source context and current answers through the existing assistant route. It uses the configured model and displays progress, cancellation and recoverable error states. AI understanding remains a proposal, not accepted vision, a commitment or execution approval. A configured model is not required just to add or manage a project.

The user can edit the draft and choose **Use this brief**. This presents the existing exact-content vault write review for the project's purpose and constraints; only approved, successfully saved content becomes confirmed intent. For an existing note, compare current bytes and preserve unrelated fields/content. A changed note triggers a fresh preview. A canceled/failed save keeps the intake draft. Model suggestions never populate `next_step` as an operator commitment; a separate explicit choice to adopt a next action is required.

### Remove and restore

Each card has a small **Project options** menu with **Link another source** and **Remove from dashboard**. Removal is an immediate reversible membership change with visible Undo. Copy states that files, repository, research and tasks are kept. **Removed projects** in project tools provides durable restore after the Undo notice disappears or the app restarts.

A project with an active delegation or unreviewed result cannot be removed until that work is resolved; the UI explains the specific run and links directly to its work/review. The backend enforces this too. Removal never cancels work implicitly. Deleting project files, repositories, notes, tasks or research is outside this feature.

Restoring brings back the same identity, source links, tasks and assessment. A missing folder does not prevent restore; it is shown as an unavailable source.

## Membership and identity

Use an additive SQLite registry with durable project IDs, source aliases, visibility and intake revisions. Keep existing discovered project IDs when unambiguous, preserving Organizer/delegation references. New manually linked projects get UUIDs, not name-derived IDs.

Normalize existing local paths with filesystem canonicalization and platform-aware comparison. Track the Git common directory for worktree aliases. A Git remote shared by two folders is a possible duplicate suggestion, not sufficient authority to merge them. Repository URL normalization removes cosmetic trailing slash/`.git`, preserves host/path semantics and rejects embedded credentials and unsafe URL schemes. Do not infer identity from display name alone.

First rollout preserves all currently discovered projects. Explicitly removed memberships leave durable tombstones across both folder and note discovery. Previously unseen automatic discoveries appear in a small **Discovered projects** list with Add actions instead of repeatedly joining the curated dashboard. Track initialization/version explicitly; an empty dashboard after user removals is not a first-run migration signal.

Membership writes increment a revision and invalidate the scan cache. A scan started before removal must not restore the row afterward. Registry updates and duplicate checks are transactional. Registry failure is surfaced; do not silently fall back to rediscovering removed projects. If the legacy discovery root is unavailable, independently linked projects still load with a source warning.

## Source inspection

A project can have multiple folder/repository sources. Linking does not clone, install dependencies, execute scripts, recurse through arbitrary source trees, follow instructions in documents, or change project files.

Local inspection reads a fixed small set of top-level documents and manifests: README variants, project manual/brief if present, and recognized package/build manifests. Maximum 12 files, 32 KiB per file and 128 KiB total; UTF-8 text only. Exclude secrets, hidden credential files, environment files, dependency folders and binaries. Canonicalize each file; reject symlink/junction escapes outside the selected folder. Preserve source path, fingerprint, excerpt and collection time. Malformed or oversized documents produce partial results, not success claims about unread material.

For Git links, version one can inspect public GitHub/GitLab repository metadata and README through bounded host-specific adapters. Other Git links, private repositories, and unavailable hosts can still be saved; show **Link a local folder to inspect this repository** rather than pretending their contents were read. No credential prompt or automatic clone. Remote access is HTTPS-only with fixed provider API endpoints, restricted redirects, bounded response bodies, timeout/cancellation, and no requests to arbitrary private/local addresses. Repository host access failures do not lose saved membership. No remote calls or real credentials are required in automated tests.

Before Evaluate with Olympus, display which excerpts will be sent. Treat every excerpt as untrusted evidence, separate from system instructions. Do not send unrelated project context. Store assessment provenance and source revisions; reinspection marks previous understanding stale rather than overwriting user-confirmed intent.

## Implementation boundaries

- Add focused Rust modules for membership storage, project source inspection and intake persistence; wire Tauri commands in `lib.rs` and additive schema in `schema.sql`.
- Reconcile registry membership with the existing scanner and preserve the scanner's real Git facts; do not build a second competing project list in React.
- Add a frontend project-management service and small add/assessment/options components beside ProjectsPanel. Reuse current dialog, focus, form and error styles. Native folder selection is unavailable in browser preview and must say so; synthetic browser fixtures exercise the same component contracts.
- Extend assistant attachment/context handling with bounded project-intake evidence. Reuse current configured model routing; no new model picker, provider or conversation system.
- Keep project purpose/accepted intent in the existing vault authority. SQLite owns membership and draft/review provenance. No hidden synchronization that can overwrite a concurrently edited vault note.

## Acceptance criteria

1. Folder, repository URL and idea each add a durable card with only the essential input. Outside-root folders work; invalid paths/URLs produce actionable inline errors.
2. A removed project stays removed after rescan and restart; Undo and the removed-project list restore the same ID and related work. No source files or research are changed by removal.
3. Duplicate folder aliases, linked worktrees, URL variants and rapid double submissions do not create duplicate memberships. Same-name distinct sources remain separate.
4. Existing projects retain their task/run associations. A failed discovery root does not erase linked projects. In-flight scan/assessment results cannot revive removal or attach to another project.
5. Source inspection stays within its allowlist and byte/path/network boundaries. Unavailable private/unsupported Git sources are explicitly uninspected.
6. Draft understanding is clearly distinguished from confirmed vision. Essential answers survive restart. Provider failure/cancellation preserves the project and answers; assessment never starts execution.
7. Confirmed briefs require a successful reviewed write; stale source/note revisions cannot silently overwrite newer evidence. Recommendation text is never adopted as a commitment automatically.
8. Add dialog and project menus support keyboard navigation, Escape, focus return, accessible errors, pending states and responsive layouts. Empty and all-removed dashboards have clear Add/Restore actions.
9. Unit/integration tests cover storage, race conditions, path/URL boundaries and migration; browser tests cover each user flow. Run production build, full Rust portable suite and required full visual regression. Native folder picker and real provider acceptance are reported separately; no paid/live provider tests are implicit in implementation.

## Scope limits

No destructive project deletion, automatic cloning, credential management, continuous repository monitoring, background paid evaluation or automatic delegation. These are not needed to deliver the approved link → understand → clarify → choose-next-action flow.

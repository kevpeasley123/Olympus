# Project linking and dashboard membership

Shipped in 0.28.0 (`7223f61`), following the approved October 11 project-linking design. Linking and membership changes work in the desktop app only; the browser preview disables **+ Add project**.

## Operator flow

- **+ Add project**, beside the Projects heading, accepts an existing folder, an HTTPS repository URL, or an idea name. Folders can live outside the discovery root. Existing links open the original project; removed links offer Restore. A card's **•••** menu offers **Link another source**.
- Olympus inspects a bounded set of source documents and shows the excerpts it found. Purpose, priority and constraints remain editable drafts until saved. A missing or private source does not prevent keeping the project. In Project detail these live under **Edit project brief & sources**.
- When a project has a linked folder, inspection reads that folder and makes no remote request; otherwise it tries the first repository link's public README. Additional links are retained but not automatically inspected.
- **Evaluate with Olympus** attaches the visible excerpts and saved answers to the existing conversation. Send remains explicit. Supplementary project context is restricted to that project's stable identity; normal conversation history remains available. Evaluation does not authorize work.
- **Use this brief** previews the complete proposed purpose and constraints through the existing vault confirmation dialog, which always asks (`ModifyAuthored`). Confirmed intent is published only after the reviewed bytes are written. Like the other vault writers, `confirm_project_brief` then commits exactly that note to the vault's Git (since 2026-10-12). The recorded next step is not silently adopted from a recommendation.
- **Remove from dashboard** (card **•••** menu) preserves files, notes, tasks, research and work history. Undo and the durable **Available & removed projects** list restore the same project. Active work and unreviewed results block removal.

## Storage and recovery

SQLite owns membership, source aliases, draft answers and revisions. First successful discovery adopts the existing portfolio; later discoveries wait for Add. Removed memberships remain tombstones. Separate legacy identities that share a Git common directory are preserved; an ambiguous new worktree requires choosing the intended project. A folder name cannot claim a note-only project's identity.

Membership changes update the shared dashboard state immediately. Failed membership reads show no unverified rows, and a slow scan cannot revive a removal or overwrite a newer brief.

Before an approved brief reaches disk, `project_brief_writes` reserves its identity and stores the reviewed before/after bytes. Registry publication is transactional. Recovery recognizes exactly written content without writing it again; changed or missing notes retain their project association and require a fresh review for another write. This does not promise cross-machine locking against Obsidian or OneDrive.

Local inspection is limited to twelve named text files, 32 KiB per file and 128 KiB total, with canonical path containment and UTF-8 checks. Public GitHub/GitLab README requests use fixed hosts, no credentials, no redirects, a 15-second timeout and a 32 KiB response ceiling. Private and unsupported repositories remain saved links with an explicit inspection limitation. No cloning, source execution or automatic model request is introduced.

## Verification

`node scripts/test-project-linking.mjs` (browser workflow with synthetic IPC), `node scripts/test-project-linking-contracts.mjs`, and the Rust tests in `project_registry.rs` and `project_intake.rs`. The branch's original verification counts, independent review and implementation decisions are recorded in this file as of `7223f61`. Native file-dialog/WebView2 behaviour, live Git-host responses and real provider evaluation are not accepted in the desktop app.

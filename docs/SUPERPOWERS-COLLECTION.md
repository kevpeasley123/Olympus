# Superpowers collection pilot

Approved in chat 01a118cb-9a78-76d2-abbe-c97f511900a5 on October 8, 2026.

## Implemented
Armory Skills contains a curated reference collection with six summarized skills, pinned upstream links (revision 8ca22dba9a94f28898bbce59f2537ff4d87c747d), source review date, Olympus application rules, and explicit readiness limits. A non-animated reference star in the Skills constellation opens the same panel. The compiled skill count remains unchanged; the additional collection is labeled separately. Hephaestus has a suggested-reference link, not an assigned executable skill.

Source -> Olympus summary -> agent loadout -> mission evidence -> memory is the intended lineage, explicitly identified as partially unconnected. These summaries are repository-owned metadata; no upstream script, hook, dependency or skill instruction is executed/imported by the UI. Links are pinned and opened only on user selection.

## Codex installation
The marketplace query reported Superpowers available but not installed at implementation time. A plugin installation suggestion was issued. A final marketplace recheck confirmed installed=true after the user completed installation. No installation step remains. Olympus does not observe the installation status and does not infer it from the catalog. No optional visual companion or telemetry was enabled. AGENTS.md records the approved pilot boundaries.

## Remaining integration
Backend-bound assignment, skill-use events, mission highlighting/history, automated memory lineage, and native acceptance are pending. Do not display active usage from availability alone. No new provider/spending authority is granted.

## Verification
Production build and scripts/skill-collection-review.mjs; Armory interaction regression. Collection tests exercise star inspection, six expandable summaries, pinned source links, Hephaestus reference, unchanged mission count and widths 1672/1280. Browser fixtures do not prove native backend execution.

Final regression: 21/21 visual scenarios and 57 functional checks passed.


## Hephaestus execution pilot (2026-10-08)
The native project-delegation adapter now supplies a small Olympus-authored adaptation of the pinned Superpowers source. This is not the upstream plugin loaded into Claude Code. The exact compiled instructions live in `src-tauri/src/commands/hephaestus-guidance.txt`.

Planning and implementation approval subjects include the entire guidance and SHA-256. Exact scope comparison rejects stale or changed scopes. Instructions are appended to the provider prompt, and a `guidance_prepared` event is persisted before process launch; a failed event write prevents launch. That event records preparation, not successful launch or model compliance. Existing process and result records provide subsequent evidence. Historical runs are not assigned fabricated skill usage.

The native Armory binds `hephaestus-engineering@1` to coding-delegate (Hephaestus). Browser fixtures retain their own unconnected state. The provider remains the existing Claude Code driver with separate approvals, fixed commands, isolated worktree, $5 per launch and 45-minute limit. No automatic commit, push, merge, deployment, Monid invocation or memory promotion is added. Zeus/chat still cannot grant execution approval; use Project delegation.

Live-provider acceptance remains pending an operator-approved task. No provider launch was performed to verify this integration. Automatic memory lineage and automated independent review remain future work.

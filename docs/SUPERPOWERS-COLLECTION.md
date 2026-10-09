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

# Command — Capability Armory and Chat/Mission workspace

Implemented 2026-09-29 from `c432f48` (0.20.0), committed as `9ad66b7` and released in 0.21.0. Verified then in a Linux container with Chromium (SwiftShader WebGL); no WebView2 run was part of this work.

**Still current:** the read-only backend projection (`command_capabilities`, `command_missions`), the capability model and the polling cadence below. They feed the Olympus Armory, the Pantheon constellations and mission planets, and the companion's Active missions list.

**Replaced:** the capability ring, its agent lens and the console layout this redesign put on screen. On 2026-10-07 they gave way first to orbital capability cards ([COMMAND-REFERENCE-2026-10-07.md](archive/COMMAND-REFERENCE-2026-10-07.md)) and then to the flagship ([COMMAND-FLAGSHIP.md](COMMAND-FLAGSHIP.md), [COMMAND-MISSION-PANTHEON.md](COMMAND-MISSION-PANTHEON.md)). The app no longer renders them; they survive in `command-agent-harness.html` without `?flagship`, which is the composition `npm run visual:review` captures ([VISUAL-REVIEW.md](VISUAL-REVIEW.md)).

## 1. Internal design note (written before implementation)

Superseded. It recorded the project ring's ownership, the tool and skill sources, the three-state console in a four-track grid, and the six-step plan that section 2 implemented. The full note is in `9ad66b7`.

## 2. What was built

### Responsibility

Command answers "what can Olympus do, who is doing it, and what is happening now". Project mode answers "what is the state of my projects". Nothing project-specific remains on Command: no project sectors, no scan readout, no project hover, no project-targeted execution. The SVG ProjectRing component and the depth-preview page were deleted. `projectRing.ts` and `projectConstellation.ts` stay because `commandLayout` (`hybridCore.ts`) still computes the project anchors and note-field placement; the app has not drawn that 3D note field since 2026-10-07 (`904020f`). Project mode is untouched.

### Capability model

- **Domain**: eight fixed domains: Communications, Research, Knowledge, Code, Reasoning, Voice, Files, System. A domain's count is the number of Tools and Skills in it.
- **Tool**: real, invokable access that Olympus already has in code (14): Gmail, Pantheon library, Obsidian vault, Obsidian handoff, Git, Claude Code, the three reasoning routes from `models.rs` (Sol, Astra, Claude comparison), Realtime voice, transcription, file attachments, quick apps, guarded browser handoff. Each carries its authority, effects, approval requirement, which agents and workflows use it, and usage counted from persisted runs.
- **Skill**: a versioned instruction contract. Seven are compiled contracts that workflow nodes bind: `communication-assess@2`, `project-relevance@2`, `situation-discovery@1`, `situation-briefing@1`, `research-retrieval@1`, `evidence-synthesis@1`, `claim-verification@1`. Since 2026-10-08 `hephaestus-engineering` (Superpowers-derived pilot guidance) is bound to the Coding Delegate, and since 2026-10-07 skills the operator adds through resource intake are listed too, as instructions with no execution or tool authority ([RESOURCE-INTAKE.md](RESOURCE-INTAKE.md)). Helper functions and Knowledge Audit (a workflow without skill contracts) are not skills. The checked-in `capabilitiesFixture.json` predates both additions and still lists seven skills.
- **State** (per capability, derived in `capabilities.ts`): Available, In scope (lens or domain reveals it), Active (a running mission's active step uses it), Completed (a finished step used it), Unavailable (observed missing: key absent, folder missing, executable not found), Requires approval (Claude Code).

Availability is observed in `Environment::observe()` (keys present in the Rust process, vault and research folders, `git` on PATH, the Claude Code executable lookup). Keys are checked for presence only; values never leave Rust.

### Backend (read-only)

`src-tauri/src/commands/capabilities.rs`:

- `command_capabilities` — domains, tools, skills, agent bindings. Research @1 binds Pantheon + Sol and `research-retrieval`/`evidence-synthesis`; Verification @1 binds `claim-verification`; Coding Delegate binds Claude Code + Git and, since 2026-10-08, `hephaestus-engineering`; Olympus Core is the aggregate.
- `command_missions` — up to six recent missions projected from `research_verification_runs`, `communication_runs`/`communication_events`, `knowledge_audit_runs`/`knowledge_audit_events` and `delegation_runs`, running first. A step is Active only if the run is running and its recorded events say so; a finished run never reports an active step. A delegation waiting on its implementation approval reports that approval notice.

No schema change, no new table, no write. 7 unit tests plus an ignored fixture writer (`OLYMPUS_CAPABILITIES_FIXTURE=<path> cargo test --lib write_capability_fixture -- --ignored`) that regenerates `src/services/capabilitiesFixture.json` from a synthetic in-memory database.

### Ring and lens

Superseded on 2026-10-07. `capabilityRing.ts` and `CapabilityRing.tsx` remain and render only in the non-flagship harness composition. The flagship shows tools and skills as the Plugins and Skills constellations and in the Armory dialog.

### Chat workspace

`ChatPanel` gained a `layout`: `expanded` (persisted per viewer in `localStorage` `olympus.commandChatLayout`) and `compact` (the anchored command bar with dormant/engaged/transcript). This redesign left conversation persistence, the one-turn model route, Text/Voice, Auto Speak, attachments and observations unchanged. Since 2026-10-07 the app renders the console as the companion, whose expanded layout has Overview and Conversation tabs, and since 2026-10-11 the same console serves every mode ([COMMAND-CONSOLE.md](COMMAND-CONSOLE.md)). The idle state with "What would you like to work on?" and capability-grounded suggestions renders only without `companion`, which now means only in the non-flagship harness.

### Mission View

`MissionView.tsx` shows a mission: status, request, plan steps with the agent owning each, active agents/tools/skills, approval notice, result, and "From recorded run events", with Open-in-destination. In the companion it opens inside the Active missions list for the selected running or waiting mission. The compact console shows a one-line strip, which can also show a mission that finished within the last 20 minutes (`RECENT_MISSION_MS`) and has not been dismissed.

In the flagship the same projection drives the Armory roster's Working and Waiting states, the mission planets and the Active missions list. `useCommandArmory` polls missions every 2.5 s while one runs and every 15 s otherwise; capabilities every 60 s and on focus.

### Authority

Nothing in the redesign starts, cancels, approves or writes. Selecting agents, domains, capabilities and suggestions is inspection or composer-filling. The Command harness asserts the IPC allowlist: every invoked command is a read. Resource intake, added beside the Armory on 2026-10-07, is a separate explicit write workflow ([RESOURCE-INTAKE.md](RESOURCE-INTAKE.md)).

## 3. Not yet live

- Missions exist only for runs Olympus already records (research verification, communication intelligence, knowledge audit, delegation). Chat turns are not missions. There is no Gmail/"Natalie" mission type, no Design Agent and no swarm orchestration; `docs/ARMORY-PLAN.md` covers those.
- The subscription (Claude Code) engine from `docs/ARMORY-PLAN.md` is not built. Phase 0b is partly done: `claude_executable()` now looks in `OLYMPUS_CLAUDE_CODE`, `PATH`, `~/.local/bin` and the npm location, and delegated children no longer receive `ANTHROPIC_API_KEY`. The engine spike must run on the owner's PC.
- The redesign superseded the plan's "stations around the project ring": the ring became the capability armory, itself replaced on 2026-10-07.

## 4. Manual review (desktop)

Superseded on 2026-10-07. The list walked the capability ring, lens and Agent Catalog, which the app no longer renders. Its remaining checks map onto the flagship as: start a Research Verification from Research and return to Command, where a mission planet, the Active missions list and the agent's Armory row follow the recorded steps and clear when the run ends; compact and expand the console and send a message in each; turn on reduced motion; check the owner's usual window size and a narrow one.

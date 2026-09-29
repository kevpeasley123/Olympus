# Command — Capability Armory and Chat/Mission workspace

Started 2026-09-29, from `c432f48` (0.20.0), in a cloud container. It builds, unit-tests and harness-tests here. No desktop or WebView2 run has taken place, and nothing is committed.

## 1. Internal design note (written before implementation)

**Current ring ownership.** `CommandInstrument` feeds `commandLayout(projects, graph, scale)` (`hybridCore.ts`) into two renderers:

- the SVG `ProjectRing` (sectors, curved names, hit targets, the project-owned note constellation, centre readouts);
- the WebGL scene (`hybridScene.ts` + `commandMaterialStudy.ts`). It builds one glass cassette and one engraved label per `layout.ring.segments[i].project`, lights the hovered project, and runs the "executing" signal along the note edges owned by `execution.projectId`.

`layoutProjectRing` and `layoutProjectConstellation` are used only by Command.

**Project coupling.** The following are Command presentation only:

- project segments, labels and hover readouts (name, open task count);
- the scan readout ("SCANNING…", "NO PROJECTS", "STALE");
- project hover glow, and the `execution.projectId` targeting.

Project mode (`ProjectsPanel`, the board, detail, delegation, briefing) does not use them. The note constellation is placed around project anchors, but it is vault knowledge, not project state.

**Agent sources.** `command_agents.rs` projects Olympus Core, Research @1 and Verification @1 (compiled `AgentDefinition`s with skill references), and the legacy Coding Delegate (the delegation driver, with no skill bindings). Availability comes from the OpenAI key and the Research folder. History comes from `research_verification_runs` and `delegation_runs`.

**Tool sources.** There is no tool registry. Real, invokable access exists for:

- Gmail (read-only OAuth cache);
- the Pantheon research library;
- the Obsidian vault (context reads; write-gated writes; Obsidian handoff);
- Git repository scans;
- Claude Code (delegation, behind approvals);
- the reasoning routes in `models.rs` (Sol, Astra, Claude comparison);
- Realtime speech and transcription;
- operator-picked file attachments with PDF extraction;
- quick-app launching (Windows);
- guarded browser handoff.

**Skill sources.** These are compiled contracts only:

- `communication-assess@2` and `project-relevance@2` (Communication Intelligence v4);
- `situation-discovery@1` and `situation-briefing@1` (Communication Situations v1);
- `research-retrieval@1`, `evidence-synthesis@1` and `claim-verification@1` (Research Verification v1).

Knowledge Audit is a workflow with no skill contracts. Helper functions are not skills.

**Chat architecture.** `ChatPanel` is one console with three states:

- `dormant`: the command bar only;
- `engaged`: an aperture holding the last three exchanges;
- `transcript`: a paged history.

It sits in the right grid column (Command: 44px rail, catalog .29, instrument .40, console .31). Voice, the one-turn model route (`ModelRouteControl`), Auto Speak, attachments and observations all live in the command bar. Messages come from `useDashboardData`, which is hydrated and gated, and the stream from `conversationStream`.

**Redesign approach.**

1. Add a read-only backend projection, `command_capabilities` (domains, tools, skills, agent bindings, availability, last use) and `command_missions` (running and recent structured runs projected from their own persisted events), using existing tables only.
2. Build the ring from capability domains through a generic segment shape (`id`, `label`, `count`, `emphasis`) that the SVG and WebGL renderers both consume. The note constellation stays as an ambient, non-interactive star field placed as before. Nothing else about the scene changes.
3. The lens (selected agent), domain hover and selection, and mission activity produce one `lit` map of domain and capability state. It drives the WebGL glow per frame, with no rebuild, plus a small SVG layer of contextual capability glyphs.
4. The Tool/Skill inspector lives in the catalog's detail region, so the centre gains no card.
5. The console gains a Command-only `expanded` layout that fills its own column: header, idle state with capability-grounded suggestions, conversation, pinned composer and Mission View. `compact` is today's console. Conversation state is unchanged.
6. The mission drives the agent highlight (left), domain and capability light plus the existing executing theater (centre), and mission steps (right). All three read the same projection.

## 2. What was built

### Responsibility

Command answers "what can Olympus do, who is doing it, and what is happening now". Project mode answers "what is the state of my projects". Nothing project-specific remains on the Command ring: no project sectors, no scan readout, no project hover, no project-targeted execution. `ProjectRing.tsx` and the `depth-preview` page were deleted. `projectRing.ts` (geometry, centre readout) and `projectConstellation.ts` (note field placement) stay, because the ring geometry and the ambient note field still use them. Project mode is untouched.

### Capability model

- **Domain**: one ring sector. Eight fixed domains: Communications, Research, Knowledge, Code, Reasoning, Voice, Files, System. A domain's count is the number of Tools and Skills in it.
- **Tool**: real, invokable access that Olympus already has in code (14): Gmail, Pantheon library, Obsidian vault, Obsidian handoff, Git, Claude Code, the three reasoning routes from `models.rs` (Sol, Astra, Claude comparison), Realtime voice, transcription, file attachments, quick apps, guarded browser handoff. Each carries its authority, effects, approval requirement, which agents and workflows use it, and usage counted from persisted runs.
- **Skill**: a compiled, versioned contract that a workflow node binds (7): `communication-assess@2`, `project-relevance@2`, `situation-discovery@1`, `situation-briefing@1`, `research-retrieval@1`, `evidence-synthesis@1`, `claim-verification@1`. Helper functions and Knowledge Audit (a workflow without skill contracts) are not skills.
- **State** (per capability, derived in `capabilities.ts`): Available, In scope (lens or domain reveals it), Active (a running mission's active step uses it), Completed (a finished step used it), Unavailable (observed missing: key absent, folder missing, executable not found), Requires approval (Claude Code).

Availability is observed in `Environment::observe()` (keys present in the Rust process, vault and research folders, `git` on PATH, the Claude Code executable lookup). Keys are checked for presence only; values never leave Rust.

### Backend (read-only)

`src-tauri/src/commands/capabilities.rs`:

- `command_capabilities` — domains, tools, skills, agent bindings. Research @1 binds Pantheon + Sol and `research-retrieval`/`evidence-synthesis`; Verification @1 binds `claim-verification`; Coding Delegate binds Claude Code + Git and no skills; Olympus Core is the aggregate.
- `command_missions` — up to six recent missions projected from `research_verification_runs`, `communication_runs`/`communication_events`, `knowledge_audit_runs`/`knowledge_audit_events` and `delegation_runs`, running first. A step is Active only if the run is running and its recorded events say so; a finished run never reports an active step. A delegation waiting on its implementation approval reports that approval notice.

No schema change, no new table, no write. 7 unit tests plus an ignored fixture writer (`OLYMPUS_CAPABILITIES_FIXTURE=<path> cargo test --lib write_capability_fixture -- --ignored`) that regenerates `src/services/capabilitiesFixture.json` from a synthetic in-memory database.

### Ring and lens

`capabilityRing.ts` lays out equal sectors with a gap at twelve o'clock; the SVG (`CapabilityRing.tsx`) and WebGL (`hybridScene.ts`, `commandMaterialStudy.ts`) renderers consume the same segments. One `light` map (domain → 0..1: active 1, hovered .9, in scope .75, completed .35) drives WebGL frame glow per frame, without rebuilding the scene.

Precedence (`armoryView`): a mission's recorded state, then a selected or hovered domain, then the lens. The Olympus Core lens reveals nothing (it would reveal everything). Revealed capabilities are drawn in their domain's wedge (tools as circles on the outer band, skills as diamonds inside it), with labels placed next to their glyph by `layoutRevealed`, which avoids label-label and label-glyph collisions and keeps labels out of the Ω. Keyboard: arrow keys move between domains, Enter reveals, Down enters the revealed capabilities, Escape returns. Selecting a capability opens its inspector in the catalog's detail region ("Inspection only").

The centre readout under the Ω shows a name only; kind, state and counts go to the status line under the dial, which has the width for them.

### Chat workspace

`ChatPanel` gains a Command-only `layout`: `expanded` (default in Command, persisted per viewer in `localStorage` `olympus.commandChatLayout`) fills the right column with a header, the conversation, a pinned composer and the Mission View; `compact` is the previous anchored command bar with dormant/engaged/transcript. Conversation persistence, the one-turn model route, Text/Voice, Auto Speak, attachments and observations are unchanged and remain in the command bar.

The idle state appears when nothing has been said this launch: "What would you like to work on?", the opening briefing if there is one, suggestions, and a link to the earlier conversation. Each suggestion requires the Tools it would lean on to be available, and clicking one only fills the composer.

### Mission View and execution theater

`MissionView.tsx` shows the current mission: status, request, plan steps with the agent owning each, active agents/tools/skills, approval notice, result, and "From recorded run events". It offers Open-in-destination and, once finished, Dismiss. A finished mission stays for 20 minutes unless dismissed. The compact console shows a one-line strip instead.

The same mission drives all three zones: the working agent rows (Olympus Core whenever any mission runs), the active domains and capabilities on the ring plus the existing executing theater (signals travel from active domains through the Ω), and the plan in the Mission View. `useCommandArmory` polls missions every 2.5 s while one runs and every 15 s otherwise; capabilities every 60 s and on focus.

### Authority

Nothing in the redesign starts, cancels, approves or writes. Selecting agents, domains, capabilities and suggestions is inspection or composer-filling. The Command harness asserts the IPC allowlist: every invoked command is a read.

## 3. Not yet live

- Missions exist only for runs Olympus already records (research verification, communication intelligence, knowledge audit, delegation). Chat turns are not missions. There is no Gmail/"Natalie" mission type, no Design Agent and no swarm orchestration; `docs/ARMORY-PLAN.md` covers those.
- The subscription (Claude Code) engine from `docs/ARMORY-PLAN.md` is not built. Phase 0b is partly done: `claude_executable()` now looks in `OLYMPUS_CLAUDE_CODE`, `PATH`, `~/.local/bin` and the npm location, and delegated children no longer receive `ANTHROPIC_API_KEY`. The engine spike must run on the owner's PC.
- The redesign supersedes the plan's "stations around the project ring": the ring is now the capability armory.
- Everything here was verified in a Linux container with Chromium (SwiftShader WebGL). No WebView2 or desktop run has taken place.

## 4. Manual review (desktop)

1. Command opens with the expanded chat, the catalog left, and the ring showing eight domain sectors; no project names.
2. Select Research Agent, then Verification, then Coding Delegate: the right Tools and Skills appear in their wedges; Coding Delegate shows Claude Code as unavailable or requiring approval, matching the machine.
3. Hover and click each domain; arrow keys move between domains.
4. Click a revealed capability: the inspector opens in the catalog; Back returns.
5. Start a Research Verification from the Research view and return to Command: the Mission View, working rows and ring light follow the recorded steps, and the mission ends when the run ends.
6. Compact and expand the chat; send a message in each; confirm Text/Voice, Auto Speak and the model route still work and history persists across restart.
7. Turn on reduced motion (OS setting): no ambient motion; state changes still visible.
8. Check at the owner's usual window size and at a narrow window.

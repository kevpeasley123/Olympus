# Command HUD — operational Agent Catalog

September 24, 2026. Implemented in the source worktree; not an installed release.

## COMMAND LAYOUT

Command now uses four grid tracks: the existing slim global rail, the Agent
Catalog, the existing Olympus instrument, and a reserved chat column. After the
rail and gaps, the three main regions use approximately 29% / 40% / 31%.

The center still renders the existing `CommandInstrument` and hybrid scene. No
ring segments, constellation nodes, project interactions, Ω geometry or renderer
were replaced with agents. The whole instrument fits its allocated center track
using its existing transform; label/interaction geometry continues through the
existing instrument implementation. Intrinsic flex width is constrained so its
layout box cannot extend into chat's track.

The left panel uses Olympus's dark glass surface, thin borders, restrained amber
selection and muted legacy state. Its list and selected details scroll separately;
there are no fixed slots limiting it to three agents. At very small widths below
801 px the regions stack in normal scroll flow instead of becoming overlapping
floating panels. The intended desktop layout remains three adjacent regions.

## AGENT CATALOG

Operational roles only:

- Research Agent @1 — compiled executable; configuration-dependent availability.
- Verification Agent @1 — compiled executable; configuration-dependent availability.
- Coding Delegate — existing executable machinery, legacy/unversioned. `UNPROVEN`
  when no completed delegation records exist; `RECORDED` if completion evidence
  exists, without asserting current readiness or generalized quality.

The count is `1 orchestrator · 3 agents`, computed from the returned role list.
No candidate/documentary Agent Index entries enter this endpoint or HUD. Models,
skills and workflows are not counted as agents. Research's deeper catalog still
retains its clearly separated documentary material.

## ORCHESTRATOR

Olympus Core appears separately as the main orchestrator. `ACTIVE` denotes the
running application orchestration surface, not a claim that an agent job is active.
Its capabilities are planning, routing, fixed graph execution, bounded agent
coordination and synthesis. Its detail states existing approval boundaries and
that chat cannot launch agents or grant execution consent. No “full system access”
or unrestricted authority was copied from the reference image.

## AGENT DETAILS

Selection updates the lower portion of the same left panel. It shows role,
definition version (or explicit legacy/unversioned), availability, real referenced
skills, authority, source scope, workflows, declared peer, recorded execution count,
last execution, model strategy and up to five recent executions. Technical handler
paths, schemas and full trace payloads remain in deeper inspection.

Empty history says `No recorded executions yet` and `Last execution: None`.
Research/Verification counts are dispatched child executions, including a separately
recorded clarification pass; they are not inflated parent workflow counts and do
not mean successful provider completions. Recent rows retain their recorded status
and original definition version. Pending children with no start time are excluded.

Coding Delegate uses actual delegation-table run counts and its last recorded start.
Its driver observation remains explicitly dated to the September 23 audit; this
view does not launch a probe, claim current authentication, or run a Coding pilot.

## CHAT RESERVE

The right track is a layout reservation in both compact and expanded states.
The existing console remains bottom-right when dormant and grows upward inside
that track for engaged dialogue and full history. Command overrides the old narrow
desktop rule that positioned chat as a fixed overlay. Chat expansion does not
resize or move the instrument and cannot cover the catalog or central Ω.

The source change is limited to Command layout; Project, Research and Communications
retain their existing chat arrangements.

## RUNTIME TRUTH

`command_agent_catalog` is a backend-owned read-only projection. It consumes:

- Compiled Research/Verification definitions and their actual skill references.
- Current presence of configured OpenAI credentials and the Research directory.
- Persisted `research_verification_runs` child records and `delegation_runs` rows.

`AVAILABLE` means configured to attempt the workflow, not a successful live provider
health/credit check. That limitation is stated in the selected role's availability
description. The view performs no API calls or paid availability probes. An unavailable
dependency is shown as `UNAVAILABLE`. A failed catalog read removes stale ready
claims instead of retaining a misleading green display.

The frontend has a read-only client with only `read()`. It refreshes on mount,
window focus, explicit refresh and a 30-second cadence, and displays observation
time. The backend does not read Markdown, mutate run state, call recovery, execute
agents, consume approval, register skills or change definitions. Tests assert that
reading the catalog leaves SQLite change counts and running statuses untouched.

Browser preview without a runtime reports missing observations; it never substitutes
fixture roles/history. Synthetic fixtures are isolated in the development harness.

## CROSS-LINKS

Research and Verification expose `Research Verification v1`. This navigates to the
existing Research/Pantheon surface and opens its existing workflow disclosure in
inspection-only mode. A recent execution opens its exact parent run there.
Starting/cancelling/retrying an agent is not exposed in this deep-linked mode.
`Return to Command catalog` restores Command with its selected role preserved.

Coding's `Project delegation` link opens the existing Project surface. It does not
prepare or authorize a delegation. The Command panel contains no launch control.

## FILES CHANGED

New:

- `src-tauri/src/commands/command_agents.rs`: read-only projection and SQLite tests.
- `src/services/commandAgents.ts`: typed read-only client and navigation target.
- `src/components/panels/CommandAgentCatalog.tsx`: operational list/detail panel.
- `src/components/panels/commandAgents.css`: Command zones and panel styling.
- `src/services/commandAgentsFixture.json`: synthetic backend projection fixture.
- `src/command-agent-harness.tsx`, `command-agent-harness.html`: combined Command
  visual, Agent Catalog, chat geometry and authority harness.
- This implementation report.

Updated:

- `src/App.tsx`: left catalog, selected-role state, existing-surface navigation.
- `src/components/panels/LibraryPanel.tsx`: opens the existing inspection disclosure.
- `src/components/panels/ResearchVerification.tsx`: read-only deep links and return.
- `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`: register the read endpoint.
- `src/hybrid-core-harness.tsx`: bounded polling for observed pointer settling,
  replacing a timing-sensitive fixed delay against 500 ms telemetry. The production
  renderer and the test's settling threshold are unchanged.
- `OLYMPUS-MANUAL.md`, `docs/NEXT-SESSION.md`: current Command surface and handoff.

Existing dirty migration/inspection/agent work is preserved. No agent definition,
authority, executor, graph or source-write behavior was expanded by this slice.

## TESTS

Fresh validation on September 24:

- Production build (`npm run build`, including TypeScript): passed, output in the
  temporary `olympus-command-agents-build` directory.
- Full Rust library suite: **339 passed, 0 failed, 2 paid tests ignored**.
- Command/catalog browser harness: **35 passed** at 1672 × 941, 1280 × 800 and
  960 × 800; the final narrow-label refinement was rechecked at 960 and 1672.
  Includes all role selections, missing dependencies, empty/persisted history,
  seven synthetic executors, read-only links, both chat expansion modes,
  non-overlap, unchanged instrument size and reduced motion.
- Existing instrument browser harness: **82 passed**, including live projection,
  environment motion, context loss/retry, reduced motion and hidden-view behavior.
- Existing Research Verification browser regressions: **22 passed**.
- `git diff --check`: passed (repository line-ending notices only).

The instrument harness initially exposed timing-sensitive sampling, including an
environment-motion check while another GPU preview was open. It passed in isolation
after the bounded telemetry polling refinement described above. Production motion
code and numerical thresholds were not changed.

Existing build warnings remain: browser `buffer` externalization, dependency `eval`,
and large bundles; Rust reports an existing unused field. Fixtures are synthetic;
their rows are not imported into the operational database.

## MANUAL REVIEW

Wide and narrower desktop layouts were inspected with the real instrument and chat
components under synthetic runtime data. The catalog remains left, Ω remains the
middle subject, and the expanded transcript remains in its right reserve.
Role selection, absent dependencies, empty/history states, legacy Coding, additional
synthetic executors and read-only cross-links were exercised in the harness.

This work does not establish native installed acceptance, live provider readiness,
or successful agent execution. No app installation, paid call, Coding pilot, vault
rewrite, commit or push is part of this task. No new agents, candidate HUD, generic
framework, agent editor, graph editor, peer chat, capability map or autonomous
launching was introduced.

param(
  [Parameter(Mandatory = $true)]
  [string]$VaultPath
)

$projectNotePath = Join-Path $VaultPath "01 - Projects\Project Olympus.md"
$decisionLogPath = Join-Path $VaultPath "04 - Decisions\Decision Log.md"
$maintenancePath = Join-Path $VaultPath "09 - System\Vault Maintenance Protocol.md"
$dashboardIaPath = Join-Path $VaultPath "09 - System\Dashboard Information Architecture.md"
$workspaceReadmePath = Join-Path $VaultPath "Projects Workspace\Project Olympus Workspace\README.md"

$projectNote = @'
---
title: Project Olympus
type: project
status: active
created: 2026-04-25
tags:
  - olympus/project
  - olympus/active
aliases:
  - Olympus
---

# Project Olympus

Project Olympus is the local command station being built for AI-assisted projects, research, skills, agents, and durable memory workflows.

> [!info] Current signal
> Olympus should feel like a command center for active projects first, with markets and weather as context and Obsidian as the long-term memory layer.

## Goals

- Build a professional local dashboard called Olympus.
- Keep the Obsidian vault as the real second-brain memory layer.
- Track projects, Git state, research, and reusable workflows from one place.
- Develop repeatable project scaffolds, skills, and agent patterns.

## Linked Notes

- [[Olympus Charter]]
- [[System Architecture]]
- [[User Profile]]
- [[Dashboard Information Architecture]]
- [[Skill Index]]
- [[Agent Index]]
- [[Decision Log]]

## Current Product Direction

Olympus now has a clearer home-screen hierarchy:

- `Tools` is a compact launch rail for repeatable utilities.
- `Markets` is ambient context, not the dominant dashboard surface.
- `Projects` is the primary center-column work surface.
- `Research Database` acts as a controlled entry point with add/view actions and a visible entry count.
- `Weather` is compact situational context.
- `Chat` is a persistent working window, not the hero of the page.

## Next Actions

- [ ] Make the Projects panel show three complete projects comfortably without visual crowding.
- [ ] Wire the Projects panel to real Git signals instead of seeded project state.
- [ ] Add a real `View Database` flow for research records.
- [ ] Decide the first live market/news API to test in Olympus.
- [ ] Keep the vault synchronized whenever the dashboard hierarchy changes materially.

## Codex Implementation

Olympus uses a Codex-native two-layer model:

- Layer 1: this Obsidian vault as strategy, memory, and durable project context.
- Layer 2: dedicated project workspaces with local `AGENTS.md` files for focused execution.
'@

$decisionLog = @'
---
title: Decision Log
type: decision-log
status: active
tags:
  - olympus/decisions
  - olympus/log
---

# Decision Log

Use this note to capture durable decisions for Olympus.

## Decisions

- 2026-04-25 - Obsidian is the real long-term memory layer; the Olympus dashboard is the command interface.
- 2026-04-25 - Start with human-approved AI actions.
- 2026-04-25 - Use Obsidian Markdown, Canvas, and Bases as first-class vault artifacts.
- 2026-04-25 - Use Codex with a two-layer model: Layer 1 for strategy and memory, Layer 2 for focused project execution with project-local `AGENTS.md` files.
- 2026-04-25 - Simplify the Olympus home screen around Tools, Markets, Projects, Research Database, Weather, and Chat instead of the old constellation/operator-brief concept.
- 2026-04-25 - Markets is ambient context; it should inform the operator without dominating the dashboard.
- 2026-04-25 - Projects is the primary center-column work surface and should reflect both Git activity and durable Obsidian context.
- 2026-04-25 - Research Database should behave as an entry point with add/view actions and an entry count, not as a wall of research cards.
- 2026-04-25 - After major dashboard refinements, sync the Obsidian vault before the project drifts too far from durable memory.
'@

$maintenance = @'
---
title: Vault Maintenance Protocol
type: system
status: active
tags:
  - olympus/system
  - olympus/vault-maintenance
aliases:
  - Olympus Maintenance Cadence
---

# Vault Maintenance Protocol

This note defines how Olympus should keep the Obsidian vault useful while the project evolves.

> [!summary] Operating rule
> Important Olympus changes should either update the vault directly or leave a clear reason why no vault update was needed.

## Update Cadence

- **Every meaningful project change:** update the relevant project, decision, task, skill, agent, or architecture note.
- **Every research ingestion:** create or update a research note in `02 - Research`.
- **Every architectural decision:** add an entry to [[Decision Log]].
- **Every new reusable workflow:** add or update a note in `05 - Skills` or `06 - Agents`.
- **Every working session:** review whether [[Project Olympus]], [[User Profile]], and the project workspace need updates.
- **Every major dashboard refinement pass:** update [[Project Olympus]], [[Decision Log]], and [[Dashboard Information Architecture]] together.
- **Before any commit or push that changes Olympus direction materially:** perform a vault sync pass.
- **Maximum drift rule:** if three meaningful dashboard or workflow changes happen without a vault update, stop and sync the vault before continuing.

## Quality Check

Before ending a meaningful Olympus session, check:

- Did the dashboard/app change create new durable knowledge?
- Did a decision happen that belongs in [[Decision Log]]?
- Did tasks or next actions change?
- Did user preferences become clearer?
- Did a new skill, agent, project scaffold, or research item emerge?
- Would a future AI session understand the current project state from the vault?

## Positive Change Criteria

A vault update is positive when it:

- Makes future context easier to recover.
- Reduces repeated explanation.
- Links research, tasks, decisions, and projects.
- Captures why a choice was made.
- Keeps the vault readable for a human, not just an AI.

## Default Behavior

When in doubt, prefer a small, clear update over leaving context trapped in chat.

Do not overwrite substantial user-written notes without explicit approval.

## Interface Sync Rule

When interface cleanup removes obsolete UI concepts, update the vault so future sessions do not keep reasoning from the old dashboard shape.

When refining the interface, update the vault if the preferred dashboard behavior, hierarchy, or primary interaction model changes in a durable way.
'@

$dashboardIa = @'
---
title: Dashboard Information Architecture
type: system
status: active
tags:
  - olympus/system
  - olympus/dashboard
  - olympus/information-architecture
---

# Dashboard Information Architecture

This note captures the current intended hierarchy of the Olympus home screen.

## Primary Hierarchy

1. `Projects`
   - The main working surface.
   - Should expose active work, Git state, recent signals, and recommended next steps.
2. `Research Database`
   - A controlled entry point for durable source material.
   - Should show entry count and add/view actions.
3. `Tools`
   - Compact launch rail for repeated utilities.
4. `Markets`
   - Ambient context strip.
   - Useful, but not the main purpose of the dashboard.
5. `Weather`
   - Compact situational context only.
6. `Chat`
   - Persistent working window.

## Panel Roles

### Projects

- Must feel like the reason Olympus exists.
- Should eventually combine local folder/Git truth with Obsidian intent/context.
- Should be easy to scan in one glance.

### Research Database

- Home screen should not dump the full library as the primary visual surface.
- Show the count of saved entries and actions to add/view.
- Durable source material should live in Obsidian-backed memory, not only in transient chat.

### Tools

- Rows should be compact, readable, and directly launchable.
- Tool labels matter more than decorative chrome.

### Markets

- Present key market context quickly.
- Detail can be hidden behind a collapsible disclosure.
- News is more useful than decorative market commentary.

### Weather

- One-line context is enough.

### Chat

- Keep it useful and persistent, but not oversized relative to Projects.
'@

$workspaceReadme = @'
# Project Olympus Workspace

Use this folder as the focused Layer 2 execution space for Olympus dashboard work.

## Structure

- 00 - Inputs - source materials, specs, references, transcripts, briefs
- 01 - Process - active plans, working docs, checklists, scratch structure
- 02 - Outputs - the things this project is producing
- 03 - Feedback - review notes, metrics, iteration learnings
- 05 - Skills - project-local skills and workflows

## Project Purpose

Refine and implement Olympus as a local command center where projects are the primary working surface, research is durable, and Obsidian remains the real memory layer.

## Current Focus

- tighten the dashboard information hierarchy
- make the Projects panel the true center surface
- keep Markets and Weather contextual instead of dominant
- maintain Obsidian sync so the vault stays trustworthy

## Shipped Outcome

Success means Olympus feels like a practical command station: compact tool launching, clear project visibility, controllable research ingestion, and a vault-backed memory model that stays in sync with product direction.
'@

Set-Content -LiteralPath $projectNotePath -Value $projectNote
Set-Content -LiteralPath $decisionLogPath -Value $decisionLog
Set-Content -LiteralPath $maintenancePath -Value $maintenance
Set-Content -LiteralPath $dashboardIaPath -Value $dashboardIa
Set-Content -LiteralPath $workspaceReadmePath -Value $workspaceReadme

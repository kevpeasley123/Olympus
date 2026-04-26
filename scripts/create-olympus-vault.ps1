param(
  [Parameter(Mandatory = $true)]
  [string]$VaultPath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $VaultPath -PathType Container)) {
  New-Item -ItemType Directory -Force -Path $VaultPath | Out-Null
}

$folders = @(
  "00 - Dashboard",
  "01 - Projects",
  "02 - Research",
  "03 - Tasks",
  "04 - Decisions",
  "05 - Skills",
  "06 - Agents",
  "07 - Templates",
  "08 - Daily Briefs",
  "09 - System"
)

foreach ($folder in $folders) {
  New-Item -ItemType Directory -Force -Path (Join-Path $VaultPath $folder) | Out-Null
}

function Write-VaultFile {
  param(
    [Parameter(Mandatory = $true)][string]$RelativePath,
    [Parameter(Mandatory = $true)][string]$Content
  )

  $path = Join-Path $VaultPath $RelativePath
  if (Test-Path -LiteralPath $path) {
    Write-Output "Skipped existing: $path"
    return
  }

  $parent = Split-Path -Parent $path
  if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }

  Set-Content -LiteralPath $path -Value $Content -Encoding UTF8
  Write-Output "Created: $path"
}

$today = Get-Date -Format "yyyy-MM-dd"

Write-VaultFile "09 - System\Olympus Charter.md" @"
---
title: Olympus Charter
type: system
status: active
tags:
  - olympus/system
  - olympus/charter
aliases:
  - Project Olympus Charter
---

# Olympus Charter

Olympus is a local-first command station for projects, research, AI memory, skills, agents, and daily operational intelligence.

> [!summary] North Star
> Olympus should feel like an extension of the operator: aware of active projects, durable research, preferences, workflows, and the next useful move.

## Core Principles

- Obsidian is the durable memory layer.
- The Olympus dashboard is the command interface.
- Research should become reusable memory, not disposable chat context.
- Skills and agents should be explicit, reviewable, and reusable.
- AI-generated actions should ask before risky writes or external effects.

## Core Links

- [[User Profile]]
- [[System Architecture]]
- [[Project Olympus]]
- [[Skill Index]]
- [[Agent Index]]
- [[Olympus Map.canvas]]
"@

Write-VaultFile "09 - System\User Profile.md" @"
---
title: User Profile
type: profile
status: seed
tags:
  - olympus/profile
  - olympus/memory
aliases:
  - Operator Profile
---

# User Profile

This note is the editable memory profile Olympus should use to understand preferences, recurring instructions, working style, and long-term context.

## Current Preferences

- Futuristic AI lab aesthetic with professional command-center density.
- Dense but curated interfaces.
- Obsidian should hold the real memory map.
- The dashboard should help operate the system, not replace the vault.
- Recommendations should be direct, practical, and tied to active projects.

## Recurring Instructions

- Ask before risky writes, external actions, or irreversible changes.
- Prefer durable notes, links, and project context over one-off chat memory.
- When research is added, summarize why it matters and connect it to projects.

## Open Questions

- What sources should feed the daily operator brief?
- Which project stacks should become reusable scaffold recipes?
- What agents should exist first?
"@

Write-VaultFile "09 - System\System Architecture.md" @"
---
title: System Architecture
type: architecture
status: active
tags:
  - olympus/system
  - olympus/architecture
aliases:
  - Olympus Architecture
---

# System Architecture

Olympus has three major surfaces:

- [[Project Olympus]] - the local dashboard and command station.
- [[User Profile]] - the editable personal memory layer.
- This Obsidian vault - the durable knowledge base.

## Flow

````mermaid
graph TD
    A[Research or source material] --> B[Olympus ingestion]
    B --> C[Brief-ready summary]
    C --> D[Obsidian research note]
    D --> E[Project context]
    E --> F[Daily operator brief]
````

## Vault Responsibilities

- Store project context.
- Store research summaries and source notes.
- Track decisions.
- Store task and next-action context.
- Store skill and agent definitions.
- Preserve daily briefs.

## Dashboard Responsibilities

- Surface the current operational picture.
- Draft briefs and summaries.
- Help choose and launch workflows.
- Write approved memory artifacts into this vault.
"@

Write-VaultFile "01 - Projects\Project Olympus.md" @"
---
title: Project Olympus
type: project
status: active
created: $today
tags:
  - olympus/project
  - olympus/active
aliases:
  - Olympus
---

# Project Olympus

Project Olympus is the local command station being built for AI-assisted projects, research, tasks, skills, agents, and daily briefings.

> [!info] Current signal
> Build the foundation: dashboard, Obsidian memory, reusable skills, and project scaffolding.

## Goals

- Create a professional dashboard called Olympus.
- Use this vault as the real second-brain memory layer.
- Develop repeatable workflows for research, projects, and daily planning.
- Build a library of deployable skills and agents.

## Linked Notes

- [[Olympus Charter]]
- [[System Architecture]]
- [[User Profile]]
- [[Skill Index]]
- [[Agent Index]]
- [[Olympus Next Actions]]

## Next Actions

- [ ] Review [[Olympus Map.canvas]].
- [ ] Add the first real research source to [[02 - Research]].
- [ ] Define the first three reusable project scaffold recipes.
- [ ] Draft the first daily operator brief in [[08 - Daily Briefs]].
"@

Write-VaultFile "05 - Skills\Skill Index.md" @"
---
title: Skill Index
type: skill-index
status: active
tags:
  - olympus/skills
  - olympus/index
---

# Skill Index

This index tracks reusable skills Olympus can call on when working with the vault, projects, research, and agents.

## Installed Codex Skills

- `obsidian-markdown` - create Obsidian Markdown with properties, wikilinks, callouts, tags, and embeds.
- `json-canvas` - create and validate Obsidian `.canvas` maps.
- `obsidian-bases` - create `.base` views for structured vault data.
- `obsidian-cli` - optional live interaction with Obsidian.
- `defuddle` - clean web pages into readable Markdown before summarization.

## Olympus Skill Categories

- Research ingestion
- Project context creation
- Daily brief generation
- Project scaffold creation
- Agent launch recipes
- Obsidian memory writing

## Related

- [[Obsidian Research Summary Skill]]
- [[Project Context Template]]
- [[Research Summary Template]]
"@

Write-VaultFile "05 - Skills\Obsidian Research Summary Skill.md" @"
---
title: Obsidian Research Summary Skill
type: skill
status: draft
tags:
  - olympus/skills
  - olympus/research
  - obsidian
---

# Obsidian Research Summary Skill

Use this workflow when turning an article, transcript, note, or source document into durable memory.

## Workflow

1. Capture title, source, author if available, and date.
2. Summarize the source in brief-ready language.
3. Extract key points.
4. Explain why it matters to active projects.
5. Link related notes using wikilinks.
6. Add follow-up actions.

## Output

Use [[Research Summary Template]].
"@

Write-VaultFile "06 - Agents\Agent Index.md" @"
---
title: Agent Index
type: agent-index
status: draft
tags:
  - olympus/agents
  - olympus/index
---

# Agent Index

This index will track deployable agents Olympus can use for recurring workflows.

## Candidate Agents

- Research Analyst - summarizes and connects source material.
- Project Architect - turns ideas into project plans and scaffold choices.
- Daily Briefing Officer - creates the daily operator brief.
- Obsidian Curator - maintains note structure, links, tags, and Bases.
- Codebase Navigator - reads existing repos and creates onboarding context.

## Agent Rules

- Agents should have a clear purpose.
- Agents should have inputs and outputs.
- Agents should write to the vault only after approval.
- Agents should preserve source links and rationale.
"@

Write-VaultFile "03 - Tasks\Olympus Next Actions.md" @"
---
title: Olympus Next Actions
type: task-list
status: active
tags:
  - olympus/tasks
  - olympus/active
---

# Olympus Next Actions

- [ ] Review the starter vault structure.
- [ ] Open [[Olympus Map.canvas]] and confirm the first map layout.
- [ ] Add your first real source to [[02 - Research]].
- [ ] Fill out [[User Profile]] with more preferences and recurring instructions.
- [ ] Define your first project scaffold recipe.
- [ ] Create the first daily brief.

## Related

- [[Project Olympus]]
- [[Olympus Charter]]
- [[System Architecture]]
"@

Write-VaultFile "04 - Decisions\Decision Log.md" @"
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

- $today - Obsidian is the real long-term memory layer; the Olympus dashboard is the command interface.
- $today - Start with human-approved AI actions.
- $today - Use Obsidian Markdown, Canvas, and Bases as first-class vault artifacts.
"@

Write-VaultFile "07 - Templates\Research Summary Template.md" @"
---
title: Research Summary Template
type: template
tags:
  - olympus/template
  - olympus/research
---

# {{title}}

> [!summary] Brief-ready summary
> 

## Source

- URL:
- Author:
- Date:
- Type:

## Key Points

- 

## Why It Matters


## Related Projects

- 

## Follow-Up Actions

- [ ] 
"@

Write-VaultFile "07 - Templates\Project Context Template.md" @"
---
title: Project Context Template
type: template
tags:
  - olympus/template
  - olympus/project
---

# {{project_name}}

> [!info] Current signal
> 

## Goal


## Current State


## Stack


## Key Decisions

- 

## Linked Research

- 

## Next Actions

- [ ] 
"@

Write-VaultFile "08 - Daily Briefs\$today.md" @"
---
title: $today
type: daily-brief
date: $today
tags:
  - olympus/daily-brief
---

# $today

## Operator Brief

> [!summary] Today’s signal
> Start Olympus cleanly: establish the vault, confirm the map, and begin feeding it real project/research context.

## Priorities

- Review [[Olympus Map.canvas]].
- Fill out [[User Profile]].
- Add first real research item.

## Project Status

- [[Project Olympus]] is active.

## Research Signals

- No real research has been added yet.

## Recommended Next Move

Open the map and begin with one real source or project note.
"@

Write-VaultFile "00 - Dashboard\Olympus Home.md" @"
---
title: Olympus Home
type: dashboard
status: active
tags:
  - olympus/dashboard
---

# Olympus Home

## Start Here

- [[Project Olympus]]
- [[Olympus Charter]]
- [[User Profile]]
- [[Olympus Next Actions]]
- [[Decision Log]]
- [[Skill Index]]
- [[Agent Index]]
- [[Olympus Map.canvas]]
- [[Olympus Memory.base]]

## Current Brief

![[08 - Daily Briefs/$today]]
"@

$canvas = @{
  nodes = @(
    @{ id = "0a1b2c3d4e5f6789"; type = "group"; x = -480; y = -280; width = 1240; height = 760; label = "Olympus Knowledge Map"; color = "5" },
    @{ id = "1111111111111111"; type = "file"; x = 0; y = 0; width = 300; height = 220; file = "01 - Projects/Project Olympus.md" },
    @{ id = "2222222222222222"; type = "file"; x = -390; y = 0; width = 300; height = 220; file = "09 - System/Olympus Charter.md" },
    @{ id = "3333333333333333"; type = "file"; x = 390; y = 0; width = 300; height = 220; file = "09 - System/User Profile.md" },
    @{ id = "4444444444444444"; type = "file"; x = -390; y = 320; width = 300; height = 220; file = "09 - System/System Architecture.md" },
    @{ id = "5555555555555555"; type = "file"; x = 0; y = 320; width = 300; height = 220; file = "03 - Tasks/Olympus Next Actions.md" },
    @{ id = "6666666666666666"; type = "file"; x = 390; y = 320; width = 300; height = 220; file = "05 - Skills/Skill Index.md" },
    @{ id = "7777777777777777"; type = "file"; x = 0; y = -230; width = 300; height = 170; file = "00 - Dashboard/Olympus Home.md" },
    @{ id = "8888888888888888"; type = "file"; x = 390; y = -230; width = 300; height = 170; file = "06 - Agents/Agent Index.md" }
  )
  edges = @(
    @{ id = "a000000000000001"; fromNode = "1111111111111111"; fromSide = "left"; toNode = "2222222222222222"; toSide = "right"; toEnd = "arrow"; label = "guided by" },
    @{ id = "a000000000000002"; fromNode = "1111111111111111"; fromSide = "right"; toNode = "3333333333333333"; toSide = "left"; toEnd = "arrow"; label = "personalized by" },
    @{ id = "a000000000000003"; fromNode = "4444444444444444"; fromSide = "top"; toNode = "1111111111111111"; toSide = "bottom"; toEnd = "arrow"; label = "defines" },
    @{ id = "a000000000000004"; fromNode = "5555555555555555"; fromSide = "top"; toNode = "1111111111111111"; toSide = "bottom"; toEnd = "arrow"; label = "advances" },
    @{ id = "a000000000000005"; fromNode = "6666666666666666"; fromSide = "left"; toNode = "1111111111111111"; toSide = "right"; toEnd = "arrow"; label = "extends" },
    @{ id = "a000000000000006"; fromNode = "7777777777777777"; fromSide = "bottom"; toNode = "1111111111111111"; toSide = "top"; toEnd = "arrow"; label = "opens into" },
    @{ id = "a000000000000007"; fromNode = "8888888888888888"; fromSide = "bottom"; toNode = "6666666666666666"; toSide = "top"; toEnd = "arrow"; label = "uses" }
  )
}

$canvasPath = Join-Path $VaultPath "Olympus Map.canvas"
if (-not (Test-Path -LiteralPath $canvasPath)) {
  $canvas | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $canvasPath -Encoding UTF8
  Write-Output "Created: $canvasPath"
} else {
  Write-Output "Skipped existing: $canvasPath"
}

Get-Content -Raw -LiteralPath $canvasPath | ConvertFrom-Json | Out-Null

$base = @"
filters:
  or:
    - 'file.hasTag("olympus/project")'
    - 'file.hasTag("olympus/research")'
    - 'file.hasTag("olympus/tasks")'
    - 'file.hasTag("olympus/decisions")'
    - 'file.hasTag("olympus/skills")'
    - 'file.hasTag("olympus/agents")'
    - 'file.hasTag("olympus/system")'
    - 'file.hasTag("olympus/profile")'
    - 'file.hasTag("olympus/daily-brief")'
formulas:
  age_days: '(now() - file.ctime).days.round(0)'
properties:
  type:
    displayName: "Type"
  status:
    displayName: "Status"
  formula.age_days:
    displayName: "Age Days"
views:
  - type: table
    name: "Olympus Memory"
    order:
      - file.name
      - type
      - status
      - formula.age_days
      - file.tags
  - type: cards
    name: "Projects"
    filters:
      and:
        - 'file.hasTag("olympus/project")'
    order:
      - file.name
      - status
      - file.tags
"@

Write-VaultFile "Olympus Memory.base" $base

Get-ChildItem -Recurse -File $VaultPath -Include *.md,*.canvas,*.base |
  Sort-Object FullName |
  Select-Object -ExpandProperty FullName

param(
  [Parameter(Mandatory = $true)]
  [string]$VaultPath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $VaultPath -PathType Container)) {
  throw "Vault path does not exist: $VaultPath"
}

$folders = @("Architecture", "Projects", "Research", "Skills", "Tasks", "Dashboard")
foreach ($folder in $folders) {
  New-Item -ItemType Directory -Force -Path (Join-Path $VaultPath $folder) | Out-Null
}

$files = @{}

$files["Architecture\System Architecture.md"] = @"
---
title: System Architecture
type: architecture
status: active
tags:
  - olympus/architecture
  - olympus/map
aliases:
  - Olympus Architecture
---

# System Architecture

Project Olympus is the command station. Obsidian is the durable memory layer.

> [!info] Operating model
> Olympus should coordinate projects, research, tasks, skills, and daily briefs while writing long-term knowledge into this vault as readable notes, canvases, and bases.

## Core Surfaces

- [[Project Olympus]] - local desktop command station
- [[Second AI Brain]] - Obsidian-backed memory system
- [[kepano obsidian-skills]] - rules for writing Obsidian-compatible artifacts
- [[Olympus Dashboard]] - command-center interface
- [[Olympus Next Actions]] - current task thread

## Memory Flow

````mermaid
graph TD
    A[Research or transcript] --> B[Olympus research ingestion]
    B --> C[Brief-ready summary]
    C --> D[Obsidian research note]
    D --> E[Project context]
    E --> F[Daily operator brief]
````

## Design Principle

The dashboard should never replace the vault. The vault is where the map becomes durable.
"@

$files["Projects\Project Olympus.md"] = @"
---
title: Project Olympus
type: project
status: active
stack: Tauri, React, TypeScript, Vite, SQLite, Obsidian Markdown
tags:
  - olympus/project
  - olympus/active
aliases:
  - Olympus
---

# Project Olympus

Project Olympus is a local-first command station for projects, research, workflows, reusable skills, and daily intelligence.

> [!summary] Current signal
> Build the command station while letting Obsidian become the real second-brain map underneath it.

## Goals

- Create a professional local dashboard called [[Olympus Dashboard]].
- Develop the real knowledge map in Obsidian through notes, links, Bases, and Canvas.
- Convert repeated project starts into reusable scaffold recipes.
- Keep AI actions human-approved until trust is earned.

## Linked Notes

- [[System Architecture]]
- [[Second AI Brain]]
- [[kepano obsidian-skills]]
- [[Olympus Next Actions]]

## Next Actions

- [ ] Review [[Olympus Map.canvas]] in Obsidian.
- [ ] Add the first real article or transcript to [[Research]].
- [ ] Convert preferred stacks into [[Skills]] recipes.
"@

$files["Projects\Second AI Brain.md"] = @"
---
title: Second AI Brain
type: project
status: forming
tags:
  - olympus/project
  - olympus/memory
aliases:
  - AI Memory Layer
---

# Second AI Brain

The second AI brain is the Obsidian-backed memory layer for Olympus. It should hold research, project context, preferences, reusable instructions, and decisions.

## Purpose

- Preserve context across AI sessions.
- Make research queryable and linkable.
- Give Olympus durable memory that is inspectable outside the app.

## Links

- [[Project Olympus]]
- [[System Architecture]]
- [[kepano obsidian-skills]]
"@

$files["Research\kepano obsidian-skills.md"] = @"
---
title: kepano obsidian-skills
type: research
source: https://github.com/kepano/obsidian-skills
source_type: github
tags:
  - olympus/research
  - obsidian
  - skills
  - canvas
  - bases
aliases:
  - Obsidian Skills
---

# kepano obsidian-skills

> [!summary] Brief-ready summary
> This repository provides agent skills for creating Obsidian Markdown, Bases, JSON Canvas files, Obsidian CLI workflows, and Defuddle-based web extraction. Olympus should use these skills to write real vault artifacts instead of simulating Obsidian inside the dashboard.

## Key Points

- `obsidian-markdown` defines frontmatter, wikilinks, embeds, callouts, properties, and tags.
- `json-canvas` defines valid `.canvas` nodes, edges, groups, IDs, and validation rules.
- `obsidian-bases` defines `.base` files with filters, formulas, properties, summaries, and views.
- `obsidian-cli` is optional and should not be required for Olympus V1.
- `defuddle` can later clean web articles into Markdown before ingestion.

## Why It Matters

This gives Olympus a rulebook for writing memory directly into [[Second AI Brain]] without inventing incompatible formats.

## Related

- [[Project Olympus]]
- [[System Architecture]]
- [[Olympus Map.canvas]]
"@

$files["Dashboard\Olympus Dashboard.md"] = @"
---
title: Olympus Dashboard
type: interface
status: active
tags:
  - olympus/dashboard
  - olympus/interface
---

# Olympus Dashboard

The dashboard is the command interface for Olympus. It should show active projects, operator briefs, research ingestion, skills, scaffolds, and next actions.

> [!warning] Boundary
> The dashboard should not pretend to be the Obsidian graph. The real map belongs in this vault through notes, links, Canvas, and Bases.

## Responsibilities

- Display command-center state.
- Draft briefs and summaries.
- Help approve writes into Obsidian.
- Launch reusable workflows and scaffolds.

## Connected Vault Artifacts

- [[Project Olympus]]
- [[System Architecture]]
- [[Olympus Next Actions]]
- [[kepano obsidian-skills]]
"@

$files["Tasks\Olympus Next Actions.md"] = @"
---
title: Olympus Next Actions
type: task-list
status: active
tags:
  - olympus/tasks
  - olympus/active
---

# Olympus Next Actions

- [ ] Open [[Olympus Map.canvas]] and confirm the first graph layout feels right.
- [ ] Add the first real research source to [[Research]].
- [ ] Decide the vault folder convention for project notes, research notes, skills, and briefs.
- [ ] Add a durable [[Personal Profile]] note for preferences and recurring instructions.
- [ ] Create scaffold recipes for preferred project stacks.

## Related

- [[Project Olympus]]
- [[Second AI Brain]]
- [[System Architecture]]
"@

$files["Skills\Obsidian Skills Installed.md"] = @"
---
title: Obsidian Skills Installed
type: skill-index
tags:
  - olympus/skills
  - obsidian
---

# Obsidian Skills Installed

These skills are installed in the Codex skills path and should guide future vault work.

## Skills

- `obsidian-markdown` - write Obsidian Markdown with properties, wikilinks, callouts, embeds, and tags.
- `json-canvas` - create and validate `.canvas` maps.
- `obsidian-bases` - create `.base` views with filters, formulas, and summaries.
- `obsidian-cli` - optional live interaction with Obsidian vaults.
- `defuddle` - future clean Markdown extraction from web pages.

## Applied To

- [[Project Olympus]]
- [[Second AI Brain]]
- [[Olympus Map.canvas]]
- [[Olympus Memory.base]]
"@

$files["Dashboard\Personal Profile.md"] = @"
---
title: Personal Profile
type: profile
status: seed
tags:
  - olympus/profile
  - olympus/memory
---

# Personal Profile

This note is the editable profile Olympus should use to remember preferences and recurring instructions.

## Current Preferences

- Futuristic AI lab aesthetic, but professional.
- Dense but curated command-center layout.
- Research should become reusable memory.
- Recommendations should be direct and useful.
- Obsidian is the durable memory layer, not just a dashboard decoration.

## Recurring Instructions

- Ask before risky writes or external actions.
- Prefer real vault artifacts over simulated memory views.
- Keep project context reusable across future AI sessions.
"@

foreach ($relative in $files.Keys) {
  $path = Join-Path $VaultPath $relative
  Set-Content -LiteralPath $path -Value $files[$relative] -Encoding UTF8
}

$canvas = @{
  nodes = @(
    @{ id = "0a1b2c3d4e5f6789"; type = "group"; x = -460; y = -260; width = 1180; height = 720; label = "Project Olympus Knowledge Map"; color = "5" },
    @{ id = "1111111111111111"; type = "file"; x = 20; y = 20; width = 300; height = 220; file = "Projects/Project Olympus.md" },
    @{ id = "2222222222222222"; type = "file"; x = -360; y = 20; width = 300; height = 220; file = "Architecture/System Architecture.md" },
    @{ id = "3333333333333333"; type = "file"; x = 400; y = 20; width = 300; height = 220; file = "Projects/Second AI Brain.md" },
    @{ id = "4444444444444444"; type = "file"; x = -360; y = 330; width = 300; height = 220; file = "Research/kepano obsidian-skills.md" },
    @{ id = "5555555555555555"; type = "file"; x = 20; y = 330; width = 300; height = 220; file = "Dashboard/Olympus Dashboard.md" },
    @{ id = "6666666666666666"; type = "file"; x = 400; y = 330; width = 300; height = 220; file = "Tasks/Olympus Next Actions.md" },
    @{ id = "7777777777777777"; type = "file"; x = 20; y = -210; width = 300; height = 170; file = "Skills/Obsidian Skills Installed.md" },
    @{ id = "8888888888888888"; type = "file"; x = 400; y = -210; width = 300; height = 170; file = "Dashboard/Personal Profile.md" }
  )
  edges = @(
    @{ id = "a000000000000001"; fromNode = "1111111111111111"; fromSide = "left"; toNode = "2222222222222222"; toSide = "right"; toEnd = "arrow"; label = "is designed by" },
    @{ id = "a000000000000002"; fromNode = "1111111111111111"; fromSide = "right"; toNode = "3333333333333333"; toSide = "left"; toEnd = "arrow"; label = "writes memory to" },
    @{ id = "a000000000000003"; fromNode = "4444444444444444"; fromSide = "top"; toNode = "2222222222222222"; toSide = "bottom"; toEnd = "arrow"; label = "informs" },
    @{ id = "a000000000000004"; fromNode = "5555555555555555"; fromSide = "top"; toNode = "1111111111111111"; toSide = "bottom"; toEnd = "arrow"; label = "controls" },
    @{ id = "a000000000000005"; fromNode = "6666666666666666"; fromSide = "top"; toNode = "1111111111111111"; toSide = "bottom"; toEnd = "arrow"; label = "advances" },
    @{ id = "a000000000000006"; fromNode = "7777777777777777"; fromSide = "bottom"; toNode = "4444444444444444"; toSide = "top"; toEnd = "arrow"; label = "derived from" },
    @{ id = "a000000000000007"; fromNode = "8888888888888888"; fromSide = "bottom"; toNode = "3333333333333333"; toSide = "top"; toEnd = "arrow"; label = "personalizes" }
  )
}

$canvasPath = Join-Path $VaultPath "Olympus Map.canvas"
$canvas | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $canvasPath -Encoding UTF8
Get-Content -Raw -LiteralPath $canvasPath | ConvertFrom-Json | Out-Null

$base = @"
filters:
  or:
    - 'file.hasTag("olympus/project")'
    - 'file.hasTag("olympus/research")'
    - 'file.hasTag("olympus/architecture")'
    - 'file.hasTag("olympus/tasks")'
    - 'file.hasTag("olympus/skills")'
    - 'file.hasTag("olympus/profile")'
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
    name: "Project Cards"
    filters:
      and:
        - 'file.hasTag("olympus/project")'
    order:
      - file.name
      - status
      - file.tags
"@

Set-Content -LiteralPath (Join-Path $VaultPath "Olympus Memory.base") -Value $base -Encoding UTF8

Get-ChildItem -Recurse -File $VaultPath -Include *.md,*.canvas,*.base |
  Sort-Object FullName |
  Select-Object -ExpandProperty FullName

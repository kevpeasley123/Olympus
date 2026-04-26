param(
  [Parameter(Mandatory = $true)]
  [string]$VaultPath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $VaultPath -PathType Container)) {
  throw "Vault path does not exist: $VaultPath"
}

function Write-IfMissing {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )

  if (Test-Path -LiteralPath $Path) {
    Write-Output "Skipped existing: $Path"
    return
  }

  $parent = Split-Path -Parent $Path
  if ($parent -and -not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }

  Set-Content -LiteralPath $Path -Value $Content -Encoding UTF8
  Write-Output "Created: $Path"
}

function Append-IfMissing {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Marker,
    [Parameter(Mandatory = $true)][string]$Block
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  $content = Get-Content -Raw -LiteralPath $Path
  if ($content -notmatch [regex]::Escape($Marker)) {
    $content = $content.TrimEnd() + "`r`n`r`n" + $Block.Trim() + "`r`n"
    Set-Content -LiteralPath $Path -Value $content -Encoding UTF8
    Write-Output "Updated: $Path"
  } else {
    Write-Output "Already present: $Path"
  }
}

$today = Get-Date -Format "yyyy-MM-dd"

$rootAgents = Join-Path $VaultPath "AGENTS.md"
Write-IfMissing $rootAgents @"
# Olympus Vault AGENTS

This vault is the Layer 1 strategy brain for Olympus.

## Role

Act as a strategist and planning partner, not as an execution engine.

You are here to help the operator:

- clarify goals
- identify the right projects
- summarize research
- maintain durable context
- create or update project plans
- decide what work should move into Layer 2 project workspaces

## Default behavior

- Prefer creating or updating concise Markdown notes over long chat-only reasoning.
- Use the vault as the durable memory layer.
- Link related notes with Obsidian wikilinks.
- Add decisions to 04 - Decisions/Decision Log.md when project direction changes.
- Keep 01 - Projects/Project Olympus.md, 03 - Tasks/Olympus Next Actions.md, and 09 - System/User Profile.md current when they materially change.

## Boundaries

- Do not rewrite substantial user-authored notes without approval.
- Do not treat this vault like a code repo unless a specific project folder is opened as its own workspace.
- When execution work is needed, move it into a Layer 2 project workspace with its own `AGENTS.md`.

## Layer model

- Layer 1: this vault, used for strategy, storage, and cross-project context.
- Layer 2: individual project workspaces, each with a focused role, process, and outputs.
"@

$codexModelPath = Join-Path $VaultPath "09 - System\Codex Layer Model.md"
Write-IfMissing $codexModelPath @"
---
title: Codex Layer Model
type: system
status: active
tags:
  - olympus/system
  - olympus/codex
  - olympus/architecture
---

# Codex Layer Model

Olympus uses a two-layer system with Codex.

## Layer 1 - Strategy Brain

Layer 1 lives in the main Obsidian vault.

Its job is to answer:

- What are we trying to do?
- Which projects matter right now?
- What research, notes, and decisions should be preserved?
- What work should be delegated into project execution?

This is the general's layer. It should help think, plan, review, and store context.

## Layer 2 - Project Workspaces

Layer 2 lives in individual project folders.

Each project workspace should have:

- its own `AGENTS.md`
- its own inputs, process, outputs, and feedback areas
- its own project-local skills or workflow notes

This is the soldier layer. It should help do one job well.

## Codex Mapping

- Claude-style folder instructions become `AGENTS.md` for Codex.
- Global reusable capabilities live in installed Codex skills.
- Project-specific workflows live inside the project folder, usually in 05 - Skills.

## Rule of thumb

If the work is broad, strategic, reflective, or cross-project, keep it in Layer 1.

If the work is focused, operational, and tied to shipping a concrete output, move it into Layer 2.
"@

$newProjectSkillPath = Join-Path $VaultPath "05 - Skills\New Project Skill.md"
Write-IfMissing $newProjectSkillPath @"
---
title: New Project Skill
type: skill
status: active
tags:
  - olympus/skills
  - olympus/projects
  - olympus/codex
---

# New Project Skill

Use this skill when a new project should move from idea into a dedicated execution workspace.

## Interview Goals

Capture:

- project name
- desired shipped outcome
- who the work serves
- inputs required
- workflow or process
- outputs to create
- feedback loop
- what Codex should and should not do in that project

## Output

Create:

- a project note in Layer 1
- a dedicated Layer 2 project folder from the Codex Project Template
- a project-local `AGENTS.md`

## Principle

The project should be narrow enough that Codex can act like a focused employee, not a general planner.
"@

$weeklyReviewSkillPath = Join-Path $VaultPath "05 - Skills\Weekly Review Skill.md"
Write-IfMissing $weeklyReviewSkillPath @"
---
title: Weekly Review Skill
type: skill
status: active
tags:
  - olympus/skills
  - olympus/review
  - olympus/codex
---

# Weekly Review Skill

Use this skill once a week to keep Layer 1 useful.

## Review Questions

- What changed this week?
- Which projects advanced?
- Which efforts stalled?
- What decisions were made?
- What research mattered?
- What should be promoted, paused, or removed?

## Required updates

- 03 - Tasks/Olympus Next Actions.md
- 04 - Decisions/Decision Log.md
- active project notes in 01 - Projects
- the latest note in 08 - Daily Briefs when relevant

## Success condition

After the review, a future Codex session should understand current priorities without depending on chat history.
"@

$strategyGeneralPath = Join-Path $VaultPath "06 - Agents\Strategy General.md"
Write-IfMissing $strategyGeneralPath @"
---
title: Strategy General
type: agent
status: active
tags:
  - olympus/agents
  - olympus/strategy
  - olympus/codex
---

# Strategy General

This is the Layer 1 Codex role.

## Mission

Help the operator think clearly, choose the right projects, and maintain a high-quality strategic memory system.

## Responsibilities

- clarify goals
- synthesize research
- identify next actions
- prepare project scopes
- decide what belongs in Layer 2

## Non-goals

- do not pretend to ship the project from this layer
- do not sprawl into every open task at once
"@

$projectSoldierPath = Join-Path $VaultPath "06 - Agents\Project Soldier.md"
Write-IfMissing $projectSoldierPath @"
---
title: Project Soldier
type: agent
status: active
tags:
  - olympus/agents
  - olympus/execution
  - olympus/codex
---

# Project Soldier

This is the Layer 2 Codex role.

## Mission

Work inside one project workspace and help move that project toward a concrete shipped result.

## Responsibilities

- understand the project's local `AGENTS.md`
- work from inputs toward outputs
- maintain the process and feedback trail
- keep the workspace clean and specific

## Non-goals

- do not act like the strategy general
- do not pull in unrelated cross-project work unless explicitly asked
"@

$projectTemplateRoot = Join-Path $VaultPath "07 - Templates\Codex Project Template"
New-Item -ItemType Directory -Force -Path $projectTemplateRoot | Out-Null

Write-IfMissing (Join-Path $projectTemplateRoot "AGENTS.md") @"
# Project Workspace AGENTS

This folder is a Layer 2 Codex project workspace.

## Role

Act as a focused project worker for this project only.

You should help answer:

- how do we do this?
- what needs to be created?
- what is blocked?
- what should happen next?

## Working rules

- Stay scoped to this project.
- Read README.md before making assumptions.
- Keep inputs, process, outputs, and feedback updated as work evolves.
- Put project-specific reusable workflows in 05 - Skills.
- Capture implementation learnings in 03 - Feedback.

## Boundaries

- Do not expand into unrelated strategy work unless explicitly directed.
- Do not silently change the project's role or success criteria.
"@

Write-IfMissing (Join-Path $projectTemplateRoot "README.md") @"
# Project Workspace Template

Use this folder as the starting point for a Codex-driven Layer 2 project.

## Structure

- `00 - Inputs` - source materials, specs, references, transcripts, briefs
- 01 - Process - active plans, working docs, checklists, scratch structure
- 02 - Outputs - the things this project is producing
- 03 - Feedback - review notes, metrics, iteration learnings
- 05 - Skills - project-local skills and workflows

## First setup

1. Rename this folder to the project name.
2. Update README.md with the project purpose and shipped outcome.
3. Edit AGENTS.md so Codex knows its exact role here.
4. Add the first project-local skill if a workflow will repeat.
"@

Write-IfMissing (Join-Path $projectTemplateRoot "00 - Inputs\README.md") @"
# Inputs

Put source material here:

- idea briefs
- client context
- research
- transcripts
- requirements
- screenshots
"@

Write-IfMissing (Join-Path $projectTemplateRoot "01 - Process\README.md") @"
# Process

Use this folder for:

- current plan
- workflow checkpoints
- implementation notes
- active reasoning that should remain visible to future sessions
"@

Write-IfMissing (Join-Path $projectTemplateRoot "02 - Outputs\README.md") @"
# Outputs

Put shipped or near-shipped outputs here:

- deliverables
- exported documents
- launch assets
- final working artifacts
"@

Write-IfMissing (Join-Path $projectTemplateRoot "03 - Feedback\README.md") @"
# Feedback

Use this folder for:

- review notes
- user feedback
- metrics
- postmortems
- iteration lessons
"@

Write-IfMissing (Join-Path $projectTemplateRoot "05 - Skills\README.md") @"
# Project Skills

Put project-local skills here when they should stay specific to this project.

Examples:

- packaging research workflow
- transcript cleanup workflow
- client call processing workflow
- upload checklist
"@

$layer2TemplatePath = Join-Path $VaultPath "07 - Templates\Layer 2 Project Template.md"
Write-IfMissing $layer2TemplatePath @"
---
title: Layer 2 Project Template
type: template
status: active
tags:
  - olympus/template
  - olympus/project
  - olympus/codex
---

# Layer 2 Project Template

Use the `Codex Project Template` folder when a project should become a dedicated execution workspace.

## Required parts

- project purpose
- shipped outcome
- local AGENTS.md
- inputs
- process
- outputs
- feedback
- project-local skills
"@

$intakeTemplatePath = Join-Path $VaultPath "07 - Templates\Project Intake Template.md"
Write-IfMissing $intakeTemplatePath @"
---
title: Project Intake Template
type: template
status: active
tags:
  - olympus/template
  - olympus/intake
---

# Project Intake

## Project Name

## Why This Matters

## Shipped Outcome

## Inputs

## Process

## Outputs

## Feedback Loop

## What Codex Should Do

## What Codex Should Not Do
"@

Append-IfMissing -Path (Join-Path $VaultPath "05 - Skills\Skill Index.md") -Marker "## Codex Layer Skills" -Block @"
## Codex Layer Skills

- [[New Project Skill]]
- [[Weekly Review Skill]]
"@

Append-IfMissing -Path (Join-Path $VaultPath "06 - Agents\Agent Index.md") -Marker "## Codex Roles" -Block @"
## Codex Roles

- [[Strategy General]]
- [[Project Soldier]]
"@

Append-IfMissing -Path (Join-Path $VaultPath "09 - System\System Architecture.md") -Marker "## Codex Workspace Model" -Block @"
## Codex Workspace Model

Olympus should use Codex in two ways:

- Layer 1: open the full vault to think, review, plan, and maintain memory.
- Layer 2: open one dedicated project workspace with its own AGENTS.md to execute.
"@

Append-IfMissing -Path (Join-Path $VaultPath "09 - System\Olympus Charter.md") -Marker "## Codex Principle" -Block @"
## Codex Principle

Codex should behave like a strategist in Layer 1 and a focused worker in Layer 2.
"@

Append-IfMissing -Path (Join-Path $VaultPath "01 - Projects\Project Olympus.md") -Marker "## Codex Implementation" -Block @"
## Codex Implementation

Olympus should use a Codex-native two-layer system:

- the Obsidian vault as a strategy brain
- dedicated project workspaces as focused execution environments
"@

Append-IfMissing -Path (Join-Path $VaultPath "04 - Decisions\Decision Log.md") -Marker "$today - Use Codex with a two-layer model" -Block @"
- $today - Use Codex with a two-layer model: Layer 1 for strategy and memory, Layer 2 for focused project execution with project-local `AGENTS.md` files.
"@

Get-ChildItem -Recurse -LiteralPath $VaultPath -File -Include AGENTS.md,*.md |
  Sort-Object FullName |
  Select-Object -ExpandProperty FullName

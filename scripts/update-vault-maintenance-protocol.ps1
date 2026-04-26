param(
  [Parameter(Mandatory = $true)]
  [string]$VaultPath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $VaultPath -PathType Container)) {
  throw "Vault path does not exist: $VaultPath"
}

$systemFolder = Join-Path $VaultPath "09 - System"
$dashboardFolder = Join-Path $VaultPath "00 - Dashboard"
New-Item -ItemType Directory -Force -Path $systemFolder | Out-Null
New-Item -ItemType Directory -Force -Path $dashboardFolder | Out-Null

$protocolPath = Join-Path $systemFolder "Vault Maintenance Protocol.md"
$content = @"
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
- **Every working session:** review whether [[Project Olympus]], [[Olympus Next Actions]], and [[User Profile]] need updates.
- **Daily when used actively:** create or update the daily brief in `08 - Daily Briefs`.

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
"@

Set-Content -LiteralPath $protocolPath -Value $content -Encoding UTF8

$homePath = Join-Path $dashboardFolder "Olympus Home.md"
if (Test-Path -LiteralPath $homePath) {
  $homeContent = Get-Content -Raw -LiteralPath $homePath
  if ($homeContent -notmatch "\[\[Vault Maintenance Protocol\]\]") {
    $homeContent = $homeContent.TrimEnd() + "`r`n- [[Vault Maintenance Protocol]]`r`n"
    Set-Content -LiteralPath $homePath -Value $homeContent -Encoding UTF8
  }
}

Write-Output $protocolPath

param(
  [Parameter(Mandatory = $true)]
  [string]$VaultPath,
  [Parameter(Mandatory = $true)]
  [string]$ProjectName
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $VaultPath -PathType Container)) {
  throw "Vault path does not exist: $VaultPath"
}

$templateRoot = Join-Path $VaultPath "07 - Templates\Codex Project Template"
if (-not (Test-Path -LiteralPath $templateRoot -PathType Container)) {
  throw "Template folder does not exist: $templateRoot"
}

$projectFolder = Join-Path $VaultPath ("Projects Workspace\" + $ProjectName)
if (Test-Path -LiteralPath $projectFolder) {
  throw "Project folder already exists: $projectFolder"
}

New-Item -ItemType Directory -Force -Path $projectFolder | Out-Null

$items = Get-ChildItem -LiteralPath $templateRoot -Force
foreach ($item in $items) {
  Copy-Item -LiteralPath $item.FullName -Destination $projectFolder -Recurse -Force
}

$readmePath = Join-Path $projectFolder "README.md"
$agentsPath = Join-Path $projectFolder "AGENTS.md"

$readme = Get-Content -Raw -LiteralPath $readmePath
$readme = $readme.Replace("# Project Workspace Template", "# $ProjectName")
$readme = $readme.TrimEnd() + @"

## Project Purpose

Describe what this workspace is for.

## Shipped Outcome

Describe what success looks like.
"@
Set-Content -LiteralPath $readmePath -Value $readme -Encoding UTF8

$agents = Get-Content -Raw -LiteralPath $agentsPath
$agents = $agents.TrimEnd() + @"

## Project name

$ProjectName
"@
Set-Content -LiteralPath $agentsPath -Value $agents -Encoding UTF8

Get-ChildItem -Recurse -LiteralPath $projectFolder -Force |
  Select-Object FullName

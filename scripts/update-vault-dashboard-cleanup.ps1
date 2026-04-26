param(
  [Parameter(Mandatory = $true)]
  [string]$VaultPath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $VaultPath -PathType Container)) {
  throw "Vault path does not exist: $VaultPath"
}

function Append-IfMissing {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Marker,
    [Parameter(Mandatory = $true)][string]$Block
  )

  $content = Get-Content -Raw -LiteralPath $Path
  if ($content -notmatch [regex]::Escape($Marker)) {
    $content = $content.TrimEnd() + "`r`n`r`n" + $Block.Trim() + "`r`n"
    Set-Content -LiteralPath $Path -Value $content -Encoding UTF8
  }
}

$projectPath = Join-Path $VaultPath "01 - Projects\Project Olympus.md"
$decisionPath = Join-Path $VaultPath "04 - Decisions\Decision Log.md"
$protocolPath = Join-Path $VaultPath "09 - System\Vault Maintenance Protocol.md"

Append-IfMissing -Path $projectPath -Marker "## Dashboard Direction" -Block @"
## Dashboard Direction

The dashboard direction has been simplified. The home screen should now focus on three primary surfaces only:

- Tools
- Markets
- Research Database

The older project constellation, operator brief, active projects, profile, tasks, and Obsidian preview concepts should not define the home experience anymore.
"@

Append-IfMissing -Path $decisionPath -Marker "2026-04-25 - Simplify the Olympus home screen" -Block @"
- 2026-04-25 - Simplify the Olympus home screen around three sections: Tools, Markets, and Research Database. Remove the old demo-style operational widgets from the primary dashboard.
"@

if (Test-Path -LiteralPath $protocolPath) {
  $protocolContent = Get-Content -Raw -LiteralPath $protocolPath
  $protocolContent = $protocolContent.Replace([char]0 + "2 - Research", "02 - Research")
  $protocolContent = $protocolContent.Replace([char]0 + "5 - Skills", "05 - Skills")
  $protocolContent = $protocolContent.Replace([char]0 + "6 - Agents", "06 - Agents")
  $protocolContent = $protocolContent.Replace([char]0 + "8 - Daily Briefs", "08 - Daily Briefs")

  if ($protocolContent -notmatch [regex]::Escape("When interface cleanup removes obsolete UI concepts")) {
    $protocolContent = $protocolContent.TrimEnd() + @"

## Interface Cleanup Rule

When interface cleanup removes obsolete UI concepts, update the vault so future sessions do not keep reasoning from the old dashboard shape.
"@
  }

  Set-Content -LiteralPath $protocolPath -Value $protocolContent -Encoding UTF8
}

Get-Content -LiteralPath $projectPath
Get-Content -LiteralPath $decisionPath
Get-Content -LiteralPath $protocolPath

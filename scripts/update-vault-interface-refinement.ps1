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

Append-IfMissing -Path $projectPath -Marker "## Interface Refinement" -Block @"
## Interface Refinement

The home screen should now feel more like a composed command surface and less like a wall of modules.

Current preferred direction:

- a discreet row of skill cards for Tools
- a compact Weather widget
- a visible Conversation window
- a Research Database that opens as a library first
- an Add Research flow that appears only when requested
"@

Append-IfMissing -Path $decisionPath -Marker "2026-04-25 - Shift the dashboard toward a calmer command surface" -Block @"
- 2026-04-25 - Shift the dashboard toward a calmer command surface with a compact tools row, weather widget, conversation panel, and research library-first flow.
"@

Append-IfMissing -Path $protocolPath -Marker "When refining the interface" -Block @"
When refining the interface, update the vault if the preferred dashboard behavior or hierarchy changes in a durable way.
"@

Get-Content -LiteralPath $projectPath
Get-Content -LiteralPath $decisionPath
Get-Content -LiteralPath $protocolPath

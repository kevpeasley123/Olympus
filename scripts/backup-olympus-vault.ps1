<#
.SYNOPSIS
    Verifies saved-file/Git snapshots, with optional private GitHub replication.
.DESCRIPTION
    Uses the existing daily Olympus Vault Backup task. Never commits the working
    vault. Local recovery stays outside OneDrive. Reads the pinned off-device
    destination from DestinationPath\remote.json when configured.
    See docs/VAULT-BACKUP.md for scope, retention and tested restore steps.
#>
[CmdletBinding()]
param(
    [string]$VaultPath = 'C:\Users\kevpe\OneDrive\Desktop\Projects\Obsidian vaults\Olympus Obsidian Vault',
    [string]$DestinationPath = 'C:\Users\kevpe\Backups\Olympus Vault',
    [ValidateRange(1,3650)][int]$Keep = 14,
    [string]$PythonPath = 'C:\Python314\python.exe'
)
$ErrorActionPreference = 'Stop'
$arguments = @((Join-Path $PSScriptRoot 'vault_backup.py'),'create','--vault',$VaultPath,'--destination',$DestinationPath,'--keep',"$Keep")
$remoteConfig = Join-Path $DestinationPath 'remote.json'
if (Test-Path -LiteralPath $remoteConfig) { $arguments += @('--remote-config',$remoteConfig) }
$result = & $PythonPath @arguments
$resultCode = $LASTEXITCODE
if (Test-Path -LiteralPath $DestinationPath) {
    Add-Content -LiteralPath (Join-Path $DestinationPath 'backup.log') -Encoding utf8 -Value ("{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'),($result -join ' '))
}
Write-Output $result
exit $resultCode

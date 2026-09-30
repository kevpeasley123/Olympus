[CmdletBinding()]
param(
    # Put an "Update Olympus" icon on the desktop that runs this script, then stop.
    [switch]$CreateShortcut,
    # Keep the window open at the end (the desktop icon passes this).
    [switch]$Pause,
    # Do not start Olympus after installing.
    [switch]$NoLaunch
)

# The PC half of "Bring everything current" (see CLAUDE.md): bring the local
# checkout to origin/master and, when master is newer than the installed app,
# build and install it with install-olympus-local.ps1. It never discards local
# work: a dirty checkout or a local master that has diverged stops it.

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

function Get-OlympusInstallation {
    $registryRoots = @(
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    Get-ItemProperty $registryRoots -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -eq "Project Olympus" } |
        Select-Object -First 1
}

function Invoke-Git {
    & git @args
    if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed with exit code $LASTEXITCODE." }
}

if ($CreateShortcut) {
    $desktop = [Environment]::GetFolderPath("Desktop")
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut((Join-Path $desktop "Update Olympus.lnk"))
    $shortcut.TargetPath = "powershell.exe"
    $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Pause"
    $shortcut.WorkingDirectory = $repoRoot
    $installed = Get-OlympusInstallation
    if ($installed -and $installed.InstallLocation) {
        $shortcut.IconLocation = "$(Join-Path $installed.InstallLocation 'project-olympus.exe'),0"
    }
    $shortcut.Save()
    Write-Host "Created 'Update Olympus' on the desktop."
    return
}

$exitCode = 0
Push-Location $repoRoot
try {
    if (& git status --porcelain) {
        throw "The Olympus checkout at $repoRoot has uncommitted changes. Nothing was changed. Commit or push that work first (ask Claude to 'bring everything current' from this folder)."
    }

    Write-Host "Fetching master from GitHub..."
    Invoke-Git fetch origin master
    $branch = (& git rev-parse --abbrev-ref HEAD).Trim()
    if ($branch -ne "master") {
        Write-Host "Switching the checkout from $branch to master."
        Invoke-Git switch master
    }
    # Fast-forward only: a local master with its own commits is never rewritten.
    & git merge --ff-only origin/master
    if ($LASTEXITCODE -ne 0) {
        throw "Local master has commits that are not on GitHub. Nothing was changed. Push them first (ask Claude to 'bring everything current' from this folder)."
    }

    $config = Get-Content -Raw -LiteralPath (Join-Path $repoRoot "src-tauri\tauri.conf.json") | ConvertFrom-Json
    $available = [version]$config.version
    $installed = Get-OlympusInstallation
    if ($installed -and [version]$installed.DisplayVersion -ge $available) {
        Write-Host "Project Olympus $($installed.DisplayVersion) is installed and current with master."
    }
    else {
        Write-Host "Installing Project Olympus $available (installed: $(if ($installed) { $installed.DisplayVersion } else { 'none' }))."
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE." }

        # install-olympus-local.ps1 refuses to replace a running app. Ask it to
        # close the way its own window would, and give it time to save state.
        $running = Get-Process -Name "project-olympus" -ErrorAction SilentlyContinue
        if ($running) {
            Write-Host "Closing the open Olympus window..."
            $running | ForEach-Object { [void]$_.CloseMainWindow() }
            $running | ForEach-Object { if (-not $_.WaitForExit(20000)) { throw "Olympus did not close within 20 seconds. Close it and run this again." } }
        }

        & (Join-Path $PSScriptRoot "install-olympus-local.ps1")
        $installed = Get-OlympusInstallation
    }

    if (-not $NoLaunch -and $installed -and $installed.InstallLocation) {
        $exe = Join-Path $installed.InstallLocation "project-olympus.exe"
        if (-not (Get-Process -Name "project-olympus" -ErrorAction SilentlyContinue) -and (Test-Path -LiteralPath $exe)) {
            Start-Process -FilePath $exe -WorkingDirectory $installed.InstallLocation
        }
    }
}
catch {
    Write-Host ""
    Write-Host "Update stopped: $($_.Exception.Message)" -ForegroundColor Yellow
    $exitCode = 1
}
finally {
    Pop-Location
}

if ($Pause) { [void](Read-Host "Press Enter to close") }
exit $exitCode

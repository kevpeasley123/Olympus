[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [switch]$ForceReinstall
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$tauriConfigPath = Join-Path $repoRoot "src-tauri\tauri.conf.json"
$cargoManifestPath = Join-Path $repoRoot "src-tauri\Cargo.toml"
$installedExeName = "project-olympus.exe"

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

Push-Location $repoRoot
try {
    $gitStatus = & git status --porcelain
    if ($LASTEXITCODE -ne 0) {
        throw "Could not inspect the Olympus Git checkout."
    }
    if ($gitStatus) {
        throw "The Olympus checkout has uncommitted changes. Commit or restore them before installing a release."
    }

    $config = Get-Content -Raw -LiteralPath $tauriConfigPath | ConvertFrom-Json
    $releaseVersion = [version]$config.version
    $existing = Get-OlympusInstallation

    if ($existing -and -not $ForceReinstall) {
        $installedVersion = [version]$existing.DisplayVersion
        if ($installedVersion -ge $releaseVersion) {
            throw (
                "Project Olympus $installedVersion is already installed. " +
                "Increase the release version, or pass -ForceReinstall deliberately."
            )
        }
    }

    $runningInstalledApp = Get-Process -Name "project-olympus" -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Path -and $existing.InstallLocation -and
            $_.Path.StartsWith($existing.InstallLocation, [System.StringComparison]::OrdinalIgnoreCase)
        }
    if ($runningInstalledApp) {
        throw "Close the installed Project Olympus window before updating it."
    }

    if (-not $SkipBuild) {
        Write-Host "Building Project Olympus $releaseVersion..."
        $npmArguments = @("run", "tauri", "--", "build", "--bundles", "msi")
        & npm.cmd $npmArguments
        if ($LASTEXITCODE -ne 0) {
            throw "npm.cmd exited with code $LASTEXITCODE."
        }
    }

    $metadataJson = & cargo metadata --format-version 1 --no-deps --manifest-path $cargoManifestPath
    if ($LASTEXITCODE -ne 0) {
        throw "Could not resolve Cargo's release directory."
    }
    $targetDirectory = ($metadataJson | ConvertFrom-Json).target_directory
    $msiDirectory = Join-Path $targetDirectory "release\bundle\msi"
    $msi = Get-ChildItem -LiteralPath $msiDirectory -Filter "Project Olympus_$($config.version)_*.msi" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $msi) {
        throw "No Project Olympus $releaseVersion MSI was found in $msiDirectory."
    }

    Write-Host "Installing $($msi.FullName)..."
    $installer = Start-Process -FilePath "msiexec.exe" `
        -ArgumentList @("/i", "`"$($msi.FullName)`"", "/passive", "/norestart") `
        -Verb RunAs `
        -Wait `
        -PassThru

    if ($installer.ExitCode -ne 0) {
        throw "The Project Olympus installer exited with code $($installer.ExitCode)."
    }

    $installed = Get-OlympusInstallation
    if (-not $installed -or -not $installed.InstallLocation) {
        throw "Windows did not report an installed Project Olympus application."
    }

    $installedExe = Join-Path $installed.InstallLocation $installedExeName
    if (-not (Test-Path -LiteralPath $installedExe)) {
        throw "The installed executable was not found at $installedExe."
    }

    # An early development pin pointed at Cargo's debug output. Cargo replaces
    # that file during builds, so Windows eventually treats the pin as stale.
    # Repair the existing pin once; subsequent installers keep this target.
    $pinnedShortcutPath = Join-Path $env:APPDATA `
        "Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Project Olympus.lnk"
    if (Test-Path -LiteralPath $pinnedShortcutPath) {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($pinnedShortcutPath)
        $shortcut.TargetPath = $installedExe
        $shortcut.WorkingDirectory = $installed.InstallLocation
        $shortcut.IconLocation = "$installedExe,0"
        $shortcut.Save()
        Write-Host "Repaired the existing Project Olympus taskbar shortcut."
    }

    Write-Host ""
    Write-Host "Project Olympus $($installed.DisplayVersion) is installed at:"
    Write-Host "  $installedExe"
    Write-Host "Launch it from the existing taskbar pin or Start > Project Olympus."
}
finally {
    Pop-Location
}

<#
.SYNOPSIS
    Bundles the Obsidian vault's git history to a path outside OneDrive.

.DESCRIPTION
    The vault repo is local-only and lives inside OneDrive, so its .git is
    exposed to the same sync client that corrupts index files and conflict-copies
    loose objects — the failure that forced Rust build output out of OneDrive in
    f290e66. A bundle is a single file containing the whole history, written
    somewhere OneDrive does not touch, so losing the vault folder does not lose
    the history with it.

    Two things this deliberately does NOT do:

    - It does not commit. The vault's working tree is expected to be dirty by
      design; committing on a schedule would attribute the operator's in-progress
      Obsidian edits to a background job. Uncommitted work is therefore NOT in
      the bundle, and the log records how many files were dirty so that gap is
      visible rather than silent.
    - It does not push anywhere. This is protection against losing the folder,
      not against losing the machine.

    Every bundle is verified after being written. An unverified backup is a
    belief, not a backup.
#>

[CmdletBinding()]
param(
    [string]$VaultPath = 'C:\Users\kevpe\OneDrive\Desktop\Projects\Obsidian vaults\Olympus Obsidian Vault',

    # Outside OneDrive on purpose. Changing this to a synced path defeats the
    # entire reason the script exists.
    [string]$DestinationPath = 'C:\Users\kevpe\Backups\Olympus Vault',

    # Roughly a fortnight of daily runs. Bundles of a 69-file vault are tiny;
    # the limit exists to stop unbounded growth, not to save space.
    [int]$Keep = 14
)

$ErrorActionPreference = 'Stop'

function Write-Log {
    param([string]$Message)
    $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Write-Output $line
    if ($script:LogFile) { Add-Content -Path $script:LogFile -Value $line -Encoding utf8 }
}

if (-not (Test-Path -LiteralPath $DestinationPath)) {
    New-Item -ItemType Directory -Path $DestinationPath -Force | Out-Null
}

$script:LogFile = Join-Path $DestinationPath 'backup.log'

try {
    if (-not (Test-Path -LiteralPath (Join-Path $VaultPath '.git'))) {
        throw "No git repository at $VaultPath"
    }

    # Guard against the destination silently ending up back under OneDrive —
    # a bundle inside the thing it is protecting against is worse than none,
    # because it looks like a backup.
    $resolvedDestination = (Resolve-Path -LiteralPath $DestinationPath).Path
    if ($resolvedDestination -like '*OneDrive*') {
        throw "Destination is inside OneDrive: $resolvedDestination"
    }

    Push-Location -LiteralPath $VaultPath
    try {
        $dirty = @(git status --porcelain)
        $head = (git rev-parse --short HEAD).Trim()
        $commits = (git rev-list --count --all).Trim()

        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $bundle = Join-Path $resolvedDestination "olympus-vault-$stamp.bundle"

        # Never redirect a native command's stderr here. git writes its progress
        # and its "is okay" verification line to stderr, and PowerShell 5.1 turns
        # redirected native stderr into a terminating NativeCommandError under
        # ErrorActionPreference='Stop' — so `2>&1` made a *successful* verify
        # fail the script. Exit codes are the only signal read below.
        git bundle create $bundle --all | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "git bundle create failed with exit code $LASTEXITCODE" }

        # Verify against the repo it came from. A bundle that will not verify is
        # the failure mode worth catching here, not at restore time.
        git bundle verify $bundle | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Remove-Item -LiteralPath $bundle -Force -ErrorAction SilentlyContinue
            throw 'Bundle failed verification and was discarded'
        }

        $size = [math]::Round((Get-Item -LiteralPath $bundle).Length / 1KB, 1)
        Write-Log "ok  head=$head commits=$commits dirty=$($dirty.Count) size=${size}KB  $(Split-Path $bundle -Leaf)"

        if ($dirty.Count -gt 0) {
            # Not an error. It is the accepted cost of not auto-committing the
            # operator's edits — but it must never be invisible.
            Write-Log "    note: $($dirty.Count) uncommitted file(s) are NOT in this bundle"
        }
    }
    finally {
        Pop-Location
    }

    $stale = Get-ChildItem -LiteralPath $resolvedDestination -Filter 'olympus-vault-*.bundle' |
        Sort-Object LastWriteTime -Descending |
        Select-Object -Skip $Keep
    foreach ($old in $stale) {
        Remove-Item -LiteralPath $old.FullName -Force
        Write-Log "    pruned $($old.Name)"
    }
}
catch {
    Write-Log "FAIL  $($_.Exception.Message)"
    exit 1
}

# Vault backup and recovery

The vault is shared project memory. Its Git history, working files and derived
Olympus search index have different recovery requirements. Application source
pushes do not preserve the vault. OneDrive synchronization is not the independent
recovery copy.

## Installed arrangement

- Source: `C:\Users\kevpe\OneDrive\Desktop\Projects\Obsidian vaults\Olympus Obsidian Vault`.
- Local recovery: `C:\Users\kevpe\Backups\Olympus Vault`, outside OneDrive.
- Existing Windows task: **Olympus Vault Backup**, daily at 13:00 local time.
  Its existing action runs `scripts/backup-olympus-vault.ps1` hidden. No second
  scheduler is needed. A powered-off computer cannot perform a backup; the task
  is configured to start when available.
- Keep the newest **14 verified local snapshots**. Pre-existing `.bundle` backups
  remain untouched. Corrupt or unknown snapshot folders are preserved for diagnosis.
- Kevin explicitly authorized off-device storage of private vault notes/history in
  `kevpeasley123/Olympus-Memory-Backup` on October 8, 2026. The destination is pinned
  to GitHub repository ID `1411265984`, branch `snapshots/windows-primary`.
  This authorization does not cover other repositories, public sharing or accounts.

`remote.json` beside the snapshots enables replication:

```json
{"repository":"kevpeasley123/Olympus-Memory-Backup","repository_id":1411265984,"branch":"snapshots/windows-primary"}
```

Every upload verifies that this exact GitHub.com repository is still private, then
uses authenticated fast-forward Git push and confirms the remote commit. Missing
authentication, changed identity/privacy, divergence or excessive artifact size
stops replication with a failure result while preserving the local snapshot.
The source vault is never automatically staged or committed. An isolated
`.publisher` repository transports five recovery artifacts. Its commit history
retains earlier snapshots; it is intentionally separate from source-vault commits.
A transport `.gitattributes` disables text conversion so Windows clones preserve
the exact checksummed bytes.

## What a snapshot contains

Each `olympus-snapshot-*` directory contains:

1. `vault.zip`: saved notes, attachments, canvases, bases, applicable Obsidian
   configuration and `.memory-history`, including untracked and unstaged files.
2. `history.bundle`: reachable Git history and refs exported by `git bundle --all`.
3. `index.patch`: staged differences from HEAD, preserving staged versus unstaged
   state when restored.
4. `manifest.json`: source identity, captured Git state, per-file sizes/checksums,
   artifact checksums, exclusions and actual creation time.
5. `manifest.sha256`: checksum of the manifest.

The capture compares file hashes and Git state before and after reading. A changing
source or unresolved merge fails instead of replacing a verified snapshot. Only a
verified snapshot becomes eligible for retention. These checks coordinate a local
capture; they do not provide distributed transactions across OneDrive devices.

Excluded: `.git` working metadata (history is in the bundle), `.trash`, Python
caches, OS litter, memory-write locks and volatile Obsidian workspace layouts.
Unsaved editor buffers, Git hooks/config/reflogs/unreachable objects are not recovered.
Symlinks/junctions are rejected rather than silently following another directory.
Checksums detect corruption; they are not cryptographic signatures against a writer
who can replace both data and checksums.

This is a **vault backup**, not a complete Olympus installation or computer backup.
The application SQLite database, conversation history outside the vault, provider
credentials, mail cache and other machine data need separate recovery policies.
The native memory search index is derived and can be rebuilt from restored notes;
notes never restore execution authority or approval tokens.

## Run and inspect

Requires Python 3.11+ (installed wrapper default `C:\Python314\python.exe`), Git and
authenticated GitHub CLI on the scheduled user's account. Credentials stay in the
existing credential store, not in the vault, scripts or configuration file.

```powershell
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File .\scripts\backup-olympus-vault.ps1
Get-Content -LiteralPath 'C:\Users\kevpe\Backups\Olympus Vault\status.json'
Get-ScheduledTaskInfo -TaskName 'Olympus Vault Backup'
```

`status.json` reports the latest attempt, local snapshot, last successful remote
commit/time and errors. A failure retains previous successful timestamps rather
than making them look current. `backup.log` keeps run results; the process exits
nonzero on failure for Task Scheduler. There is no separate push-notification
service: check the status and task result after outages or credential changes.
If a lock survives an interrupted process, inspect its PID and confirm that process
has stopped before manually removing that lock; the script never steals it.

## Restore after losing the computer

Install Python/Git/GitHub CLI, recover access to Kevin's GitHub account, and obtain
the Olympus source scripts. Choose **new folders**. The commands below never replace
the working vault and can also exercise recovery on the current computer.

```powershell
gh repo clone kevpeasley123/Olympus-Memory-Backup C:\Recovery\OlympusTransport -- --branch snapshots/windows-primary
C:\Python314\python.exe .\scripts\vault_backup.py verify --snapshot C:\Recovery\OlympusTransport
C:\Python314\python.exe .\scripts\vault_backup.py restore --snapshot C:\Recovery\OlympusTransport --destination C:\Recovery\OlympusVault
git -C C:\Recovery\OlympusVault fsck --full
git -C C:\Recovery\OlympusVault status --short
```

For an earlier snapshot, check out its transport commit in this disposable clone
before verification. For local recovery, substitute a local `olympus-snapshot-*`
folder for the transport clone. Restore verifies checksums, safe paths, file hashes,
the Git bundle and restored history before exposing the destination. It does not
overwrite an existing directory. Review recovered files in Obsidian before choosing
how to replace/reconfigure the live vault.

To prove the derived native memory index can be rebuilt without writing recovered
notes (from an Olympus development checkout with Rust installed):

```powershell
$env:OLYMPUS_MEMORY_RESTORE_VAULT = 'C:\Recovery\OlympusVault'
cargo test --manifest-path .\src-tauri\Cargo.toml --lib real_vault_index_recall -- --ignored --nocapture
Remove-Item Env:OLYMPUS_MEMORY_RESTORE_VAULT
```

This checks native backend recall with a disposable index; it is not installed
desktop or live-provider acceptance. To resume backups, restore/recreate the pinned
`remote.json` and scheduled task. A missing local `.publisher` automatically fetches
the existing machine branch before appending. A second active computer must use a
different `snapshots/<machine-name>` branch, never force-push over this one.

## Growth and concurrent writing

Local retention is bounded; remote snapshot history accumulates. Uploads stop at
90 MiB per artifact or 1 GiB per snapshot, leaving the local copy available. The
90 MiB guard stays below [GitHub's 100 MiB file limit](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).
Review repository growth as attachments/history increase; before approaching these
limits migrate archives to versioned object storage or a dedicated backup service.
Do not automatically buy storage, enable paid LFS, rewrite backup history or prune
the only off-device recovery copy. See [GitHub repository limits](https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits).
The private repository uses GitHub access controls, not client-side encryption;
account access and recovery credentials are part of disaster recovery.

Keep independent session records immutable and uniquely named. Shared project
notes still use the memory skill's fresh-hash compare-and-write helper; a backup is
not permission to overwrite concurrent edits. Prefer one primary computer for shared
summary reconciliation. Preserve OneDrive conflict copies and reconcile evidence
explicitly; neither the local writer lock nor backup lock spans other devices.

## Verification

`python scripts/test-vault-backup.py` exercises history/staging/working-file recovery,
concurrent changes, unresolved merges, corruption, unsafe paths, privacy/identity
guards, publisher reconstruction and same-second retention. Periodically perform
the download-and-restore procedure above: a successful upload alone is not proof
that disaster recovery works.

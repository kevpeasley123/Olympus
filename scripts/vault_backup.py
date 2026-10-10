"""Verified vault snapshots: Git history, staged changes and saved working files.

Never commits the source vault. Restore only creates a new destination.
"""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import tempfile
import uuid
import zipfile

FORMAT='olympus-vault-backup/v1'
MAX_BYTES=64*1024**3
MAX_FILES=300_000
EXCLUDED_DIRS={'.git','__pycache__','.trash'}
EXCLUDED_FILES={'.memory-write.lock','Thumbs.db','desktop.ini','.DS_Store'}
ARTIFACTS={'vault.zip','history.bundle','index.patch'}

class BackupError(RuntimeError): pass

def sha256(data): return hashlib.sha256(data).hexdigest()

def file_digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream,'sha256').hexdigest()

def run_git(root,*args,input=None):
    # Local restore/verification must not inherit a caller's repository/index.
    env={k:v for k,v in os.environ.items() if not k.startswith('GIT_')}
    env.update(GIT_TERMINAL_PROMPT='0',GIT_CONFIG_NOSYSTEM='1',GIT_CONFIG_GLOBAL=os.devnull)
    result=subprocess.run(['git','-c','core.hooksPath='+os.devnull,'-C',str(root),*args],input=input,capture_output=True,env=env)
    if result.returncode: raise BackupError('Git '+args[0]+' failed: '+result.stderr.decode('utf-8','replace')[:1200])
    return result.stdout

def linked(path):
    return path.is_symlink() or (hasattr(path,'is_junction') and path.is_junction())

def safe_name(name):
    if not isinstance(name,str) or '\\' in name or ':' in name or '\x00' in name:
        raise BackupError('Unsafe archive path')
    parts=name.split('/')
    if not parts or any(not p or p in {'.','..'} or p.rstrip(' .')!=p or p.casefold()=='.git' for p in parts):
        raise BackupError('Unsafe archive path')
    for part in parts:
        if re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?',part,re.I):
            raise BackupError('Reserved Windows path')
        if any(ord(c)<32 or c in '<>"|?*' for c in part):raise BackupError('Unsafe archive path')
    return PurePosixPath(name)

def inventory(root):
    root=Path(root).resolve(strict=True);files={};total=0;folded=set()
    def walk_error(error):raise BackupError('Cannot enumerate the entire vault') from error
    for parent,dirs,names in os.walk(root,followlinks=False,onerror=walk_error):
        kept=[]
        for name in dirs:
            path=Path(parent)/name
            if name in EXCLUDED_DIRS:continue
            if linked(path):raise BackupError('Linked directories require a separate explicit backup')
            kept.append(name)
        dirs[:]=sorted(kept)
        for name in sorted(names):
            path=Path(parent)/name;relative=path.relative_to(root).as_posix()
            if name in EXCLUDED_FILES:continue
            if name in {'workspace.json','workspace-mobile.json'} and '.obsidian' in path.relative_to(root).parts:continue
            safe_name(relative)
            if linked(path) or not path.resolve(strict=True).is_relative_to(root):raise BackupError('Source escaped the vault')
            before=path.stat()
            if not stat.S_ISREG(before.st_mode):raise BackupError('Non-regular source file')
            total+=before.st_size
            if total>MAX_BYTES or len(files)>=MAX_FILES:raise BackupError('Vault exceeds explicit snapshot limits')
            digest=file_digest(path);after=path.stat()
            if (before.st_size,before.st_mtime_ns)!=(after.st_size,after.st_mtime_ns):raise BackupError('Source changed during backup')
            if relative.casefold() in folded:raise BackupError('Case-colliding source paths')
            folded.add(relative.casefold());files[relative]={'sha256':digest,'bytes':after.st_size}
    return files

def git_state(vault):
    if run_git(vault,'ls-files','--unmerged'):
        raise BackupError('Vault has an unresolved Git merge; last verified snapshot retained')
    return {
        'head':run_git(vault,'rev-parse','HEAD').decode().strip(),
        'branch':run_git(vault,'rev-parse','--abbrev-ref','HEAD').decode().strip(),
        'refs':run_git(vault,'for-each-ref','--format=%(objectname) %(refname)').decode(),
        'index':sha256(run_git(vault,'diff','--cached','--binary','--full-index','--no-ext-diff','--no-textconv','HEAD')),
    }

def write_manifest(snapshot,manifest):
    content=(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n').encode('utf-8')
    (snapshot/'manifest.json').write_bytes(content)
    (snapshot/'manifest.sha256').write_text(sha256(content)+'\n',encoding='ascii')

def manifest_for(snapshot):
    snapshot=Path(snapshot).resolve(strict=True)
    if linked(snapshot):raise BackupError('Snapshot cannot be a link')
    raw=(snapshot/'manifest.json').read_bytes()
    if len(raw)>128*1024**2:raise BackupError('Oversized manifest')
    if sha256(raw)!=(snapshot/'manifest.sha256').read_text().strip():raise BackupError('Manifest checksum failed')
    value=json.loads(raw)
    if value.get('format')!=FORMAT or set(value.get('artifacts',{}))!=ARTIFACTS:raise BackupError('Unsupported snapshot format')
    return value

def verify_backup(snapshot):
    snapshot=Path(snapshot).resolve(strict=True);manifest=manifest_for(snapshot)
    for name,digest in manifest['artifacts'].items():
        path=snapshot/name
        if linked(path) or file_digest(path)!=digest:raise BackupError('Artifact checksum failed: '+name)
    if file_digest(snapshot/'index.patch')!=manifest['git']['index']:
        raise BackupError('Captured index does not match the staged patch')
    records=manifest['files']
    if not isinstance(records,dict) or len(records)>MAX_FILES:raise BackupError('Invalid file inventory')
    seen=set();folded=set();total=0
    with zipfile.ZipFile(snapshot/'vault.zip') as archive:
        for info in archive.infolist():
            safe_name(info.filename)
            if info.filename in seen or info.filename.casefold() in folded:raise BackupError('Duplicate archive entry')
            if info.is_dir() or stat.S_ISLNK(info.external_attr>>16):raise BackupError('Unsupported archive entry')
            seen.add(info.filename);folded.add(info.filename.casefold());total+=info.file_size
            if total>MAX_BYTES or len(seen)>MAX_FILES:raise BackupError('Archive exceeds extraction limits')
            expected=records.get(info.filename)
            if not expected or expected.get('bytes')!=info.file_size:raise BackupError('Archive inventory mismatch')
            with archive.open(info) as stream:digest=hashlib.file_digest(stream,'sha256').hexdigest()
            if digest!=expected.get('sha256'):raise BackupError('File checksum failed')
    if seen!=set(records):raise BackupError('Missing archive entry')
    with tempfile.TemporaryDirectory(prefix='olympus-bundle-check-') as folder:
        run_git(folder,'init','--bare')
        run_git(folder,'bundle','verify',str(snapshot/'history.bundle'))
    return manifest

def remove_owned(path,parent,prefix):
    # Every recursive removal is constrained to a direct, owned child.
    path=Path(path);parent=Path(parent).resolve(strict=True)
    if linked(path) or path.resolve(strict=True).parent!=parent or not path.name.startswith(prefix):
        raise BackupError('Refusing unsafe cleanup target')
    def readonly(function,name,error):
        candidate=Path(name).resolve(strict=True)
        if not candidate.is_relative_to(path.resolve(strict=True)):raise BackupError('Cleanup escaped owned folder')
        os.chmod(name,stat.S_IWRITE|stat.S_IREAD);function(name)
    shutil.rmtree(path,onerror=readonly)

@contextmanager
def destination_lock(destination):
    lock=destination/'.backup.lock'
    try:
        with lock.open('x',encoding='utf-8') as f:f.write(json.dumps({'pid':os.getpid(),'started':datetime.now(timezone.utc).isoformat()}))
    except FileExistsError:raise BackupError('Another backup owns the destination lock; do not delete a live lock')
    try:yield
    finally:lock.unlink()

def checked_destination(vault,destination):
    vault=Path(vault).resolve(strict=True);destination=Path(destination).resolve()
    if destination.is_relative_to(vault) or vault.is_relative_to(destination):raise BackupError('Backup and vault must use separate directory trees')
    if any(part.casefold().startswith('onedrive') for part in destination.parts):raise BackupError('Local recovery copy must be outside OneDrive')
    return destination

def create_backup(vault,destination,keep=14):
    vault=Path(vault).resolve(strict=True);destination=checked_destination(vault,destination)
    if not 1<=keep<=3650:raise BackupError('Keep must be between 1 and 3650')
    destination.mkdir(parents=True,exist_ok=True)
    with destination_lock(destination):
        stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex
        pending=destination/('.pending-'+stamp);pending.mkdir()
        try:
            before=git_state(vault);files=inventory(vault)
            run_git(vault,'bundle','create',str(pending/'history.bundle'),'--all')
            patch=run_git(vault,'diff','--cached','--binary','--full-index','--no-ext-diff','--no-textconv','HEAD')
            if sha256(patch)!=before['index']:raise BackupError('Source index changed during backup')
            (pending/'index.patch').write_bytes(patch)
            with zipfile.ZipFile(pending/'vault.zip','w',compression=zipfile.ZIP_DEFLATED,allowZip64=True) as archive:
                for relative in sorted(files):archive.write(vault/relative,relative)
            if files!=inventory(vault) or before!=git_state(vault):raise BackupError('Source changed during backup; last verified snapshot retained')
            manifest={'format':FORMAT,'created_at':datetime.now(timezone.utc).isoformat(),'source':str(vault),'git':before,'files':files,
                'excluded':{'directories':sorted(EXCLUDED_DIRS),'files':sorted(EXCLUDED_FILES),'volatile':'Obsidian workspace/workspace-mobile.json'},
                'consistency':'Source hashes and Git state matched before and after capture; not a cross-machine atomic snapshot.',
                'artifacts':{name:file_digest(pending/name) for name in sorted(ARTIFACTS)}}
            write_manifest(pending,manifest);verify_backup(pending)
            completed=destination/('olympus-snapshot-'+stamp);pending.rename(completed)
            # UUID ordering cannot establish creation order within one second.
            # Always retain the snapshot just verified and published.
            older=[path for path in destination.glob('olympus-snapshot-*') if path!=completed]
            snapshots=[completed]+sorted(older,key=lambda path:path.stat().st_mtime_ns,reverse=True)
            for old in snapshots[keep:]:
                # An unknown/corrupt directory is preserved for diagnosis.
                try:verify_backup(old)
                except (BackupError,OSError,ValueError,zipfile.BadZipFile):continue
                remove_owned(old,destination,'olympus-snapshot-')
            return completed
        finally:
            if pending.exists():remove_owned(pending,destination,'.pending-')

def restore_backup(snapshot,destination):
    snapshot=Path(snapshot).resolve(strict=True);manifest=verify_backup(snapshot)
    destination=Path(destination).resolve()
    if destination.exists() or destination.is_relative_to(Path(manifest['source']).resolve()) or destination.is_relative_to(snapshot):
        raise BackupError('Restore requires a new folder outside the original vault and snapshot')
    destination.parent.mkdir(parents=True,exist_ok=True)
    pending=destination.parent/('.restore-'+uuid.uuid4().hex);pending.mkdir()
    try:
        run_git(pending,'init')
        run_git(pending,'fetch','--no-write-fetch-head',str(snapshot/'history.bundle'),'+refs/*:refs/*')
        head=manifest['git']['head']
        if not re.fullmatch('[0-9a-f]{40,64}',head):raise BackupError('Invalid captured Git identity')
        branch=manifest['git']['branch']
        if branch=='HEAD':run_git(pending,'update-ref','--no-deref','HEAD',head)
        else:
            run_git(pending,'check-ref-format','refs/heads/'+branch)
            run_git(pending,'update-ref','refs/heads/'+branch,head)
            run_git(pending,'symbolic-ref','HEAD','refs/heads/'+branch)
        run_git(pending,'read-tree','HEAD')
        if (snapshot/'index.patch').stat().st_size:run_git(pending,'apply','--cached','--binary',str(snapshot/'index.patch'))
        with zipfile.ZipFile(snapshot/'vault.zip') as archive:
            for relative in manifest['files']:
                target=pending.joinpath(*safe_name(relative).parts);target.parent.mkdir(parents=True,exist_ok=True)
                with archive.open(relative) as source,target.open('xb') as output:shutil.copyfileobj(source,output)
        if inventory(pending)!=manifest['files']:raise BackupError('Restored file verification failed')
        run_git(pending,'fsck','--full')
        if run_git(pending,'rev-parse','HEAD').decode().strip()!=head:raise BackupError('Restored history mismatch')
        pending.rename(destination)
        return {'status':'verified','destination':str(destination),'files':len(manifest['files']),'head':head}
    finally:
        if pending.exists():remove_owned(pending,destination.parent,'.restore-')

def github_metadata(repository):
    result=subprocess.run(['gh','api','--hostname','github.com','repos/'+repository],capture_output=True)
    if result.returncode:raise BackupError('Cannot confirm the GitHub backup repository identity and privacy; upload stopped')
    return json.loads(result.stdout)

def require_private_remote(config):
    repository=config.get('repository','');branch=config.get('branch','')
    if not re.fullmatch(r'[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+',repository) or not re.fullmatch(r'snapshots/[a-z0-9-]+',branch):
        raise BackupError('Invalid configured backup repository or machine branch')
    metadata=github_metadata(repository)
    if metadata.get('private') is not True or metadata.get('id')!=config.get('repository_id') or metadata.get('full_name','').casefold()!=repository.casefold():
        raise BackupError('Backup destination is not the pinned private repository; upload stopped')
    return 'https://github.com/'+repository+'.git'

def remote_git(root,*args):
    return run_git(root,'-c','credential.helper=','-c','credential.helper=!gh auth git-credential',*args)

def publish_backup(snapshot,config_path):
    snapshot=Path(snapshot).resolve(strict=True);verify_backup(snapshot)
    config_path=Path(config_path).resolve(strict=True);config=json.loads(config_path.read_text(encoding='utf-8-sig'))
    remote=require_private_remote(config)
    publisher=config_path.parent/'.publisher';marker=publisher/'.olympus-backup-publisher'
    identity=json.dumps({'repository':config['repository'],'id':config['repository_id'],'branch':config['branch']},sort_keys=True)
    with destination_lock(config_path.parent):
        if publisher.exists():
            if linked(publisher) or not marker.is_file() or marker.read_text()!=identity:
                raise BackupError('Publisher directory belongs to a different destination')
        else:
            publisher.mkdir();run_git(publisher,'init','-b',config['branch']);marker.write_text(identity)
        run_git(publisher,'config','user.name','Olympus Backup')
        run_git(publisher,'config','user.email','backup@localhost')
        if run_git(publisher,'symbolic-ref','--short','HEAD').decode().strip()!=config['branch']:
            raise BackupError('Publisher is on an unexpected branch')
        if not run_git(publisher,'for-each-ref','refs/heads/'+config['branch']):
            existing=remote_git(publisher,'ls-remote',remote,'refs/heads/'+config['branch']).decode().split()
            if existing:
                # Recover lost local transport state without rewriting remote
                # history or checking out data into the working vault.
                remote_git(publisher,'fetch',remote,'refs/heads/'+config['branch'])
                run_git(publisher,'update-ref','refs/heads/'+config['branch'],'FETCH_HEAD')
                run_git(publisher,'read-tree','HEAD')
        names=sorted(ARTIFACTS|{'manifest.json','manifest.sha256'})
        total=0
        for name in names:
            size=(snapshot/name).stat().st_size;total+=size
            if size>90*1024**2:raise BackupError('Snapshot artifact exceeds the 90 MiB GitHub transport guard; local backup preserved. Migrate off-device storage before retrying.')
        if total>1024**3:raise BackupError('Snapshot exceeds the 1 GiB transport budget; local backup preserved')
        # A recovery archive must survive a clone with Windows autocrlf enabled.
        (publisher/'.gitattributes').write_bytes(b'* -text\n')
        for name in names:shutil.copyfile(snapshot/name,publisher/name)
        run_git(publisher,'add','--','.gitattributes',*names)
        if run_git(publisher,'diff','--cached','--name-only'):
            run_git(publisher,'commit','-m','Verified vault snapshot '+snapshot.name)
        head=run_git(publisher,'rev-parse','HEAD').decode().strip()
        # Never overwrite another machine's remote history.
        require_private_remote(config)
        remote_git(publisher,'push',remote,'HEAD:refs/heads/'+config['branch'])
        actual=remote_git(publisher,'ls-remote',remote,'refs/heads/'+config['branch']).decode().split()
        if not actual or actual[0]!=head:raise BackupError('Remote commit did not match after push')
        return {'repository':config['repository'],'branch':config['branch'],'commit':head,'verified_at':datetime.now(timezone.utc).isoformat()}

def save_status(destination,report):
    destination=Path(destination);destination.mkdir(parents=True,exist_ok=True)
    path=destination/'status.json';previous={}
    if path.exists():
        try:previous=json.loads(path.read_text())
        except (ValueError,OSError):pass
    if report.get('remote'):report['last_remote_success']=report['remote']
    elif previous.get('last_remote_success'):report['last_remote_success']=previous['last_remote_success']
    if report.get('snapshot'):report['last_local_success']=report['snapshot']
    elif previous.get('last_local_success'):report['last_local_success']=previous['last_local_success']
    report['checked_at']=datetime.now(timezone.utc).isoformat()
    pending=destination/('.status-'+uuid.uuid4().hex)
    pending.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');os.replace(pending,path)

def main():
    parser=argparse.ArgumentParser(description=__doc__);sub=parser.add_subparsers(dest='action',required=True)
    create=sub.add_parser('create');create.add_argument('--vault',required=True);create.add_argument('--destination',required=True);create.add_argument('--keep',type=int,default=14);create.add_argument('--remote-config')
    verify=sub.add_parser('verify');verify.add_argument('--snapshot',required=True)
    restore=sub.add_parser('restore');restore.add_argument('--snapshot',required=True);restore.add_argument('--destination',required=True)
    args=parser.parse_args()
    report={};status_destination=None
    try:
        if args.action=='create':
            status_destination=checked_destination(args.vault,args.destination)
            report={'status':'verified-local','snapshot':str(create_backup(args.vault,args.destination,args.keep))}
            if args.remote_config:
                report['remote']=publish_backup(report['snapshot'],args.remote_config);report['status']='verified-local-and-remote'
            save_status(args.destination,report);print(json.dumps(report))
        elif args.action=='verify':
            result=verify_backup(args.snapshot);print(json.dumps({'status':'verified','files':len(result['files']),'head':result['git']['head']}))
        else:print(json.dumps(restore_backup(args.snapshot,args.destination)))
    except (BackupError,OSError,ValueError,zipfile.BadZipFile) as error:
        report.update(status='failed',error=str(error))
        if status_destination is not None and status_destination.exists():save_status(status_destination,report)
        print(json.dumps(report));raise SystemExit(1)

if __name__=='__main__':main()

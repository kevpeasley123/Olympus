"""Recovery tests use isolated repositories and never write the real vault."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import uuid
from datetime import datetime, timezone
from unittest import mock
import zipfile

MODULE=Path(__file__).with_name('vault_backup.py')
if MODULE.exists():
    spec=importlib.util.spec_from_file_location('vault_backup',MODULE)
    backup=importlib.util.module_from_spec(spec);spec.loader.exec_module(backup)
else: backup=None

class Recovery(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='olympus-backup-test-')
        self.root=Path(self.temp.name);self.vault=self.root/'vault';self.vault.mkdir()
        self.dest=self.root/'backups'
        self.git('init','-b','main');self.git('config','user.name','Fixture');self.git('config','user.email','fixture@invalid')
        (self.vault/'note.md').write_text('committed',encoding='utf-8')
        (self.vault/'deleted.md').write_text('delete me',encoding='utf-8')
        self.git('add','.');self.git('commit','-m','fixture')
        self.head=self.git('rev-parse','HEAD').strip()
    def tearDown(self): self.temp.cleanup()
    def git(self,*args,cwd=None):
        return subprocess.run(['git','-C',str(cwd or self.vault),*args],check=True,capture_output=True,text=True).stdout
    def require_implementation(self):
        self.assertIsNotNone(backup,'Backup currently saves only committed history; working-tree recovery is missing')
    def test_recovers_history_staged_unstaged_untracked_and_deleted_files(self):
        self.require_implementation()
        (self.vault/'note.md').write_text('staged',encoding='utf-8');self.git('add','note.md')
        (self.vault/'note.md').write_text('working copy',encoding='utf-8')
        (self.vault/'draft 🦉.md').write_text('not yet committed',encoding='utf-8')
        (self.vault/'deleted.md').unlink()
        (self.vault/'.memory-history').mkdir();(self.vault/'.memory-history/old.json').write_text('{"older":"bytes"}')
        before=self.git('status','--porcelain=v1')
        snapshot=backup.create_backup(self.vault,self.dest,keep=14)
        self.assertEqual(before,self.git('status','--porcelain=v1'))
        self.assertEqual(self.head,self.git('rev-parse','HEAD').strip())
        target=self.root/'recovered';report=backup.restore_backup(snapshot,target)
        self.assertEqual((target/'note.md').read_text(),'working copy')
        self.assertEqual((target/'draft 🦉.md').read_text(),'not yet committed')
        self.assertTrue((target/'.memory-history/old.json').exists())
        self.assertFalse((target/'deleted.md').exists())
        self.assertEqual(self.git('show',':note.md',cwd=target),'staged')
        self.assertEqual(self.git('rev-parse','HEAD',cwd=target).strip(),self.head)
        self.assertEqual(before,self.git('status','--porcelain=v1',cwd=target))
        self.assertEqual(report['status'],'verified')
    def test_source_change_never_publishes_a_success_or_prunes_last_good_backup(self):
        self.require_implementation();first=backup.create_backup(self.vault,self.dest,keep=1)
        original=backup.inventory
        calls=0
        def changing(root):
            nonlocal calls
            calls+=1
            if calls==2: (self.vault/'note.md').write_text('changed during backup')
            return original(root)
        with mock.patch.object(backup,'inventory',side_effect=changing):
            with self.assertRaisesRegex(backup.BackupError,'changed'):backup.create_backup(self.vault,self.dest,keep=1)
        self.assertTrue(first.exists());self.assertEqual(len(list(self.dest.glob('olympus-snapshot-*'))),1)
    def test_corruption_is_rejected_before_restore_or_retention(self):
        self.require_implementation();snapshot=backup.create_backup(self.vault,self.dest)
        with (snapshot/'vault.zip').open('ab') as f:f.write(b'corruption')
        with self.assertRaises(backup.BackupError):backup.restore_backup(snapshot,self.root/'restore')
        self.assertFalse((self.root/'restore').exists())
    def test_live_source_and_existing_restore_destination_are_never_overwritten(self):
        self.require_implementation()
        with self.assertRaises(backup.BackupError):backup.create_backup(self.vault,self.vault/'backups')
        snapshot=backup.create_backup(self.vault,self.dest)
        with self.assertRaises(backup.BackupError):backup.restore_backup(snapshot,self.vault)
        with self.assertRaises(backup.BackupError):backup.restore_backup(snapshot,self.vault/'restored')
        self.assertEqual((self.vault/'note.md').read_text(),'committed')
        before=sorted(p.relative_to(self.vault).as_posix() for p in self.vault.rglob('*'))
        command=subprocess.run([sys.executable,str(MODULE),'create','--vault',str(self.vault),'--destination',str(self.vault)],capture_output=True)
        self.assertNotEqual(command.returncode,0)
        self.assertEqual(before,sorted(p.relative_to(self.vault).as_posix() for p in self.vault.rglob('*')))
    def test_retention_only_removes_owned_verified_snapshots(self):
        self.require_implementation();self.dest.mkdir();(self.dest/'keep-me.txt').write_text('independent')
        # Two runs in one second, with UUID order opposite creation order.
        with mock.patch.object(backup,'datetime') as clock,mock.patch.object(backup.uuid,'uuid4',side_effect=[uuid.UUID(int=2),uuid.UUID(int=1)]):
            clock.now.return_value=datetime(2026,10,8,tzinfo=timezone.utc)
            first=backup.create_backup(self.vault,self.dest,keep=1)
            second=backup.create_backup(self.vault,self.dest,keep=1)
        self.assertFalse(first.exists());self.assertTrue(second.exists());self.assertTrue((self.dest/'keep-me.txt').exists())
    def test_unsafe_archive_paths_are_rejected_even_with_recomputed_checksums(self):
        self.require_implementation()
        for name in ['../escape','C:/escape','folder/evil:stream','.git/config','folder/CON','folder/x.']:
            with self.subTest(name=name):
                snapshot=backup.create_backup(self.vault,self.dest)
                with zipfile.ZipFile(snapshot/'vault.zip','a') as z:z.writestr(name,'bad')
                manifest=json.loads((snapshot/'manifest.json').read_text())
                manifest['artifacts']['vault.zip']=backup.file_digest(snapshot/'vault.zip')
                manifest['files'][name]={'sha256':backup.sha256(b'bad'),'bytes':3}
                backup.write_manifest(snapshot,manifest)
                with self.assertRaises(backup.BackupError):backup.verify_backup(snapshot)

    def test_remote_upload_requires_the_pinned_private_repository(self):
        self.require_implementation()
        self.assertTrue(hasattr(backup,'require_private_remote'),'Off-device publication is not implemented')
        config={'repository':'owner/private-vault','repository_id':123,'branch':'snapshots/machine'}
        for metadata in [{'id':123,'private':False,'full_name':'owner/private-vault'}, {'id':999,'private':True,'full_name':'owner/private-vault'}]:
            with mock.patch.object(backup,'github_metadata',return_value=metadata):
                with self.assertRaises(backup.BackupError):backup.require_private_remote(config)
        with mock.patch.object(backup,'github_metadata',return_value={'id':123,'private':True,'full_name':'owner/private-vault'}):
            self.assertEqual(backup.require_private_remote(config),'https://github.com/owner/private-vault.git')

    def test_unresolved_merge_cannot_replace_the_last_restorable_snapshot(self):
        self.require_implementation();first=backup.create_backup(self.vault,self.dest,keep=1)
        self.git('checkout','-b','other');(self.vault/'note.md').write_text('other change');self.git('commit','-am','other')
        self.git('checkout','main');(self.vault/'note.md').write_text('main change');self.git('commit','-am','main')
        result=subprocess.run(['git','-C',str(self.vault),'merge','other'],capture_output=True)
        self.assertNotEqual(result.returncode,0)
        with self.assertRaisesRegex(backup.BackupError,'unresolved'):
            backup.create_backup(self.vault,self.dest,keep=1)
        self.assertTrue(first.exists());self.assertEqual(len(list(self.dest.glob('olympus-snapshot-*'))),1)

    def test_privacy_check_uses_the_same_host_as_the_upload(self):
        with mock.patch.object(backup.subprocess,'run',return_value=mock.Mock(returncode=0,stdout=b'{}')) as command:
            backup.github_metadata('owner/private-vault')
            self.assertIn('--hostname',command.call_args.args[0]);self.assertIn('github.com',command.call_args.args[0])

    def test_transient_index_patch_must_match_captured_git_state(self):
        first=backup.create_backup(self.vault,self.dest,keep=1)
        original=backup.run_git;calls=0
        def transient(root,*args,**kwargs):
            nonlocal calls
            if args[:2]==('diff','--cached'):
                calls+=1
                if calls==2:return b'transient staged patch'
            return original(root,*args,**kwargs)
        with mock.patch.object(backup,'run_git',side_effect=transient):
            with self.assertRaisesRegex(backup.BackupError,'index'):
                backup.create_backup(self.vault,self.dest,keep=1)
        self.assertTrue(first.exists())
        manifest=json.loads((first/'manifest.json').read_text())
        manifest['git']['index']=backup.sha256(b'a different patch')
        backup.write_manifest(first,manifest)
        with self.assertRaisesRegex(backup.BackupError,'index'):backup.verify_backup(first)

    def test_remote_publication_can_resume_after_local_publisher_loss(self):
        bare=self.root/'off-device.git';bare.mkdir();self.git('init','--bare',cwd=bare)
        snapshot=backup.create_backup(self.vault,self.dest)
        config={'repository':'owner/private-vault','repository_id':123,'branch':'snapshots/machine'}
        commits=[]
        with mock.patch.object(backup,'require_private_remote',return_value=str(bare)),mock.patch.object(backup,'remote_git',side_effect=backup.run_git):
            for name in ['first-machine-state','recovered-machine-state']:
                directory=self.root/name;directory.mkdir();(directory/'remote.json').write_text(json.dumps(config))
                try:commits.append(backup.publish_backup(snapshot,directory/'remote.json')['commit'])
                except backup.BackupError as error:self.fail('Restored publisher could not resume: '+str(error))
        self.git('merge-base','--is-ancestor',commits[0],commits[1],cwd=bare)
        downloaded=self.root/'downloaded'
        self.git('-c','core.autocrlf=true','clone','--branch','snapshots/machine',str(bare),str(downloaded),cwd=self.root)
        backup.restore_backup(downloaded,self.root/'remote-restored')

if __name__=='__main__':unittest.main()

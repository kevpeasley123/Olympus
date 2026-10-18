"""Reversible installation of the approved passive statusline wrapper; no model calls."""
from pathlib import Path
import argparse, hashlib, json, os, shutil, datetime

def digest(data): return hashlib.sha256(data).hexdigest()
def install(home, source, baseline, node):
    settings=home/'.claude/settings.json'
    raw=settings.read_bytes(); config=json.loads(raw.decode('utf-8-sig'))
    if digest(raw)!=baseline['settingsSha256']: raise RuntimeError('Claude settings changed since inspection; inspect before retrying')
    original=home/'.claude/statusline-command.sh'
    if digest(original.read_bytes())!=baseline['originalScriptSha256']: raise RuntimeError('Original statusline changed since inspection')
    command=config.get('statusLine',{}).get('command')
    if command!=baseline['statusLine']['command'] or command!='bash /c/Users/kevpe/.claude/statusline-command.sh': raise RuntimeError('Unreviewed statusline command; preserve it and inspect first')
    target=home/'.claude/olympus-quota'
    target.mkdir(exist_ok=False)
    shutil.copy2(settings,target/'settings.before.json');shutil.copy2(original,target/'statusline.before.sh')
    shutil.copy2(source,target/'collector.mjs')
    wrapper='#!/usr/bin/env bash\ninput=$(cat)\nprintf \'%s\' "$input" | '+json.dumps(node.as_posix())+' '+json.dumps((target/'collector.mjs').as_posix())+' >/dev/null 2>&1\nprintf \'%s\' "$input" | '+command+'\n'
    (target/'wrapper.sh').write_text(wrapper,encoding='utf-8',newline='\n')
    installed='bash "'+(target/'wrapper.sh').as_posix()+'"'
    manifest={'originalStatusLine':config['statusLine'],'installedCommand':installed,'collectorSha256':digest(source.read_bytes()),'settingsSha256Before':digest(raw),'originalScriptSha256':digest(original.read_bytes()),'installedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
    (target/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    config['statusLine']={**config['statusLine'],'command':installed}
    if settings.read_bytes()!=raw: raise RuntimeError('Claude settings changed during preparation; configuration left untouched')
    temp=target/'settings.pending.json';temp.write_text(json.dumps(config,indent=2)+'\n',encoding='utf-8');os.replace(temp,settings)
    print(json.dumps({'installed':True,'directory':str(target),'originalScriptUnchanged':digest(original.read_bytes())==manifest['originalScriptSha256']}))

def restore(home):
    target=home/'.claude/olympus-quota';settings=home/'.claude/settings.json'
    raw=settings.read_bytes();config=json.loads(raw.decode('utf-8-sig'));manifest=json.loads((target/'manifest.json').read_text(encoding='utf-8'))
    if config.get('statusLine',{}).get('command')!=manifest['installedCommand']: raise RuntimeError('Statusline changed; refusing to overwrite concurrent work')
    config['statusLine']={**config['statusLine'],'command':manifest['originalStatusLine']['command']}
    if settings.read_bytes()!=raw: raise RuntimeError('Settings changed during restore')
    temp=target/'settings.restore.json';temp.write_text(json.dumps(config,indent=2)+'\n',encoding='utf-8');os.replace(temp,settings)
    print('Original statusline restored; other settings and backup files preserved')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--baseline');parser.add_argument('--restore',action='store_true');args=parser.parse_args()
    if args.restore: restore(Path.home())
    elif args.baseline:
        node=Path('C:/Program Files/nodejs/node.exe')
        if not node.is_file(): raise RuntimeError('Reviewed Node runtime unavailable')
        install(Path.home(),Path(__file__).with_name('claude-quota-collector.mjs'),json.loads(Path(args.baseline).read_text(encoding='utf-8')),node)
    else: parser.error('Provide inspected --baseline or --restore')

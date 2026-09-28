"""Import an explicitly curated local context pack; never invokes a model or mail API.

Run with Olympus stopped. Originals stay in place. The caller reviews the pack;
this validates graph references, backs up the database, and preserves provenance.
"""
import argparse,datetime,json,pathlib,sqlite3,shutil,hashlib

def validate(pack):
    required=['situationId','asOf','phase','summary','coverage','sources','entities','relationships','facts','workstreams']
    if pack.get('version')!=1 or any(k not in pack for k in required):raise ValueError('Invalid context version/fields')
    sid=pack['situationId']
    if not sid or len(sid)>100 or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in sid):raise ValueError('Invalid situation ID')
    for field,limit in [('sources',500),('entities',200),('workstreams',24),('relationships',500),('facts',300)]:
        if not isinstance(pack[field],list) or len(pack[field])>limit:raise ValueError('Invalid '+field)
    ids={}
    for field in ['sources','entities','workstreams']:
        ids[field]={x['id'] for x in pack[field]}
        if len(ids[field])!=len(pack[field]):raise ValueError('Duplicate '+field)
    if not ids['workstreams']:raise ValueError('At least one workstream required')
    for e in pack['entities']:
        if e['kind'] not in ['person','organization','service','unknown'] or e['workstream'] not in ids['workstreams']:raise ValueError('Invalid entity')
    for edge in pack['relationships']:
        if edge['from'] not in ids['entities'] or edge['to'] not in ids['entities']:raise ValueError('Dangling relationship')
    for group in ['entities','relationships','facts','workstreams']:
        for item in pack[group]:
            if not item.get('refs') or any(r['sourceId'] not in ids['sources'] or not r.get('locator') for r in item['refs']):raise ValueError('Uncited '+group)
    for fact in pack['facts']:
        if fact['status'] not in ['documented','operator context','needs confirmation'] or fact['workstream'] not in ids['workstreams']:raise ValueError('Invalid fact')
    for source in pack['sources']:
        path=pathlib.Path(source['path'])
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=source['sha256']:raise ValueError('Source changed or unavailable: '+source['id'])
    return pack

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--pack',required=True);parser.add_argument('--db',required=True);parser.add_argument('--title',required=True);parser.add_argument('--dismiss-id',action='append',default=[]);parser.add_argument('--merge-id',action='append',default=[]);args=parser.parse_args()
    pack=validate(json.loads(pathlib.Path(args.pack).read_text(encoding='utf-8')))
    dbpath=pathlib.Path(args.db).resolve()
    if not dbpath.is_file():raise ValueError('Existing Olympus database required')
    c=sqlite3.connect(dbpath);c.execute('PRAGMA busy_timeout=10000')
    accounts=c.execute('SELECT id FROM gmail_accounts WHERE enabled=1').fetchall()
    if len(accounts)!=1:raise ValueError('Exactly one connected account required')
    account=accounts[0][0];stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
    archive=dbpath.parent/'situation-imports'/pack['situationId'];archive.mkdir(parents=True,exist_ok=True)
    backup=archive/('before-import-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'.sqlite')
    with sqlite3.connect(backup) as dst:c.backup(dst)
    # Preserve extracted provenance separately from the map and model-facing rows.
    source_dir=pathlib.Path(args.pack).resolve().parent
    extraction=archive/'extraction';extraction.mkdir(exist_ok=True)
    for f in source_dir.glob('source-*.json'):shutil.copy2(f,extraction/f.name)
    for name in ['manifest.json','HOME-SOURCE-REVIEW.md','operator-home-handoff.md']:
        if (source_dir/name).is_file():shutil.copy2(source_dir/name,archive/name)
    for source in pack['sources']:
        if source['id']=='operator-handoff':source['path']=str(archive/'operator-home-handoff.md')
    with c:
        c.execute('CREATE TABLE IF NOT EXISTS communication_situation_contexts(account_id TEXT NOT NULL,situation_id TEXT NOT NULL,payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),updated_at TEXT NOT NULL,PRIMARY KEY(account_id,situation_id))')
        c.execute("INSERT INTO communication_situations(account_id,id,title,state,briefing_json,updated_at) VALUES(?,?,?,'active','{}',?) ON CONFLICT(account_id,id) DO UPDATE SET title=excluded.title,state='active',updated_at=excluded.updated_at",(account,pack['situationId'],args.title,stamp))
        c.execute('INSERT INTO communication_situation_contexts VALUES(?,?,?,?) ON CONFLICT(account_id,situation_id) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at',(account,pack['situationId'],json.dumps(pack,ensure_ascii=False),stamp))
        for sid in args.dismiss_id:
            if sid==pack['situationId']:raise ValueError('Cannot dismiss imported situation')
            if c.execute("UPDATE communication_situations SET state='dismissed',updated_at=? WHERE account_id=? AND id=? AND state IN ('active','emerging')",(stamp,account,sid)).rowcount!=1:raise ValueError('Dismiss target changed')
        for sid in args.merge_id:
            if sid==pack['situationId'] or c.execute('SELECT 1 FROM communication_situation_contexts WHERE account_id=? AND situation_id=?',(account,sid)).fetchone():raise ValueError('Cannot merge a document foundation without reconciling it')
            if c.execute("UPDATE communication_situations SET state='merged',merged_into=?,updated_at=? WHERE account_id=? AND id=? AND state IN ('active','emerging')",(pack['situationId'],stamp,account,sid)).rowcount!=1:raise ValueError('Merge target changed')
            for table in ['communication_situation_sources','communication_situation_updates','communication_situation_drafts']:
                c.execute(f'UPDATE {table} SET situation_id=? WHERE account_id=? AND situation_id=?',(pack['situationId'],account,sid))
        c.execute('UPDATE communication_situation_state SET context_revision=context_revision+1,last_attempt=0 WHERE account_id=?',(account,))
    (archive/'context.json').write_text(json.dumps(pack,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'imported':pack['situationId'],'entities':len(pack['entities']),'sources':len(pack['sources']),'dismissed':len(args.dismiss_id),'merged':len(args.merge_id),'backup':str(backup)}))
if __name__=='__main__':main()

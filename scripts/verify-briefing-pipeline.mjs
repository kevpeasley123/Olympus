import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
mkdirSync('output/conversation-brief',{recursive:true});
const env={...process.env,OLYMPUS_BRIEF_FIXTURE_PATH:resolve('output/conversation-brief/native-fixture.json')};
for(const [command,args] of [['cargo',['test','--lib','--offline','--locked','--manifest-path','src-tauri/Cargo.toml','ordinary_conversation_learning_reaches_brief_context']],[process.execPath,['scripts/test-briefing-memory.mjs']]]) {
 const result=spawnSync(command,args,{env,stdio:'inherit',windowsHide:true});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}

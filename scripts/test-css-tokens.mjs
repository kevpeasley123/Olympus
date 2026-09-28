// Fails on any `var(--x)` with no definition and no fallback (review D2).
// An undefined token computes to the property's initial value, which is how
// `.delegation-run` lost its gap and padding without anything reporting it.
import {readFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';
async function walk(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p)}return out}
const files=(await walk('src')).filter(f=>/\.(css|tsx?)$/.test(f));
const defined=new Set(),uses=[];
for(const file of files){
  const text=await readFile(file,'utf8');
  for(const m of text.matchAll(/(--[\w-]+)\s*:/g))defined.add(m[1]);
  // Set from script: style={{"--x": …}}, style.setProperty("--x", …).
  for(const m of text.matchAll(/["'`](--[\w-]+)["'`]/g))defined.add(m[1]);
  for(const m of text.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g))if(!m[2])uses.push([m[1],file]);
}
// Written per key at runtime by services/ambientMotion.ts (`--ambient-${key}`).
const dynamicPrefixes=['--ambient-'];
const missing=uses.filter(([name])=>!defined.has(name)&&!dynamicPrefixes.some(p=>name.startsWith(p)));
if(missing.length){for(const [name,file] of missing)console.error(`undefined ${name} in ${file}`);process.exit(1)}
console.log(`PASS ${uses.length} var() references resolve to a definition or a runtime-set prefix`);

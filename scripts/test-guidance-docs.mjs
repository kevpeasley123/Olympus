// Fails when the guidance docs drift from the code they describe. Stale
// guidance is worse than none: agents read these files first and rebuild
// whatever they describe. Checks only facts a script can prove:
//   1. docs/NEXT-SESSION.md names the current version and stays a short handoff;
//      docs/RELEASES.md has a line for the current version.
//   2. Every repository path or file name a live doc mentions still exists.
//   3. The ARCHITECTURE.md command table lists exactly the registered commands.
//   4. Every `npm run <script>` a live doc mentions exists in package.json.
// History is exempt: docs/archive/, docs/reviews/ and release notes record what
// was true then, and may name files that have since gone.
import {readFile, readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {dirname, join, normalize} from 'node:path';

const HANDOFF = 'docs/NEXT-SESSION.md', HANDOFF_MAX_LINES = 150;
const failures = [];
const fail = message => failures.push(message);

function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {encoding: 'utf8'})
      .split('\n').filter(Boolean);
  } catch { return null; }
}
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, {withFileTypes: true})) {
    if (['.git', 'node_modules', 'dist', 'target', 'output'].includes(e.name)) continue;
    const p = dir === '.' ? e.name : `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}
const files = (trackedFiles() ?? await walk('.')).filter(f => !f.startsWith('node_modules/'));
const fileSet = new Set(files);
const exists = path => fileSet.has(path) || files.some(f => f.startsWith(path.endsWith('/') ? path : `${path}/`));
const endsWithPath = path => files.some(f => f === path || f.endsWith(`/${path}`));

const liveDocs = files.filter(f => f.endsWith('.md') && (
  !f.includes('/') ||
  (f.startsWith('docs/') && !/^docs\/(archive|reviews)\//.test(f) && !/^docs\/RELEASES?[-.]/.test(f))
));

// 1. Version and handoff.
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const handoff = await readFile(HANDOFF, 'utf8');
if (!handoff.includes(version)) fail(`${HANDOFF} does not name the current version ${version}; rewrite it for this release`);
const handoffLines = handoff.split('\n').length;
if (handoffLines > HANDOFF_MAX_LINES) fail(`${HANDOFF} is ${handoffLines} lines (limit ${HANDOFF_MAX_LINES}); it is a handoff, not a log: move history to docs/archive/`);
if (!(await readFile('docs/RELEASES.md', 'utf8')).includes(`**${version}**`)) fail(`docs/RELEASES.md has no line for ${version}`);

// 2. Paths and file names.
const ROOTS = /^(src|src-tauri|scripts|docs|public)\//;
// Named in docs but never in the repository: they live in app data, the
// operator's machine, installed skills, or generated output.
const OUTSIDE_REPO = new Set(['gmail-oauth-client.json', 'client_secret_fixture.json', 'SKILL.md',
  'references/pattern-index.json', 'manifest.json', 'remote.json', 'status.json', 'report.json', 'report.md',
  // Planned output of the Armory engine spike (docs/ARMORY-PLAN.md, 0c).
  'docs/ENGINE-SPIKE.md']);
const EXT = /\.(md|tsx?|rs|mjs|css|json|ps1|html|sql|toml|py|png)$/;
function checkReference(doc, raw, isLink) {
  let ref = raw.trim().replace(/[.,;)]+$/, '').replace(/#.*$/, '').replace(/:\d+(?:[-–]\d+)?(?:,\s*\d+)*$/, '');
  ref = ref.replace(/^\/(?!\/)/, '');
  if (!ref || OUTSIDE_REPO.has(ref) || /\s|:\/\/|^mailto:|[*<>{}$|=("'\\~]|^[-@.]/.test(ref)) return;
  if (isLink) {
    const local = normalize(join(dirname(doc), ref)).replaceAll('\\', '/');
    if (!exists(local) && !exists(ref)) fail(`${doc}: link to missing ${raw}`);
    return;
  }
  if (ROOTS.test(ref)) {
    const local = normalize(join(dirname(doc), ref)).replaceAll('\\', '/');
    if (!exists(ref) && !exists(local)) fail(`${doc}: names missing path ${raw}`);
  } else if (EXT.test(ref) && !ref.startsWith('output/')) {
    if (!endsWithPath(ref)) fail(`${doc}: names missing file ${raw}`);
  }
}
const npmScripts = Object.keys(JSON.parse(await readFile('package.json', 'utf8')).scripts);
for (const doc of liveDocs) {
  const text = await readFile(doc, 'utf8');
  for (const m of text.matchAll(/`([^`\n]+)`/g)) checkReference(doc, m[1], false);
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) if (!/^(https?:|#)/.test(m[1])) checkReference(doc, m[1], true);
  // 4. npm scripts.
  for (const m of text.matchAll(/npm run ([a-z][\w:-]*[\w-])/g)) if (!npmScripts.includes(m[1])) fail(`${doc}: names missing npm script "${m[1]}"`);
}

// 3. Command table.
const lib = await readFile('src-tauri/src/lib.rs', 'utf8');
const registered = new Set(lib.match(/generate_handler!\[([\s\S]*?)\]/)[1].split(',').map(s => s.trim().split('::').pop()).filter(Boolean));
const architecture = await readFile('ARCHITECTURE.md', 'utf8');
const table = architecture.match(/<!-- commands:start -->([\s\S]*?)<!-- commands:end -->/);
if (!table) fail('ARCHITECTURE.md: missing <!-- commands:start --> … <!-- commands:end --> table');
else {
  // Parenthesised notes may quote values such as `null`; only names count.
  const listed = [...table[1].replace(/\([^)]*\)/g, '').matchAll(/`([a-z][a-z0-9_]*)`/g)].map(m => m[1]);
  const seen = new Set();
  for (const name of listed) {
    if (seen.has(name)) fail(`ARCHITECTURE.md: command ${name} listed twice`);
    seen.add(name);
    if (!registered.has(name)) fail(`ARCHITECTURE.md: lists ${name}, which lib.rs does not register`);
  }
  for (const name of registered) if (!seen.has(name)) fail(`ARCHITECTURE.md: command table is missing ${name}, registered in lib.rs`);
}

if (failures.length) { for (const f of failures) console.error(f); process.exit(1); }
console.log(`PASS guidance docs: ${liveDocs.length} live docs reference existing files and scripts, ${registered.size} commands documented, handoff current for ${version}`);

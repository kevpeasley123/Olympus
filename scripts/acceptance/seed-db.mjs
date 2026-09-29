#!/usr/bin/env node
// Seeds the acceptance database with the rows the first native pass needs.
//
//   node scripts/acceptance/seed-db.mjs <dir> [--db <path>]
//
// Run it after build-fixtures.mjs and after one launch with the acceptance
// config has created the database, with the app closed. <dir> is the fixture
// directory. The database defaults to the acceptance identifier's app data
// directory (%APPDATA%\com.projectolympus.acceptance\olympus.sqlite on
// Windows); --db names another one explicitly. A path containing
// "commandstation", the production identifier, is always refused.
//
// Inserts: an enabled synthetic Gmail account; one situation with document
// context (the rows scripts/import-situation-context.py writes, inserted
// directly so no Python is needed); a delegation run awaiting review in a git
// worktree of acceptance-history; conversation across four days, including a
// reply with research provenance and one row marked as imported from
// localStorage. It also commits once in acceptance-history, so that project
// has a commit since the first launch. Refuses to run twice on one database.
//
// Needs node:sqlite: Node 22.13 or later runs it as is; 22.5–22.12 need
// --experimental-sqlite, which this script adds by re-running itself.

import { spawnSync, execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let sqlite;
try {
  sqlite = await import("node:sqlite");
} catch {
  if (!process.execArgv.includes("--experimental-sqlite")) {
    const rerun = spawnSync(process.execPath, ["--experimental-sqlite", ...process.execArgv, fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: "inherit" });
    process.exit(rerun.status ?? 1);
  }
  console.error(`Refusing: node:sqlite is unavailable in Node ${process.version}. Use Node 22.5 or later.`);
  process.exit(1);
}
const { DatabaseSync } = sqlite;

const IDENTIFIER = "com.projectolympus.acceptance";
const SEED_EVENT = "acceptance-seed";
const usage = "Usage: node scripts/acceptance/seed-db.mjs <dir> [--db <path>]";

function fail(message) {
  console.error(`Refusing: ${message} Nothing was changed.`);
  process.exit(1);
}

// ---- Arguments and refusals ------------------------------------------------

const args = process.argv.slice(2);
let dbArg = null;
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--db") dbArg = args[++i] ?? fail("--db needs a path.");
  else positional.push(args[i]);
}
if (positional.length !== 1) {
  console.error(usage);
  process.exit(2);
}
const dir = resolve(positional[0]);

/** Tauri's app_data_dir: the platform data directory joined with the identifier. */
function defaultDatabase() {
  const data = platform() === "win32" ? process.env.APPDATA
    : platform() === "darwin" ? join(homedir(), "Library", "Application Support")
    : process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  if (!data) fail("APPDATA is not set; pass --db explicitly.");
  return join(data, IDENTIFIER, "olympus.sqlite");
}
const dbPath = resolve(dbArg ?? defaultDatabase());
if (dbPath.toLowerCase().includes("commandstation")) fail(`${dbPath} belongs to the production identifier.`);
if (!dbArg && !dbPath.includes(IDENTIFIER)) fail(`${dbPath} is not under ${IDENTIFIER}; pass --db explicitly.`);
if (!existsSync(dbPath)) fail(`${dbPath} does not exist. Launch once with the acceptance config first, then close the app.`);

const vault = join(dir, "vault");
const history = join(dir, "projects", "acceptance-history");
const researchFile = "02 - Research/Evidence Before Authority.md";
for (const required of [join(vault, researchFile), join(history, ".git"), join(vault, "02 - Research", "_attachments", "sample.pdf")]) {
  if (!existsSync(required)) fail(`${required} is missing. Run build-fixtures.mjs into ${dir} first.`);
}

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA busy_timeout = 10000; PRAGMA foreign_keys = ON;");
const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view')").all().map((row) => row.name));
for (const table of ["gmail_accounts", "communication_situations", "communication_situation_contexts", "delegation_runs", "delegation_contracts", "conversation_messages", "conversation_research", "conversation_imports", "processing_logs"]) {
  if (!tables.has(table)) fail(`${dbPath} has no ${table} table. Launch this branch's build once so it applies the current schema.`);
}
if (db.prepare("SELECT 1 FROM processing_logs WHERE event_type = ?").get(SEED_EVENT)) fail(`${dbPath} is already seeded.`);
if (db.prepare("SELECT 1 FROM gmail_accounts WHERE enabled = 1").get()) fail(`${dbPath} already has an enabled Gmail account.`);

// ---- Helpers ----------------------------------------------------------------

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const git = (cwd, gitArgs, at) => {
  const env = { ...process.env };
  if (at !== undefined) env.GIT_AUTHOR_DATE = env.GIT_COMMITTER_DATE = `@${Math.floor(at / 1000)} +0000`;
  return execFileSync("git", gitArgs, { cwd, env, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
};

/** `pantheon.rs` `split_frontmatter`: BOM stripped, `---` fences, body after the closing fence. */
function splitFrontmatter(content) {
  content = content.replace(/^﻿/, "");
  if (!content.startsWith("---")) return null;
  let after = content.slice(3);
  after = after.startsWith("\r\n") ? after.slice(2) : after.startsWith("\n") ? after.slice(1) : after;
  const end = after.indexOf("\n---");
  if (end < 0) return null;
  let body = after.slice(end + 4);
  body = body.startsWith("\r\n") ? body.slice(2) : body.startsWith("\n") ? body.slice(1) : body;
  return { frontmatter: after.slice(0, end), body };
}

/** `vault_write.rs` `content_fingerprint`: LF, each line right-trimmed, trailing whitespace dropped. */
function contentFingerprint(content) {
  const normalised = content.replace(/\r\n/g, "\n").split("\n").map((line) => line.replace(/\r$/, "").trimEnd()).join("\n").trimEnd();
  return sha256(normalised);
}

const scalar = (frontmatter, key) => frontmatter.match(new RegExp(`^${key}:\\s*"?([^"\\n]*)"?\\s*$`, "m"))?.[1];

const now = Date.now();
const DAY = 86_400_000;
const HOUR = 3_600_000;
const pad = (n) => String(n).padStart(2, "0");
/** SQLite CURRENT_TIMESTAMP form, UTC: what conversation_messages.created_at holds. */
const sqliteTime = (ms) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");
const isoSeconds = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const clock = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
/** A local time `days` ago at `hour`:`minute`. */
const localAt = (days, hour, minute) => { const d = new Date(now - days * DAY); d.setHours(hour, minute, 0, 0); return d.getTime(); };

// ---- Research provenance ----------------------------------------------------

const note = splitFrontmatter(readFileSync(join(vault, researchFile), "utf8"));
if (!note) fail(`${researchFile} has no frontmatter.`);
const body = note.body.trim();
if (body.length > 4000) fail(`${researchFile} is longer than one excerpt.`);
const provenance = [{
  title: scalar(note.frontmatter, "title"),
  sourceFile: researchFile,
  sourceDate: scalar(note.frontmatter, "source_date") ?? null,
  stance: scalar(note.frontmatter, "stance"),
  origin: scalar(note.frontmatter, "origin") ?? null,
  excerpt: body,
  truncated: false,
  fingerprint: contentFingerprint(body)
}];

// ---- Situation document pack ------------------------------------------------

const account = { email: "acceptance.operator@example.invalid" };
account.id = contentFingerprint(account.email);
const docs = join(dir, "situation-docs");
mkdirSync(docs, { recursive: true });
copyFileSync(join(vault, "02 - Research", "_attachments", "sample.pdf"), join(docs, "office-lease.pdf"));
writeFileSync(join(docs, "operator-update.md"), "# Operator update\n\nSynthetic. The move date is not confirmed; the landlord owes a revised floor plan.\n");
const source = (id, title, file, category) => ({ id, title, path: join(docs, file), sha256: sha256(readFileSync(join(docs, file))), category });
const ref = (sourceId, locator) => [{ sourceId, locator }];
const situationId = "acceptance-office-move";
const pack = {
  version: 1,
  situationId,
  asOf: new Date(now).toISOString().slice(0, 10),
  phase: "Lease signed, move not scheduled",
  summary: "Synthetic situation. The lease is signed; the move date, the floor plan and the internet install are still open.",
  coverage: "Synthetic acceptance fixture. Two invented local documents; no mail and no real accounts.",
  sources: [
    source("lease", "Example office lease", "office-lease.pdf", "Invented document evidence"),
    source("update", "Example operator update", "operator-update.md", "Invented operator context")
  ],
  workstreams: [
    { id: "w0", title: "Lease", summary: "The lease is signed. The landlord owes a revised floor plan.", nextStep: "Ask the landlord for the revised floor plan.", refs: ref("lease", "p. 1") },
    { id: "w1", title: "Move", summary: "No mover is booked and no date is confirmed.", nextStep: "Confirm a move date before booking a mover.", refs: ref("update", "operator update") },
    { id: "w2", title: "Internet", summary: "An install is needed; no provider is chosen.", nextStep: "Choose a provider once the move date is known.", refs: ref("update", "operator update") }
  ],
  entities: [
    { id: "landlord", name: "Example Property Group", kind: "organization", role: "Landlord", status: "active relationship", workstream: "w0", notes: "Named in the lease.", contacts: ["leasing@example.invalid"], refs: ref("lease", "p. 1") },
    { id: "agent", name: "Morgan Hale", kind: "person", role: "Leasing agent", status: "active relationship", workstream: "w0", notes: "Signed for the landlord.", contacts: ["morgan@example.invalid"], refs: ref("lease", "p. 1") },
    { id: "mover", name: "Mover not chosen", kind: "unknown", role: "Mover to identify", status: "needs confirmation", workstream: "w1", notes: "No quote is on file.", contacts: [], refs: ref("update", "operator update") },
    { id: "isp", name: "Example Fiber", kind: "service", role: "Candidate internet provider", status: "candidate", workstream: "w2", notes: "Mentioned by the operator; no contract.", contacts: [], refs: ref("update", "operator update") }
  ],
  relationships: [
    { from: "agent", to: "landlord", description: "Morgan represents Example Property Group.", refs: ref("lease", "p. 1") }
  ],
  facts: [
    { label: "Lease signed", text: "The lease is signed by both parties.", status: "documented", workstream: "w0", refs: ref("lease", "p. 1") },
    { label: "Move date", text: "No move date is confirmed.", status: "needs confirmation", workstream: "w1", refs: ref("update", "operator update") },
    { label: "Operator priority", text: "The operator wants the floor plan before booking anything.", status: "operator context", workstream: "w0", refs: ref("update", "operator update") }
  ]
};

/** `import-situation-context.py` `validate()`, so the rows match what that script would accept. */
function validate(p) {
  const required = ["situationId", "asOf", "phase", "summary", "coverage", "sources", "entities", "relationships", "facts", "workstreams"];
  if (p.version !== 1 || required.some((k) => !(k in p))) throw Error("Invalid context version/fields");
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(p.situationId)) throw Error("Invalid situation ID");
  for (const [field, limit] of [["sources", 500], ["entities", 200], ["workstreams", 24], ["relationships", 500], ["facts", 300]]) {
    if (!Array.isArray(p[field]) || p[field].length > limit) throw Error(`Invalid ${field}`);
  }
  const ids = {};
  for (const field of ["sources", "entities", "workstreams"]) {
    ids[field] = new Set(p[field].map((x) => x.id));
    if (ids[field].size !== p[field].length) throw Error(`Duplicate ${field}`);
  }
  if (!ids.workstreams.size) throw Error("At least one workstream required");
  for (const e of p.entities) if (!["person", "organization", "service", "unknown"].includes(e.kind) || !ids.workstreams.has(e.workstream)) throw Error("Invalid entity");
  for (const edge of p.relationships) if (!ids.entities.has(edge.from) || !ids.entities.has(edge.to)) throw Error("Dangling relationship");
  for (const group of ["entities", "relationships", "facts", "workstreams"]) {
    for (const item of p[group]) if (!item.refs?.length || item.refs.some((r) => !ids.sources.has(r.sourceId) || !r.locator)) throw Error(`Uncited ${group}`);
  }
  for (const fact of p.facts) if (!["documented", "operator context", "needs confirmation"].includes(fact.status) || !ids.workstreams.has(fact.workstream)) throw Error("Invalid fact");
  for (const s of p.sources) if (!existsSync(s.path) || sha256(readFileSync(s.path)) !== s.sha256) throw Error(`Source changed or unavailable: ${s.id}`);
}
try { validate(pack); } catch (error) { fail(`the synthetic situation pack is invalid (${error.message}).`); }
writeFileSync(join(docs, "context.json"), JSON.stringify(pack, null, 2));

// ---- Git: a commit since the first launch, and the delegation worktree -------

writeFileSync(join(history, "SINCE-LAUNCH.md"), "Committed by seed-db.mjs after the first acceptance launch.\n");
git(history, ["add", "SINCE-LAUNCH.md"]);
git(history, ["commit", "-q", "-m", "Commit after the first acceptance launch"], now);
const base = git(history, ["rev-parse", "HEAD"]);

const runId = randomUUID();
const branch = `olympus/run-${runId.slice(0, 8)}`;
const workspace = join(dir, "delegations", runId);
mkdirSync(join(dir, "delegations"), { recursive: true });
git(history, ["worktree", "add", "-q", "-b", branch, workspace, base]);
writeFileSync(join(workspace, "README.md"), "# acceptance-history\n\nRevision 7, edited by the synthetic delegated run.\n");
// The only check this worktree can run. It prints and exits 0, and declares no
// test script, so "npm test" reads as not applicable.
writeFileSync(join(workspace, "package.json"), JSON.stringify({
  name: "acceptance-history",
  private: true,
  scripts: { build: "node -e \"console.log('acceptance build ok')\"" }
}, null, 2) + "\n");
// The review refuses npm checks without node_modules; empty is enough, since
// the build script needs no dependencies and Olympus never installs them.
mkdirSync(join(workspace, "node_modules"), { recursive: true });

// ---- Database ---------------------------------------------------------------

const conversation = [
  { id: "acceptance-u1", role: "user", at: localAt(4, 9, 12), content: "What changed in acceptance-history this week?" },
  { id: "acceptance-a1", role: "assistant", at: localAt(4, 9, 13), content: "Two commits: the request log and a fix for empty requests. No next step is recorded for the project." },
  { id: "acceptance-u2", role: "user", at: localAt(2, 16, 40), content: "Should a delegated run be approved on the agent's summary?" },
  { id: "acceptance-a2", role: "assistant", at: localAt(2, 16, 41), content: "No. Approve it against the recorded checks and the diff. Evidence Before Authority makes the same point; it is endorsed in your library.", research: provenance },
  { id: "acceptance-u3", role: "user", at: localAt(1, 11, 5), content: "Is the office move on track?" },
  { id: "acceptance-a3", role: "assistant", at: localAt(1, 11, 6), content: "The lease is signed. The move date and the floor plan are still open." },
  { id: "acceptance-u4", role: "user", at: now - 20 * 60_000, content: "Anything waiting on me?" },
  { id: "acceptance-a4", role: "assistant", at: now - 19 * 60_000, content: "One delegated run is awaiting your review in acceptance-history." }
];
// Imported from localStorage at the first desktop launch, three days ago. Its
// original date was never recorded; only its HH:MM survived.
const importedAt = now - 3 * DAY;
const imported = { id: "acceptance-imported-1", role: "user", content: "Remind me why acceptance-archive was archived.", timestamp: "14:10" };

const criteria = [
  "The build script prints a confirmation line and exits 0.",
  "No file outside the worktree is changed."
];
const stamp = new Date(now).toISOString();

db.exec("BEGIN IMMEDIATE");
try {
  db.prepare("INSERT INTO gmail_accounts (id, email, enabled, status, scopes, connected_at, horizon_days) VALUES (?, ?, 1, 'connected', ?, ?, 90)")
    .run(account.id, account.email, "https://www.googleapis.com/auth/gmail.readonly", new Date(now - 3 * DAY).toISOString());

  // The rows import-situation-context.py writes, in the same form.
  db.prepare("INSERT INTO communication_situations (account_id, id, title, state, briefing_json, updated_at) VALUES (?, ?, ?, 'active', '{}', ?)")
    .run(account.id, situationId, "Office move (synthetic)", stamp);
  db.prepare("INSERT INTO communication_situation_contexts (account_id, situation_id, payload_json, updated_at) VALUES (?, ?, ?, ?)")
    .run(account.id, situationId, JSON.stringify(pack), stamp);
  db.prepare("UPDATE communication_situation_state SET context_revision = context_revision + 1, last_attempt = 0 WHERE account_id = ?").run(account.id);

  // Side rows as store_messages writes them: empty provenance unless supplied.
  const message = db.prepare("INSERT INTO conversation_messages (id, role, content, timestamp, created_at) VALUES (?, ?, ?, ?, ?)");
  const research = db.prepare("INSERT INTO conversation_research (message_id, sources_json) VALUES (?, ?)");
  const mail = db.prepare("INSERT INTO conversation_mail (message_id, sources_json) VALUES (?, '[]')");
  for (const row of conversation) {
    message.run(row.id, row.role, row.content, clock(row.at), sqliteTime(row.at));
    research.run(row.id, JSON.stringify(row.research ?? []));
    mail.run(row.id);
  }
  message.run(imported.id, imported.role, imported.content, imported.timestamp, sqliteTime(importedAt));
  research.run(imported.id, "[]");
  mail.run(imported.id);
  db.prepare("INSERT INTO conversation_imports (message_id, imported_at) VALUES (?, ?)").run(imported.id, isoSeconds(importedAt));

  db.prepare(`INSERT INTO delegation_runs (id, project_id, project_name, task, driver, model, phase, workspace, branch,
      base_commit, agent_session_id, process_id, milestone, checkpoint, outcome, changed_files_json, diff_summary, error, started_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'awaiting_review', ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?, NULL, ?, ?)`)
    .run(runId, "project-acceptance-history", "acceptance-history",
      "Add a build script that prints a confirmation line.",
      "Synthetic acceptance fixture (no agent ran)", "synthetic",
      workspace, branch, base, runId,
      "Implementation finished; operator review required",
      "Added a build script that prints a confirmation line, and updated the README. (Synthetic: no agent ran.)",
      JSON.stringify(["README.md", "package.json"]), "README.md | 2 +-; package.json (new)",
      new Date(now - 2 * HOUR).toISOString(), new Date(now - HOUR).toISOString());
  db.prepare("INSERT INTO delegation_contracts (run_id, criteria_json, plan) VALUES (?, ?, ?)")
    .run(runId, JSON.stringify(criteria), "1. Add package.json with a build script that only prints.\n2. Update the README.\n3. Change nothing else.");
  const event = db.prepare("INSERT INTO delegation_events (run_id, phase, milestone, created_at) VALUES (?, ?, ?, ?)");
  event.run(runId, "planning", "Synthetic plan recorded", new Date(now - 2 * HOUR).toISOString());
  event.run(runId, "editing", "Synthetic edits written to the worktree", new Date(now - 90 * 60_000).toISOString());
  event.run(runId, "awaiting_review", "Implementation finished; operator review required", new Date(now - HOUR).toISOString());

  db.prepare("INSERT INTO processing_logs (event_type, message, payload_json) VALUES (?, ?, ?)")
    .run(SEED_EVENT, "Acceptance seed applied", JSON.stringify({ dir, runId, situationId, account: account.email }));
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  console.error(`Seeding failed and the database was rolled back: ${error.message}`);
  console.error(`The commit in ${history} and the worktree at ${workspace} remain; delete ${dir} and rebuild the fixture to start again.`);
  process.exit(1);
}
db.close();

console.log(`Seeded ${dbPath}

  Gmail       ${account.email} (synthetic, enabled; every network and keyring path is refused)
  Situation   "Office move (synthetic)" with document context from ${docs}
  Delegation  run ${runId} awaiting review
              worktree ${workspace} (branch ${branch}, build script only echoes)
  Chat        ${conversation.length} messages across four days; ${conversation.filter((m) => m.research).length} reply with research provenance
              (${researchFile}, fingerprint ${provenance[0].fingerprint.slice(0, 12)}…)
              1 row imported from localStorage (${isoSeconds(importedAt)}, original time ${imported.timestamp})
  Projects    acceptance-history has one commit made now, after the first launch

Relaunch with OLYMPUS_ACCEPTANCE_DIR=${dir} and the acceptance config.`);

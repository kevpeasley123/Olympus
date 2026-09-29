// Regression checks for scripts/acceptance/seed-db.mjs destination identity.
// Everything is built under a fresh temporary directory: a fixture, scratch
// databases from src-tauri/schema.sql, and directory links. The links are
// junctions on Windows and symlinks elsewhere, and the output says which ran.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir, platform } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const LINK = platform() === "win32" ? "junction" : "dir";
const LINK_NAME = platform() === "win32" ? "junction" : "symlink";
const schema = readFileSync("src-tauri/schema.sql", "utf8");
const root = mkdtempSync(join(tmpdir(), "olympus-seed-test-"));
let passed = 0;

function check(condition, message) {
  if (!condition) {
    rmSync(root, { recursive: true, force: true });
    throw new Error(`FAIL ${message}`);
  }
  passed++;
}

function node(script, args, env = {}) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
}

function fixture(name) {
  const dir = join(root, name);
  const built = node("scripts/acceptance/build-fixtures.mjs", [dir]);
  check(built.status === 0, `fixture ${name} builds: ${built.stderr}`);
  return dir;
}

/** A database as the app leaves it after one launch, with or without the acceptance launch record. */
function database(parent, launchedFor) {
  mkdirSync(parent, { recursive: true });
  const path = join(parent, "olympus.sqlite");
  const db = new DatabaseSync(path);
  db.exec(schema);
  if (launchedFor !== undefined) {
    db.prepare("INSERT INTO processing_logs (event_type, message, payload_json) VALUES ('acceptance-profile-launch', 'Acceptance profile launch', ?)")
      .run(JSON.stringify({ dir: launchedFor, identifier: "com.projectolympus.acceptance" }));
  }
  db.close();
  return path;
}

function seeded(path) {
  const db = new DatabaseSync(path);
  const count = db.prepare("SELECT count(*) AS n FROM processing_logs WHERE event_type = 'acceptance-seed'").get().n;
  const accounts = db.prepare("SELECT count(*) AS n FROM gmail_accounts").get().n;
  db.close();
  return count + accounts > 0;
}

function refused(label, fx, args, db, env) {
  const run = node("scripts/acceptance/seed-db.mjs", [fx, ...args], env);
  check(run.status === 1 && run.stderr.includes("Refusing"), `${label}: refused (status ${run.status}) ${run.stdout}${run.stderr}`);
  if (db) check(!seeded(db), `${label}: nothing written`);
  return run.stderr;
}

const fx = fixture("fx");
const other = fixture("other");

// A production-named directory, even one that carries a launch record for this fixture.
const production = database(join(root, "data", "com.projectolympus.commandstation"), fx);
refused("production path by name", fx, ["--db", production], production);

// The same directory reached through a link whose name says nothing.
symlinkSync(join(root, "data", "com.projectolympus.commandstation"), join(root, "data", "innocent"), LINK);
const viaLink = refused(`production path through a ${LINK_NAME}`, fx, ["--db", join(root, "data", "innocent", "olympus.sqlite")], production);
check(viaLink.includes("resolves to") && viaLink.includes("commandstation"), `${LINK_NAME} refusal names the resolved path`);

// The default location, when the acceptance directory itself is a link into production.
const appdata = join(root, "appdata");
mkdirSync(appdata);
symlinkSync(join(root, "data", "com.projectolympus.commandstation"), join(appdata, "com.projectolympus.acceptance"), LINK);
const defaultEnv = platform() === "win32" ? { APPDATA: appdata } : { XDG_DATA_HOME: appdata };
refused(`default path through a ${LINK_NAME}`, fx, [], production, defaultEnv);

// Acceptance-looking databases that lack the right launch record.
const unlaunched = database(join(root, "data", "no-launch"));
refused("no launch record", fx, ["--db", unlaunched], unlaunched);
const elsewhere = database(join(root, "data", "other-fixture"), other);
refused("launch record for another fixture", fx, ["--db", elsewhere], elsewhere);
const garbled = database(join(root, "data", "garbled"));
{
  const db = new DatabaseSync(garbled);
  db.exec("INSERT INTO processing_logs (event_type, message, payload_json) VALUES ('acceptance-profile-launch', 'x', 'not json')");
  db.close();
}
refused("unreadable launch record", fx, ["--db", garbled], garbled);

// The fixture reached through a link still matches the record written for its real path.
const good = database(join(root, "default", "com.projectolympus.acceptance"), fx);
symlinkSync(fx, join(root, "fx-link"), LINK);
const ok = node("scripts/acceptance/seed-db.mjs", [join(root, "fx-link")], platform() === "win32" ? { APPDATA: join(root, "default") } : { XDG_DATA_HOME: join(root, "default") });
check(ok.status === 0 && seeded(good), `seeds the launched acceptance database at the default path: ${ok.stderr}`);
refused("second seed", fx, [], undefined, platform() === "win32" ? { APPDATA: join(root, "default") } : { XDG_DATA_HOME: join(root, "default") });

rmSync(root, { recursive: true, force: true });
console.log(`PASS ${passed} acceptance seed destination checks (links exercised as ${LINK_NAME}s on ${platform()})`);

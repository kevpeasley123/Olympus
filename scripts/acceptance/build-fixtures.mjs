#!/usr/bin/env node
// Writes the synthetic vault and projects root for a desktop acceptance run.
//
//   node scripts/acceptance/build-fixtures.mjs <dir>
//
// <dir>/vault     the ten vault folders, project notes, research notes with
//                 wikilinks and a PDF attachment, a decision log, system notes
// <dir>/projects  git repositories: clean, dirty, recent history, one with a
//                 linked worktree holding uncommitted work, and a plain folder
// <dir>/worktrees the linked worktree, outside the projects root so the scan
//                 reports it under its repository rather than as a project
//
// Everything here is invented. Nothing reads or writes outside <dir>: git
// identity is set per repository, and no global git configuration is touched.
// Run it with OLYMPUS_ACCEPTANCE_DIR=<dir> and see DESKTOP-ACCEPTANCE.md.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const usage = "Usage: node scripts/acceptance/build-fixtures.mjs <dir>";
const target = process.argv[2];
if (!target || process.argv.length > 3) {
  console.error(usage);
  process.exit(2);
}
const root = resolve(target);
if (existsSync(root) && readdirSync(root).length > 0) {
  console.error(`Refusing: ${root} exists and is not empty. Choose a new directory; nothing was changed.`);
  process.exit(1);
}
try {
  execFileSync("git", ["--version"], { stdio: "ignore" });
} catch {
  console.error("Refusing: git is not on PATH. The projects fixture needs it.");
  process.exit(1);
}

const DAY = 86_400_000;
const HOUR = 3_600_000;
const now = Date.now();
const pad = (n) => String(n).padStart(2, "0");
/** Local calendar date, the form the notes' date fields use. */
const localDate = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const today = localDate(now);

const vault = join(root, "vault");
const projects = join(root, "projects");
const worktrees = join(root, "worktrees");

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

/** Git with this repository's own identity; dates, when given, pin both author and committer. */
function git(cwd, args, at) {
  const env = { ...process.env };
  if (at !== undefined) {
    // Git's internal format: unambiguous in every locale and time zone.
    const stamp = `@${Math.floor(at / 1000)} +0000`;
    env.GIT_AUTHOR_DATE = stamp;
    env.GIT_COMMITTER_DATE = stamp;
  }
  return execFileSync("git", args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
}

function initRepo(path) {
  mkdirSync(path, { recursive: true });
  git(path, ["init", "-q", "-b", "main"]);
  git(path, ["config", "user.name", "Olympus Acceptance Fixture"]);
  git(path, ["config", "user.email", "acceptance@example.invalid"]);
  git(path, ["config", "commit.gpgsign", "false"]);
  git(path, ["config", "core.autocrlf", "false"]);
}

function commit(path, files, message, at) {
  for (const [name, content] of Object.entries(files)) write(join(path, name), content);
  git(path, ["add", "--all"]);
  git(path, ["commit", "-q", "-m", message], at);
}

/** A one-page PDF with correct xref offsets, so any reader opens it. */
function samplePdf() {
  const text = "Olympus acceptance sample attachment";
  const stream = `BT /F1 14 Tf 24 72 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 360 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

// ---- Vault ---------------------------------------------------------------

const FOLDERS = [
  "00 - Dashboard", "01 - Projects", "02 - Research", "03 - Tasks", "04 - Decisions",
  "05 - Skills", "06 - Agents", "07 - Templates", "08 - Daily Briefs", "09 - System"
];
for (const folder of FOLDERS) mkdirSync(join(vault, folder), { recursive: true });

write(join(vault, "00 - Dashboard", "Acceptance Home.md"), `# Acceptance vault

Synthetic vault for a desktop acceptance run. Nothing here is the operator's.
`);

/** Frontmatter in the shape `project_notes.rs` reads; dates quoted as it asks. */
function projectNote({ title, alias, status, promoted, vision, visionReviewed, nextStep, body }) {
  const lines = ["---", `title: "${title}"`, "type: project", `status: ${status}`];
  if (promoted) lines.push(`promoted: "${promoted}"`);
  if (vision) lines.push(`vision: "${vision}"`);
  if (visionReviewed) lines.push(`vision_reviewed: "${visionReviewed}"`);
  if (nextStep) lines.push(`next_step: "${nextStep}"`);
  lines.push("aliases:", `  - ${alias}`, "tags:", "  - olympus/project", "---", "", `# ${title}`, "", body, "");
  return lines.join("\n");
}

const PROJECT_NOTES = [
  {
    file: "Project Acceptance Clean.md", title: "Project Acceptance Clean", alias: "acceptance-clean",
    status: "active", promoted: localDate(now - 40 * DAY),
    vision: "A small, finished tool whose repository is clean.",
    visionReviewed: localDate(now - 6 * DAY),
    nextStep: "Tag the current commit as the first release.",
    body: "A clean repository with a declared next step and a recent vision review."
  },
  {
    file: "Project Acceptance Dirty.md", title: "Project Acceptance Dirty", alias: "acceptance-dirty",
    status: "watching", promoted: localDate(now - 90 * DAY),
    vision: "A parser kept in view while its upstream settles.",
    visionReviewed: localDate(now - 20 * DAY),
    nextStep: "Decide whether the uncommitted config change is kept.",
    body: "Uncommitted changes sit in the working tree.\n\n- [ ] Review the uncommitted config change in acceptance-dirty"
  },
  {
    file: "Project Acceptance History.md", title: "Project Acceptance History", alias: "acceptance-history",
    status: "active", promoted: localDate(now - 30 * DAY),
    vision: "A service with steady daily commits.",
    visionReviewed: localDate(now - 12 * DAY),
    // No next step on purpose: the board and briefing must say none is recorded.
    nextStep: null,
    body: "Several commits across the last days. No next step is declared."
  },
  {
    file: "Project Acceptance Worktree.md", title: "Project Acceptance Worktree", alias: "acceptance-worktree",
    status: "active", promoted: localDate(now - 300 * DAY),
    vision: "A library whose agent work happens in a linked worktree.",
    // Older than the 90-day review window on purpose.
    visionReviewed: localDate(now - 200 * DAY),
    nextStep: "Review the uncommitted agent work in the linked worktree.",
    body: "The linked worktree holds uncommitted files."
  },
  {
    file: "Project Acceptance Archive.md", title: "Project Acceptance Archive", alias: "acceptance-archive",
    status: "archived", promoted: localDate(now - 400 * DAY),
    vision: "Retired. Kept for its decision history.",
    visionReviewed: localDate(now - 120 * DAY),
    nextStep: "Nothing further; archived.",
    body: "No repository exists for this project, so it renders from the note alone."
  }
];
for (const note of PROJECT_NOTES) write(join(vault, "01 - Projects", note.file), projectNote(note));

/** Frontmatter in the shape the Add Entry writer produces (`pantheon.rs`). */
function researchNote({ title, sourceType, created, sourceDate, sourceUrl, origin, stance, whyKept, project, body }) {
  return [
    "---",
    `title: "${title}"`,
    "type: research",
    `source_type: "${sourceType}"`,
    `created: "${created}"`,
    `source_date: "${sourceDate}"`,
    `source_url: "${sourceUrl}"`,
    'written_by: "Olympus acceptance fixture"',
    `origin: ${origin}`,
    `stance: ${stance}`,
    `why_kept: "${whyKept}"`,
    `project: "${project}"`,
    "tags:",
    '  - "olympus/research"',
    `  - "research/${sourceType}"`,
    "---",
    "",
    body
  ].join("\n");
}

const RESEARCH = [
  {
    file: "Evidence Before Authority.md",
    title: "Evidence Before Authority", sourceType: "Paper", created: localDate(now - 9 * DAY),
    sourceDate: "2025-11-04", sourceUrl: "https://example.org/papers/evidence-before-authority",
    origin: "collected", stance: "endorsed",
    whyKept: "Grounds the rule that recorded evidence precedes approval.",
    project: "01 - Projects/Project Acceptance Clean.md",
    body: `# Evidence Before Authority

## Claim

An agent's report of its own work is a claim, not evidence. Review compares the
change against recorded checks before anything is approved.

## Method

The synthetic study compared reviews that read check output first with reviews
that read the agent's summary first. See [[Checklist Discipline]] for the
checklist used, and [[A Note That Does Not Exist]] for a link that resolves to
nothing on purpose.

## Attachment

![[_attachments/sample.pdf]]
`
  },
  {
    file: "Checklist Discipline.md",
    title: "Checklist Discipline", sourceType: "Guide", created: localDate(now - 5 * DAY),
    sourceDate: "2026-02-10", sourceUrl: "https://example.org/guides/checklist-discipline",
    origin: "olympus-found", stance: "provisional",
    whyKept: "A short checklist for verifying delegated work.",
    project: "01 - Projects/Project Acceptance History.md",
    body: `# Checklist Discipline

## Before review

1. Run the declared build.
2. Read the diff, not the summary.

## After review

Record what was observed for each criterion. Related:
[[Evidence Before Authority]].
`
  },
  {
    file: "Latency Budgets for Spoken Replies.md",
    title: "Latency Budgets for Spoken Replies", sourceType: "Article", created: localDate(now - 2 * DAY),
    sourceDate: "2026-06-01", sourceUrl: "https://example.org/articles/latency-budgets",
    origin: "collected", stance: "disputed",
    whyKept: "Its latency numbers disagree with the visual-first order; kept to test that claim.",
    project: "01 - Projects/Project Acceptance Worktree.md",
    body: `# Latency Budgets for Spoken Replies

## Summary

Argues that spoken summaries should start before written text. Olympus does the
opposite; this entry is kept as a dissenting source.
`
  }
];
for (const note of RESEARCH) write(join(vault, "02 - Research", note.file), researchNote(note));
write(join(vault, "02 - Research", "_attachments", "sample.pdf"), samplePdf());

write(join(vault, "03 - Tasks", "Acceptance Tasks.md"), `# Acceptance tasks

- [ ] Walk the first native pass in DESKTOP-ACCEPTANCE.md
- [ ] Record each row as pass, fail or observed
- [x] Build the acceptance fixture
`);

write(join(vault, "04 - Decisions", "Decision Log.md"), `---
title: Decision Log
type: decision-log
tags:
  - olympus/decisions
---

# Decision Log

Synthetic entries for an acceptance run.

## ${localDate(now - 10 * DAY)} · Review reads evidence first

Delegated work is approved only against recorded checks, never the agent's own
summary. Source: [[Evidence Before Authority]].

## ${localDate(now - 3 * DAY)} · Archive Acceptance Archive

The archived project keeps its note; its repository is gone.
`);

write(join(vault, "05 - Skills", "Skill Index.md"), "# Skill Index\n\nSynthetic: no skills are registered in the acceptance vault.\n");
write(join(vault, "06 - Agents", "Agent Index.md"), "# Agent Index\n\nSynthetic: Research @1 and Verification @1 are described in the app's catalog.\n");
write(join(vault, "07 - Templates", "Project Template.md"), "---\ntype: project\nstatus: scaffold\ntags:\n  - olympus/template\n---\n\n# {{title}}\n");
write(join(vault, "08 - Daily Briefs", "README.md"), "# Daily Briefs\n\nReserved for later scheduled briefs. Empty in the acceptance vault.\n");

write(join(vault, "09 - System", "User Profile.md"), `---
title: User Profile
type: system
status: active
olympus:
  brief_time: "07:30"
  brief_max_words: 400
  active_project_cap: 5
  quiet_hours: "22:00-07:00"
tags:
  - olympus/system
---

# User Profile

Synthetic operator for an acceptance run. Prefers dry, economical replies.
`);
write(join(vault, "09 - System", "Olympus Charter.md"), `---
title: Olympus Charter
type: system
tags:
  - olympus/system
---

# Olympus Charter

Synthetic charter. Reads run freely; writes ask first.
`);

// The vault is a repository, as the real one is, so gated writes can commit.
initRepo(vault);
commit(vault, {}, "Acceptance vault fixture", now - 10 * DAY);

// ---- Projects --------------------------------------------------------------

const clean = join(projects, "acceptance-clean");
initRepo(clean);
commit(clean, { "README.md": "# acceptance-clean\n\nA clean repository.\n" }, "Start acceptance-clean", now - 20 * DAY);
commit(clean, { "src/main.txt": "release candidate\n" }, "Prepare the first release", now - 8 * DAY);

const dirty = join(projects, "acceptance-dirty");
initRepo(dirty);
commit(dirty, { "README.md": "# acceptance-dirty\n", "config.txt": "mode=strict\n" }, "Start acceptance-dirty", now - 15 * DAY);
write(join(dirty, "config.txt"), "mode=lenient\n");
write(join(dirty, "notes-uncommitted.txt"), "Not yet added.\n");

const history = join(projects, "acceptance-history");
initRepo(history);
const HISTORY = [
  [4 * DAY, "Start acceptance-history"],
  [3 * DAY + 2 * HOUR, "Add the request log"],
  [2 * DAY, "Handle empty requests"],
  [DAY + 3 * HOUR, "Document the log format"],
  [5 * HOUR, "Tighten request validation"],
  [HOUR, "Fix a typo in the log header"]
];
HISTORY.forEach(([ago, message], index) => {
  commit(history, { "README.md": `# acceptance-history\n\nRevision ${index + 1}.\n`, [`log/${index + 1}.txt`]: `${message}\n` }, message, now - ago);
});

const worktreeRepo = join(projects, "acceptance-worktree");
initRepo(worktreeRepo);
commit(worktreeRepo, { "README.md": "# acceptance-worktree\n", "lib.txt": "v1\n" }, "Start acceptance-worktree", now - 6 * DAY);
const linked = join(worktrees, "acceptance-worktree-agent");
mkdirSync(worktrees, { recursive: true });
git(worktreeRepo, ["worktree", "add", "-q", "-b", "agent/acceptance-fixture", linked]);
write(join(linked, "lib.txt"), "v2 in progress\n");
write(join(linked, "agent-notes.txt"), "Uncommitted agent work.\n");

write(join(projects, "acceptance-plain", "README.md"), "# acceptance-plain\n\nA folder that is not a git repository and has no note.\n");

console.log(`Acceptance fixture written to ${root}

  vault      ${vault}
             ${FOLDERS.length} folders · ${PROJECT_NOTES.length} project notes · ${RESEARCH.length} research notes · sample.pdf · Decision Log
  projects   ${projects}
             acceptance-clean (clean) · acceptance-dirty (uncommitted) · acceptance-history (${HISTORY.length} dated commits)
             acceptance-worktree (linked worktree with uncommitted files) · acceptance-plain (not git)
             acceptance-archive has a note and no folder
  worktrees  ${linked}

Built ${today}. Next: set OLYMPUS_ACCEPTANCE_DIR to this directory and launch with
  npm run tauri -- dev --config scripts/acceptance/tauri.acceptance.json`);

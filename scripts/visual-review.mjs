#!/usr/bin/env node
// Olympus visual review: launches the Vite preview, drives the Command harness
// through deterministic scenarios at desktop viewports, waits for the
// harness's visual-ready contract, runs semantic geometry and text-overflow
// assertions, captures screenshots and writes a report for Claude (or a
// person) to read. Browser-only: it proves layout and rendering in Chromium,
// not WebView2, Tauri IPC or the installed app.
//
//   npm run visual:review                      primary viewport, every scenario, plus key scenarios at 1920×1080 and 1280×800
//   npm run visual:review -- --all             every scenario at every viewport
//   npm run visual:review -- --scenario idle --scenario mission-active
//   npm run visual:review -- --viewport 1920x1080
//   npm run visual:review -- --url http://127.0.0.1:31420   reuse a running dev server
//   npm run visual:review -- --no-checks       skip the in-page functional checks
//
// Output: output/visual-review/latest/ (ignored by git): <scenario>@<w>x<h>.png,
// report.json, report.md. Exit code 1 when a mechanical assertion fails.
import {checkOrganizer} from "./organizer-browser.mjs";
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(import.meta.dirname, "..");
const OUTPUT = join(ROOT, "output", "visual-review", "latest");
const HARNESS = "/command-agent-harness.html";

// Primary: the installed window's configured size (tauri.conf.json 1440×960,
// confirmed by the native pass's 1456×999 captures including the frame).
export const VIEWPORTS = { primary: [1440, 960], wide: [1920, 1080], narrow: [1280, 800] };
export const SCENARIOS = [
  "idle", "agent-olympus", "agent-research", "agent-verification", "agent-coding", "domain-communications", "capability-detail",
  "chat-compact", "chat-expanded", "mission-active", "mission-research", "mission-complete", "reduced-motion"
];
const KEY_SCENARIOS = ["idle", "chat-expanded", "domain-communications", "mission-active"];

const args = process.argv.slice(2);
const option = name => args.flatMap((arg, i) => arg === `--${name}` ? [args[i + 1]] : []);
const flag = name => args.includes(`--${name}`);

function plan() {
  const scenarios = option("scenario").length ? option("scenario") : SCENARIOS;
  for (const scenario of scenarios) if (!SCENARIOS.includes(scenario)) throw Error(`Unknown scenario ${scenario}. Known: ${SCENARIOS.join(", ")}`);
  const viewports = option("viewport").map(value => { const [w, h] = value.split("x").map(Number); if (!w || !h) throw Error(`Bad viewport ${value}`); return [w, h]; });
  if (viewports.length) return scenarios.flatMap(s => viewports.map(v => [s, v]));
  const runs = scenarios.map(s => [s, VIEWPORTS.primary]);
  if (flag("all")) for (const v of [VIEWPORTS.wide, VIEWPORTS.narrow]) runs.push(...scenarios.map(s => [s, v]));
  else if (!option("scenario").length) for (const v of [VIEWPORTS.wide, VIEWPORTS.narrow]) runs.push(...KEY_SCENARIOS.map(s => [s, v]));
  return runs;
}

const freePort = () => new Promise((ok, fail) => { const server = createServer(); server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => ok(port)); }); server.on("error", fail); });
async function waitFor(url, ms = 60_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try { const response = await fetch(url); if (response.ok) return; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw Error(`Preview server did not answer at ${url}`);
}
async function startPreview() {
  const given = option("url")[0];
  if (given) { await waitFor(given + HARNESS); return { base: given.replace(/\/$/, ""), stop: () => {} }; }
  const port = await freePort();
  const child = spawn(process.execPath, [join(ROOT, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; child.stdout.on("data", d => { log += d; }); child.stderr.on("data", d => { log += d; });
  const base = `http://127.0.0.1:${port}`;
  try { await waitFor(base + HARNESS); } catch (error) { child.kill(); throw Error(`${error.message}\n${log}`); }
  return { base, stop: () => child.kill() };
}

async function launch() {
  // Windows: the installed Edge needs no download. Elsewhere, Playwright's Chromium.
  const attempts = process.platform === "win32" ? [{ channel: "msedge" }, {}] : [{}];
  let last;
  for (const attempt of attempts) {
    try { return await chromium.launch({ ...attempt, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }); }
    catch (error) { last = error; }
  }
  throw Error(`No browser could start. On Windows install Edge, or run: npx playwright install chromium\n${last?.message}`);
}

/**
 * Semantic geometry and text checks, evaluated in the page. Mechanical failures
 * block; notes are observations for the reviewer. No exact-pixel expectations.
 */
function inspectPage({ scenario, tolerance }) {
  const failures = [], notes = [];
  const fail = (id, detail) => failures.push({ id, detail });
  const note = (id, detail) => notes.push({ id, detail });
  const $ = selector => document.querySelector(selector);
  const box = selector => { const element = $(selector); if (!element) return null; const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const intersects = (a, b) => a && b && a.left < b.right - tolerance && b.left < a.right - tolerance && a.top < b.bottom - tolerance && b.top < a.bottom - tolerance;
  const inside = (inner, outer, slack = tolerance) => inner && outer && inner.left >= outer.left - slack && inner.right <= outer.right + slack && inner.top >= outer.top - slack && inner.bottom <= outer.bottom + slack;
  const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  const regions = { catalog: box(".command-agent-catalog"), center: box(".center-stack"), dial: box(".command-instrument__dial"), right: box(".right-stack"), chat: box(".command-console"), composer: box("#olympus-console-input"), send: box('[aria-label="Send command"]'), rail: box(".tools-rail") };

  if (document.documentElement.scrollWidth > innerWidth + 1) fail("no-horizontal-overflow", `scrollWidth ${document.documentElement.scrollWidth} > ${innerWidth}`);
  if (innerHeight >= 760 && document.documentElement.scrollHeight > innerHeight + 1) fail("no-page-scroll", `scrollHeight ${document.documentElement.scrollHeight} > ${innerHeight}`);
  for (const [name, rect] of Object.entries(regions)) if (!rect) fail(`region-present:${name}`, "missing");
  if (regions.catalog && regions.dial && regions.catalog.right > regions.dial.left + tolerance) fail("catalog-left-of-core", `catalog.right ${regions.catalog.right.toFixed(0)} > core.left ${regions.dial.left.toFixed(0)}`);
  if (regions.dial && regions.chat && regions.dial.right > regions.chat.left + tolerance) fail("chat-right-of-core", `core.right ${regions.dial.right.toFixed(0)} > chat.left ${regions.chat.left.toFixed(0)}`);
  if (intersects(regions.chat, regions.dial)) fail("chat-not-over-core", "chat overlaps the instrument");
  if (intersects(regions.chat, regions.catalog)) fail("chat-not-over-catalog", "chat overlaps the Agent Catalog");
  if (regions.chat && regions.right && !inside(regions.chat, regions.right, 2)) fail("chat-in-column", "chat escapes its column");
  if (regions.dial && !inside(regions.dial, viewport, 2)) fail("core-in-viewport", "instrument is clipped by the viewport");
  if (regions.composer && (!inside(regions.composer, viewport) || (regions.chat && !inside(regions.composer, regions.chat, 2)))) fail("composer-visible", "composer is outside the viewport or chat");
  if (regions.send && !inside(regions.send, viewport)) fail("send-visible", "send control is outside the viewport");
  const gap = (a, b) => b.left - a.right;
  if (regions.catalog && regions.center && gap(regions.catalog, regions.center) < 8) fail("region-spacing", `catalog → core gap ${gap(regions.catalog, regions.center).toFixed(0)}px`);
  if (regions.center && regions.right && gap(regions.center, regions.right) < 8) fail("region-spacing", `core → chat gap ${gap(regions.center, regions.right).toFixed(0)}px`);
  if (regions.dial && regions.dial.width < 340) fail("core-not-squeezed", `instrument ${regions.dial.width.toFixed(0)}px wide`);
  if (regions.catalog && regions.chat && Math.abs(regions.catalog.top - regions.chat.top) > 24 && document.querySelector('.command-console[data-layout="expanded"]')) note("panel-alignment", `catalog top ${regions.catalog.top.toFixed(0)} vs chat top ${regions.chat.top.toFixed(0)}`);

  // Capability glyphs and labels: inside the instrument, not on top of each other.
  const nodes = [...document.querySelectorAll(".capability-node")];
  const labels = nodes.map(node => ({ id: node.getAttribute("data-capability"), rect: node.querySelector(".capability-node__label")?.getBoundingClientRect() })).filter(entry => entry.rect);
  for (const node of nodes) { const r = node.querySelector(".capability-node__glyph")?.getBoundingClientRect(); if (r && regions.dial && !inside(r, regions.dial, 2)) fail("capability-inside-core", `${node.getAttribute("data-capability")} outside the instrument`); }
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) if (intersects(labels[i].rect, labels[j].rect)) fail("capability-labels-separate", `${labels[i].id} overlaps ${labels[j].id}`);
  if (regions.dial) { const cx = (regions.dial.left + regions.dial.right) / 2, cy = (regions.dial.top + regions.dial.bottom) / 2, clear = regions.dial.width * 70 / 440;
    for (const label of labels) { const lx = (label.rect.left + label.rect.right) / 2, ly = (label.rect.top + label.rect.bottom) / 2; if (Math.hypot(lx - cx, ly - cy) < clear) note("label-near-core", `${label.id} label within the Ω clearance`); } }

  // Text: clipped without an ellipsis is a defect; an ellipsis is intentional clamping, noted.
  const hiddenByDesign = element => {
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      const own = getComputedStyle(node), box = node.getBoundingClientRect();
      if (own.clipPath !== "none" || own.clip !== "auto" && own.position === "absolute" || box.width <= 1 && box.height <= 1 || Number(own.opacity) === 0) return true;
    }
    return false;
  };
  const textSelectors = ".command-agent-catalog, .command-console, .command-instrument__status, .command-instrument__preview, .mission-view, .capability-detail";
  let clamped = 0;
  for (const element of document.querySelectorAll(`:is(${textSelectors}) :is(h2,h3,h4,p,span,strong,small,dd,dt,li,button,label,time)`)) {
    if (!element.textContent?.trim() || element.children.length > 3) continue;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || element.closest("[hidden], details:not([open]) > :not(summary)")) continue;
    // Hidden by design: screen-reader-only text and controls revealed on hover clip themselves.
    if (hiddenByDesign(element)) continue;
    const rect = element.getBoundingClientRect(); if (!rect.width || !rect.height) continue;
    const horizontal = element.scrollWidth > element.clientWidth + 1 && style.overflowX !== "visible";
    const clamp = style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none" && style.webkitLineClamp !== "";
    const text = element.textContent.trim().slice(0, 60);
    if (horizontal && !clamp) fail("text-not-clipped", `"${text}" is clipped (${element.className || element.tagName})`);
    else if (horizontal && clamp) clamped++;
    const scroller = element.closest(".console-viewport, .agent-catalog-list, .agent-selected-detail, .mission-view, .console-idle");
    if (!scroller && !inside(rect, viewport, 1)) fail("text-in-viewport", `"${text}" is outside the viewport`);
    // A scroller at rest shows its start: text cut off above it can never be scrolled to.
    if (scroller && scroller.scrollTop === 0) { const box = scroller.getBoundingClientRect(); if (rect.top < box.top - 1 && rect.bottom > box.top) fail("text-reachable", `"${text}" is cut off above its scroll container`); }
  }
  if (clamped) note("intentional-ellipsis", `${clamped} element(s) clamp with an ellipsis`);

  // Scenario truth: the state on screen is the state asked for.
  const nodeIds = nodes.map(node => node.getAttribute("data-capability")).sort().join(",");
  const expect = (condition, id, detail) => { if (!condition) fail(`scenario:${id}`, detail); };
  const mission = $(".mission-view");
  if (["idle", "agent-olympus", "chat-compact", "reduced-motion"].includes(scenario)) expect(!nodes.length && !mission, "quiet-idle", `idle shows ${nodes.length} capability nodes and ${mission ? "a" : "no"} mission`);
  if (scenario === "agent-research") expect(nodeIds === "evidence-synthesis,model-primary,pantheon,research-retrieval", "research-lens", nodeIds);
  if (scenario === "agent-verification") expect(nodeIds === "claim-verification,model-primary,pantheon", "verification-lens", nodeIds);
  if (scenario === "agent-coding") expect(nodeIds === "claude-code,git" && $('.capability-node[data-capability="claude-code"]')?.getAttribute("data-state") === "unavailable", "coding-lens", nodeIds);
  if (scenario === "domain-communications") expect(nodes.length === 5, "domain-reveal", nodeIds);
  if (scenario === "capability-detail") expect($(".capability-detail")?.textContent?.includes("Claim Verification"), "detail", "capability detail missing");
  if (scenario === "chat-compact") expect($('.command-console[data-layout="compact"][data-mode="dormant"]'), "compact", "console is not compact and dormant");
  if (scenario === "chat-expanded") expect($('.command-console[data-layout="expanded"] .console-viewport') && !$(".console-idle"), "expanded", "expanded conversation not shown");
  if (scenario.startsWith("mission-active") || scenario === "mission-research") {
    expect(mission?.getAttribute("data-status") === "running", "mission-running", "no running mission view");
    expect($('.mission-view__steps li[data-state="active"]'), "active-step", "no active step");
    expect($('.agent-role-row[data-working="active"]'), "agent-working", "no working agent highlighted");
    expect($('.capability-ring__segment[data-state="active"]'), "domain-active", "no active domain on the ring");
    expect(nodes.some(node => node.getAttribute("data-state") === "active"), "capability-active", "no active capability revealed");
  }
  if (scenario === "mission-research") expect([...document.querySelectorAll('.agent-role-row[data-working="active"]')].some(row => row.textContent?.includes("Verification")), "verification-working", "Verification Agent is not among the working agents");
  if (scenario === "mission-complete") expect(mission?.getAttribute("data-status") === "completed" && !$('.mission-view__steps li[data-state="active"]') && !nodes.some(node => node.getAttribute("data-state") === "active"), "mission-complete", "completed mission still shows activity");
  return { failures, notes, regions, renderer: document.documentElement.dataset.visualRenderer, nodes: nodeIds };
}

async function main() {
  const runs = plan();
  await rm(OUTPUT, { recursive: true, force: true });
  await mkdir(OUTPUT, { recursive: true });
  const preview = await startPreview();
  const browser = await launch();
  const results = [];
  let functional = null;
  try {
    for (const [scenario, [width, height]] of runs) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: scenario === "reduced-motion" ? "reduce" : "no-preference" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
      const name = `${scenario}@${width}x${height}`;
      const started = Date.now();
      try {
        await page.goto(`${preview.base}${HARNESS}?scenario=${scenario}`, {timeout:90000});
        await page.waitForSelector(`html[data-visual-ready="${scenario}"]`, { timeout: 90_000 });
        const inspection = await page.evaluate(inspectPage, { scenario, tolerance: 1 });
        if(inspection.failures.length||errors.length)console.error(inspection.failures,errors);
        for (const error of errors) inspection.failures.push({ id: "console-error", detail: error.slice(0, 300) });
        const file = `${name}.png`;
        await page.screenshot({ path: join(OUTPUT, file) });
        results.push({ scenario, viewport: [width, height], file, ms: Date.now() - started, ...inspection });
      } catch (error) {
        results.push({ scenario, viewport: [width, height], file: null, ms: Date.now() - started, failures: [{ id: "scenario-did-not-become-ready", detail: String(error.message ?? error).slice(0, 400) }, ...errors.map(e => ({ id: "console-error", detail: e.slice(0, 300) }))], notes: [] });
      }
      await context.close();
      process.stdout.write(`${results.at(-1).failures.length ? "FAIL" : "ok  "} ${name} (${results.at(-1).ms} ms)\n`);
    }
    if (!flag("no-checks")) {
      const page = await (await browser.newContext({ viewport: { width: VIEWPORTS.primary[0], height: VIEWPORTS.primary[1] } })).newPage();
      await page.goto(`${preview.base}${HARNESS}?check`);
      await page.waitForFunction(() => /checks passed|FAIL/.test(document.querySelector("#result")?.textContent ?? ""), null, { timeout: 180_000 }).catch(() => {});
      const text = await page.evaluate(() => document.querySelector("#result")?.textContent ?? "no result");
      functional = { passed: (text.match(/^PASS /gm) ?? []).length, failed: /FAIL/.test(text), text };
      process.stdout.write(`${functional.failed ? "FAIL" : "ok  "} functional checks: ${functional.passed} passed\n`);
    }
    if (!flag("no-checks")) await checkOrganizer(browser,preview.base,join(OUTPUT,"organizer"));
  } finally { await browser.close(); preview.stop(); }

  const failed = results.filter(result => result.failures.length);
  const report = { generatedAt: new Date().toISOString(), output: OUTPUT, runs: results, functional, summary: { scenarios: results.length, failed: failed.length, functionalFailed: functional?.failed ?? null } };
  await writeFile(join(OUTPUT, "report.json"), JSON.stringify(report, null, 2));
  const lines = ["# Olympus visual review", "", `Generated ${report.generatedAt}. Browser: Chromium via Playwright (not WebView2).`, "",
    "Screenshots are for review: open each one and critique it against docs/VISUAL-REVIEW.md. Passing assertions do not mean the design passed.", "",
    "| Scenario | Viewport | Renderer | Mechanical failures | Notes | Screenshot |", "| --- | --- | --- | --- | --- | --- |",
    ...results.map(r => `| ${r.scenario} | ${r.viewport.join("×")} | ${r.renderer ?? "—"} | ${r.failures.map(f => `${f.id}: ${f.detail}`).join("<br>") || "none"} | ${r.notes.map(n => `${n.id}: ${n.detail}`).join("<br>") || "—"} | ${r.file ?? "—"} |`),
    "", functional ? `Functional harness: ${functional.passed} checks passed${functional.failed ? `, then: ${functional.text.split("\n").find(l => l.startsWith("FAIL"))}` : ""}.` : "Functional harness skipped."];
  await writeFile(join(OUTPUT, "report.md"), lines.join("\n") + "\n");
  process.stdout.write(`\n${results.length - failed.length}/${results.length} scenario captures passed mechanical checks. Report: ${join(OUTPUT, "report.md")}\n`);
  if (failed.length || functional?.failed) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });

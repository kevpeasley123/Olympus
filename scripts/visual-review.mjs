#!/usr/bin/env node
// Olympus visual review: launches the Vite preview, drives the shipped Command
// composition (the Armory, the Pantheon and the companion console) through
// deterministic scenarios at desktop viewports, plus the real App in browser
// mode, waits for the harness's visual-ready contract, runs semantic geometry
// and text-overflow assertions, captures screenshots and writes a report for
// Claude (or a person) to read. Browser-only: it proves layout and rendering in Chromium,
// not WebView2, Tauri IPC or the installed app.
//
//   npm run visual:review                      primary viewport, every scenario, plus key scenarios at 1920×1080 and 1280×800
//   npm run visual:review -- --all             every scenario at every viewport
//   npm run visual:review -- --scenario idle --scenario missions
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

// The shipped Command composition: the Armory, the Pantheon and the companion
// console, as App.tsx renders it (`flagship`). Each scenario names the harness
// state it loads, the query it adds and an optional step after it is ready.
// `app-command` loads the real App in browser mode rather than the harness.
const SCENARIO_SETUP = {
  "idle": { state: "idle" },
  "missions": { state: "mission-research", query: "&missions=2" },
  "mission-active": { state: "mission-active" },
  "mission-complete": { state: "mission-complete" },
  "conversation": { state: "chat-expanded", after: async page => { await page.getByRole("button", { name: "Conversation", exact: true }).click(); await page.waitForTimeout(400); } },
  "chat-compact": { state: "chat-compact" },
  "armory-agents": { state: "idle", after: async page => {
    await page.getByRole("button", { name: /^Agents\s*5$/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Olympus Armory" }); await dialog.waitFor();
    await dialog.getByRole("button", { name: /Athena Research/ }).click(); await page.waitForTimeout(300);
  } },
  "voice-speaking": { state: "idle", query: "&voice=speaking&level=0.8" },
  "reduced-motion": { state: "reduced-motion" },
  "app-command": { app: true }
};
export const SCENARIOS = Object.keys(SCENARIO_SETUP);
const KEY_SCENARIOS = ["idle", "missions", "conversation", "app-command"];

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
  const child = spawn(process.execPath, [join(ROOT, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: ROOT, env:{...process.env,OLYMPUS_VISUAL_REVIEW:"1"}, stdio: ["ignore", "pipe", "pipe"] });
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
  const box = selector => { const element = $(selector); if (!element) return null; const r = element.getBoundingClientRect(); return r.width || r.height ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } : null; };
  const intersects = (a, b) => a && b && a.left < b.right - tolerance && b.left < a.right - tolerance && a.top < b.bottom - tolerance && b.top < a.bottom - tolerance;
  const inside = (inner, outer, slack = tolerance) => inner && outer && inner.left >= outer.left - slack && inner.right <= outer.right + slack && inner.top >= outer.top - slack && inner.bottom <= outer.bottom + slack;
  const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  const regions = { armory: box(".olympus-armory"), center: box(".center-stack"), chat: box(".command-console"), composer: box("#olympus-console-input"), send: box('[aria-label="Send command"]') };

  if (document.documentElement.scrollWidth > innerWidth + 1) fail("no-horizontal-overflow", `scrollWidth ${document.documentElement.scrollWidth} > ${innerWidth}`);
  if (innerHeight >= 760 && document.documentElement.scrollHeight > innerHeight + 1) fail("no-page-scroll", `scrollHeight ${document.documentElement.scrollHeight} > ${innerHeight}`);
  for (const [name, rect] of Object.entries(regions)) if (!rect) fail(`region-present:${name}`, "missing");
  if (!$(".command-instrument[data-flagship]")) fail("shipped-composition", "the Command instrument is not the flagship composition");
  if ($(".command-agent-catalog")) fail("shipped-composition", "the retired Agent Catalog is mounted");
  if (regions.armory && regions.center && regions.armory.right > regions.center.left + tolerance) fail("armory-left-of-pantheon", `armory.right ${regions.armory.right.toFixed(0)} > centre.left ${regions.center.left.toFixed(0)}`);
  if (innerWidth >= 1280 && regions.center && regions.chat && regions.center.right > regions.chat.left + tolerance) fail("console-right-of-pantheon", `centre.right ${regions.center.right.toFixed(0)} > console.left ${regions.chat.left.toFixed(0)}`);
  if (intersects(regions.chat, regions.armory)) fail("console-not-over-armory", "the console overlaps the Armory");
  if (regions.composer && (!inside(regions.composer, viewport) || (regions.chat && !inside(regions.composer, regions.chat, 2)))) fail("composer-visible", "composer is outside the viewport or console");
  if (regions.send && !inside(regions.send, viewport)) fail("send-visible", "send control is outside the viewport");
  if (regions.center && regions.center.width < 480) fail("pantheon-not-squeezed", `centre ${regions.center.width.toFixed(0)}px wide`);
  if (regions.armory && regions.chat && Math.abs(regions.armory.top - regions.chat.top) > 24 && $('.command-console[data-layout="expanded"]')) note("panel-alignment", `armory top ${regions.armory.top.toFixed(0)} vs console top ${regions.chat.top.toFixed(0)}`);

  // Text: clipped without an ellipsis is a defect; an ellipsis is intentional clamping, noted.
  const hiddenByDesign = element => {
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      const own = getComputedStyle(node), rect = node.getBoundingClientRect();
      if (own.clipPath !== "none" || own.clip !== "auto" && own.position === "absolute" || rect.width <= 1 && rect.height <= 1 || Number(own.opacity) === 0) return true;
    }
    return false;
  };
  let clamped = 0;
  for (const element of document.querySelectorAll(":is(.olympus-armory, .command-console, .armory-dialog, .olympus-voice-dock) :is(h2,h3,h4,p,span,strong,small,dd,dt,li,button,label,time)")) {
    if (!element.textContent?.trim() || element.children.length > 3) continue;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || element.closest("[hidden], details:not([open]) > :not(summary)")) continue;
    if (hiddenByDesign(element)) continue;
    const rect = element.getBoundingClientRect(); if (!rect.width || !rect.height) continue;
    const horizontal = element.scrollWidth > element.clientWidth + 1 && style.overflowX !== "visible";
    const clamp = style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none" && style.webkitLineClamp !== "";
    const text = element.textContent.trim().slice(0, 60);
    if (horizontal && !clamp) fail("text-not-clipped", `"${text}" is clipped (${element.className || element.tagName})`);
    else if (horizontal && clamp) clamped++;
    const scroller = element.closest(".console-viewport, .console-idle, .active-mission-list, .armory-dialog, .armory-agent-list");
    if (!scroller && !inside(rect, viewport, 1)) fail("text-in-viewport", `"${text}" is outside the viewport`);
    if (scroller && scroller.scrollTop === 0) { const sbox = scroller.getBoundingClientRect(); if (rect.top < sbox.top - 1 && rect.bottom > sbox.top) fail("text-reachable", `"${text}" is cut off above its scroll container`); }
  }
  if (clamped) note("intentional-ellipsis", `${clamped} element(s) clamp with an ellipsis`);

  // Scenario truth: the state on screen is the state asked for.
  const expect = (condition, id, detail) => { if (!condition) fail(`scenario:${id}`, detail); };
  const canvas = $(".hybrid-core canvas");
  const planets = canvas?.dataset.missionPlanets;
  const brief = $(".command-console")?.innerText ?? "";
  const expectPlanets = { "idle": "0", "missions": "2", "mission-active": "1", "mission-complete": "0", "reduced-motion": "0" }[scenario];
  if (expectPlanets !== undefined && canvas) expect(planets === expectPlanets, "mission-planets", `expected ${expectPlanets} mission planets, saw ${planets}`);
  if (["idle", "mission-complete", "reduced-motion"].includes(scenario)) expect(brief.includes("No active missions reported."), "quiet-brief", "Mission brief does not report an idle state");
  if (scenario === "missions") expect(brief.includes("2 active missions. 1 awaiting approval."), "missions-brief", "Mission brief does not report two missions with one awaiting approval");
  if (scenario === "mission-active") expect(brief.includes("1 active mission."), "mission-brief", "Mission brief does not report one active mission");
  if (scenario === "conversation") expect($('.command-console .console-viewport') && document.querySelectorAll(".command-console .conversation-bubble").length > 0, "conversation", "Conversation tab shows no messages");
  if (scenario === "chat-compact") expect($('.command-console[data-layout="compact"][data-mode="dormant"]'), "compact", "console is not compact and dormant");
  if (scenario === "armory-agents") expect([...document.querySelectorAll('[role="dialog"]')].some(d => d.textContent?.includes("Scoped Pantheon Research excerpts only")), "armory-loadout", "Athena's loadout does not show its real scope");
  if (scenario === "voice-speaking") { const signal = $(".olympus-signal"); const peak = Number(signal?.dataset.signalPeak ?? 0); expect(signal?.dataset.signalSource === "live" && peak > 10, "voice-wave", `voice signal ${signal?.dataset.signalSource ?? "missing"}, peak ${peak}px`); }
  return { failures, notes, regions, renderer: document.documentElement.dataset.visualRenderer ?? canvas?.dataset.engine ?? "none", planets };
}

/**
 * Interaction checks on the shipped composition: the real App in browser mode
 * and the harness. They replace the retired Agent Catalog checks.
 */
async function functionalChecks(browser, base) {
  const checks = [], errors = [];
  const check = (condition, label) => { if (!condition) throw Error(label); checks.push(label); };
  const page = await (await browser.newContext({ viewport: { width: VIEWPORTS.primary[0], height: VIEWPORTS.primary[1] } })).newPage();
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(base + "/");
    await page.getByRole("button", { name: "Command", exact: true }).click();
    await page.waitForSelector('[data-flagship][data-scene-ready="true"]', { timeout: 90_000 });
    check(await page.locator(".command-agent-catalog").count() === 0, "The App mounts no Agent Catalog");
    const agents = page.getByRole("button", { name: /^Agents\s*\d+$/ }).first();
    await agents.click();
    const dialog = page.getByRole("dialog", { name: "Olympus Armory" });
    await dialog.waitFor();
    await dialog.getByRole("button", { name: /Athena Research/ }).click();
    check(await dialog.getByText("Scoped Pantheon Research excerpts only", { exact: true }).isVisible(), "Athena's loadout shows its real scope");
    await dialog.getByRole("button", { name: "Pantheon library Available", exact: true }).click();
    check(await dialog.getByLabel("Capability detail", { exact: true }).isVisible(), "A capability contract opens for inspection");
    await page.keyboard.press("Escape");
    check(await dialog.count() === 0, "Escape closes the Armory");
    check(await agents.evaluate(element => element === document.activeElement), "The Armory returns keyboard focus to its trigger");
    for (const [name, mode] of [["Project", "project"], ["Research", "research"], ["Communications", "communications"]]) {
      await page.getByRole("button", { name, exact: true }).click();
      await page.locator(`.mode-${mode}`).waitFor();
      check(true, `${name} opens its destination`);
      await page.getByRole("button", { name: "Command", exact: true }).click();
    }
    await page.getByRole("button", { name: "Open preferences", exact: true }).first().click();
    await page.getByRole("dialog").first().waitFor();
    check(true, "Preferences opens from the console");
    await page.keyboard.press("Escape");

    await page.goto(`${base}${HARNESS}?flagship&scenario=idle`);
    await page.waitForSelector('html[data-visual-ready="idle"]', { timeout: 90_000 });
    const canvas = page.locator(".hybrid-core canvas");
    check(await canvas.getAttribute("data-projection") === "PerspectiveCamera", "The Pantheon renders with a perspective camera");
    const start = Number(await canvas.getAttribute("data-galaxy-time"));
    await page.waitForTimeout(2500);
    check(Number(await canvas.getAttribute("data-galaxy-time")) > start, "The galaxy advances with animation frames");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${base}${HARNESS}?flagship&scenario=reduced-motion`);
    await page.waitForSelector('html[data-visual-ready="reduced-motion"]', { timeout: 90_000 });
    const frozen = await canvas.getAttribute("data-galaxy-time");
    await page.waitForTimeout(1400);
    check(frozen === await canvas.getAttribute("data-galaxy-time"), "Reduced motion freezes the galaxy");
    await page.evaluate(() => document.querySelector(".hybrid-core canvas")?.dispatchEvent(new Event("webglcontextlost", { cancelable: true })));
    await page.getByText("3D view unavailable", { exact: false }).waitFor();
    check(await page.getByRole("group", { name: "Dashboard mode" }).getByRole("button").count() === 4, "Header navigation survives a lost graphics context");
    check(errors.length === 0, `No page errors${errors.length ? `: ${errors[0]}` : ""}`);
    return { passed: checks.length, failed: false, text: checks.map(c => `PASS ${c}`).join("\n") };
  } catch (error) {
    return { passed: checks.length, failed: true, text: [...checks.map(c => `PASS ${c}`), `FAIL ${error.message}`].join("\n") };
  } finally { await page.context().close(); }
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
        const setup = SCENARIO_SETUP[scenario];
        if (setup.app) {
          await page.goto(`${preview.base}/`, { timeout: 90_000 });
          await page.getByRole("button", { name: "Command", exact: true }).click();
          await page.waitForSelector('[data-flagship][data-scene-ready="true"]', { timeout: 90_000 });
          await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(700);
        } else {
          await page.goto(`${preview.base}${HARNESS}?flagship&scenario=${setup.state}${setup.query ?? ""}`, { timeout: 90_000 });
          await page.waitForSelector(`html[data-visual-ready="${setup.state}"]`, { timeout: 90_000 });
          if (setup.after) await setup.after(page);
        }
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
      functional = await functionalChecks(browser, preview.base);
      process.stdout.write(`${functional.failed ? "FAIL" : "ok  "} functional checks: ${functional.passed} passed${functional.failed ? `, then ${functional.text.split("\n").at(-1)}` : ""}\n`);
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

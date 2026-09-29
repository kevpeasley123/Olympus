# Visual review

`npm run visual:review` lets an agent (or a person) see the Command UI, not just compile it. It starts the Vite preview, drives the Command harness through fixed scenarios at desktop viewports, checks geometry and text mechanically, saves screenshots, and writes a report. The agent then reads the screenshots and critiques them.

It proves layout and rendering in Chromium. It does not prove WebView2, Tauri IPC, real data or the installed app; that is the Windows native pass below.

## Running it

```bash
npm run visual:review                               # every scenario at 1440×960, key scenarios at 1920×1080 and 1280×800
npm run visual:review -- --all                      # every scenario at every viewport
npm run visual:review -- --scenario mission-active  # one scenario (repeatable)
npm run visual:review -- --viewport 1280x800        # one viewport (repeatable)
npm run visual:review -- --url http://127.0.0.1:31420   # reuse a running dev server
npm run visual:review -- --no-checks                # skip the in-page functional checks
```

Output goes to `output/visual-review/latest/` (ignored by git; replaced each run):

- `<scenario>@<w>x<h>.png` — one screenshot per capture;
- `report.md` — a table of captures, mechanical failures and notes, plus the functional result;
- `report.json` — the same, with region rectangles, for tooling.

Exit code 1 when any mechanical check or the functional harness fails.

Browser: Playwright 1.56.1 (a devDependency). On Linux it uses Playwright's Chromium (preinstalled in the cloud container at `/opt/pw-browsers`). On Windows it tries the installed Edge first (`channel: "msedge"`), so no browser download is needed; if that fails, `npx playwright install chromium`. WebGL runs on SwiftShader, so the 3D instrument renders headless.

## Viewports

| Name | Size | Why |
| --- | --- | --- |
| primary | 1440×960 | `tauri.conf.json` window size; the native pass captured 1456×999 including the frame |
| wide | 1920×1080 | a maximised window on a common monitor |
| narrow | 1280×800 | the smallest supported desktop window |

## Scenarios

All run in `command-agent-harness.html?scenario=<name>` against `src/services/capabilitiesFixture.json` (generated from a synthetic database by the Rust fixture writer) with a fixed clock (2026-09-29 07:20 UTC). The mail fixture uses `operator@example.invalid`; no real Gmail content is used anywhere.

| Scenario | State |
| --- | --- |
| `idle` | Olympus Core lens, expanded chat in its idle state |
| `agent-olympus`, `agent-research`, `agent-verification`, `agent-coding` | each lens; the coding lens opens the Claude Code inspector |
| `domain-communications` | a selected domain revealing its Tools and Skills |
| `capability-detail` | the Claim Verification inspector |
| `chat-compact` | compact, dormant console |
| `chat-expanded` | a conversation this launch plus earlier history |
| `mission-active` | a running Communication Intelligence mission |
| `mission-research` | a running Research Verification mission (Verification Agent working) |
| `mission-complete` | a finished mission with its result |
| `reduced-motion` | reduced motion |

## Visual-ready contract

The harness sets `html[data-visual-ready="<scenario>"]` only when the page is stable: fonts loaded; the WebGL scene reports ready (or the SVG fallback is showing); finite CSS/Web animations finished; two further animation frames. `data-visual-renderer` records `hybrid` or `svg`. The runner waits for that attribute rather than sleeping, so a screenshot never catches a half-built frame.

## Mechanical checks

No pixel baselines: the 3D scene and fonts vary slightly between machines, and a pixel diff would fail on noise while missing semantic defects. The checks are semantic:

- no horizontal page overflow or page scroll;
- region order and separation: catalog left of the instrument, chat right of it, no region overlapping another, at least 8 px between them, the chat inside its column;
- the instrument fully in the viewport and at least 340 px wide; composer and send button visible;
- revealed capability glyphs inside the dial, their labels not overlapping each other; a note when a label enters the Ω clearance;
- text clipped without an ellipsis fails; text clipped with an ellipsis is noted as intentional; text outside the viewport (outside a scroller) fails; text cut off above a scroller at rest fails (unreachable);
- elements hidden by design are skipped (screen-reader-only text, hover-revealed controls using `clip-path` or zero opacity);
- per-scenario truth: e.g. a running mission must show an active step, a working agent, an active domain and an active capability; a completed mission must show none; compact must be dormant;
- console errors.

After the captures it runs the Command harness's `?check` functional suite (53 checks: lenses, domain keyboard, compact/expand, suggestions fill without sending, reduced motion, and the IPC allowlist — every invoked command is a read).

## The review loop

Mechanical checks catch geometry; they do not judge whether it looks right. After any UI change:

1. Run the focused tests (`node scripts/test-capabilities.mjs`, the relevant `scripts/test-*.mjs`).
2. `npm run visual:review`.
3. Open the screenshots (an agent reads the PNGs) — at least the scenarios the change touches, at every viewport it affects.
4. Critique: hierarchy, alignment, label legibility and ownership, truncation, crowding, whether the state shown is the state the data implies, dark-theme contrast.
5. Fix; add a mechanical check when a defect is checkable (the unreachable-text check came from a defect first seen by eye).
6. Re-run and look again. Then run the full suite as a regression pass.

## Windows native acceptance (separate)

The visual review does not replace the native pass. On the owner's PC, with the isolated acceptance profile (`docs/NEXT-SESSION.md`): build and launch the desktop app, walk the manual review list in `docs/COMMAND-ARMORY-REDESIGN.md` §4, and capture the window. Only that shows WebView2 rendering, real Tauri commands, real availability (keys, vault, Claude Code) and real run history.

A later layer could drive the desktop window itself (WebView2 remote debugging, or OS-level screen capture) so the same scenarios run against the real app. Not built.

## Limits

- Chromium with SwiftShader, not WebView2 on the owner's GPU; colours and antialiasing differ slightly.
- The fixture is synthetic; real availability and history come only from the desktop app.
- Only Command is covered. Other harness pages still have their own `?check` runs.

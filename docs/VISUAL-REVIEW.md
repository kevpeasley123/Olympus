# Visual review

`npm run visual:review` lets an agent (or a person) see the shipped Command screen, not just compile it. It starts the Vite preview, drives the Command harness in its shipped composition (`?flagship`: the Olympus Armory, the Pantheon with mission planets, the companion console) through fixed scenarios at desktop viewports, captures the real App in browser mode as well, checks geometry and text mechanically, saves screenshots and writes a report. The agent then reads the screenshots and critiques them.

Until 2026-10-12 it drove the harness without `?flagship` and captured the retired Agent Catalog composition; reviews before that date say nothing about the screen Kevin uses.

It proves layout and rendering in Chromium. It does not prove WebView2, Tauri IPC, real data or the installed app; that is the Windows native pass below.

## Running it

```bash
npm run visual:review                               # every scenario at 1440×960, key scenarios at 1920×1080 and 1280×800
npm run visual:review -- --all                      # every scenario at every viewport
npm run visual:review -- --scenario missions        # one scenario (repeatable)
npm run visual:review -- --viewport 1280x800        # one viewport (repeatable)
npm run visual:review -- --url http://127.0.0.1:31420   # reuse a running dev server
npm run visual:review -- --no-checks                # skip the in-page functional checks
```

Output goes to `output/visual-review/latest/` (ignored by git; replaced each run):

- `<scenario>@<w>x<h>.png` — one screenshot per capture;
- `report.md` — a table of captures, mechanical failures and notes, plus the functional result;
- `report.json` — the same, with region rectangles, for tooling;
- `organizer/` — screenshots from the Organizer browser workflow checks (below).

Exit code 1 when any mechanical check or the functional harness fails. A failing Organizer check also exits 1, before the report is written.

Browser: Playwright 1.56.1 (a devDependency). On Linux it uses Playwright's Chromium (preinstalled in the cloud container at `/opt/pw-browsers`). On Windows it tries the installed Edge first (`channel: "msedge"`), so no browser download is needed; if that fails, `npx playwright install chromium`. WebGL runs on SwiftShader, so the 3D instrument renders headless.

## Viewports

| Name | Size | Why |
| --- | --- | --- |
| primary | 1440×960 | `tauri.conf.json` window size; the native pass captured 1456×999 including the frame |
| wide | 1920×1080 | a maximised window on a common monitor |
| narrow | 1280×800 | the smallest supported desktop window |

## Scenarios

Harness scenarios run in `command-agent-harness.html?flagship&scenario=<state>` against `src/services/capabilitiesFixture.json` (generated from a synthetic database by the Rust fixture writer) with a fixed clock (2026-09-29 07:20 UTC). The mail fixture uses `operator@example.invalid`; no real Gmail content is used anywhere.

| Scenario | State |
| --- | --- |
| `idle` | no missions; Mission brief says none are reported |
| `missions` | two missions: Research verification working, Thread analysis awaiting approval |
| `mission-active` | one running Communication Intelligence mission |
| `mission-complete` | a finished mission: no planets, an idle brief |
| `conversation` | the companion's Conversation tab with history |
| `chat-compact` | compact, dormant console |
| `armory-agents` | the Armory dialog open on Athena's loadout |
| `voice-speaking` | the Spoken replies wave at 0.8 level |
| `reduced-motion` | reduced motion |
| `app-command` | the real App (`/`) in browser mode, Command selected |

Key scenarios (`idle`, `missions`, `conversation`, `app-command`) also run at 1920×1080 and 1280×800.

## Visual-ready contract

The harness sets `html[data-visual-ready="<scenario>"]` only when the page is stable: fonts loaded; the WebGL scene reports ready (or the SVG fallback is showing); finite CSS/Web animations finished; two further animation frames. `data-visual-renderer` records `hybrid` or `svg`. The runner waits for that attribute rather than sleeping, so a screenshot never catches a half-built frame.

## Mechanical checks

No pixel baselines: the 3D scene and fonts vary slightly between machines, and a pixel diff would fail on noise while missing semantic defects. The checks are semantic:

- the shipped composition is mounted (`.command-instrument[data-flagship]`) and the retired Agent Catalog is not;
- no horizontal page overflow or page scroll;
- region order: Armory left of the Pantheon, console right of it (from 1280 px wide), the console never over the Armory, the centre at least 480 px wide; composer and send button visible;
- text clipped without an ellipsis fails; clipped with an ellipsis is noted as intentional; text outside the viewport (outside a scroller) fails; text cut off above a scroller at rest fails (unreachable);
- elements hidden by design are skipped (screen-reader-only text, hover-revealed controls using `clip-path` or zero opacity);
- per-scenario truth: the number of mission planets the scene reports, the Mission brief sentence, the Conversation tab showing messages, the compact console being dormant, Athena's real scope in the Armory, the voice wave following the level;
- console errors.

After the captures it runs the functional checks on the shipped composition: in the real App, the Armory dialog, a loadout's real scope, a capability contract, Escape and focus return, navigation to the other three modes and Preferences; in the harness, the perspective camera, the galaxy advancing, reduced motion freezing it, and header navigation surviving a lost graphics context. Then the Organizer browser workflow in `organizer-harness.html` (`scripts/organizer-browser.mjs`). `--no-checks` skips both.

## The review loop

Mechanical checks catch geometry; they do not judge whether it looks right. After any UI change:

1. Run the focused tests (`node scripts/test-capabilities.mjs`, the relevant `scripts/test-*.mjs`).
2. `npm run visual:review`.
3. Open the screenshots (an agent reads the PNGs) — at least the scenarios the change touches, at every viewport it affects.
4. Critique: hierarchy, alignment, label legibility and ownership, truncation, crowding, whether the state shown is the state the data implies, dark-theme contrast.
5. Fix; add a mechanical check when a defect is checkable (the unreachable-text check came from a defect first seen by eye).
6. Re-run and look again. Then run the full suite as a regression pass.

## Windows native acceptance (separate)

The visual review does not replace the native pass. On the owner's PC, with the isolated acceptance profile (`OLYMPUS_ACCEPTANCE_DIR`, described in `ARCHITECTURE.md`): build and launch the desktop app, walk the checks in `docs/COMMAND-ARMORY-REDESIGN.md` §4 (mapped onto the flagship there), and capture the window. Only that shows WebView2 rendering, real Tauri commands, real availability (keys, vault, Claude Code) and real run history.

A later layer could drive the desktop window itself (WebView2 remote debugging, or OS-level screen capture) so the same scenarios run against the real app. Not built.

## Limits

- Chromium with SwiftShader, not WebView2 on the owner's GPU; colours and antialiasing differ slightly.
- The fixture is synthetic; real availability and history come only from the desktop app.
- Only Command and the Organizer workflow are covered. Other harness pages still have their own `?check` runs, driven by `scripts/test-*.mjs`.

# Command renderer lifecycle

Development fix after installed 0.11.1, September 9, 2026.

Command uses only the 3D core. The old SVG Omega/orbits and renderer preference have been removed. SVG labels and interaction targets remain aligned with the 3D apparatus; they are not a fallback renderer. *(Superseded 2026-09-28: the SVG layer is now the first-drawn and fallback instrument. See below.)*

Command stays mounted across Project/Research navigation. Hidden dimensions do not shrink or clear its canvas, and hidden scenes stop rendering. Equivalent polling layouts do not rebuild meshes. Changed layouts retain the completed scene until its replacement paints. Initial loading and graphics errors hide the coordinated scene and labels; graphics failures offer Retry 3D view instead of legacy artwork. *(Superseded 2026-09-28: labels no longer hide; see below.)*

Validation: TypeScript/Vite production build and 28 browser harness checks pass, including context loss, retry, missing WebGL, reduced motion, and hidden-view rendering. Browser Command/Project/Research round trip retained one canvas and its frame counter, then restored the complete apparatus. No installed WebView validation yet; this fix has not been packaged or installed.

## SVG-first rendering and deferred scene — September 28, 2026

Design-review item F5, `CommandInstrument.tsx`, `hybridScene.ts`, `command.css`.

- **SVG first.** The SVG layer (project ring, linked-note constellation, day arc,
  centre readout) is always visible and interactive, and draws an Ω glyph of its
  own. `data-renderer` reads `svg` until the scene has painted, then `hybrid`, at
  which point the flat glyph is hidden and the 3D core takes its place.
- **Fallback.** On a graphics error the 3D component is unmounted, so its GPU
  resources, listeners and timers go with it, and the flat instrument remains the
  whole instrument. The notice reads "3D view unavailable · showing the flat
  instrument", with Retry 3D view (mounts a fresh scene) and the error behind a
  Technical detail disclosure.
- **Deferred init.** The scene is not created at launch. It starts the first time
  Command is shown (`active`), and stays mounted afterwards, so opening Olympus in
  Research or Project does not pay for it. Hidden scenes still stop rendering, as
  before.
- **Per-frame DOM work.** The canvas `data-*` attributes the harnesses read are
  written only in development builds. Hit-target transforms are rounded to a tenth
  of a viewBox unit and written only when they change, so idle drift no longer
  touches the DOM every frame.
- **Decorative animation.** The header omega's ring tilt animation (shown in
  Project and Research, where the header carries the omega) is paused; the header
  decoration rests.
- **Scan state.** The ring's centre readout shows SCANNING… / SCAN FAILED /
  STALE · HH:MM from the project scan, with the full sentence and Retry on the
  line under the dial. Loading and failure show no project names. A genuine
  scan that finds nothing reads NO PROJECTS with a one-line explanation.
- **Keyboard.** The ring is one tab stop: Left/Right move between projects,
  Down enters a project's notes, Up or Escape returns, Home/End jump to the ends.

Verification: build; mock checks with WebGL disabled at four viewport sizes show
the SVG instrument; opening in Research loads no 3D chunk (see the
[implementation checklist](reviews/2026-09-28-design-usability/IMPLEMENTATION-CHECKLIST.md)).
Not verified: deferral, fallback and pausing on a real GPU in the desktop app.

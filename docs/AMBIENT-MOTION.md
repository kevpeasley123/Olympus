# Command ambient motion

The fixed 440-unit SVG remains the layout authority. ProjectRing owns stationary
segments, labels, and node positions. AmbientOrbits adds decorative, pointer-transparent
SVG tracks at radii 194 and 190, between the project band and day arc. The inner sweep
stays at radius 80 inside the protected core. No project segment or label is rotated.

## Tuning

Edit `src/services/ambientMotion.ts`: AMBIENT is the source for durations, event intervals,
and separation. Seconds flow into CSS custom properties through ambientVariables.
- Outer orbit: 80 seconds clockwise; a 100-unit amber arc and larger marker.
- Secondary ticks: 48 seconds counter-clockwise, with a 64-unit amber accent arc.
- Core lighting: 6 seconds, glow opacity 0.45–1; idle glow scale 1–1.005, glyph stationary.
- Tracer: 4.6 seconds, bright point with 70-unit fading tail and 2.8-unit head; nominal 8–12-second starts.
- Inner sweep: 3.8 seconds, 84-unit illuminated arc, nominal 8–13-second starts.
- Node drift: 23–35 seconds, no more than about 2 screen pixels from its anchor.
- Node signals: 5–11-second starts; actual linked neighbors react 450ms apart.
- Micro arcs: 4–9-second starts; fade over 2.6 seconds.
- Existing vignette: 47-second cycle, 2px/1px drift; artwork remains unscaled and sharp.

One seeded, low-frequency timeout queue staggers starts by at least 1.5 seconds.
Collision avoidance can extend a nominal interval. At most one tracer exists, and
active-state timing still leaves a gap after it finishes. No per-frame React updates,
new canvas, animated blur/shadow, layout animation, or added dependency.

## States and lifecycle

CommandInstrument accepts an optional OlympusVisualState: idle, listening, thinking,
speaking, executing, complete, error. Existing real chat thinking/speaking states remain
wired. Listening/executing/complete/error are explicit extension points, not invented
activity. Complete has a short outward pulse then returns to idle; error has no alarm.

useMotionPermission responds to document visibility and live reduced-motion changes.
Hidden or reduced-motion states cancel the event queue, remove transient signals, and
pause continuous CSS animation. Reduced-motion CSS also removes rotation/drift outright.
Existing response motion is suppressed when motion is disallowed. Time data continues
to update while visible even with reduced motion. No background timers catch up in a burst.

## Verification

- Production TypeScript/Vite build and four service harnesses.
- ambientMotion.harness.ts checks 12,000 timing samples, deterministic seeds, and non-overlapping tracers.
- Open `/ambient-motion-harness.html` on the Vite server for the isolated browser lifecycle test:
  visible start, hidden cancellation, resume, live reduced preference, suppression, cleanup.
  This page mocks visibility/media queries locally; it changes no OS setting.
- Desktop preview uses a separate application identifier/database. Visual inspection
  confirmed the original composition and stationary labels with the real vault graph.
- No quantitative 60-FPS benchmark has been claimed. The implementation uses transform
  and opacity animation with a small bounded number of SVG additions.

## Across-room visibility (0.3.3)

Operator feedback superseded the original very faint treatment. Longer amber arcs,
thicker strokes, larger markers, stronger node signals, and wider core-light contrast
make movement easier to perceive at a distance. Track radii, labels, tiles, node anchors,
and background treatment are unchanged. Only the decorative orbit groups rotate.
No additional blur, dependency, or per-frame JavaScript was introduced.

# Command ambient motion

The fixed 440-unit SVG remains the layout authority. ProjectRing owns stationary
segments, labels, and node positions. AmbientOrbits adds decorative, pointer-transparent
SVG tracks at radii 194 and 190, between the project band and day arc. Inner decorative arcs occupy radii 80–108 around the core. No project segment or label is rotated.

## Tuning

Edit `src/services/ambientMotion.ts`: AMBIENT is the source for durations, event intervals,
and separation. Seconds flow into CSS custom properties through ambientVariables.
- Outer orbit: 80 seconds clockwise; a 100-unit amber arc and larger marker.
- Secondary ticks: 48 seconds counter-clockwise, with a 64-unit amber accent arc.
- Core lighting: 6 seconds, glow opacity 0.45–1; idle glow scale 1–1.005, glyph stationary.
- Tracer: 4.6 seconds, bright point with 70-unit fading tail and 2.8-unit head; nominal 8–12-second starts.
- Inner baseline: two always-visible arcs at radii 80/87, rotating in opposite directions every 10/14 seconds.
- Inner burst: three additional arcs at radii 94/101/108 fade through one 3.8-second revolution on nominal 8–13-second starts; five inner rotators at peak.
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

## Persistent inner motion (0.3.4)

Two inner arcs remain visible between events. The existing sweep queue temporarily
adds three more, with offset starting angles and alternating direction. The baseline
arcs never remount when a burst starts. Reduced motion keeps the baseline arcs static
and suppresses the transient three. Durations remain in AMBIENT; no new timers.

## Multi-axis full rings (0.3.5)

Supersedes the inner arc geometry above: full thin circles at radii 84/94 form
the permanent pair; radii 104/114/124 join on the existing 3.8-second envelope.
Fixed axis wrappers orient five distinct planes. CSS perspective and rotateY
project each ring from an open ellipse through edge-on and back, with opposing
10/14-second rotations. The glyph stays in the foreground. This is decorative
CSS projection, not a WebGL scene or a physically occluding 3D model.
Reduced motion shows the permanent pair at static tilts and hides the burst.
No extra dependencies, timers, or per-frame JavaScript.

## Edge-on ring correction (0.3.6)

Replaces the zero-area CSS 3D projection with a 2D orthographic projection.
Each full SVG ring narrows to scaleX 0.012, then opens again; non-scaling strokes
retain thickness through the edge-on phase. No backface culling or zero scale.
The separate axis wrappers and 10/14-second cycles remain.

## Ring count (0.3.7)

Operator tuning: two persistent inner rings, with only the radius-104 ring added
during the existing burst. Three total at peak; timing and edge-on fix unchanged.

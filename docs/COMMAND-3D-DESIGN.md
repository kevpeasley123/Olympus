# Command core dimensional rendering proposal

## Inspected implementation

CommandInstrument.tsx owns the 440-unit SVG instrument, central glyph, day arc, project ring, ambient treatment and voice amplitude input. OmegaInstrument.tsx is the separate small emblem, not the primary Command renderer. Rendering currently combines SVG, CSS and Motion; there is no Three.js dependency.

ProjectRing.tsx draws segments, labels, nodes, links and accessible interaction targets. projectRing.ts calculates stable segment geometry. projectConstellation.ts computes the broad deterministic node field and real tree/cross-project relationships; its existing output must remain the front-view source of truth. Project props derive from the Rust project scan; graph data comes through useVaultGraph, and task counts through the existing action queue. No renderer-owned project state is needed.

useAmbientMotion and ambientMotion.ts schedule restrained tracers, sweeps and node pulses; CSS and Motion animate the presentation. useMotionPermission already honors document visibility and reduced motion. The visual state vocabulary includes idle/listening/thinking/speaking/executing/complete/error. App.tsx supplies real voice phase and voice level; assistant pending/producing and instrument events also exist. Executing/complete styles must only be driven by actual execution events, never invented ambient activity.

## Options

| Option | Benefits and structural preservation | Tradeoffs, risk and effort |
|---|---|---|
| 1. Extend SVG/CSS pseudo-3D | Lowest cost; exact current map and text retained | Limited true occlusion/material depth; low risk/effort; likely short of the requested dimensional presence |
| 2. Hybrid Three.js core plus SVG/DOM | True depth and materials; existing coordinates, labels and hit targets retained | Moderate effort and GPU/lifecycle risk; needs camera/overlay alignment and fallback; strongest balance |
| 3. Full 3D interface | Maximum spatial flexibility | Highest effort/GPU cost and accessibility/readability risk; unnecessary replacement of working interface structure |

Recommend option 2, with a localized direct Three.js component. React 18 can also use Fiber 8, but Fiber 9 requires React 19; an unrelated React migration is not justified. Current Three.js WebGLRenderer requires WebGL 2, so feature detection and the existing SVG fallback are mandatory.

Official references: https://r3f.docs.pmnd.rs/getting-started/installation and https://threejs.org/docs/pages/WebGLRenderer.html

## First implementation slice

Build an opt-in prototype, retaining the installed SVG default until visual comparison. Share the existing ring/constellation layout output, with a front-facing orthographic camera matching the 440-unit viewbox. Keep every X/Y coordinate, project order and relationship; assign small deterministic Z offsets by node ID. Preserve the broad field and glyph clearance before adding intentional depth occlusion.

Add a beveled Omega, layered segment frames and thin tubular orbit geometry: two persistent inner rings and one additional during the existing elevated cycle. Tubular geometry remains visible edge-on. Keep labels, accessible hit targets, tooltips, console and navigation in SVG/DOM. Use existing hover/state data for both renderers, not duplicate state stores.

Use restrained orange emission, blue-gray structural materials and bounded shallow depth. Start without expensive bloom or shadows. Cap pixel ratio, pause hidden animation, provide a static reduced-motion frame, clean up GPU resources and restore SVG on unavailable/lost rendering context.

Compare still frames for map preservation; watch 5–10 seconds for obvious depth; verify keyboard/mouse targets, voice state changes, edge-on ring visibility, resize alignment and desktop frame time. Synthetic fixtures are for development only; integration must consume the actual graph and project props.

No rendering code changed during this inspection phase, as requested in the original brief.

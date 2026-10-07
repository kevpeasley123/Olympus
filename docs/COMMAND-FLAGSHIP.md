# Command flagship redesign - October 7, 2026

The permanent catalog competed with Omega and made capability inspection dominate
the home screen. The new default is a narrow Armory, a perspective celestial core,
and a quieter conversation panel. Existing routes, execution, approvals and data
integrations are retained. No dependency was added.

## Architecture

- `OlympusArmory` owns summary and inspection state, with the existing `Modal`
  focus trap, Escape/backdrop dismissal and focus return. Agent rows become
  loadouts; plugin ports show source adapters; skills use an ordered inscription
  list; operations show recorded run progress. Workflow and historical research
  links still use existing destinations.
- `armoryPresentation` derives adapter membership, conservative connection states,
  and live operations. Models/executors are not inflated into plugin counts.
- `CommandInstrument` uses a flagship presentation variant. Destination controls
  remain HTML buttons outside WebGL; loss of graphics cannot remove navigation.
  Legacy component harnesses remain useful regression coverage, not the default UI.
- `useCommandArmory` now surfaces mission-read failures rather than treating the
  last successful snapshot as an unqualified current observation.

## Visual / motion approach

Reuse Three.js with a real perspective camera, the existing extruded Omega,
an opaque depth-writing sphere behind the glyph, volumetric seeded dust and
independently phased/inclined orbiting bodies. Both scene passes share a depth
buffer. All continuous torus rings are hidden in flagship mode; four sparse
trajectory traces replace them. Small damped pointer movement affects the camera.
The existing restrained bloom provides light falloff. Motion drives no React
state on animation frames. Sphere and trails are decorative, not invented agents.

Pixel ratio stays capped at 2. Existing hidden-tab/mode suspension, reduced-motion
freeze, lazy scene loading, context-loss SVG fallback and shared geometry/material
cleanup remain. New meshes participate in the existing disposal traversal.
No React Three Fiber, Drei, GSAP or additional postprocessing was needed.

## Data truth

Desktop catalog, tools, skills, agent loadouts and missions come from existing
Rust endpoints. Browser previews are explicitly synthetic. Gmail is Connected
only when its available descriptor explicitly reports a connected account;
other adapters remain Available, never assumed authenticated. Authority and
approval descriptions come from their compiled contracts. Coding remains
unproven when that is its recorded status. Readiness does not prove provider
credit or quality.

Current limitations: the mission endpoint does not expose background Gmail sync,
general monitors or schedules. The empty summary says no active runs *reported*;
the Operations view names the missing coverage. No Calendar, Drive, GitHub or
other integration was fabricated. The plugin count is eight in the current
fixture, not all fourteen tools. Models and the executor remain in loadouts.

## Validation

`node scripts/test-armory-presentation.mjs` checks source adapter classification,
authentication claims, empty states and running/waiting membership.
`node scripts/flagship-review.mjs [preview-url]` checks the actual App composition
at 1440x960, 1920x1080, 1280x800 and 900x900; drawer/loadout/contract inspection,
focus, Escape, geometry, synthetic recorded operations, perspective projection,
front/rear volume, reduced motion and context-loss navigation. It captures the
review in `output/flagship-review`. Existing capability and full Command visual
regressions remain required.

Human visual iterations corrected short-window composer clipping, left-rail
contrast/overflow, focus after opening a loadout, scrollbar treatment and quieted
assistant copy. Browser timing is machine-specific, not a universal FPS promise.
Native deployment/acceptance is recorded separately in the session report.

# COMMAND mission Pantheon — October 7, 2026

The supplied COMMAND render and design brief supersede decorative celestial
bodies. Armory remains left, Pantheon center, Olympus conversation right.

## Data and interaction

- `activeMissions` selects recorded running/waiting workflows, deduplicated by
  mission ID. Agent counts never create planets. Completed, cancelled, failed
  and interrupted terminal runs leave the scene immediately; backend history
  is unchanged. Missing mission state is distinguished from a known empty list.
- `useCommandView` owns selection for both planetary targets and Active Missions.
  Selecting only inspects. MissionView retains recorded steps, assigned agents,
  approval text and navigation to the originating surface.
- Progress halos and right-panel bars measure completed eligible steps, not
  estimated total effort. Unknown progress has no arc. Workflow projections
  have no deadline field; no deadline or percentage is fabricated.
- Waiting is not automatically blocked: a waiting run with a recorded failed
  step uses warning treatment. Approval uses the recorded approval flag.
- Plugins are real source/connection/local adapters; edges indicate shared
  workflow membership. Skills are snapshot instructions; edges indicate shared
  allowed tools (24 visible stars maximum, 10 edges). Obsidian uses the bounded
  vault graph and real note links (60 visible edges). All three domain labels
  persist independently of missions. Existing inspection actions are retained.

## Rendering and performance

Existing Three.js perspective rendering is retained. The larger Omega has
beveled solid geometry, metallic sides, seeded irregular energy grain and local
bloom. Two continuous inclined toruses cross the shared depth buffer. Mission
spheres and their thin orbit paths use rotated circular geometry. Periods are
260–419 seconds; waiting moves at 12% speed. Arrival phases are spread and retained
across polling. Projected HTML targets follow the same camera; a ray against
Omega hides labels when the solid occludes a planet. Keyboard and right-panel
access remain. Graphics failure retains flat mission controls and retry.

The former 22 decorative bodies were removed. Ambient particles are one seeded
680-point draw with slower drift. Existing frame loop, hidden-view suspension,
reduced-motion mode, pixel-ratio ceiling of 2 and lazy scene import remain.
Sphere geometry is shared. Mission resources reconcile by ID and are disposed
when removed. Progress geometry changes only when progress changes. Selection
and polling do not recreate WebGL. There are no per-frame React state updates.
No dependency, paid call, backend command or execution authority was added.

## Verification and limits

Run `node scripts/test-pantheon-missions.mjs` for lifecycle and telemetry tests.
`node scripts/mission-review.mjs <dev-url>` covers zero/one/two missions, completed
missions, paired selection, four viewports, reduced motion and context loss.
`flagship-review.mjs` now asserts zero idle planets instead of decorative bodies.
Run the full `npm run visual:review` regression suite per AGENTS.md.

Browser fixtures are synthetic. Production still reads `command_missions`,
`command_capabilities` and the vault graph through existing Tauri paths. Browser
preview has synthetic capabilities and zero live missions. Browser verification
does not establish native WebView2, real IPC or installed desktop acceptance.

The existing Olympian landscape is retained and is not pixel-identical to the
supplied painting. Real agent names, counts and workflow titles replace the
render's example content. The backend reports supported workflow runs, not a
general project/deadline mission registry; background sync and monitors remain
outside its projection. Dense mission-label collision avoidance and native
desktop acceptance remain follow-ups.

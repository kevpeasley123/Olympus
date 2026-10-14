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
- Right-panel progress bars measure completed eligible steps, not estimated
  total effort. Unknown progress has no bar. The planet progress halos were
  hidden in 0.24.0; progress belongs to the mission directory. Workflow
  projections have no deadline field; no deadline or percentage is fabricated.
- Waiting is not automatically blocked: a waiting run with a recorded failed
  step uses warning treatment. Approval uses the recorded approval flag.
- Plugins are real source/connection/local adapters. Skills are snapshot
  instructions (24 visible stars maximum), plus one Superpowers reference
  collection star. Since 2026-10-11 (`a939fed`) the Plugin and Skill lines are
  decorative nearest-neighbour group lines, not shared workflow or tool
  membership. Obsidian Memory uses the bounded vault graph and real note links
  (at most 60 drawn). Lines in each group show only while one of its stars is
  hovered or focused. The Plugins, Skills and Obsidian Memory labels persist
  independently of missions. Existing inspection actions are retained.
- The agents themselves stand around the Omega as animated gods
  ([PANTHEON-FIGURES.md](PANTHEON-FIGURES.md)), and they are the scene's only
  representation of the agents: the Agents constellation (a star per agent and
  its "Agents 5" label) was removed once the five figures stood. The Armory
  keeps the Agents count and roster, and hovering a row highlights its god.
  Skills sits in the upper right corner, clear of Hephaestus's station.

## Rendering and performance

Existing Three.js perspective rendering is retained. The larger Omega has
beveled solid geometry, metallic sides, seeded irregular energy grain and local
bloom. The two inner toruses this pass kept have been hidden in the flagship
since 0.25.0. Mission spheres orbit on rotated circular paths, which have been
invisible since 0.24.0. Periods are 180–269 seconds (260–419 before 0.24.0). A
planet pauses while it is hovered, focused or inspected from the mission list;
waiting runs no longer slow down. Arrival phases are spread and retained
across polling. Projected HTML targets follow the same camera; a ray against
Omega marks a planet occluded when the solid is in front of it. Since 2026-10-08
(`652c71b`) an occluded planet's hover ring and hit area are disabled while its
label stays visible and clickable. Keyboard and right-panel
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
missions, paired selection, four viewports, reduced motion and context loss. It
launches Edge (`channel: 'msedge'`). Run on 2026-10-12 in Chromium instead, it
stopped at its first "Permanent Obsidian" check: it looks for a group named
"Obsidian constellation", and the group is now labelled "Obsidian Memory
constellation". `flagship-review.mjs` asserts zero idle planets instead of
decorative bodies; see [COMMAND-FLAGSHIP.md](COMMAND-FLAGSHIP.md) for its state.

`npm run visual:review`, the regression pass AGENTS.md asks for, does not cover
this composition: it drives `command-agent-harness.html` without `?flagship` and
captures the older Agent Catalog and orbital capability cards. The mission
planets are covered only by the ad-hoc `scripts/*-review.mjs` scripts.

Browser fixtures are synthetic. Production still reads `command_missions`,
`command_capabilities` and the vault graph through existing Tauri paths. Browser
preview has synthetic capabilities and zero live missions. Browser verification
does not establish native WebView2, real IPC or installed desktop acceptance.

Command's backdrop has been the canyon altar (`olympus-altar-v5.png`) since
0.24.0; it is not pixel-identical to the supplied painting. Real agent names, counts and workflow titles replace the
render's example content. The backend reports supported workflow runs, not a
general project/deadline mission registry; background sync and monitors remain
outside its projection. Dense mission-label collision avoidance and native
desktop acceptance remain follow-ups.

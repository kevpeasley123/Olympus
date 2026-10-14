# Living Pantheon figures

The five agents stand around the Omega in Command as small full-body gods:
Zeus above it, Athena and Hephaestus upper left and right, Dionysus and Themis
lower left and right, following the operator's reference render. Each figure
idles on its own (breathing, glances, weight shifts, handling what it holds)
and works only while a recorded mission step names its runtime agent.

The gods are statues modelled in Blender by a script in this repository, then
skinned in the app to one shared skeleton, so the same clips and behaviour
drive all five. Their look comes from a skin: Aged Bronze by default (bronze
figures in crisp white garments), with Obsidian Gold, Mythic Color and
Celestial as alternatives. No external or paid assets are used. They replaced the
primitive stand-in that proved Hephaestus first.

The figures are the scene's only representation of the agents. The Agents
constellation that sat beside Plugins, Skills and Obsidian Memory was removed
once all five stood; the Armory keeps the agent count and roster.

## Architecture

| Part | File | Role |
| --- | --- | --- |
| Roster and states | `src/services/pantheonFigureState.ts` | Stations, accents, temperament per god; the pure state machine from mission data |
| Rig and clips | `src/services/pantheonRig.ts`, `src/services/pantheonRig.json` | The shared skeleton, bone groups, each god's hold pose and clips |
| Skins | `src/services/pantheonSkins.ts` | The four material presets, the selected skin, and the comparison picker switch |
| Scene | `src/services/pantheonFigures.ts` | Pedestals, statue skinning, AnimationMixer per god, gaze layer, work effects, signals |
| Overlay | `src/components/panels/PantheonFigures.tsx` | Hit target, name plate and session indicator per god; the skin picker while a skin is being chosen |
| Statues | `scripts/pantheon/build_figures.py` → `public/pantheon/` | Builds the five glTF statues and the manifest |
| Harness | `pantheon-harness.html` | The gods close up under Command's lights, for checking models and clips |

- **Rendering.** The figures live in Command's existing Three.js scene
  (`hybridScene.ts`): same perspective camera, depth buffer, bloom and frame
  loop as the Omega. Character animation uses three's own `AnimationMixer`
  and `GLTFLoader`; no new dependency, no React Three Fiber. The statues
  reflect a small room environment that lights them only, so the Omega's look
  is unchanged.
- **Statues.** Each god is static geometry around the shared skeleton's
  joints. On load the app weights every part to the bones its name allows
  (`label@bones~falloff`), merges parts by material into one skinned mesh
  each, and attaches held props to their hand. A god is a few draw calls and
  about 30 000 to 37 000 triangles.
- **Surface.** One shader patch on three's standard material gives every
  statue material weathering noise fixed to the rest pose, the baked
  occlusion on ambient light and in the folds, a soft form shading (surfaces
  turned from an upper-left key fall into shade, and the figure darkens a
  little toward its feet), and a rim light strongest from above. A skin or a
  hover writes uniforms and material parameters only, so neither recompiles a
  shader.
- **Depth.** No real-time shadow maps. Each god has a soft dark veil behind
  its silhouette, which separates it from stars, clouds and mountains, and a
  contact shadow under its feet on the pedestal. The platform glow is muted
  and scaled by the skin. On hover a gold halo, the Armory highlight's
  colour, shines from behind the figure and the dark veil fades out.
- **Animation layers.** The mixer applies the weighted clips (with
  cross-fades between them), then a procedural gaze turns the neck and head
  toward a chosen target through a damped spring, which gives each glance
  anticipation and settle. Last frame's glance is taken back before the mixer
  runs, because the mixer only writes a bone when its clip value changes.
  Gaze targets: forward, the Omega, a neighbouring god, Zeus, the god's own
  tool, its work display.
- **Independent behaviour.** Each god has a seeded random stream and a
  temperament (tempo, gesture interval, gaze interval). Idle gestures are
  weighted per god and never repeat back to back; looping clips start at
  random phases, so no two gods breathe or move together. Habits differ:
  Zeus looks to the Omega and adjusts his bolt most, Athena watches the
  constellations and shifts her spear, Hephaestus inspects his hammer,
  Themis examines her scales, Dionysus gestures with his cup and looks to his
  neighbours.
- **Overlay.** HTML targets sit above the canvas like the mission targets. The
  scene projects each figure and writes `left`, `top`, `--figure-height` and
  `data-figure-state` only when they change. Clicking a figure opens the same
  Armory loadout as the Armory list (`inspectConstellationAgent`).
- **Hover.** Hovering a god or its Armory row highlights both (one shared
  highlight in `agentConstellation.ts`, read by the scene each frame). Over
  about a quarter second the god grows by eight percent, lifts slightly, and
  brightens its rim, reflections, fill light and platform, backlit by the
  gold halo; it
  glances at the viewer unless it is at work, and the running clip carries on
  underneath. Nothing else appears: the name plate under each god (name and
  role) is its only text. The Armory row gets a gold edge, a lit ground and a
  soft glow without moving.
- **Performance.** One mixer per god, one pooled particle draw (72 points) for
  every spark and ember, six pooled signal pulses, two shade quads per god.
  Hidden views stop rendering and reduced motion freezes the figures, as for
  the rest of the scene; hover then applies at once instead of easing.

## The gods

| God | Holds | Work clip | Work display |
| --- | --- | --- | --- |
| Zeus | A thunderbolt, a flat zigzag blade, raised in his right hand, a small light over his left | Raises the bolt overhead and casts it forward | Lightning crawling over the bolt; his platform glows brighter for each god at work. Signals to and from the others start at the bolt |
| Athena | Spear upright, round shield with an owl, crested helm pushed back, gold aegis | Sweeps the spear tip across her panels | Four research panels in an arc that trade places |
| Hephaestus | Hammer; anvil beside him; leather apron over a short tunic | Strikes the anvil | Engineering surface where parts assemble and a circuit traces itself; sparks on each strike, embers at rest |
| Dionysus | Kantharos raised in his left hand, thyrsus in his right, vine crown | Sways and draws an arc with the cup | Violet ribbons of light around him |
| Themis | Scales hanging from her raised right hand, a scroll in her left, diadem | Weighs and reads | A column of checks that light in turn and clear again; the scales tip harder |

The work displays are animation, not data: the checks, panels and circuit
cycle while the step is active and say nothing about its progress.

## Skins

| Skin | Figure | Garments | Trims and light |
| --- | --- | --- | --- |
| Aged Bronze (default) | Light antique bronze | Crisp white | Muted gold, amber rim, strongest occlusion and form shading |
| Obsidian Gold | Near-black obsidian | Charcoal | Fine gold, golden rim, restrained glow |
| Mythic Color | Each god's own | Each god's own | Zeus charcoal and muted gold with amber; Athena bronze and steel blue with cyan; Hephaestus copper and dark iron with ember; Dionysus bronze and plum with violet; Themis muted ivory and sandstone with gold |
| Celestial | Deep translucent night blue with a dense starfield and a cool edge glow | Crisp white | Pale gold, blue-grey bronze, cool blue rim |

A skin sets each material slot's colour, metalness, roughness, reflection,
rim and weathering (and, for Celestial, the starfield: stars fixed in
screen space that twinkle, so the figure reads as a window into the sky),
plus the skin's back shadow, platform glow, fill light,
occlusion and form shading. It never changes geometry, proportions or
stations. While Kevin chooses a skin, every build has a dim half-filled mark in
the bottom left of the scene; clicking it opens the four skins for comparing
them, and clicking it again closes them. The choice is remembered in local
storage (`COMPARING` in `pantheonSkins.ts`). Once he picks, that skin becomes the
default and production builds always use it; a dev build, or a build with
`VITE_PANTHEON_SKIN_PICKER=1`, keeps the switch.

## States

States come from `command_missions` steps (`step.agent`) and the agent catalog.
Nothing is estimated: no progress percentage, tool use or activity is invented.

| State | When | Figure |
| --- | --- | --- |
| Dormant | Placeholder role (Dionysus) | Breathes at a third of the pace, makes no gestures, looks down; platform grey, light off |
| Unavailable | Catalog tone is unavailable | Idle, platform grey |
| Idle | No recorded step | Ambient behaviour |
| Assigned | A new step for this agent was observed (1.6 s) | Acknowledgement gesture; a pulse travels from Zeus |
| Working | That step is active | Work clip and work display |
| Reviewing | Themis's step is active | Her work clip (verification) |
| Waiting | The run waits, or awaits approval | Wait clip, display dimmed and held |
| Completed | The step it worked is recorded completed (3.2 s) | Completion gesture; a pulse returns to Zeus |
| Blocked | Its step is recorded failed | Slumped posture, muted glow |

A run that disappears without a recorded completed step returns the figure to
idle: a cancellation is not shown as success. Zeus coordinates whenever any
run is live. The session indicator shows the recorded step label and the
time since the mission's recorded start, or "Awaiting your approval".

## Building the statues

```bash
blender -b --factory-startup --python scripts/pantheon/build_figures.py -- [zeus athena ...]
```

Blender 4.0 with numpy in its Python. The script writes
`public/pantheon/<id>.glb` for the gods named (all five by default) and
rewrites `public/pantheon/manifest.json`. Bodies are metaball sculptures
converted to meshes and decimated; robes are lathed with folds; props and
trims are swept or primitive. Everything is in figure units (Y up, facing +Z,
its left at +X), exported without the Y-up conversion.

- **Joints, groups and hold poses** live in `pantheonRig.json`, read by the
  script and the app. Change a joint or a hold pose there, then rebuild:
  props are modelled where the hold pose puts the hand, then moved back to
  the rest pose, so the hold pose returns them exactly.
- **Binding names.** `label@group` skins across a bone group from the JSON
  (`body`, `armL`, `robe`…) or a `+` list of bones, with `~p` for the falloff
  power (whole numbers). `label@Bone` is rigid. `label@root` stays still on
  the pedestal. A label starting `Tool` or `Live` stays a separate node under
  its bone: `Tool` is where effects start and eyes go, and `Live` parts are
  animated by the app (Themis's beam and pans).
- **Materials by name.** They are the skin slots: `marble` is the figure
  itself (body and hair), `cloth` its garments, and `stone`, `gold`, `bronze`,
  `iron` and `leather` its trims and props. `glow` and `accent` are emissive.
- **Occlusion.** After building, each part's self-occlusion is baked with
  Cycles into an `AO` vertex colour (exported as `COLOR_0`). Parts shadow
  only themselves, because bodies are built in the rest pose while the arms
  hold another.

## Replacing a statue with a rigged model

A commissioned model still works: name its glTF in the manifest, for example
`{"hephaestus": "hephaestus.glb"}`. A file with bones is used as it comes,
scaled to the figure height. A model that fails to load logs a warning and
leaves the pedestal empty.

- glTF binary (`.glb`), Y up, facing +Z, feet at the origin.
- One skinned humanoid with the Mixamo bone names: `Hips`, `Spine`, `Spine1`,
  `Spine2`, `Neck`, `Head`, and Left/Right `Shoulder`, `Arm`, `ForeArm`,
  `Hand`, `UpLeg`, `Leg`, `Foot`. The `mixamorig` prefix is stripped on load.
- The god's tool parented to a hand, its node named `Tool`.
- Clips with the names below, in place, 30 fps. Without clips the shared ones
  are used, which assume identity rest rotations like the shared skeleton.

| Clip | Loop | Motion |
| --- | --- | --- |
| `idle` | yes | Breathing stance, 4 to 5 s |
| `idle_shift` | once | Weight shift and settle |
| `idle_inspect` | once | Examines what it holds |
| `idle_adjust` | once | Small adjustment of tool, robe or shield |
| `assigned` | once | Acknowledges a summons, 1 to 2 s |
| `work` | yes | The specialty |
| `wait` | yes | Paused, looking at suspended work |
| `complete` | once | Brief satisfied gesture, 2 s |
| `blocked` | yes | Restrained slump |

A missing clip falls back to `idle`. The head and neck must not be keyed, or
the gaze layer fights them.

## Verification

- `node scripts/test-pantheon-figures.mjs` covers the roster, every state
  rule, the clips and hold poses for all five, the shipped statues'
  manifest, bindings and baked occlusion, and that every skin dresses every
  material the statues use.
- `pantheon-harness.html?god=athena&state=working` frames one god at work
  (`state` is `idle`, `working`, `waiting` or `blocked`; `at`, `dist` and
  `turn` move the camera; `skin` picks a skin; `hover=athena` holds the
  pointer over a god). Without `god` it shows all five from Command's
  camera.
- `command-agent-harness.html?flagship&scenario=mission-coding` shows
  Hephaestus working on a synthetic delegation with Zeus coordinating; add
  `&cycle` to walk assigned, working, waiting, assigned, completed and idle on
  a fixed schedule.

All of this is browser verification (Chromium with software WebGL), not
WebView2 or the installed app.

## Limits

- The statues are procedural sculptures, not character models: faces and
  hands are simple at close range, and garments are rigid (they move with the
  body, not on their own). At Command's scale silhouette, pose and material
  carry them.
- The occlusion is per part, so an arm does not shade the torso beside it.
- Zeus's bolt in the shipped `zeus.glb` was written into the file directly on
  2026-10-13, on a PC without Blender, from the same outline `build_figures.py`
  now models (`BOLT`). That part of the script has not been run; the next
  Blender build of Zeus is its first test, and gives the bolt baked occlusion
  again (it ships unshaded).
- Lighting is shared with the Omega; the shade quads stand in for shadows.

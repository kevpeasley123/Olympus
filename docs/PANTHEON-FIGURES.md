# Living Pantheon figures

The five agents stand around the Omega in Command as small full-body gods:
Zeus above it, Athena and Hephaestus upper left and right, Dionysus and Themis
lower left and right, following the operator's reference render. Each figure
idles on its own (breathing, glances, weight shifts, handling what it holds)
and works only while a recorded mission step names its runtime agent.

The gods are marble and gold statues modelled in Blender by a script in this
repository, then skinned in the app to one shared skeleton, so the same clips
and behaviour drive all five. They replaced the primitive stand-in that proved
Hephaestus first.

## Architecture

| Part | File | Role |
| --- | --- | --- |
| Roster and states | `src/services/pantheonFigureState.ts` | Stations, accents, temperament per god; the pure state machine from mission data |
| Rig and clips | `src/services/pantheonRig.ts`, `src/services/pantheonRig.json` | The shared skeleton, bone groups, each god's hold pose and clips |
| Scene | `src/services/pantheonFigures.ts` | Pedestals, statue skinning, AnimationMixer per god, gaze layer, work effects, signals |
| Overlay | `src/components/panels/PantheonFigures.tsx` | Hit target, name plate and session indicator per god |
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
- **Animation layers.** The mixer applies the weighted clips (with
  cross-fades between them), then a procedural gaze turns the neck and head
  toward a chosen target through a damped spring, which gives each glance
  anticipation and settle. Last frame's glance is taken back before the mixer
  runs, because the mixer only writes a bone when its clip value changes.
  Gaze targets: forward, the Omega, a neighbouring god, Zeus, the god's own
  tool, its work display.
- **Independent behaviour.** Each god has a seeded random stream and a
  temperament (tempo, gesture interval, gaze interval). Idle gestures are
  weighted and never repeat back to back; looping clips start at random
  phases, so no two gods breathe or move together.
- **Overlay.** HTML targets sit above the canvas like the mission targets. The
  scene projects each figure and writes `left`, `top`, `--figure-height` and
  `data-figure-state` only when they change. Clicking a figure opens the same
  Armory loadout as the Armory list (`inspectConstellationAgent`); hovering
  highlights the same agent in both places.
- **Performance.** One mixer per god, one pooled particle draw (72 points) for
  every spark and ember, six pooled signal pulses. Hidden views stop rendering
  and reduced motion freezes the figures, as for the rest of the scene.

## The gods

| God | Holds | Work clip | Work display |
| --- | --- | --- | --- |
| Zeus | A thunderbolt raised in his right hand, a small light over his left | Raises the bolt overhead and casts it forward | Lightning crawling over the bolt; his platform glows brighter for each god at work. Signals to and from the others start at the bolt |
| Athena | Spear upright, round shield with an owl, crested helm pushed back, gold aegis | Sweeps the spear tip across her panels | Four research panels in an arc that trade places |
| Hephaestus | Hammer; anvil beside him; leather apron over a short tunic | Strikes the anvil | Engineering surface where parts assemble and a circuit traces itself; sparks on each strike, embers at rest |
| Dionysus | Kantharos raised in his left hand, thyrsus in his right, vine crown | Sways and draws an arc with the cup | Violet ribbons of light around him |
| Themis | Scales hanging from her raised right hand, a scroll in her left, diadem | Weighs and reads | A column of checks that light in turn and clear again; the scales tip harder |

The work displays are animation, not data: the checks, panels and circuit
cycle while the step is active and say nothing about its progress.

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
- **Materials by name.** `marble`, `stone`, `gold`, `bronze`, `iron` and
  `leather` get the environment reflection and the god's rim light. `glow` and
  `accent` are emissive and left to bloom.

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
  rule, the clips and hold poses for all five, and the shipped statues'
  manifest and bindings.
- `pantheon-harness.html?god=athena&state=working` frames one god at work
  (`state` is `idle`, `working`, `waiting` or `blocked`; `at`, `dist` and
  `turn` move the camera). Without `god` it shows all five from Command's
  camera.
- `command-agent-harness.html?flagship&scenario=mission-coding` shows
  Hephaestus working on a synthetic delegation with Zeus coordinating; add
  `&cycle` to walk assigned, working, waiting, assigned, completed and idle on
  a fixed schedule.

All of this is browser verification (Chromium with software WebGL), not
WebView2 or the installed app.

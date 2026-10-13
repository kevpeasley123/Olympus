# Living Pantheon figures

The five agents stand around the Omega in Command as small full-body gods:
Zeus above it, Athena and Hephaestus upper left and right, Dionysus and Themis
lower left and right, following the operator's reference render. Each figure
idles on its own (breathing, glances, weight shifts, tool handling) and works
only while a recorded mission step names its runtime agent.

Hephaestus is the proof of concept. He is the only manifested figure, and he
is a **stand-in**: a bronze statue built from primitives on a Mixamo-named
skeleton, so the behaviour, states and integration can be proven before the
real art exists. The other four keep their constellation emblems until their
models arrive.

## Architecture

| Part | File | Role |
| --- | --- | --- |
| Roster and states | `src/services/pantheonFigureState.ts` | Stations, accents, temperament per god; the pure state machine from mission data |
| Scene | `src/services/pantheonFigures.ts` | Platforms, AnimationMixer per figure, gaze layer, work effects, signals, model loading |
| Stand-in | `src/services/pantheonStandIn.ts` | The primitive statue, its skeleton and its procedural clips |
| Overlay | `src/components/panels/PantheonFigures.tsx` | Hit target, name plate and session indicator per figure |

- **Rendering.** The figures live in Command's existing Three.js scene
  (`hybridScene.ts`): same perspective camera, depth buffer, bloom and frame
  loop as the Omega. Character animation uses three's own `AnimationMixer`
  and `GLTFLoader`; no new dependency, no React Three Fiber.
- **Animation layers.** Every frame the skeleton returns to its rest pose, the
  mixer applies the weighted clips (with cross-fades between them), then a
  procedural gaze turns the neck and head toward a chosen target through a
  damped spring, which gives each glance anticipation and settle. Gaze targets:
  forward, the Omega, a neighbouring god, Zeus, the god's own tool, the work
  surface.
- **Independent behaviour.** Each god has a seeded random stream and a
  temperament (tempo, gesture interval, gaze interval). Idle gestures are
  weighted and never repeat back to back; looping clips start at random
  phases, so no two gods breathe or move together.
- **Overlay.** HTML targets sit above the canvas like the mission targets. The
  scene projects each figure and writes `left`, `top`, `--figure-height` and
  `data-figure-state` only when they change. Clicking a figure opens the same
  Armory loadout as the Armory list (`inspectConstellationAgent`); hovering
  highlights the same agent in both places.
- **Performance.** One mixer and a few draw calls per figure, one pooled
  particle draw (72 points) for every spark and ember, six pooled signal
  pulses. Hidden views stop rendering and reduced motion freezes the figures,
  as for the rest of the scene.

## States

States come from `command_missions` steps (`step.agent`) and the agent catalog.
Nothing is estimated: no progress percentage, tool use or activity is invented.

| State | When | Figure |
| --- | --- | --- |
| Dormant | Placeholder role (Dionysus) | Frozen, platform grey |
| Unavailable | Catalog tone is unavailable | Idle, platform grey |
| Idle | No recorded step | Ambient behaviour |
| Assigned | A new step for this agent was observed (1.6 s) | Acknowledgement gesture; a pulse travels from Zeus |
| Working | That step is active | Work clip, work surface, sparks on each strike |
| Reviewing | Themis's step is active | Her work clip (verification) |
| Waiting | The run waits, or awaits approval | Wait clip, surface dimmed and held |
| Completed | The step it worked is recorded completed (3.2 s) | Completion gesture; a pulse returns to Zeus |
| Blocked | Its step is recorded failed | Slumped posture, muted glow |

A run that disappears without a recorded completed step returns the figure to
idle: a cancellation is not shown as success. Zeus coordinates whenever any
run is live. The session indicator shows the recorded step label and the
time since the mission's recorded start, or "Awaiting your approval".

## Replacing the stand-in with real models

Add the model and a manifest under `public/`: a folder named `pantheon`
holding `manifest.json`, for example `{"hephaestus": "hephaestus.glb"}`, and
the files it names. With no manifest the stand-in is used. A model that fails
to load logs a warning and keeps the stand-in. Then add the god's id to
`MANIFESTED_FIGURES`.

### Model contract

- glTF binary (`.glb`), Y up, facing +Z, feet at the origin. Any unit scale:
  the loader scales the model to the figure height.
- One skinned humanoid with the Mixamo bone names: `Hips`, `Spine`, `Spine1`,
  `Spine2`, `Neck`, `Head`, and Left/Right `Shoulder`, `Arm`, `ForeArm`,
  `Hand`, `UpLeg`, `Leg`, `Foot`. The `mixamorig` prefix is stripped on load.
- The god's tool (hammer, spear, scales, cup, staff) parented to a hand, its
  node named `Tool`. Sparks and the tool glance use it.
- Clips with these exact names, in place (no root motion), 30 fps:

| Clip | Loop | Motion |
| --- | --- | --- |
| `idle` | yes | Breathing stance, 4 to 5 s |
| `idle_shift` | once | Weight shift and settle |
| `idle_inspect` | once | Examines the tool or something in hand |
| `idle_adjust` | once | Small adjustment of tool, robe or shield |
| `assigned` | once | Acknowledges a summons, 1 to 2 s |
| `work` | yes | The specialty: forging, studying panels, weighing, creating |
| `wait` | yes | Paused, looking at suspended work |
| `complete` | once | Brief satisfied gesture, 2 s |
| `blocked` | yes | Restrained slump |

  A missing clip falls back to `idle`. The head and neck must not be keyed in
  the idle clips, or the gaze layer fights them; small chest and spine motion
  is fine.
- Budget per god: about 15 000 triangles, one 1024 px PBR texture set,
  emissive map for the celestial accents.

### Production route (chosen 2026-10-13)

1. Crop each god from the reference render (full body, plain background
   painted out) and generate a front and side view in the same style.
2. Image-to-3D in Meshy or Tripo, with the prompt below, at a paid tier so the
   operator owns the output (free tiers publish under CC BY).
3. Auto-rig in the same tool, or with Mixamo or AccuRIG, to the Mixamo
   skeleton.
4. Clips from Mixamo or the tool's library for idle, shift, inspect, adjust,
   acknowledge, wait and complete; the `work` clip per god may need keyframing
   by hand in Blender. Mixamo clips may ship inside the app but not be
   redistributed on their own.
5. In Blender: parent the tool to the hand as `Tool`, rename clips to the
   table above, export glTF binary with animations.

Shared prompt: "small full-body classical Greek god figurine, cinematic dark
fantasy, polished marble and gold, subtle emissive celestial trim, consistent
style with the other four, A-pose, plain background". Per god:

| God | Look | Accent | Work clip |
| --- | --- | --- | --- |
| Zeus | Regal, flowing robes, staff or raised hand, restrained lightning | Gold | Raises staff, sends a thin bolt |
| Athena | Armored goddess, crested helm, spear and round shield, owl motif | Cyan and blue-gold | Gestures at floating panels, reorganizes them |
| Hephaestus | Powerful smith, bronze-gold armor, hammer, leather apron | Forge orange | Hammer strikes on an anvil |
| Dionysus | Youthful, flowing fabrics, vine crown, cup | Purple and gold | Draws light trails, rearranges shapes |
| Themis | Serene, white-gold robes, scales, scroll | White gold | Weighs on the scales, studies a document |

## Verification

- `node scripts/test-pantheon-figures.mjs` covers the roster and every state
  rule above.
- `command-agent-harness.html?flagship&scenario=mission-coding` shows
  Hephaestus working on a synthetic delegation; add `&cycle` to walk
  assigned, working, waiting, assigned, completed and idle on a fixed schedule.
- On 2026-10-13 the stand-in was exported to a glTF with Mixamo-prefixed
  names and served through a manifest in the browser harness: it loaded,
  replaced the stand-in and animated. That was a synthetic model; no
  commissioned model has been loaded yet.

All of this is browser verification (Chromium with software WebGL), not
WebView2 or the installed app. The stand-in's look is not the target; the
reference render is.

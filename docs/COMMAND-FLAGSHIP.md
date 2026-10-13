# Command flagship redesign - October 7, 2026

The permanent catalog competed with Omega and made capability inspection dominate
the home screen. The new default is a narrow Armory, a perspective celestial core,
and a quieter conversation panel. Existing routes, execution, approvals and data
integrations are retained. No dependency was added.

## Architecture

- `OlympusArmory` owns summary and inspection state, with the existing `Modal`
  focus trap, Escape/backdrop dismissal and focus return. It has three
  categories: Agents, Plugins and Skills. Agent rows become loadouts, each
  listing the agent's current recorded operation; plugin ports show source
  adapters; skills use an ordered inscription list. Workflow and historical
  research links still use existing destinations. The separate Operations
  category, the Armory's operations summary and Command's left tool rail were
  removed on 2026-10-07 (`86d1d7d`); live runs now appear as mission planets and
  in the companion's Active missions list ([COMMAND-MISSION-PANTHEON.md](COMMAND-MISSION-PANTHEON.md)).
- `armoryPresentation` derives adapter membership, conservative connection states,
  and live operations. Models/executors are not inflated into plugin counts.
- `CommandInstrument` uses a flagship presentation variant. Navigation stays in the HTML header, with Preferences in the companion controls; loss of graphics cannot remove navigation. Beneath the Omega, the voice dock (`OlympusVoiceDock`) holds the energy signal, a status word and a compact Spoken replies switch; see "Voice signal" below. The switch controls ElevenLabs spoken replies only and does not open the microphone.
  The older composition (Agent Catalog, orbital capability cards) is no longer rendered by the app; it survives only in `command-agent-harness.html` without `?flagship`.
- `ChatPanel` runs as the companion: Overview (Mission brief and Active missions)
  and Conversation tabs. Since 2026-10-11 (`ab0b766`) the same console is shared
  by all four modes.
- `useCommandArmory` now surfaces mission-read failures rather than treating the
  last successful snapshot as an unqualified current observation.

## Visual / motion approach

Reuse Three.js with a real perspective camera, the existing extruded Omega,
a slightly angled, sharply chamfered open-backed glyph and volumetric seeded
dust. Both scene passes share a depth buffer. The two inner torus rings, and the
voice trace that rides on them, have been hidden in the flagship since 0.25.0;
the outer reflective shell and trajectory traces remain absent. Small damped pointer movement affects the camera. The reflective field sphere is hidden; a pure-black tapered backdrop blends into brighter scenery without an illuminated perimeter. Decorative slogans and local-runtime labels are removed from the desktop presentation.
The existing restrained bloom provides light falloff. Motion drives no React
state on animation frames. The spherical backing was removed after visual feedback; the glyph is larger, its glow restrained, and speech changes light rather than inflating its geometry. A 14-degree yaw exposes the side wall. The decorative orbiting bodies of this pass were removed in 0.23.0; only recorded missions orbit now ([COMMAND-MISSION-PANTHEON.md](COMMAND-MISSION-PANTHEON.md)).

Pixel ratio stays capped at 2. Existing hidden-tab/mode suspension, reduced-motion
freeze, lazy scene loading, context-loss SVG fallback and shared geometry/material
cleanup remain. New meshes participate in the existing disposal traversal.
No React Three Fiber, Drei, GSAP or additional postprocessing was needed.

## Voice signal

Redesigned 2026-10-13 from Kevin's reference render; the PANTHEON heading and the "Spoken replies: On" pill are gone.

- **Drawing.** `services/olympusSignal.ts` draws a 2D canvas (`OlympusSignal`) once per animation frame, outside React, composited with `mix-blend-mode: screen`. The canvas shows:
  - a thin amber core with a soft pre-rendered glow, tapered at both ends;
  - drifting concentrations of current and traveling glimmers;
  - rare teal glints and fine motes;
  - short-lived branching gold filaments, made by midpoint displacement and re-jittered as they fade;
  - 15 central bars inside a faint halo.

  States blend over about 0.3 s.
- **States.** `signalStateFor` maps the voice snapshot to idle, listening, thinking, speaking, off or error.
  - Thinking means voice processing, or a typed request while spoken replies are on.
  - The status word appears only for listening, thinking, speaking and errors.
  - Off (spoken replies off) dims the line and stops audio reactivity.
- **Real audio.** `services/voiceSignal.ts` analyses without changing playback or capture:
  - the microphone and realtime voice streams through an AnalyserNode that is never connected to the output;
  - ElevenLabs replies by decoding the same bytes and reading them at the element's `currentTime`.

  Each frame it supplies a level (RMS mapped from -54 to -12 dBFS) and 16 log bands (120 Hz–6 kHz) relative to a decaying peak, gated at silence. Loudness sets bar height; each bar's band shapes it. Centre bars read the low bands and outer bars the high, so the waveform follows syllables and pauses.

  When no source can be analysed the waveform shows the state's ambient rhythm and the harness reports `signalSource=none`; it never imitates speech.
- **Omega coupling.** While speaking, the scene reads `omegaVoiceEnergy()`: the reply envelope (80 ms rise, 400 ms fall), mapped to 0.08–0.35 of the scene's energy. Glow and canyon light lift slightly with the voice; there is no shared timer.
- **Controls.** One `role="switch"` named Spoken replies (speaker icon and a 22×12 track) has a tooltip. A microphone mark appears only while the microphone is on (teal while capturing). Voice usage now lives only in the ElevenLabs preferences.
- **Performance.** The signal costs about 0.5 ms per frame in headless Chromium. It drops its widest glows if it averages over 6 ms per frame for two seconds. It stops with the page, the mode and reduced motion; reduced motion draws one composed still frame.
- **Tests.** `voice-signal-harness.html` measures the dock without WebGL. Its sources are synthetic: a generated speech-shaped WAV through the real clip path, or an oscillator stream through the real stream path. `scripts/test-voice-signal.mjs` covers the analysis, state mapping, every state, keyboard use, reduced motion and placement in Command.

## Data truth

Desktop catalog, tools, skills, agent loadouts and missions come from existing
Rust endpoints. Browser previews are explicitly synthetic. Gmail is Connected
only when its available descriptor explicitly reports a connected account;
other adapters remain Available, never assumed authenticated. Authority and
approval descriptions come from their compiled contracts. Coding remains
unproven when that is its recorded status. Readiness does not prove provider
credit or quality.

Current limitations: the mission endpoint does not expose background Gmail sync,
general monitors or schedules. With no live runs, the Mission brief and Active
missions list say "No active missions reported." No Calendar, Drive, GitHub or
other integration was fabricated. The plugin count is eight in the current
fixture, not all fourteen tools. Models and the executor remain in loadouts.

## Validation

`node scripts/test-armory-presentation.mjs` checks source adapter classification,
authentication claims, empty states and running/waiting membership.
`node scripts/flagship-review.mjs [preview-url]` drives the actual App composition
at 1440x960, 1920x1080, 1280x800 and 900x900 (Armory dialog, loadout and contract
inspection, focus, Escape, geometry, mode navigation, Preferences), then
`command-agent-harness.html?flagship` for perspective projection, idle planets,
reduced motion, context-loss navigation and the voice wave. It launches Edge
(`channel: 'msedge'`) and captures the review in `output/flagship-review`.
Run on 2026-10-12 in Chromium instead of Edge, its App and Armory checks passed
and it stopped at its assertion of two visible inner rings, which the flagship
has hidden since 0.25.0; the checks after that did not run.

`npm run visual:review` does not cover this composition. It drives
`command-agent-harness.html` without `?flagship`, so it captures the older Agent
Catalog and orbital capability cards ([VISUAL-REVIEW.md](VISUAL-REVIEW.md)). The
flagship is covered only by `flagship-review.mjs` and the other ad-hoc
`scripts/*-review.mjs` scripts.

Human visual iterations corrected short-window composer clipping, left-rail
contrast/overflow, focus after opening a loadout, scrollbar treatment and quieted
assistant copy. Browser timing is machine-specific, not a universal FPS promise.
Native deployment/acceptance is recorded separately in the session report.

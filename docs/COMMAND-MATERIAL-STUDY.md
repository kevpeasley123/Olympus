# Current checkpoint — September 8, 2026

This checkpoint preserves the operator-reviewed material study. The sections below record earlier iterations; this summary describes the current implementation.

- Original Omega outline, fixed -20-degree yaw / -9-degree elevation, 1.4 apparatus scale, and two continuous luminous orbital rings.
- Accepted smoked-glass face uses alpha compositing and a restrained front reflection; geometry remains layered with a recessed backing.
- Olympus alone is active in the fixture. Asymmetric amber edge concentrations, a short-tailed tracer every 7 seconds, and warm label treatment preserve a neutral glass center.
- Idle Omega uses a smooth 5.6-second breath, randomized 10.5–14.8-second two-stage heartbeat, restrained local light, and one faint ripple. Other states retain prior behavior. Reduced motion holds static illumination.
- Removed the periodic outer-ring tracer. The constellation signal is glowing white; its timing remains unchanged.
- Constellation X/Y and topology are preserved. Most depth values stay near the center of a bounded +/-12-unit volume, with subtle size/intensity cues and +/-0.55-unit Z drift. Connections and signals follow node depth; cross-project segments retain their original X/Y clipping.
- Tunables live in FRONT_GLASS, PROJECT_GLASS, ACTIVE_PROJECT, OMEGA_IDLE, CONSTELLATION_DEPTH, and SCENE_FINISH.

Validation: TypeScript/Vite build and 28 browser regression checks passed after the latest depth changes. Direct compositor screenshots inspected. Existing dependency/chunk warnings remain. This is a local preview checkpoint, not an installed release or a push to the remote.

---

# Command material study — 2026-09-08

Review checkpoint in the development worktree; not installed in Olympus 0.10.1.
Run `npm run dev -- --port 31429` and open `/material-study.html`.
The preview uses eight synthetic projects and 64 fixture notes, with no project writes or API calls.

## Scope

Exact non-3D Omega font outline and dimensions, extruded, separate face/side materials, procedural etched texture and bounded contour glow. A layered stationary bearing assembly surrounds the core. Exactly two continuous animated orbital rings remain.

Olympus and its adjacent project module receive recessed glass faces, metal frames, fasteners, fine graduations, and chassis ribs. Remaining modules retain the previous construction so this is a representative finish study, not a completed interface overhaul.

A shallow fixed orthographic camera reveals thickness. The SVG overlay uses the matching plane projection, preserving source layout and actions while slightly changing screen projection. Node hit areas accommodate bounded depth parallax. Shared project data and conversational architecture are unchanged.

## Implementation

`src/services/commandMaterialStudy.ts` owns the geometry, procedural textures, environment reflections, and material updates. `hybridScene.ts` integrates and disposes the study. `hybridCore.ts` centralizes the camera and overlay projection. The browser entry is `material-study.html` using the existing fixture harness.

RoomEnvironment/PMREM and physical transmission add rendering cost. No frame-rate or target-device performance guarantee has been established. There are no downloaded art assets. This is not yet the cinematic finish of the reference image.

## Validation

TypeScript/Vite production build passed. Browser regression harness passed all 15 checks: constellation invariants, bounded depth, unchanged project hit paths, one canvas, all 64 fixture nodes, exactly two rings, project action, context-loss fallback, disable cleanup, healthy recreation, reduced-motion pause/resume, hidden-view pause/resume, and missing-WebGL fallback. Desktop preview visually inspected at 1440 x 1000.

Next: review this finish at useful display size, refine materials/composition as needed, then extend the accepted treatment across the instrument and measure performance in the installed app. No installer or release version was changed for this study.

Operator refinement: traced U+03A9 directly from Windows Times New Roman regular, the original SVG fallback because Cinzel has no Greek coverage. Uses the same 150-unit font size, centered advance and baseline +52. Replaces the earlier hand-drawn 3D approximations. The path drives geometry, contours and glow. Build passed and live preview visually inspected.

Viewing-angle refinement: fixed camera at (185, 95, 500), approximately 20 degrees yaw and 10 degrees elevation, to reveal Omega and panel sidewalls. Matching SVG projection updates automatically. Node hit padding increased to accommodate depth parallax.

Operator angle adjustment: camera yaw -15 degrees and elevation -5 degrees, calculated explicitly from angles; matching SVG projection follows automatically.

Latest operator angle adjustment: yaw -20 degrees, elevation -9 degrees.

Tab depth refinement: structural tab bodies increase from 6 to 9 units, extending three units backward. Front planes, annular outlines, labels and face details remain at their existing positions.

Apparatus scale: entire dial scaled uniformly to 140%, including WebGL, SVG labels and interaction geometry.

Removed the central mechanical backing assembly: disk, stationary bearing rings, segmented tracks, graduations and surrounding studs. Omega and two animated orbital rings retained.

Celestial ring finish: two continuous gold/ivory light paths with thin cores, two restrained additive halo layers, and a broad circulating highlight. No metallic response; shared motion time freezes highlights under reduced motion. Existing orientations and ring count retained.

Inner clearance: Omega and rings uniformly reduced to 72% of their previous size. Projected constellation links are clipped outside radius 74; link pulses hide within that clearance. The ring rotation envelope including glow stays inside this region at the current camera. Outer apparatus size remains unchanged.

Correction: restored uninterrupted constellation connections and link pulses through the center; removed circular link clipping because it created a visible empty disk. Smaller Omega/rings retained for node clearance.

Outer bezel and tab refinement: dimensional metal bezel at day-ring radius 205, retaining live SVG day markers. Detailed framed glass treatment now covers all project tabs. Frame depth 12 units with front plane preserved, denser arc tessellation and six bevel segments for smoother edges.

Glass tab refinement: replaced mechanical framing, ridges, mounting ribs, fasteners and etched tab faces with a single polished tinted glass volume per project. Retained 12-unit depth and annular footprint, with amber/blue tint and restrained hover illumination.

## Material and motion refinement

Project layout, tab footprint/depth, Omega outline, camera and constellation positions preserved. Added sparse internal glass linework and a recessed dark outline; transparent material remains alpha-composited rather than transmission-based so the page background stays visible. Slightly increased roughness softens reflections. Active/hover states brighten edge accents subtly.

`MATERIAL_TUNING` in `src/services/commandMaterialStudy.ts` centralizes glass opacity, roughness, reflections, module emission, core emission/halo and timing. `coreGlowEnvelope` adds a smooth five-second 15% breath and a 1.8-second pulse every 13 seconds (up to an additional 12%). Existing voice energy adds independently. Reduced motion returns a steady baseline. There is no physical scaling, ripple, new light, or full-scene bloom pass; existing contour halo and environment lighting are retained.

Browser harness adds timing/pulse/reduced-motion envelope checks. Decorative SVG fallback layers are removed from display while hybrid rendering is ready, retaining project labels and interaction targets. This prevents duplicate decorative layers; SVG fallback remains available.

## Six-pass reference refinement

1. Every module now has a narrow open-backed dimensional housing, separate front/rear glass layers, interior gap, and embedded light channel. No project placement or ordering changed.
2. Omega gained radial halo and short-range warm light; the original traced outline and scale remain.
3. Five-second breathing and thirteen-second pulse now modulate halo/light and trigger a faint expanding ring, fading at radius 148 before project tabs. Reduced motion disables ripple.
4. Recessed rail sections, dark gaps, fine ticks and sparse orange channels fit inside the existing outer footprint.
5. HDR threshold bloom uses EffectComposer, UnrealBloomPass and OutputPass. This is luminance-selected bloom, not an object-ID mask. SVG labels are outside postprocessing. Bloom threshold/strength/radius are centralized in SCENE_FINISH. Resources are disposed with the scene. A dark rendered background supports compositing.
6. Original constellation topology, position and node sizes preserved. Cooler node emission and quieter depth-dependent links; signal interval remains 4.5 seconds.

Tuning: MATERIAL_TUNING (glass, core, pulse/ripple/local light) and SCENE_FINISH (bloom/network). Glass uses alpha transparency, not physically refractive transmission; the reference's optical richness remains an artistic limitation. No claim of matching the reference or installed-app performance. No release/install performed.

Final validation: TypeScript/Vite build passed; 18 browser checks passed after four-sample HDR target was added. Live in-app browser sample approximately 59.4 rendered frames/second at the current preview size; not a guarantee at larger resolutions or in installed Tauri. Direct composited screenshots used for final inspection because full-page capture showed stale decorative layers. Reference-level optical glass quality remains unresolved.

## Second artistic refinement

No mesh layouts, project shapes, camera, Omega outline, node positions, or graph topology changed. Glass body tint is now neutral across active/inactive states. A physical-material shader hook modulates alpha with Fresnel angle; tint stays smoky and front faces remain transparent. Direction-weighted rim vertex colors replace uniform-bright outlines. Active state remains in embedded orange channels and rim response, not a brown face.

Secondary rail and technical-line intensity reduced, orbital light alpha multiplied by .42, and bloom threshold raised to 1.35 with strength .3. Omega retains its local warm light, now slightly stronger but range-limited. Existing Z depth determines rear/mid/front node emission (.32/.58/.95); only nodes above Z=8 use the foreground class. Network opacity also depends on mean endpoint depth. Geometry and node sizes remain unchanged.

Breath: 5.3 seconds, 13% peak. Heartbeat: deterministic irregular intervals 11.7/14.2/12.6/14.8 seconds, primary .65-second lobe (+12%), pause, secondary .45-second lobe (+5.5%). A faint ripple follows the secondary onset and ends before modules. Reduced motion holds steady glow and hides ripple. Tunables remain in MATERIAL_TUNING and SCENE_FINISH. Glass remains an alpha-composited optical approximation, not refractive transmission.

## Focused smoked-glass material pass

Only project-tab material treatment changed. Mesh geometry, layout, Omega, network, camera, lighting, bloom and motion preserved. Replaced the custom alpha/Fresnel hook with stock MeshPhysicalMaterial transmission (.94), moderated by alpha opacity (.22) under the existing lighting. Neutral absorption, IOR 1.38, optical thickness 7, roughness .14. Existing extrude material groups now use a slightly stronger side/bevel material (.42 opacity, .65 environment response) and a quieter face. Rear pane opacity .035; drawn rim and embedded channel intensity reduced. Active warmth stays in trim. PROJECT_GLASS centralizes controls. This is a blended transmission approximation, not a physically exact optical simulation. No new shader or postprocessing.

Glass diagnosis: Three.js transmission captures opaque objects, excluding transparent connection lines. Tab-only correction uses ordered alpha compositing after those links, no depth writes, quieter decorative rims, darker separate tab housing, and a small smooth normal perturbation for broad reflection variation. Geometry and other scene systems untouched. Still-frame acceptance is not fully met: most pane area has no constellation nodes behind it at the current fixed spatial layout, and visible links remain very faint. Do not present this as reference-quality glass or complete visual acceptance.


## Active project state — September 8

The accepted base smoked-glass material remains unchanged. Active status adds localized amber energy through the existing two edge channels, a faint narrow warmth at the recessed outer edge, and a modest warm label lift. One tracer traverses part of the outer channel for 2.8 seconds every 7 seconds; reduced motion suppresses the tracer. No geometry, lighting, camera, or other animation changes.

`ACTIVE_PROJECT` in `commandMaterialStudy.ts` centralizes intensity, internal warmth, and tracer timing. State comes from `project.status === 'active'`, independently of hover or selection. Only Olympus is active in the material-study fixture; real project data is unchanged. This remains a browser study, not an installed release.

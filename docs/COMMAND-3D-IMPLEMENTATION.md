# Hybrid command core prototype — 0.10.0

The first implementation is optional: Preferences → Dimensional core. It is session-only and defaults to the original SVG view at each launch. Disable it at any time to compare. This is a rendering prototype for operator design review, not the final cinematic polish pass.

## Rendering boundary

- `src/services/hybridScene.ts`: lazy-loaded Three.js 0.186 WebGL 2 scene. Orthographic front camera uses the same 440-unit coordinate system as SVG. A purpose-built extruded Omega outline, beveled project bands, thin tubular orbit geometry and shallow luminous nodes gain actual Z depth. The prototype outline preserves the Omega composition but is not a font-exact reproduction of the original text glyph.
- `src/services/hybridCore.ts`: session toggle and shared command layout. Existing ring and constellation algorithms remain authoritative. Nodes retain X/Y positions; deterministic Z lies between -12 and +12. No project positions, ownership or link topology are invented. Cross-project links retain their existing clearance clipping.
- `HybridCommandCore.tsx`: lifecycle, lazy initialization and preview control. `CommandInstrument.tsx` computes one shared layout and supplies existing state/voice level. `ProjectRing.tsx` reuses the same layout and forwards hover/focus ownership.
- DOM/SVG retains labels, transparent keyboard/mouse hit areas, tooltips, day arc, status text, navigation, console and voice controls. Node halos and interaction highlights remain SVG. No AI, persistence, approval or project backend changes.

The camera stays fixed. Project positions and constellation coordinates do not move with perspective; depth comes from bevel lighting, shallow occlusion and orbit rotation. Two tubular rings remain present; the existing elevated sweep adds one ring for 3.8 seconds. Tubes have finite cross-section and remain visible edge-on, with natural partial occlusion by the core.

## State and motion

Shared idle/thinking/listening/speaking state and real voice level drive the core. Existing hover/focus highlights the corresponding project and its nodes. The renderer accepts the full existing visual-state vocabulary; this prototype does not invent execution or completion events or claim those states are newly wired to delegation. Ambient tracers are decorative activity, not evidence of work.

## Performance and recovery

One lazy scene chunk (~161 KB gzip) loads only when enabled. Pixel ratio is capped at 1.75, nodes use low-detail geometry, and there is no bloom, shadow map or camera drift. No React state updates occur per animation frame. Hidden windows skip GPU rendering; reduced motion renders a static frame and updates only on meaningful changes. A 250ms check while paused observes state changes without continuously rendering. RAF and timer handles are tracked separately and cleaned up, along with observers, geometry, materials and renderer resources.

WebGL initialization failure or context loss immediately restores the original SVG. Turning the preview off/on retries cleanly. Project text and interactions remain available during loading and fallback.

## Validation

Production TypeScript/Vite build passed. Browser fixture `hybrid-core-harness.html?run` passed 15 checks: existing constellation invariants; bounded Z; unchanged project hit paths; one canvas; all 64 fixture nodes; bounded ring count; project action; context-loss fallback; disable cleanup; recreate; reduced-motion pause/resume; hidden pause/resume; unavailable-WebGL fallback. Additional browser interaction confirmed speaking-state propagation and keyboard note activation. Desktop-size visual inspection verified the corrected Omega face orientation and visible edge-on ring geometry. Fixture data is explicitly synthetic and never enters project storage.

No sustained native GPU frame-rate benchmark or physical voice session is claimed. The 64-node fixture used roughly 162 draw calls in the inspected frame. The original SVG remains the default while the operator assesses depth, readability and responsiveness with actual project data. Browser proof is not native desktop acceptance.

## Next design pass

Operator review first: compare still-frame familiarity and 5–10 second depth impression, then assess labels and edge-on motion. Future polish can refine the Omega silhouette, segment materials, quieter connection contrast, and selective signal routing. Preserve current project map and the two-plus-one ring rule throughout.

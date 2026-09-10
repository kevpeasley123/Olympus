# Command art direction — milestone 1

## Scope and review sequence

The live application remains authoritative for project order, count, labels, data, actions, voice and model routing. The reference image supplies art direction only. Milestone 1 covers the environment, constellation enclosure and mode navigation. It does not install a desktop release or change product data.

| Phase | Files/components | Risk | Visual result / status |
| --- | --- | --- | --- |
| 0: audit | App, CommandInstrument, HybridCommandCore, hybridScene, commandMaterialStudy, BackgroundLayer, HeaderBar, ModeSwitcher, ChatPanel, AmbientDock | Read-only | Completed; findings below |
| 1: environment | BackgroundLayer.tsx, styles.css, assets/olympus-environment-v2.png | Low; raster composition affects text contrast | Same citadel, cleaner silhouettes and mist, subdued warm architecture; static backdrop |
| 2: constellation world | constellationField.ts; two integration points in hybridScene.ts | Medium; transparency and depth sorting | Dark rear atmosphere plus sparse cool boundary reflection and local amber center influence |
| 5: mode control | styles.css mode-switcher block | Low; labels and actions unchanged | One segmented dark housing; warm active boundary; visible keyboard focus |
| 6: console | ChatPanel/ModelSettings styling only, when reviewed | Low to medium | Next milestone; preserve the recently accepted header and input behavior |
| 3–4: ring and Omega | commandMaterialStudy.ts, hybridScene.ts | Medium; protected visual baseline | Deferred; preserve geometry, labels, two orbits and accepted speech signature |
| 7–8: rail and global hierarchy | ToolBelt/Quickbar styling, scene finish parameters | Low to medium | Deferred; preserve real integration actions and icon set |
| 9–10: camera and motion review | hybridCore.ts, ambientMotion.ts, state inputs | Medium | Keep current accepted values unless a later review demonstrates a specific need |

Each implemented phase is isolated: environment uses its own sibling asset/component, volume its own module, and navigation its existing CSS block. Pre-milestone source copies are under output/command-art-milestone-1/baseline. Those copies include earlier uncommitted interaction work; restoring from Git HEAD would incorrectly remove that earlier work too.

## Audit

- DOM/React: application grid, header/mode control, left tool/integration rail, footer, console/transcript, model menu and preferences.
- SVG: authoritative project hit paths and keyboard targets, note interaction overlay, day-rail marker and event annotations.
- WebGL 2 / direct Three.js: ring structure and smoked glass, extruded Omega, two inner orbits, speech trace, real 3D nodes and connections. React Three Fiber is not used.
- Canvas 2D: label and halo textures consumed by WebGL. There is one composited WebGL canvas, not a raster imitation of the interface.
- Camera: fixed shallow orthographic view; SVG uses the matching affine transform. Only the constellation receives plane-anchored perspective and pointer parallax.
- Depth: deterministic ID-based +/-34 node Z, real connection endpoints, shared depth target and orbital depth proxies. This milestone preserves the recently accepted 3.25 / 2.4375 degree-equivalent pointer response and damping.
- Lighting: hemisphere, directional, point light, PMREM environment, ACES tone mapping, transparent EffectComposer target, restrained bloom and output pass.
- Major knobs: hybridCore.ts (camera, layout, depth/parallax); hybridScene.ts (bloom, network, voice/orbit effects); commandMaterialStudy.ts (glass, labels, Omega, active and hover responses); constellationField.ts (new enclosure); ambientMotion.ts (state timing); styles.css (environment and DOM materials).
- Voice state comes from the existing shared realtime store and instrument event flow. The one-request reasoning selection is independent and resets through the existing router. Neither changed.
- Responsive sizing remains the existing grid and viewport-derived dial size, with aligned SVG targets. No reference-image dimensions are hard-coded.

## Environment asset

The prior raster contained baked-in holographic panels, labels and insignia. The new version preserves its mountain/citadel/causeway composition while removing that painted UI. The original asset is retained. The background is now static, as requested, with CSS tonal grading and a spatial vignette. No live controls were removed from the application.

Saved asset: src/assets/olympus-environment-v2.png.
Generation method: built-in image generation tool, editing src/assets/Olympus background asset.png.

Final prompt:

> Use case: lighting-weather and precise-object-edit. Asset type: background-only environment for the live Olympus desktop app. Edit target: the supplied existing Olympus background image. Preserve the same mountain citadel, Greek-inspired dark futuristic colonnades, bridge/causeway, platforms, cliff geometry, overall perspective and layout. This is the SAME environment, not new unrelated artwork. Remove all floating holographic UI panels, diagrams, ANALYTICS/OLYMPUS text, lettering, icon insignia and graphic banners, revealing plausible architecture or cloud behind them. No interface, no giant Omega, no command ring, no stars or added nodes, no HUD decoration. Refine the lighting toward cinematic twilight: rich dark navy/black stone and metal, crisp foreground structural silhouettes, cool desaturated mist separating near cliffs from distant mountains, subtle embedded warm amber architectural windows/lights. Light in distant clouds at right stays restrained and muted, not a bright sun or bright white wallpaper. Preserve detail without heavy blur, avoid over-saturation or glowing every edge. Keep the left-center area calm enough behind a circular interface. Strong dimensional atmosphere, premium calm engineered Olympus environment. Wide 16:9 composition, high resolution. Text: none.

## Constellation field

The backing follows the ring plane out to radius 191, inside the existing rail at 192. Blue-black atmospheric shading transitions over radii 72–191; alpha stays exactly 1 throughout the main portal to radius 155.5. Only the outer zone behind the ring architecture fades, using a smooth quintic taper to zero at 191. This replaces the opaque rear sphere whose silhouette stopped abruptly at the project opening. The backing uses custom alpha blending in the early opaque render queue so metal, linings and transparent glass all remain above it. The compressed front hemisphere retains very faint broad asymmetric shading that fades before its silhouette and a tight amber center response driven by existing core energy. Neither material writes depth, so the field does not hide real nodes or replace existing occlusion. Shared scene cleanup disposes both meshes' geometry/materials. There is no extra animation loop or React update per frame.

No nodes or edges are invented, removed, repositioned or relabeled. The browser main page has no Tauri vault graph and remains empty there. The existing 64-node fixture now offers a Show Olympus environment toggle for inspecting this treatment in context.

## Verification

- Production build passes (existing dependency/chunk warnings remain).
- All 42 renderer fixture checks pass: preserved node count/project hit geometry, two orbits, speech response/fade, parallax/return, context loss/retry, reduced motion and hidden-view scheduling.
- Mouse and keyboard switching through Command / Project / Research verified against actual mode state.
- Layout inspected at 1366x768, 1920x1080 and 800x900; mode housing, complete dial and console remain in the viewport. Narrow layout has no horizontal overflow. Viewport override reset afterward.
- Four pixel-level assertions verify opaque portal interior/opening, transparent exterior and a gradual composited outer taper. Samples across the twelve-o'clock project gap yield alpha 255, 244, 144, 24, 0 at radii 150, 162, 172, 182, 190; the sample span avoids the obliquely projected metal lip.
- Visually inspected transparent compositing in the full browser shell and populated material study; no square stage or background panel.
- These are browser and simulated-state checks. Real desktop vault data, microphone/audio behavior and backend requests were not exercised by this art pass.

## Review and rollback

Live browser shell: http://127.0.0.1:31429/
Populated fixture with environment: http://127.0.0.1:31429/material-study.html?environment

For a focused reversal:
1. Environment: restore BackgroundLayer.tsx and only its background CSS block from the baseline; the original asset is still present.
2. Field: remove the buildConstellationField import, construction and update call from hybridScene.ts; the independent module then becomes unused.
3. Navigation: restore only the mode-switcher CSS block from the baseline.
4. The fixture-only environment toggle is independent of the live application.

Do not restore the entire styles.css baseline after accepting later changes; reverse only the relevant block.

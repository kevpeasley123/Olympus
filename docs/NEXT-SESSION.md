# Release checkpoint: 0.15.0 (September 12, 2026)

The operator authorized committing, pushing and installing the current changes. Version manifests are 0.15.0 on `agent/curated-memory`. This checkpoint supersedes the uncommitted/uninstalled descriptions in the development notes below; consult the external receipt for actual push and installation completion, rather than inferring them from this source note.

- Typed chat can now receive concise spoken replies without microphone capture. The chat header's Text | Voice control persists the existing Auto Speak preference and stays synchronized with Voice Lab. Replay reconnects output independently; playback status, cancellation and failure recovery remain tied to transport events.
- Includes the earlier development-preview exception diagnostics and session handoff notes. The instrument's visual design is unchanged by this release.
- Release checks: production TypeScript/Vite build, all 76 voice protocol checks, typed-voice and existing voice UI fixtures, reply-mode synchronization/reload persistence, and diff whitespace passed. All 212 Rust tests passed (2 ignored). The real-vault assertion now checks that retained history is an actual source tail, allowing the intentional removal of the heading in long notes; no vault data or production loader behavior changed.
- Backup, build logs, verification and installation receipt: `../output/olympus-0.15.0-install/`. Preserve the 0.14.0 executable/MSI and database backup there. Live physical speaker playback is not established by the simulated checks.

# Typed chat replies with speech (September 12, 2026, development)

- Fixed the typed-send path that unconditionally stopped voice without requesting spoken output. Preferences > Voice Lab > Auto Speak now covers typed replies and microphone conversations. Typed replies open a receive-only Realtime connection, never request the microphone, and close after playback. The existing voice selection, summary/full-answer contract and common reasoning/history pipeline remain authoritative.
- Replay can open receive-only audio without an active microphone session. The console distinguishes capture from output, preserves Text labels for typed input, and reports completion, interruption or audio failure using transport events. Backend prompts no longer imply that producing prose activates settings or proves playback succeeded.
- The chat header now includes a compact Text | Voice reply-mode control with an amber selected state. It edits the existing persisted Auto Speak preference, stays synchronized with Voice Lab, and is disabled until settings hydrate. Text stops current automatic speech; Voice preserves written answers and does not activate capture or replay earlier audio. Icons collapse at narrow console widths while labels remain visible.
- Toggle verification: actual Command-page layout, synchronization in both directions with Voice Lab, browser reload persistence, and the typed-voice UI fixture's playback-interruption check passed. The original enabled preference was restored after verification. Production TypeScript/Vite build passed; no backend changes were needed for the toggle.
- Wait for data-channel readiness before sending the first reply. Stop, Interrupt, new typed messages, preference changes and disabling Auto Speak suppress stale output. Persist the initial assistant message before recording playback metadata. No new dependency, API model, database migration or preference default.
- Verification: production TypeScript/Vite build, 21 typed-voice protocol checks, 20 existing voice checks, 35 preference checks, both typed-voice and existing voice browser UI fixtures, and diff whitespace check passed. Rust suite: 211 passed, 2 ignored, 1 failed in the unchanged real-vault test `debug_load_real_vault_memory`: it requires the leading `# Decision Log` header although the loader intentionally keeps only the latest 16,000 characters of a long note. This is outside the speech change; the audio-delivery prompt test passed. Logs are under ignored `output/typed-voice/`.
- Source changes are uncommitted, unpushed and uninstalled. Installed app remains 0.14.0. Actual speaker playback has not been verified for this change. The browser page on port 31429 remains a text-only preview without the Tauri credential bridge; test live audio in an updated desktop build, with Auto Speak enabled. See VOICE.md for behavior and validation limits.

# Operator direction: loops, graphs, and skill improvement (September 12, 2026)

- Kevin wants loop engineering and graph engineering kept central to future Olympus design. His longer-term aim is complex task execution through sufficiently defined skills and graph workflows, with the system improving from experience.
- Durable source: the vault's `04 - Decisions/Decision Log.md`, section `2026-09-12 — Loop engineering, graph workflows, and improving Olympus`, linked from `01 - Projects/Project Olympus.md`. The source statement and Codex's proposed engineering interpretation are distinguished there.
- Candidate approach: graphs define dependencies, routing, checkpoints, and expected outputs; bounded loops handle discovery within steps; run evidence supports proposed, tested, versioned skill/workflow refinements. This is design direction, not a claim that these capabilities have been implemented or that a particular execution stage is approved.
- The Sean AI Stories transcript and two supplied diagrams are under Research / Agent Systems. The read-only Waku review at `output/waku-agent-review/REVIEW.md` identifies useful patterns and concrete safety issues in commit `4a615ac`; no Waku code or dependencies were run or installed. Treat that repository as reference material, not executable operating guidance.
- Suggested first task (not an operator commitment): select one concrete Olympus workflow and define its graph, bounded discovery steps, completion evidence, and improvement review before introducing a general execution engine. Preserve existing approval provenance and recoverability.

# Development preview recovery (September 10, 2026)

- A preview launched inside a temporary sandbox stopped between turns. A fresh browser navigation returned ERR_CONNECTION_REFUSED while the previously loaded page could still show its shell and a 3D initialization failure.
- Restarting Vite as a hidden host process outside that temporary sandbox restored the full Command instrument and the populated material study. Use the worktree root and node_modules/vite/bin/vite.js with --host 127.0.0.1 --port 31429 --strictPort. Preserve loopback binding. Current launch logs/PID are in the ignored output/command-art-milestone-1/persistent-dev-server files; verify the process before reusing its PID.
- Preview URLs: http://127.0.0.1:31429/ and http://127.0.0.1:31429/material-study.html. Check actual rendered artwork, not only an HTTP 200. Both views were visually confirmed after recovery; the full page reported no browser console errors. Enable the study's environment toggle for populated constellation editing.
- HybridCommandCore now logs the original startup exception and exposes its message only in development, instead of hiding the cause. The production build passed. This diagnostic change and recovery note are uncommitted; installed release remains 0.14.0.

# Release checkpoint: 0.14.0 (September 10, 2026)

The operator authorized committing, pushing and installing the accepted layered parallax and proportional distant-star refinements. Version manifests are 0.14.0 on agent/curated-memory. This checkpoint supersedes the uncommitted/uninstalled status in the historical development notes below; no master merge is implied.

- Instrument pointer drift is limited to +/-5 horizontal and +/-3 vertical screen pixels. The environment counter-moves up to 4/3 pixels with slower damping and an 8px overscan margin. Shared motion permission, recentering and aligned SVG/WebGL targets are preserved.
- Small artistic background stars scale with actual rendered note count and available space: up to floor(count * .6), capped at 72, with 38 stars in the 64-node material study. Stable placement, three size tiers and rear depth add texture without changing real graph data or interactions.
- Verification: production frontend and Windows MSI build passed; 211 Rust tests passed (2 ignored); all 58 renderer checks passed on the final art source, and the populated material study was visually inspected. Live backend replies/audio are not claimed by these UI checks.
- Release logs, database/app backups, verification and installation receipt belong in ../output/olympus-0.14.0-install, outside the repository. Read receipt.json and the installed executable version for actual push/install status; this source checkpoint alone does not prove installation. Private data and review artifacts remain excluded from Git.

# Proportional distant stars (working tree after 0.13.0)

- Added artistic background points behind the real constellation in the existing network pass. Three small size tiers and restrained cool brightness create a finer star-map texture. Real note coordinates, graph topology, labels, ownership, counts and interactions stay authoritative.
- Density is derived from the number of actually rendered notes: floor(count * .6), capped at 72. The 64-node study receives 38 points; eight nodes receive up to four; empty graphs receive none. Deterministic node-seeded candidates favor open space around the rendered nodes, avoid the Omega/project rim, and skip crowded gaps. Input order does not reshuffle the layer.
- The stars sit at Z -36 to -48, behind the real nodes, with existing perspective/parallax/depth handling. One instanced draw uses a small generated point texture. No independent timers, fabricated links or click targets are added; geometry, material, instance buffers and texture are disposed during existing scene cleanup.
- Latest drift request: instrument +/-5 horizontal and +/-3 vertical pixels; background counter-motion +/-4 horizontal and +/-3 vertical pixels. Existing damping, overscan and reduced-motion handling are preserved.
- Verified production build, diff whitespace check and all 58 renderer checks, including sparse/empty/crowded density, stable placement, depth/clearance, size tiers and preserved real-node counts. Populated material study visually inspected with 64 real nodes and 38 artistic stars. The fixture logged a createRoot warning during hot reload; a fresh reload renders correctly. Development changes remain uncommitted/uninstalled after 0.13.0.

# Layered scene parallax (working tree after 0.13.0)

- Pointer movement across the page gently translates the complete Command dial by up to +/-5 horizontal and +/-3 vertical screen pixels. The background counter-moves by up to 4/3 pixels with slower spring damping. The existing constellation depth/parallax remains independent.
- useSceneParallax shares pointer/lifecycle handling with separate instrument/background profiles. CSS translation on the shared WebGL/SVG wrapper preserves dial scale, labels, project/note targets, portal containment and camera. The background has an 8px overscan margin to prevent exposed page edges; its vignette and the interface stay fixed. There are no React state updates per animation frame or additional WebGL scenes.
- Page exit, window blur and resize recenter smoothly. Inactive Command stops the dial's spring; the background remains available in other modes. Hidden view and reduced motion remove listeners and immediately stop/reset both layers; touch does not drive either effect.
- Production build and all 51 renderer checks pass, including background counter-motion, edge coverage, recentering and reduced motion. Full-page pointer movement visually inspected with opposite shifts confirmed on both layers. One existing constellation return timing check failed under load in the earlier pass and passed on rerun; its behavior was unchanged.
- This refinement is available in the development pages; it has not been committed, pushed or installed. Installed release remains 0.13.0.

# Release checkpoint: 0.13.0

The operator authorized committing, pushing and installing all accumulated app changes. This release contains the Command environment and mode housing, broad opaque portal/falloff, glass-edge repair, soft project hover, refined day-rail tracker, stronger constellation parallax, and console model/preferences placement described below. Version manifests are 0.13.0 on agent/curated-memory; no master merge is implied.

Local output/profile-import copies and rollback artifacts are excluded from Git. The operator profile itself was installed in the local vault separately. Release backup, verification and installation receipt: ../output/olympus-0.13.0-install. Read that receipt and the installed executable version for actual installation status; this source checkpoint alone does not prove installation.

Release verification: production frontend and Windows MSI build passed; 211 Rust tests passed (2 ignored); model-routing controls and all 16 console checks passed. All 42 renderer checks passed on the final art source. Live audio/backend replies are not claimed by these simulated UI checks.

# Broad portal falloff (pre-release development)

- Supersedes the tight opaque rear-sphere boundary below. The backing now follows the ring plane out to radius 191 (inside the existing rail at 192), with a long blue-black luminance transition from radius 72 outward.
- Main space stays fully opaque through radius 155.5. A smooth quintic alpha taper spans 155.5–191 behind the ring architecture, with no sharp threshold or new rim. The backing renders before metal/linings and transparent glass, without writing depth; existing curved front shading and core response remain.
- Only constellationField.ts changed in production. Ring/glass geometry, labels, constellation, Omega/orbits, lighting and page UI are preserved. Pre-pass source: output/command-art-milestone-1/baseline/constellationField-before-wide-falloff.ts.
- Added composited-pixel coverage at the project opening and through the outer gap: alpha 255, 244, 144, 24, 0 at radii 150, 162, 172, 182, 190. Main portal stays opaque and the outer fade completes within the rail.
- Production build, diff whitespace check and all 42 renderer checks pass. Full Command and populated environment study inspected in browser. A reduced-motion timing check failed during concurrent preview reloads and passed on the isolated rerun; no lifecycle code changed. No release commit/push/install in this pass.

# Portal boundary refinement (working tree)

- Removed the pronounced grazing-angle rim: reflection strength .14 -> .012 with broad shading that fades before the silhouette, instead of an edge band.
- Field radius 155.5 seats its opaque boundary within the existing ring lip; only the portal changed. Deeper edge color falloff preserves subtle atmosphere without alpha fading or scenery bleed-through.
- Omega illumination, constellation topology/depth/parallax, repaired glass, project geometry, UI and background remain unchanged. Previous opaque field source retained in output/command-art-milestone-1/baseline/constellationField-opaque.ts.

# Portal and glass-edge correction (working tree)

- The constellation interior is now opaque blue-black space: rear hemisphere outputs alpha 1 with no blending. Color falloff supplies depth; opacity does not fade into the environment. Radius 153 fits inside the existing project-ring opening. Outside the aperture, the WebGL canvas remains transparent.
- Glass repair: the dark lining follows the existing pane footprint at Z=-3.25 (behind labels); a narrow metal lip closes the existing mounting-frame perimeter at Z=-1.7. No project position, label, hit path, pane dimensions or outer-ring geometry changed. The quiet rim has a modestly higher minimum visibility; accepted warm hover remains soft.
- Renderer harness now reads actual composited pixels to assert fully opaque portal samples and fully transparent outside-canvas samples. No sample graph was added to the live app.

# Command art direction: first milestone (working tree)

See COMMAND-ART-MILESTONE-1.md for the audit, phased plan, asset provenance/prompt, verification and scoped rollback. The environment, constellation enclosure and mode-selector styling are implemented. No release install/commit/push performed for this milestone. Earlier accepted working changes below remain intact.

- Environment: sibling image preserves Olympus citadel composition, removes baked-in HUD, adds warm/cool atmospheric depth; static CSS compositing replaces background drift.
- Field: rear atmosphere plus faint asymmetric curved reflection; existing nodes, connections, Z assignments, camera, parallax, ring/Omega and voice behavior preserved.
- Navigation: existing actions in one dark segmented housing with a restrained amber active boundary.
- Populated material study now has an environment toggle. Its nodes remain labeled fixture data; the live browser fallback does not invent a vault graph.

# Working changes: command interaction refinements (September 10, 2026)

These changes are implemented in the working tree after the installed 0.12.0 checkpoint below; they have not been committed, pushed, or installed.

- Project hover adds a separate soft orange perimeter glow (feathered shader, replacing the initial crisp line), restrained warm glass emission and localized label brightness. Exponential transitions settle in approximately 180 ms entering / 225 ms leaving. Active styling remains independent; no geometry or depth translation changed.
- Console model selection and the existing preferences control now share the status header. The voice notice stays below that header. The input no longer has a standalone model configuration row.
- Compact custom menu uses SOL / ASTRA / CLAUDE (existing explicit comparison route). Backend catalog and shared one-request state remain authoritative in desktop; selection resets to Sol on consumption. Realtime remains separate, with no AUTO. Browser-only options are explicitly labeled as preview.
- Verified: production build, model-routing fixture (catalog, friendly names, one-shot routing/reset, Escape focus and diagnostics), all 16 console fixture checks, and visual hover/menu/preferences inspection in the full-page browser preview. The focus-dependent console fixture requires a visible browser tab. No live backend reasoning or voice call was made.
- Outer day-rail marker refined into one contained tracker: inset bright core, thin housing, soft local halo, 24-screen-pixel fading wake and tight rail reflection. Existing time-of-day position, marker radius and ring geometry preserved. This is the DayArc current-time marker, not a new autonomous scanning animation. Production build and full-page visual inspection pass; no browser errors.
- Latest constellation adjustment: pointer parallax increased a further 30%, from 2.5 / 1.875 to 3.25 / 2.4375 degrees equivalent. Depth, fixed camera and response damping unchanged.
- Full development preview: http://127.0.0.1:31429/ . Material study remains available at /material-study.html.

# Current checkpoint: 0.12.0 (September 10, 2026)

This section supersedes the historical checkpoint below. The operator requested saving, committing, pushing the current branch, and installing all accepted changes.

- Release manifests: 0.12.0. Working branch: agent/curated-memory. Do not infer a master merge.
- Constellation: stable ID-based Z distribution over +/-34 units; unchanged base X/Y coordinates and topology. The 64-node study has 11 foreground, 13 rear and 40 middle nodes. Continuous depth response, instanced soft halos, 3D connections and a network-only orbital depth pass.
- Camera remains orthographic. Constellation-only shader perspective preserves the surrounding instrument; pointer parallax is now 2.5 degrees horizontal and 1.875 vertical equivalent, with smooth return to rest.
- Omega speaking scale gain: .2184 (20% above the prior .182). Timing and resting scale preserved.
- Accepted voice visual: separate localized amber peaks rise from the existing orange orbital and travel around it. Both original rings stay intact. Final peak amplitude: 28.6 (30% above 22); travelSpeed .60. Existing voice energy drives height and brightness with damped response/fade.
- Rejected alternatives: a standalone third waveform ring and speech light bands within Omega. Both were removed. Do not restore them.
- Existing glass labels, ring lighting, geometry and state behavior remain as described below.
- Verification: production build and 38 browser fixture checks pass. Simulated speaking and pointer response were visually inspected. Real-data desktop graphics, live audio, and acoustic response are separate acceptance evidence, not established by fixture checks.
- Installation backup and receipt directory: ../output/olympus-0.12.0-install. Read its receipt and the installed executable version to establish actual installation status; preparing this release does not itself prove installation.

---

# Olympus — next-session handoff

Updated September 9, 2026. This is a checkpoint, not authorization to invent another visual pass.

## Start here

Read `AGENTS.md`, `OLYMPUS-MANUAL.md`, `ARCHITECTURE.md`, and `CLAUDE.md`. Inspect the current code and Git status before editing. Historical handoffs contain superseded optional-3D guidance; the current command core is 3D-only. Ask the operator which element to work on next if no new task accompanies this handoff.

## Workspace and Git

- Working repository: `C:\Users\kevpe\OneDrive\Documents\New project\Olympus Memory Worktree`
- Current branch: `agent/curated-memory`
- Remote: `https://github.com/kevpeasley123/Olympus.git`
- Visual refinement checkpoint: `92f7967` — Refine embedded glass labels and contained ring illumination. Successfully pushed to `origin/agent/curated-memory`.
- Previous local release: `16f3868` — 0.11.2, included in the pushed branch.
- Main checkout: `C:\Users\kevpe\OneDrive\Desktop\Projects\Olympus`. It was not advanced during this release; last observed local master was `8731ef7`. Recheck before merging.
- The successful push targeted the current branch only. Do not claim master was updated. Earlier master/remote push attempts were rejected by automatic approval review; the operator subsequently renewed the push request and the branch push succeeded.
- This handoff is committed separately after the visual checkpoint.

## Installed versus development

Installed executable: `C:\Program Files\Project Olympus\project-olympus.exe`, version **0.11.2**, built from the release source at `16f3868`. It was installed and launched successfully. Subsequent refinements at `92f7967` are NOT installed. Version manifests still say 0.11.2; bump the version for the next packaged release.

Database: `C:\Users\kevpe\AppData\Roaming\com.projectolympus.commandstation\olympus.sqlite`.
Pre-install SQLite backup: `C:\Users\kevpe\OneDrive\Documents\New project\output\olympus-0.11.2-install\before.sqlite`. Integrity check passed. A post-install comparison found changes only in settings/tool_states after graceful shutdown; other tables matched. Do not overwrite current user data with this backup.

Cargo output is configured in `.cargo/config.toml` as `C:/Users/kevpe/dev-target/olympus-memory`. The 0.11.2 MSI is under `release/bundle/msi` there. `scripts/install-olympus-local.ps1` requires a clean committed checkout and a newer version unless explicitly reinstalling. Close the installed app gracefully before installation. Backend/API keys remain in Rust; never print `.env` contents.

## Vision and working style

Olympus is a private, local-first command station and thinking partner working toward the operator's JARVIS vision. Preserve Git truth, vault intent, durable conversation state, and explicit approval boundaries. Current work is a series of tightly scoped artistic refinements, not a conversational/model architecture rewrite.

The operator prefers concrete implementation and visual verification, with no repeated permission requests for already authorized reversible changes. Keep each pass focused. Do not change unrelated geometry, camera, glass, states, or composition. Do not claim a visual target has been fully achieved just because compilation passes.

## Preview: important distinction

- Populated material study: `http://127.0.0.1:31429/material-study.html`.
- Main browser shell: `http://127.0.0.1:31429/`.
- Regression harness: `http://127.0.0.1:31429/hybrid-core-harness.html?run=check`.
- Start if needed: `npm run dev -- --port 31429` from the working repository. A server process was running at handoff, but verify rather than assume it survives.
- The study supplies eight project fixtures and 64 constellation nodes, with a state selector. It does not write real projects.
- The plain browser shell lacks the Tauri vault backend, so its graph can have zero nodes. This is not evidence that constellation rendering was removed.
- The operator repeatedly remained on the wrong tab after a new tab was opened. Use browser inventory, navigate the existing visible tab when appropriate, then verify its URL and screenshot. Keep the populated study available for artistic review.
- Installed desktop uses real project/vault data. Do not substitute fixture claims for desktop validation.

## Current visual direction

- Original approved Omega silhouette, 3D finish; two continuous inner orbitals.
- Camera: approximately -20 degrees sideways and -9 vertically; do not reset.
- Study apparatus scale 1.4; live shell scale 0.896. Inner core scale 0.72.
- Smoked-glass project cassettes with independent frames, narrow recessed end caps, existing order and placement.
- Dark machined primary outer chassis. Negative space between glass bars and the outer energy channel is intentional.
- **No carrier/filler band and no secondary reflective rail** in that gap. Earlier attempts at continuous and segmented mounting supports were explicitly rejected and removed. Do not reintroduce them to make the modules look mechanically connected. Current preference is distinct, almost-floating cassettes.
- Decorative backplate ticks/arcs, inactive pane light strips, redundant perimeter tubes, and the 180 old decorative ticks have been removed. No new micro-dashes, pixels, circuitry, or outlines.
- Functional day marker and active-project accent/tracer remain; long SVG elapsed-day perimeter stroke was removed.
- Energy layout: four amber arcs at 12–48, 91–132, 196–224, and 280–311 degrees; two cooler arcs at 153–173 and 331–351. All use the existing recessed channel.
- Latest light shader: narrow core, soft shoulders, compact asymmetric end fades, broad static asymmetric bright regions. Amber is softer; cool-white narrower with less spill. Existing point lights align with the stronger region of each source and have tightly bounded range. No blinking or new animation. Preserve dark dominance and open space.

## Embedded project labels

Visible labels are now a high-resolution shared canvas texture on a 3D plane at Z=-2, behind the front glass (front approximately Z=-1) and ahead of backing (about Z=-12). A separate faint diffusion texture sits at Z=-2.2. Both render before the glass; the lettering stays sharp while diffusion is separate.

The atlas uses JetBrains Mono 500, curved character placement, existing active/inactive sizes and capacity truncation, and warm amber/gold. The renderer awaits the font; the component imports it so the standalone study does not silently use a fallback font. Textures are disposed with the scene. `commandLayout` now includes `labelScale` for equivalent sizing. Old visible SVG text is hidden; existing project hit targets and accessible project buttons remain.

## Relevant files

- `src/services/commandMaterialStudy.ts`: materials, primary chassis, energy-source shader/local lights, glass panes, frames/end-cap geometry, embedded name atlas, core response.
- `src/services/hybridScene.ts`: Three renderer/composer, constellation, orbitals, state animation, render-loop pause, sizing/disposal. Minimum render pixel ratio is 1.5, capped at 2; this costs more fill rate on 1x displays.
- `src/services/hybridCore.ts`: shared layout, label scale, camera, core scale.
- `src/components/panels/HybridCommandCore.tsx`: asynchronous scene lifecycle, first-painted scene swap, font readiness, context error reporting.
- `src/components/panels/CommandInstrument.tsx`: integration, aligned interactive SVG overlay, retry action. No legacy Omega/orbitals fallback.
- `src/App.tsx`: Command stays mounted while Project/Research are shown; hidden scene rendering pauses.
- `src/components/panels/ProjectRing.tsx`: original label sizing/paths, hit targets, project semantics.
- `src/components/panels/DayArc.tsx`: functional day/work markers.
- `src/styles.css`: live/study sizing, transparency, hidden SVG label rule.
- `src/hybrid-core-harness.tsx`: fixture and 28 regression checks; `material-study.html` exposes the study.

## State behavior to preserve

- Idle: deep orange breathing halo and irregular restrained heartbeat.
- Listening: two orbitals slowly open toward face-on circles; outward waves once per second.
- Thinking: **14 times normal orbital speed** (latest approved increase).
- Speaking: Omega scales with supplied voice amplitude; study uses simulated speech amplitude.
- Executing: continued rotation and approximately five white constellation transmissions per second, plus execution inputs where available. Study execution buttons are simulated.
- Error: blood-red Omega and the previously approved error sequence.

## Validation and limits

- Repeated `npm run build` (TypeScript + Vite) passed through the final refinement. No lint script is configured.
- 28 browser harness checks passed at the 0.11.2 release checkpoint: first render, retained constellation/hit geometry, two rings, context loss/retry, unavailable WebGL, reduced motion, and hidden-view pause/resume.
- Later embedded-label and lighting refinements were build-checked and screenshot-reviewed in the populated study; the complete 28-check harness has not been rerun after those changes.
- Browser live-shell navigation previously confirmed a retained canvas across Command/Project/Research transitions. Graphics failure now shows retry, not legacy artwork.
- Full real-data desktop and voice interaction testing of the post-install refinements remains outstanding.
- Build emits existing dependency warnings about buffer externalization, eval in gray-matter, and chunk size. Rust release previously emitted an unused ContentBlock.text warning.

## Next actions

1. Confirm this branch/checkpoint and inspect the current populated study.
2. Continue only the next operator-requested refinement; do not resurrect discarded carriers or decorative details.
3. Before another release, rerun the renderer harness, build, and validate labels/graph/navigation in the desktop runtime. Do not claim browser fixture checks cover real vault or voice behavior.
4. When asked to install, bump versions consistently, commit, package, back up SQLite, install, and verify the executable version. Push/merge to master only with appropriate explicit target authorization and a clean checkout.

## Suggested prompt for a fresh chat

Continue Olympus from `docs/NEXT-SESSION.md` in `C:\Users\kevpe\OneDrive\Documents\New project\Olympus Memory Worktree`. Read `AGENTS.md` and the referenced project guidance. Verify the current Git state and inspect the populated material study before editing. Preserve the accepted design and wait for my next focused refinement request.

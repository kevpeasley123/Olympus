# Canyon cleanup implementation plan
> Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Realize the approved restrained canyon cleanup.
**Architecture:** Preserve Three.js scene, React controls and telemetry services. Fit the existing scene to a responsive rectangle and reserve separate space for controls and readable labels.
**Tech Stack:** Existing React, TypeScript, Three.js and CSS; no dependencies.
**Spec:** ../specs/2026-11-04-canyon-cleanup-design.md

## Global constraints
Preserve current avatars, canyon, console, source-backed telemetry and provider gates. Preserve all pre-existing uncommitted work. Work directly in the existing preview feature checkout with original-file backups because the requested preview includes dirty work from other sessions; no blind commit or reset.

## Review focus
- Short windows: labels and control bounds remain separate.
- Narrow stages: camera fits figures without distorting the Omega.
- Active missions: session labels stay readable; details remain reachable.
- Missing usage: neutral track cannot imply an actual allowance.
- Keyboard/reduced motion: existing selection and focus remain functional.

## Task 1: Scene and control spacing
- [x] Inspect baseline screenshot and current layout.
- [x] Update pantheonFigureState.ts, hybridScene.ts and scene CSS; preserve current models.
- [x] Refine engineSwitch.css and add existing provider icons in CommandInstrument.tsx.
- [x] Retain all usage data and controls; restyle dock via UsageSummary.css.
- [x] Run focused figure, voice, usage, provider checks and production build.
- [x] Capture and inspect live flagship across 1440x960, 1280x800, 1280x720, 1920x1080 and 1000x900; correct collisions.
- [x] Run full visual review, review exact delta against backups and document results.

Ruling: this is a cosmetic refinement under AGENTS.md's lightweight workflow. Use visual geometry and existing functional tests rather than tests that mirror CSS constants. No new approval checkpoint or automatic commit of mixed dirty files.

Completed evidence: ../../reviews/2026-11-04-canyon-cleanup.md. No source commit: mixed pre-existing work remains intentionally unstaged. No deferred review findings.

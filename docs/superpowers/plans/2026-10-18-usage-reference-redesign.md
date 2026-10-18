# Usage reference redesign execution record

Approved scope: the two Downloads reference PNGs, compact 320px outside chat and expanded modal; no unrelated redesign, provider calls or billing-gate changes.

References visually inspected: ChatGPT Image Oct 17, 2026, 06_07_58 PM.png (compact) and 06_08_09 PM.png (expanded). Expanded PNG required a JPEG inspection copy after transport failures.

Implemented: grouped glass widget, colored bars and SVG rings, branded Claude/ElevenLabs icons and a code icon for Codex, actual currency, neutral unknown, explicit telemetry states, source/freshness details, native modal with Tab containment/Escape/focus restoration, responsive scrolling. No animated effects were introduced.

Ruling: reference-only plan names, unlimited allowances, Gmail quotas, extra services, decorative trends and refresh claims are omitted because no production source supplies them. Populated data stays in the isolated harness.

Validation: modal acceptance first failed for missing Expand. Focus-trap check then reproduced a Tab escape and passed after explicit wrapping. Final focused browser checks cover 1440px, 1280x800 and 420px, unknown/stale/loading/failed/unsupported/disconnected, USD, reduced motion, close/Escape and focus. Build passes with existing large-chunk warning. Multiple screenshot passes exposed and corrected percent-sign layout, generic icons and Windows text encoding. Final unknown and short-window expanded screenshots visually inspected. Reviewer compact-status finding and tooltip-window mismatch corrected; reviewer could not reread host fixes during transport outage.

Evidence: output/usage-redesign/ and output/usage-redesign-test.txt. Full visual regression was interrupted by host transport failures; consult output/usage-redesign-full-visual-final.txt for exact completed scenarios. Do not claim a complete green regression from partial logs. No native WebView2 or real-provider verification.

Library delivery: compact libfile_4498a796a78c81918f2b98795f1d1490; expanded libfile_a4b5bd456d088191a53831b6c90f1881. Upload succeeded; Windows extended-attribute metadata is unsupported by the supplied helper.


## Final refinement and verification
Full regression completed: 21/21 captures, 14 functional checks and 22 Organizer checks passed (output/usage-redesign-regression.txt). The process exited; no run remains unowned.

Parent visual feedback addressed after that full run: explicit --font-sans on all component text (computed-style assertion in harness and Command); readable supporting typography; localized provider lighting; content-driven card heights and bounded service-card width; one telemetry status per unknown card with subscription sign-in explicitly separate; fresh versus stale fixtures isolated in usageFixture.ts. Fresh fixture timestamp was stabilized after a visual check exposed re-render timing drift. Synthetic modal globally labelled.

Post-refinement checks: test-usage-redesign covers 1440, 1280x800, 420, loading/error/stale/unsupported/disconnected, currency, focus trap/restoration, Escape and reduced motion; actual Command captures/checks cover fresh and unknown 1440x960, stale 1280x800 and fresh narrow 900x900. Unit/static tests, guidance docs and build pass. Full regression was not repeated after these final focused refinements; affected checks were repeated. No native WebView2 verification.

Final actual-scene captures visually inspected; compact compared side by side with original. Library uploads confirmed:
- fresh compact: libfile_8749d5370d70819198a532cd5cf96eb3
- fresh expanded: libfile_aedbff982c4881919f43d68815608113
- unknown compact: libfile_1228e701b49081919d016285b4c84c79
- unknown expanded: libfile_a353a60ad95881918d63327949f73992
- compact comparison: libfile_a2218e543fd081919c5cd33cc29ae2e2

No live providers, production data, billing gates, commits, install or push changed.

# Engine status and usage implementation plan

**Goal:** Make engine discovery inspectable and show honest usage availability without enabling subscription generation or paid overage.

**Architecture:** Extend the existing Rust engine inspection and frontend Preferences panel. Add a collapsed usage disclosure to the Mission brief, using a small provider-specific snapshot. No new provider calls, credentials, database migrations, or routing framework.

**Spec:** Kevin's October 18 request: resume subscription-backed conversation through either engine, with visible limits, voice allowance, remaining credits and YTD usage/spend where supported. This first slice supplies discovery, eligibility and truthful unavailable states; inference remains blocked.

## Constraints and review focus
- Work only in the isolated clone at master 218e6e09.
- Explicit executable overrides must fail closed, never silently select a different installation.
- A subscription login does not prove paid overage is disabled; backend execution must refuse unknown eligibility.
- Unsupported version capabilities remain unknown. CLI inspection must drain pipes and enforce a timeout.
- Preserve units, time windows, account versus Olympus scope, source and freshness. Missing values must not become zero.
- No provider balance fixtures in production, no voice account calls, no generation or installation.

## Tasks
1. Add failing tests for executable selection, desktop discovery, version capability recognition and subscription-only billing refusal. Extend engines.rs and the shared Claude resolver; run Rust focused tests offline.
2. Add tests for missing/invalid usage, independent periods and units, and stale snapshots. Implement services/usage.ts and extend services/engines.ts.
3. Add UsageSummary beneath CommandBrief, retain existing voice-session usage separately, and improve EngineSettings with executable selection guidance and explicit billing state. Use existing colors, typography and disclosure pattern; no animation.
4. Add an isolated synthetic harness and browser checks for unavailable, stale and fixture metrics; inspect narrow/wide screenshots. Run TypeScript/Vite build, Rust offline suite, focused frontend tests and existing visual regression where available.
5. Update engine documentation and handoff with verification limits. No merge, push, installation or production data changes.

No new approval is requested: the bounded implementation and this placement are already authorized by the delegated task.

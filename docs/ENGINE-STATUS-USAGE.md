# Engine status and usage

This bounded slice inspects installed engines and displays account telemetry availability. Provider account-usage adapters remain unwired. A later offline-tested Codex conversation adapter is described in [Subscription conversation](SUBSCRIPTION-CONVERSATION.md); live generation stays blocked.

## Discovery and eligibility

Preferences > Subscription engines checks the executable, version and CLI sign-in. Codex checks an explicit `OLYMPUS_CODEX`, PATH, npm, then the desktop-managed `%LOCALAPPDATA%/OpenAI/Codex/bin/<build>/codex.exe` directories. Multiple desktop installations require an explicit executable rather than guessing which is current. Claude uses `OLYMPUS_CLAUDE_CODE`, native PATH, the native install location, then npm. The native PATH executable can differ from the PowerShell `claude` shim.

An explicit override must name an existing absolute file; a bad override never falls back. Overrides are environment configuration, not new persisted credentials or settings. The selected path and version are visible. Capability claims are limited to CLI-help versions inspected in the Windows spike; other versions are labelled unverified. Advertised streaming, schema output and ephemeral sessions do not establish successful live behavior.

Sign-in and billing eligibility are separate. A subscription can allow extra paid usage after its limits. This slice has no supported proof that overage is disabled, so subscription generation remains blocked. The existing Claude delegation gate also refuses launches, including resumes, while eligibility is unknown. Existing explicit API conversation routes are unchanged. No UI checkbox can grant billing eligibility and no automatic fallback, refill or purchase is added.

## Usage surface

Command has a compact 320px Usage widget above and outside the chat console. Expand opens a dark glass modal with two semantic groups: Models & subscriptions and APIs & services. Explicit capabilityCategory controls placement. The compact view selects the first valid percentage window; its tooltip identifies the window. The expanded view names all supplied windows, their units, periods and reset dates. Reported percentage allowances use remaining bars and rings. Currency balances display actual currency; credits retain their unit. A balance alone never supplies a percentage denominator.

Unknown allowances render neutral dashes without empty progress tracks or numeric accessibility values. Disconnected, unsupported, loading and failed states are distinct. Failed checks may retain a supplied last-known snapshot, explicitly labelled stale. Readings older than five minutes are marked stale. Source, scope, observation time and any supplied YTD values live in the expanded view. No refresh control or invented trends, plan names, unlimited allowances or service quotas are offered.

Account telemetry is not connected. Production Codex, Claude and ElevenLabs therefore show no fabricated numbers or reset dates. Populated and failure-state data exist only in the isolated engine-usage and Command test harnesses. The widget makes no provider calls. Existing Voice usage remains a separate current-app-run ledger.

The native HTML dialog traps keyboard focus, closes with Escape or Close and restores focus to Expand. Its content scrolls on short/narrow windows. The design uses static CSS/SVG with reduced-motion protection. Browser verification does not establish native WebView2 behavior.

Future adapters may use supported Codex account-limit reporting and ElevenLabs subscription/analytics endpoints. Claude quota/overage availability must be established through supported interfaces. Unknown account-wide data must stay unavailable; local receipts must not be relabelled as account-wide totals.

## Management paths

Expanded Usage provides Manage subscriptions and Manage APIs. Subscription management reuses the existing EngineSettings selector and discovery display, but opening it or its disclosure does not inspect engines. Check again is explicit. Subscription selection is session-only; billing and isolation remain blocked.

API management explains authentication, costs and verification for ElevenLabs, Gmail and API model routes. Check local configuration reads only the existing local status commands, never a provider health check or account balance. The existing targeted Preferences section handles setup. Back or Escape returns to the selected service and retains inspected evidence. Usage owns global shortcuts while modal and restores keyboard focus on exit.

Add service leads to the existing Armory resource intake and preserves its draft. It records integration material; it is not an installer, account connector or executable tool registry. Opening management performs no automatic inspection, configuration write or external request. Provider account links and setup actions are deliberate user actions.

## Verification

Run `node scripts/test-engine-usage.mjs` and `node scripts/test-engine-usage-browser.mjs`, `node scripts/test-usage-redesign.mjs`, `node scripts/test-usage-management.mjs` and `node scripts/test-usage-management-handoffs.mjs`, then `npm run build`. Management browser scripts use the isolated loopback Vite preview on port 31426. The browser script starts an isolated Vite server and uses synthetic IPC only; screenshots go under `output/engine-usage/`. The fixture page is `engine-usage-harness.html`; it is not part of the production build. Rust engine tests cover billing refusal, override precedence, desktop discovery and version capability boundaries.

Native UI, live generation, inference cancellation, real limit-hit streams and account-usage adapters require separate acceptance. No model request is needed to run the focused tests.

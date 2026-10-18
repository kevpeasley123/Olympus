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

## Explicit account refresh (development follow-on, not installed)

`account_usage_read` reads one fixed provider at a time. Usage Refresh starts
independent reads; there is no mount timer or automatic retry. Errors keep the
last successful observation and timestamp, with a failed status. No dollars or
YTD totals are inferred from characters, credits, or tokens.

- Codex uses only `app-server proxy` to an existing daemon, initializes the
  protocol, and requests `account/rateLimits/read` followed by optional
  `account/usage/read`. It bounds stdout and time, rejects server requests,
  passes the existing credential environment allowlist, and kills its proxy.
  It never starts a daemon, thread, turn, login, reset, or credit purchase.
- ElevenLabs uses the existing Windows credential entirely inside Rust for
  `GET https://api.elevenlabs.io/v1/user/subscription`. Redirects are refused;
  the request times out after 20 seconds and the body is capped at 256 KiB.
  Character quota is labelled as characters, with billing-period consumption
  and reset time. Credentials and response bodies never reach the webview.
- Claude links to `https://claude.ai/settings/usage`. Its documented status-line
  limits require a previous model response; no standalone account reader is
  integrated and no generation is started to manufacture a reading.

### Local read-only verification, October 18

Installed Codex 0.163.0-alpha.10.2 generated schemas include both account reads.
Its daemon-version probe failed with control-socket OS error 10050 in the sandbox
and again with requested host execution. The bounded proxy also failed before
any account response. A subsequent host check found the expected control-socket path absent while
.NET could construct a Unix socket and an app-server process existed. The
existing process is not reachable through this control-socket path; no restart
or startup changes were attempted. Both installed
app-server versions (0.163.0-alpha.10.2 and 0.130.0-alpha.5) reject
`--ignore-user-config`; the newer CLI accepts that flag only under `exec`.
No fresh server was started because isolation from user-configured executable
integrations was not established. This is an unresolved Codex integration
blocker, not a completed live meter and not a request to sign in again.

The ElevenLabs quota GET reached the service and returned HTTP 401. A single
follow-up diagnostic retained only an allowlisted structured identifier:
`detail.status = missing_permissions`. This establishes a permission failure,
not an invalid/expired-key diagnosis. The existing key needs access to read user
subscription information. No key replacement, new grant or permission change
was performed. A later authorized backend check succeeded after Kevin confirmed the User access grant. Do not retry
provider probes automatically or treat an ignored probe's process exit as a
successful account reading.

Official contracts consulted:
- https://learn.chatgpt.com/docs/app-server
- https://elevenlabs.io/docs/api-reference/user/subscription/get
- https://elevenlabs.io/docs/api-reference/authentication
- https://code.claude.com/docs/en/statusline

Kevin subsequently approved enabling only the existing key's subscription/user
read permission and confirmed that Olympus S1 saved User access. The existing
secure Rust quota reader then returned a successful 2xx response and a ready
reading at 2026-10-17 20:36:23 Phoenix: 975 used and 22,761 remaining characters,
with a November 6 11:09:07 Phoenix reset. The previous missing-permissions error
is resolved. This verifies the backend request, not native UI rendering.

Displayed percentages round to one decimal place in compact labels, expanded
rings and window details. Underlying quota values, geometry and accessibility
numeric values retain their original precision; unknown readings stay unknown.

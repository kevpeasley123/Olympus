# Engine status and usage

This bounded slice inspects installed engines and displays account telemetry availability. Explicit account readers are available; availability differs by provider. A later offline-tested Codex conversation adapter is described in [Subscription conversation](SUBSCRIPTION-CONVERSATION.md); live generation stays blocked.

## Discovery and eligibility

Preferences > Subscription engines checks the executable, version and CLI sign-in. Codex checks an explicit `OLYMPUS_CODEX`, PATH, npm, then the desktop-managed `%LOCALAPPDATA%/OpenAI/Codex/bin/<build>/codex.exe` directories. Multiple desktop installations require an explicit executable rather than guessing which is current. Claude uses `OLYMPUS_CLAUDE_CODE`, native PATH, the native install location, then npm. The native PATH executable can differ from the PowerShell `claude` shim.

An explicit override must name an existing absolute file; a bad override never falls back. Overrides are environment configuration, not new persisted credentials or settings. The selected path and version are visible. Capability claims are limited to CLI-help versions inspected in the Windows spike; other versions are labelled unverified. Advertised streaming, schema output and ephemeral sessions do not establish successful live behavior.

Sign-in and billing eligibility are separate. A subscription can allow extra paid usage after its limits. This slice has no supported proof that overage is disabled, so subscription generation remains blocked. The existing Claude delegation gate also refuses launches, including resumes, while eligibility is unknown. Existing explicit API conversation routes are unchanged. No UI checkbox can grant billing eligibility and no automatic fallback, refill or purchase is added.

## Usage surface

Command has a compact 320px Usage widget above and outside the chat console. Expand opens a dark glass modal with two semantic groups: Models & subscriptions and APIs & services. Explicit capabilityCategory controls placement. The compact view selects the first valid percentage window; its tooltip identifies the window. The expanded view names all supplied windows, their units, periods and reset dates. Reported percentage allowances use remaining bars and rings. Currency balances display actual currency; credits retain their unit. A balance alone never supplies a percentage denominator.

Unknown allowances render neutral dashes without empty progress tracks or numeric accessibility values. Disconnected, unsupported, loading and failed states are distinct. Failed checks may retain a supplied last-known snapshot, explicitly labelled stale. Readings older than five minutes are marked stale. Source, scope, observation time and any supplied YTD values live in the expanded view. Refresh reads supported sources explicitly; no trends, plan names, unlimited allowances or service quotas are invented.

Production starts with unknown values. Explicit Refresh invokes the native readers below; populated test harnesses use only synthetic data. Existing Voice usage remains a separate current-app-run ledger.

The native HTML dialog traps keyboard focus, closes with Escape or Close and restores focus to Expand. Its content scrolls on short/narrow windows. The design uses static CSS/SVG with reduced-motion protection. Browser verification does not establish native WebView2 behavior.

The native readers below use supported account-limit and subscription interfaces. Claude quota comes only from passive statusline observations; overage eligibility remains unverified. Unknown account-wide data stays unavailable; local receipts are not account-wide totals.

## Management paths

Expanded Usage provides Manage subscriptions and Manage APIs. Subscription management reuses the existing EngineSettings selector and discovery display, but opening it or its disclosure does not inspect engines. Check again is explicit. Subscription selection is session-only; billing and isolation remain blocked.

API management explains authentication, costs and verification for ElevenLabs, Gmail and API model routes. Check local configuration reads only the existing local status commands, never a provider health check or account balance. The existing targeted Preferences section handles setup. Back or Escape returns to the selected service and retains inspected evidence. Usage owns global shortcuts while modal and restores keyboard focus on exit.

Add service leads to the existing Armory resource intake and preserves its draft. It records integration material; it is not an installer, account connector or executable tool registry. Opening management performs no automatic inspection, configuration write or external request. Provider account links and setup actions are deliberate user actions.

## Verification

Run `node scripts/test-engine-usage.mjs` and `node scripts/test-engine-usage-browser.mjs`, `node scripts/test-usage-redesign.mjs`, `node scripts/test-usage-management.mjs` and `node scripts/test-usage-management-handoffs.mjs`, then `npm run build`. Management browser scripts use the isolated loopback Vite preview on port 31426. The browser script starts an isolated Vite server and uses synthetic IPC only; screenshots go under `output/engine-usage/`. The fixture page is `engine-usage-harness.html`; it is not part of the production build. Rust engine tests cover billing refusal, override precedence, desktop discovery and version capability boundaries.

Native UI, live generation, inference cancellation, real limit-hit streams and account-usage adapters require separate acceptance. No model request is needed to run the focused tests.

## Explicit account refresh

`account_usage_read` reads one fixed provider at a time. Usage Refresh starts
independent reads; there is no mount timer or automatic retry. Errors keep the
last successful observation and timestamp, with a failed status. No dollars or
YTD totals are inferred from characters, credits, or tokens.

- Codex uses a transient private-stdio `app-server` instead of assuming the desktop
  exposes a daemon socket. In a neutral temporary directory, bounded `mcp list`
  metadata identifies configured server names; plain dotted overrides disable
  them for this invocation. A second inventory and `features list` verify that
  MCP servers, hooks, apps, plugins, remote plugins, code-mode host, automatic
  daemon startup and skill dependency installation are disabled. Failure or an
  unsafe server name stops before server launch. Metadata is never logged or
  forwarded to the frontend. No persistent settings are changed.
  The protocol requests `account/rateLimits/read` and optional `account/usage/read`
  after initialization. It bounds stdout/time, rejects server requests, retains
  the environment allowlist and kills/reaps its child. It creates no thread,
  turn, listener, daemon, login, reset or purchase. Native credit balances remain
  credits; token activity never supplies an absolute token-allowance denominator.
- ElevenLabs uses the existing Windows credential entirely inside Rust for
  `GET https://api.elevenlabs.io/v1/user/subscription`. Redirects are refused;
  the request times out after 20 seconds and the body is capped at 256 KiB.
  Character quota is labelled as characters, with billing-period consumption
  and reset time. Credentials and response bodies never reach the webview.
- Claude reads the bounded local passive quota file described below. The account
  page remains available; no generation is started to manufacture a reading.

### Earlier proxy investigation, October 18

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
integrations was not established. This explained the original proxy failure, not an authentication failure. The
private-stdio reader above replaces that dependency and has returned real account
data through the Olympus Rust command; native UI acceptance remains separate.

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

## Passive Claude quota collector

`scripts/claude-quota-collector.mjs` accepts ordinary Claude Code statusline input
in memory and persists only version, observation timestamps and the five-hour/
seven-day used percentages and reset times. It never retains prompts, transcripts,
session identifiers or credentials. There are no network requests or model calls.
The quota file is `%LOCALAPPDATA%\Olympus\telemetry\claude-quota.json`.

`scripts/install-claude-quota.py` compares inspected settings/script hashes, backs
up the current settings and statusline, and installs a wrapper that forwards the
original input to the existing command. Its `--baseline` option ENABLES it; it is
not a preview. `--restore` restores the original command and retains unrelated
settings, concurrent formatting changes and backup files.

Writes serialize with a bounded lock and atomic replacement. An abandoned lock
fails closed: recovery requires confirming no collector is running before removing
that quota file's lock directory. It is never automatically reclaimed. Missing,
invalid or expired windows are unknown; unchanged consecutive payloads retain
observation times. A reappearing window is a new local observation, not proof of
a new provider request. The app labels observations over five minutes stale.

`commands/claude_quota.rs` reads at most 8 KiB and validates each window. Refresh
reads that file without contacting Claude. The collector updates during ordinary
authorized Claude Code activity; the app uses explicit Refresh to load a new
snapshot. Displayed windows expire at their reset even without another Refresh.
Absolute token allowances and billing balances stay unknown. No browser reading
is seeded into automatic telemetry. First real capture and native rendering are
separate acceptance steps; fixture verification requires no generation.

# Claude blockers: read-only follow-up, 2026-10-29 UTC

## Account page access

Computer-use tools are available in this continuation. Inventory found native
Firefox windows and the installed Olympus window. Selecting Firefox window 67838
with the native tool returned `Computer Use app approval timed out` after 301
seconds. No account page was read, login screen observed, permission granted or
billing setting changed. This was an app-access approval timeout, not a verified
Claude authentication failure. Do not bypass it through another automation route.

Smallest user action: approve Firefox access if that prompt remains available, or
open https://claude.ai/settings/usage and report the usage-credit enabled/disabled
state (and account identity matches the Max account used by Olympus). No billing
change is requested. A current read is evidence at that instant, not a permanent
programmatic protection against later account changes. Keep generation closed.

## Plugin exclusion

Installed executable: npm Claude Code 2.1.284. Its help confirms `--settings` accepts
inline JSON; safe mode leaves built-in plugins unaffected. A first direct help read
returned successfully but took 405 seconds in the executor; subsequent probes use
an explicit 10-second child deadline.

Official documentation describes `enabledPlugins` as a Boolean map, built-in IDs
ending in `@builtin`, and plugin-authoring as a built-in skill with no mod code.
It directs users to `/plugin` to disable it. Safe mode does not exclude built-ins.
The current docs also say built-ins are absent from `plugin list`.

A no-prompt comparison ran the installed CLI with the same safe/restricted/settings-
source isolation and `plugin details cc-plugin-plugin-authoring@builtin`, first
without additional settings and then with per-invocation JSON:

```json
{"enabledPlugins":{"cc-plugin-plugin-authoring@builtin":false}}
```

Both commands exited 1 with the same plugin-not-found message. This cannot prove
exclusion because the baseline also cannot see the built-in. It is a candidate
supported configuration mechanism, not verified runtime isolation. No configuration
was persisted and no allowlist expanded. A non-generating session inventory that
reports built-ins, or version-specific authoritative verification of the effective
setting, is still needed before another prompt. Do not treat newer online reference
behavior as established for installed 2.1.284.

Allowlisted local configuration inspection found only the existing official
rust-analyzer plugin enable entry and a statusline in user settings. Neither
repository settings file exists. No built-in override was found. Other settings,
credentials and session files were not collected.

## Previously submitted attempt and telemetry

The only resumed live request used Sonnet 5.5 and normal `complete()`. Recorded
failure was strict system/init validation: correct model, no tools/MCP, three
plugins (agents-md, telemetry, plugin-authoring). The attempt ended after 2.58
seconds. No answer, token totals or rate-limit/overage event was recorded.

Source queues the user prompt after initialize/MCP metadata, before system/init
validation; stderr is discarded and session persistence disabled. The missing
result is not proof of zero provider work. Passive quota file
`C:/Users/kevpe/AppData/Local/Olympus/telemetry/claude-quota.json` is absent.
The initial sandbox environment redirected LOCALAPPDATA; the actual user path was
therefore checked explicitly as well. No before/after quota pair can bound tokens
or percentage consumption. No evidence establishes a charge, but no zero-charge
claim is justified. No further model call was made in this follow-up.

## What the incomplete settings-browser check meant

This was the local synthetic Olympus `harness/engine-usage-harness.html`, not Claude's
account usage page. First run timed out after 30 seconds in `page.goto`, waiting
for load at localhost while Vite was optimizing dependencies. The retry logged
scanning/bundling dependencies and made no completed assertions or new screenshots;
its owned test was interrupted. The exact underlying cause beyond the startup
stall was not established. Full Command visual regression independently completed
successfully, but does not replace the missing targeted settings screenshot.
No production app was launched to work around it.

## Evidence and sources

Local ignored evidence:
- `output/claude-plugin-readonly-probe-2026-10-29.json`
- `output/claude-live-current-2026-10-29.txt`
- `output/claude-meter-browser-2026-10-29.txt`
- `output/claude-meter-browser-retry-2026-10-29.txt`

Official references:
- https://code.claude.com/docs/en/settings-reference#enabledplugins
- https://code.claude.com/docs/en/plugins/mods/overview
- https://code.claude.com/docs/en/plugins/cli-reference

No additional generation, billing changes, credential reads, persistent settings
changes or app installation occurred. Both generation gates remain closed.

## Follow-up after Kevin's screenshot at 01:44:55 UTC

The parent inspected the user-supplied screenshot (Library ID
libfile_d9fbb814fd148191b431303495fcb8e0): usage credits $0; usage-credit toggle OFF;
monthly spend $0.00 of $40; auto-reload off; Last updated just now. This is fresh
screen evidence, not an API read. Account identity is not visible in the image.
No screenshot pixels were independently materialized in this executor.

At 01:47:56 UTC, bounded read-only `auth status --json` confirmed logged-in Max,
claude.ai / firstParty, matching the existing Olympus authorization by email and
organization compared only in memory. No identifiers were printed. That establishes
current CLI identity continuity, but cannot independently link the identity-hidden
screenshot to it. Kevin confirming the screenshot is that same account is the
smallest remaining account-context input; no billing change is needed.

A single new no-prompt control probe used the existing initialize + mcp_status
protocol, safe/restricted launch, empty tools/MCP, and per-invocation
`enabledPlugins` false for cc-plugin-plugin-authoring@builtin. Both control replies
succeeded, pending permissions and MCP servers were empty. Initialization returned
no plugins field and no session_state keys. Closing stdin produced no system/init
inventory. No user message was sent. Thus the tested handshake cannot prove plugin
exclusion before generation. Exact model ID lookup was false in this diagnostic;
it did not check display-name aliases, so it is not a model-unavailability finding.

The official Python SDK control type/source exposes initialize and MCP metadata,
not a plugin-inventory request. The TypeScript reference search describes its
initialization result as commands, models, account and output-style configuration.
Its full page exceeded the web tool's content limit, and a direct Markdown fetch
returned 403; this is a verification limit, not proof no newer SDK capability exists.
No unsupported control request was guessed or sent.

Sources:
- https://raw.githubusercontent.com/anthropics/claude-agent-sdk-python/main/src/claude_agent_sdk/types.py
- https://raw.githubusercontent.com/anthropics/claude-agent-sdk-python/main/src/claude_agent_sdk/client.py
- https://raw.githubusercontent.com/anthropics/claude-agent-sdk-python/main/src/claude_agent_sdk/_internal/query.py
- https://code.claude.com/docs/en/agent-sdk/typescript

Evidence:
- `output/claude-fresh-account-check-2026-10-29.json`
- `output/claude-control-plugin-disabled-2026-10-29.json`
- `output/probe-claude-control-plugin-disabled-2026-10-29.py`

## Bounded options, without blind generation probes

1. Inspect the documented interactive `/plugin` Installed/Built-in view in a
   non-generating CLI session started with the same per-invocation exclusion.
   Do not click enable/disable or change persistent settings. This requires an
   accessible, approved computer-use surface or Kevin reading that view. It may
   verify the effective setting in that session, but does not by itself add a
   machine-verifiable per-turn inventory to Olympus.
2. Obtain a version-specific supported pre-prompt plugin inventory contract from
   Anthropic, or assess an approved CLI upgrade that provides one. This preserves
   the strict allowlist and offers durable runtime enforcement; no install or
   upgrade is authorized or performed here.

The candidate exclusion is not installed into Olympus because its effect is still
unverified. Broadening the allowlist or accepting plugins after a prompt does not
meet this task's pre-launch requirement. Both generation gates remain closed.
No extra generation or production configuration changes occurred in this follow-up.

## Bounded interactive inspection

Parent authorized option 1 only, with no permission/settings changes. Started one
interactive CLI through the approved terminal with a 90-second owned-process
limit, same safe/restricted/settings-source/tool/MCP/permission settings and
invocation-only plugin exclusion. Print-mode stream framing was omitted because
this was the interactive UI, not generation transport.

The first screen was the workspace-trust prompt for
`output/claude-acceptance-empty`, with `No, exit` selected. It explicitly stated
Claude could read, edit and execute files there if trusted. No `/plugin` view was
reachable before that decision. Selected `No, exit`; no trust acceptance, command,
model prompt or settings change. This is a concrete permission blocker, not a
plugin inventory result.

Smallest additional authorization for this route would be trusting only this
synthetic inspection directory for the bounded interactive check. That persists
workspace trust and therefore needs explicit permission; it still would not prove
automatic per-turn plugin inventory for Olympus. Otherwise retain the closed gate
and seek a vendor-supported pre-prompt inventory contract/version. Do not use an
unrelated already-trusted working directory as a workaround or guess new flags.

## Approved trust retry at 02:34:37 UTC and unexpected auto-update

Kevin explicitly authorized trusting only the synthetic inspection directory and
confirmed the screenshot is the same Max account. The next interactive prompt
showed that exact directory; selected Yes. No other trust or permissions granted.
The CLI started as v2.1.284 with the same invocation-only exclusion and isolation
flags, including `--disable-slash-commands`. `/plugin` returned `Unknown command:
/plugin`; no Built-in inventory appeared. The unchanged launch contract therefore
cannot expose this menu. Removing that flag would be a different diagnostic
configuration and would not prove the production contract; it was not attempted.

Unexpectedly, the CLI displayed `Auto-updating...` then `Update installed - Restart
to apply`. A subsequent bounded version read of the invoked npm executable returned
2.1.312. The npm package metadata modification time was 2026-10-29 02:35:38 UTC.
No update command was requested. This is an unintended installation side effect,
not an authorized upgrade; no rollback, restart or further interactive probe was
attempted. The owned inspection process exited normally after Ctrl+C.

The interactive UI also said Not logged in / API Usage Billing, inconsistent with
the earlier Max auth read. This session is not evidence of correct subscription
authentication. The follow-up shell inspection showed sandbox-redirected LOCALAPPDATA,
but its environment alone does not establish the interactive child's exact auth
cause. No credentials were read and no login attempted.

Safe offline fix: the Claude adapter command now explicitly sets the documented
`DISABLE_AUTOUPDATER=1` per child invocation. The inspection helper likewise has it
for any future explicitly authorized reuse. No global or persistent update setting
was changed. The regression assertion failed before the fix; final targeted result
is in `output/claude-no-auto-update-green-2026-10-29.txt`. Both generation gates
remain closed. Newly observed 2.1.312 has not undergone transport/isolation review.

Evidence: `output/claude-interactive-inspection-anomaly-2026-10-29.json` records
executable version/hash and safely limited filesystem metadata. Official control:
https://code.claude.com/docs/en/env-vars#disable_autoupdater

Remaining operational route: reconcile the changed CLI version and auth discrepancy,
then establish a documented pre-prompt inventory mechanism. An interactive menu with
changed flags might aid diagnosis, but cannot alone fulfill per-turn enforcement.
No further permission decision is pending for the already-approved folder; the
inventory remains unavailable under the unchanged launch settings.

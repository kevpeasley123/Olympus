# Claude launch decision — 2026-10-29

## Decision

Keep both generation gates closed. The current wrapper does not satisfy the required
pre-prompt proof of plugin isolation. Do not keep retrying the interactive manager:
that manager is deliberately disabled by the production launch contract. No
supported combination has been established that both preserves Max authentication
and proves the effective built-in inventory before the first user prompt.
This is a missing verified contract, not proof that all personal CLI automation is
impossible. No login, generation, upgrade, interactive launch or settings change
occurred during this diagnosis.

## Confirmed cause of the missing plugin menu

Installed 2.1.312 help and official CLI reference define
`--disable-slash-commands` as disabling all skills and commands. Our interactive
probe included that flag. `/plugin` being unknown is therefore expected by design;
using that menu under unchanged flags was an invalid diagnostic plan. Removing
it only for inspection would test a different configuration. It would not establish
production per-turn enforcement, so no such retry is proposed.

`--safe-mode` leaves authentication functional but does not disable built-in
plugins. `--restricted` and `--setting-sources ""` filter settings; `--settings`
remains a per-invocation override. `--bare` is unsuitable because it skips the
subscription/keychain authentication path. None is a demonstrated pre-prompt
built-in inventory interface. CLI details/list and initialize/MCP probes are
already exhausted with their documented limitations; do not repeat them blindly.

## Authentication comparison

The current comparison held the executable, folder and environment constant,
then ran only `auth status --json` under (A) the original preflight flags and (B)
the full interactive flags. Repeated those reads in a terminal execution context.
All four cases reported loggedIn=false, authMethod=none, firstParty, no subscription.
No identity or credential values were printed. Each child had a ten-second limit
and DISABLE_AUTOUPDATER=1.

- Executable: C:/Users/kevpe/AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe
- Version: 2.1.312; SHA256 6099672ebe5dcb518b67d1d32dde1e3360bc6bee1dae7f8d28a69c49acc7c865
- Cwd: the exact approved `output/claude-acceptance-empty` directory.
- Both host contexts: APPDATA=C:/Users/kevpe/AppData/Roaming;
  LOCALAPPDATA=C:/Users/kevpe/AppData/Local; USERPROFILE=C:/Users/kevpe.
- CLAUDE_CONFIG_DIR absent, so default configuration home is the user's .claude.
- Environment names: APPDATA, COMSPEC, DISABLE_AUTOUPDATER, HOMEDRIVE,
  HOMEPATH, LOCALAPPDATA, PATH, PATHEXT, SYSTEMROOT, TEMP, TERM, TMP, USERPROFILE.
- No API-key, OAuth-token, alternate-provider or profile variable was inherited.
- Production allowlist also supports CLAUDE_CONFIG_DIR; the diagnostic scripts
  differed in allowing TERM, but CLAUDE_CONFIG_DIR was absent in these runs.

The sandbox-only follow-up had redirected LOCALAPPDATA. Fresh host comparisons
above use the real path and still report signed out; the sandbox path alone does
not explain current authentication. Adding the interactive isolation flags does
not change auth-status results. The earlier Max read was at 01:47:56, before the
interactive launch and auto-update. This does not prove the update caused sign-out.

Metadata only: the credential file still exists, modified 01:48:25 UTC, before the
02:35 auto-update; user settings are unchanged since October 18. Contents were not
read. The reason credentials are no longer accepted is not established. Ordinary
user-led sign-in might restore CLI authentication, but it would not solve plugin
isolation and is not requested as the next step for this blocked architecture.

## Spending evidence and version drift

Kevin confirmed the 01:44:55 usage-credit-OFF screenshot is the same Max account.
That supplies current human-observed account evidence. It is not a programmatic
per-turn billing check. The one prior submitted attempt remains usage-unknown.

The interactive launch unexpectedly ran the CLI's updater. The subsequent binary
is 2.1.312 rather than reviewed 2.1.284. No update command was issued. No rollback
was attempted. The adapter now sets DISABLE_AUTOUPDATER=1; focused offline tests
passed after a failing-before-fix regression. Do not reopen against a new version
without reviewing its contract. Status inspection should use the same per-process
update suppression too.

## Smallest supported alternatives

1. Preserve the no-extra-spend requirement: Olympus remains the local context and
   coordination UI, with an explicit user-reviewed handoff to the official Claude
   app/CLI for subscription conversation. The user sends the prompt there and can
   bring the answer back. This is a small architectural boundary change, but does
   not deliver an embedded native Olympus reply. It needs a product decision, not
   another flag probe; no handoff feature was implemented here.
2. Preserve fully embedded automated conversation: use a provider-supported API
   integration with explicit spending authority, or a local model. API billing is
   outside the present authorization; a local model would not be Claude Max.
3. Preserve every original requirement: obtain an Anthropic-supported, version-
   specific subscription integration and pre-prompt isolation contract before
   more implementation. This has uncertain timing but avoids reducing safeguards.

The official Agent SDK quickstart describes API authentication and says third-party
products need prior approval to offer claude.ai login/rate limits. It does not
establish that swapping this private wrapper for the SDK would make Max embedding
a supported solution. This is a product-support constraint to clarify, not a claim
that Kevin's personal use has been adjudicated.

## Evidence

- `output/claude-auth-environment-pipes-2026-10-29.json`
- `output/claude-auth-environment-terminal-2026-10-29.json`
- `output/claude-2.1.312-help.txt`
- `output/claude-fresh-account-check-2026-10-29.json`
- `output/claude-control-plugin-disabled-2026-10-29.json`
- Earlier chronological record: `2026-10-29-claude-readonly-blockers.md`.

Sources:
- https://code.claude.com/docs/en/cli-reference
- https://code.claude.com/docs/en/authentication
- https://code.claude.com/docs/en/plugins/mods/overview
- https://code.claude.com/docs/en/agent-sdk/quickstart
- https://code.claude.com/docs/en/env-vars

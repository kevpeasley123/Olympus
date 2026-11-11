# Olympus tools

Olympus offers its own data to an engine as tools, so a model can look things
up instead of Olympus pre-assembling every prompt. The tools are served by the
Olympus executable itself, started in a second role, over the Model Context
Protocol (MCP) on stdin and stdout.

## Launch

`project-olympus --olympus-tools --db <olympus.sqlite> [--vault <folder>]`

`lib.rs` checks for the flag before anything else, so this role opens no window,
loads no `.env` and starts no workers. The skill runner builds the matching MCP
configuration with `tool_server::mcp_config`.

## Tools

All six are read-only. An engine sees them as `mcp__olympus__<name>`.

| Tool | Returns |
| --- | --- |
| `search_mail` | Up to 10 excerpts from locally cached Gmail: sender, subject, date, thread id |
| `read_mail_thread` | Up to 20 messages of one cached thread |
| `recall_memory` | Learned records under `09 - System/Learned` that match the query, each with its vault file path and content |
| `search_vault` | Up to 10 vault notes matching the query, with a short excerpt |
| `read_vault_note` | One Markdown note by vault-relative path |
| `list_projects` | The dashboard's projects with status, vision and recorded next step |

Every string in an answer is capped at 4,000 characters and every list at 20
entries.

## Boundaries the server enforces itself

- **The database is opened read-only.** A tool cannot write even by mistake.
- **Vault reads stay in the vault.** A path must be relative, end in `.md`,
  resolve inside the vault after symlinks and `..` are followed, and not pass
  through a dot-folder such as `.obsidian`. Notes over 256 KB are refused.
- **`recall_memory` reads learned records only**, never their receipts or
  other notes. It returns the record's file path, which is what lets an answer
  cite a published assertion by where it is saved.
- **There are no write tools.** A tool that changes anything belongs behind
  the approval gate in the main process, not here.

Text a tool returns is evidence for the model, never an instruction. The engine
launch says so in its system prompt; the server cannot enforce it.

## Verification

`cargo test --lib tool_server` covers the handshake, each boundary above, a
read-only database file, and the launch arguments. The built executable was
driven over stdio by hand on Linux (initialize, list, two calls). It has not yet
been started by Claude Code or Codex, and not on Windows, where the release
build is a windowed program: stdio through pipes is expected to work there but
is unproven.

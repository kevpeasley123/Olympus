# The Olympians

Each Olympian is a profile: a named role with a charter, a ceiling on the tools
it may ever be given, a turn ceiling, and a way of executing. Profiles live in
`src-tauri/src/commands/agent_profiles.rs` and are served by `agent_profiles`.

A profile is a description, not a process. An Olympian acts only when the skill
runner starts an engine under its profile ([SKILL-RUNNER.md](SKILL-RUNNER.md)).
Every execution is still one Claude Code run started by Olympus; what the
profile changes is what that run is told it is and what it is allowed to touch.

## Profiles

| Olympian | Roster id | Executes | Tool ceiling | May hand off |
| --- | --- | --- | --- | --- |
| Zeus, orchestrator | `olympus` | Skill runner, 16 turns | All six Olympus tools | Yes |
| Athena, research analyst | `research` | Skill runner, 16 turns | All six Olympus tools | No |
| Themis, verification analyst | `verification` | Skill runner, 12 turns | Mail, vault and memory tools; not the project list | No |
| Hephaestus, systems engineer | `coding-delegate` | Coding delegation (`delegation.rs`), not the skill runner | None on the skill runner | No |
| Dionysus, creative strategist | `dionysus` | Planned; not executable | None | No |

What a profile enforces:

- **The charter opens the system prompt** of every run credited to the Olympian,
  ahead of the skill's own instructions.
- **A skill narrows a profile and can never widen it.** A test fails the build if
  a skill uses a tool its Olympian may not have, exceeds its turn ceiling, or
  orchestrates under a profile that cannot hand off.
- **Only Zeus may hand work to others**, and only to Athena and Themis.

## Hand-offs

"Ask Olympus" (`work-request`) is the one skill that orchestrates:

1. **Plan.** Zeus looks at the request with a light set of tools and returns a
   plan. A small request he answers himself, and the run ends there with no
   hand-off. Otherwise he names up to two hand-offs, each a task that stands alone.
   The accepted plan is recorded as one `plan` event, so the Activity Deck can
   show who is queued and count the run's stages.
2. **Hand-offs.** Each runs as its own recorded run under the specialist's
   profile and assignment skill, linked to Zeus's run by `parent_run`
   (migration 10). It has its own events, so the specialist's figure works
   while it runs. Themis is given Athena's report to check.
3. **Answer.** Zeus writes one answer from the reports. It may cite tools his
   specialists called; it may not cite a tool no run behind it called. A failed
   hand-off is reported to him as failed, not hidden.

Hand-offs are carried out by the runner, not by a tool the model calls. The tool
server is read-only by construction and holds none of the subscription checks, so
an engine launched from inside a tool call would bypass them. The model decides
who gets what; Olympus starts each run through the same guarded launch as any
other.

Themis's verdicts are `holds`, `partly_holds`, `does_not_hold` or `cannot_check`.
`partly_holds` is for a source that supports only part of a claim, or only
something more general.

A request with two hand-offs is four engine runs. That is why small requests end
after the plan.

## Not built

- Hand-offs to Hephaestus. Coding delegation is a separate driver with its own
  approval flow.
- A specialist handing work onward, or more than two hand-offs.
- Per-Olympian engine or model choice. Every profile runs on Claude Code today.
- Per-Olympian memory.

## Verification

`cargo test --lib -- agent_profiles skill_runner` covers the profile invariants,
plans (answer or hand off, never both or neither), verdicts, run linkage, and
that a request or report cannot close its own data section in a prompt. The
single-run skills have completed against Claude Code. The orchestrated path has
not been run against Claude Code.

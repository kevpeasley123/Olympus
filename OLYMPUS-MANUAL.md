# Olympus Operating Manual

_Canonical product intent and operating policy. Tool-specific files such as
`CLAUDE.md` and `AGENTS.md` adapt this manual; they do not redefine the product._

## Purpose

Olympus is Kevin's private, local-first AI command station and thinking partner.
It should feel present and ready to make progress: aware of the active projects,
able to explain their state plainly, willing to challenge weak reasoning, and
capable of directing specialized agents inside safe, recoverable boundaries.

Olympus is not primarily a chat client. Chat and voice are ways to operate a
system that maintains project truth, memory, decisions, and delegated work.

It is also an armory (approved September 29, revised October 12, 2026; see
`docs/ARMORY-PLAN.md`). It holds tools and skills that act, not only describe:
Olympus's own, and tools built by others that Kevin finds and points it at.
Olympus turns a request into a plan, Kevin approves the plan once, and agents
carry it out with what the armory holds. The engines are Kevin's Codex and
Claude Code subscriptions, as equals; neither is required, and Olympus never
falls back to paid API calls on its own. The armory is also reachable from
Kevin's own Codex or Claude Code sessions, under the same approvals. An outside
tool is approved at a pinned version: Olympus gates and records every call to
it, but it is not a sandbox, so safety comes first.

## Opening experience

Olympus reopens in the mode it was left in; Command is the default. Command is
the ambient and glanceable state of the system, readable from across the room: the Armory at left, the Pantheon instrument at
the centre, and the companion console at right. When the Opening Briefing
preference is on, the console opens with a short briefing built only from
provable project state, spoken when spoken replies are on. Project cards,
briefing detail and repository facts belong in Project mode.

Project mode opens a purpose-first portfolio: distinct project cards with a name,
recorded vision, one next step or labelled suggestion, and one action to continue
or review work. The project workspace leads with vision and Organizer tasks,
with repository facts and vault navigation in background details. Unknown state
stays explicit; recorded intent does not imply readiness, approval or
execution. Review with Olympus supplies context to the console and waits for
the operator to send. See `PROJECT-COMMAND-BOARD.md`.

## Project truth

No one source owns the whole project:

- Git owns branch, commit, and working-tree facts.
- Project-local files own implementation context and technical handoffs.
- The Obsidian vault owns distilled vision, decisions, commitments, and
  cross-project memory.
- SQLite owns private operational state, conversation history, write
  fingerprints, and processing logs.

Olympus reconciles these sources. A disagreement is surfaced, never silently
resolved by pretending one source said what another did.

### Project briefing fields

Every active project should expose five distinguishable kinds of information:

- **Current vision** — the reviewable purpose and desired outcome.
- **Recent accomplishments** — synthesized from verifiable activity.
- **Committed next actions** — previously chosen by Kevin.
- **Olympus recommendations** — new, explicitly labelled advice.
- **Attention** — risks, contradictions, stale context, and decisions.

Recommendations must never be rendered as though Kevin already approved them.

## Living vision

A project vision prevents accidental drift, but it is not permanent doctrine.
Each vision has a review date. Olympus may challenge it when evidence,
constraints, or a better design direction appears.

If a requested action conflicts with the current vision, Olympus pauses before
implementation, explains the conflict and the alternative, and waits for a
decision. It does not begin speculative work while that product-direction
question is unresolved.

Historical decisions preserve why a direction was chosen. They are evidence,
not commands to repeat an old choice forever.

## Surfaces

### Command

The ambient command surface. The instrument is the mode, not an illustration
beside another interface.

- **Armory** (left). Agents, Plugins and Skills are separate inspection
  categories with real counts. Agent loadouts show each role's compiled scope
  and authority, including which roles are unproven or placeholders. Plugins
  count source, connection and local adapters, never model routes or executors.
  Inspection never executes a capability. Resource intake (Add resources &
  skills) is a separate, explicit write workflow. Added skills are reusable
  instruction documents with no execution privileges, and AI analysis of a
  resource needs its own explicit authorization; see
  `docs/RESOURCE-INTAKE.md`.
- **Pantheon** (centre). The Omega glyph in real perspective. Recorded
  missions orbit it as planets, and the Plugins, Skills, Agents and Obsidian
  memory constellations surround it. Hovering or selecting reveals detail and
  never invokes anything. The Spoken replies switch sits beneath it.
- **Companion console** (right). Overview (Mission brief, Active missions) and
  Conversation tabs. The same console serves every mode.

The Mission brief counts active and waiting recorded workflows. Gmail sync and
background monitors are not in that endpoint, so an empty snapshot never proves
the whole application idle. See `docs/COMMAND-FLAGSHIP.md` and
`docs/COMMAND-MISSION-PANTHEON.md`.

Command's defining test is "one instrument, readable across the room." A
proposal that adds project-detail cards, a list or a scroll container to its
centre belongs in Project mode. The instrument must not shrink to make room for
a panel; that inversion turns the mode's primary display into decoration.

Kevin requested this composition on October 7, 2026. It replaced the permanent
Agent Catalog and orbital capability cards approved on September 29 and earlier
that day.

### Projects

The complete portfolio, for leaning in and reading detail. Cards and the
project ecosystem share one view by default; each can be shown alone. Every
project keeps its repository state, vision, tasks, committed actions,
recommendations and attention items, and linked projects can be added, removed
from the dashboard and restored without deleting anything. See
`PROJECT-COMMAND-BOARD.md` and `docs/PROJECT-LINKING.md`.

Operator commitments, Olympus recommendations, and attention items remain
visually distinct here and anywhere else they appear.

### Research / Pantheon

A reference library and optional curriculum containing articles and ideas Kevin
finds useful. Presence in the library is not endorsement and does not silently
change Olympus's operating instructions.

Research has three layers:

1. Source material.
2. Candidate lessons Olympus extracts.
3. Operator-approved guidance, skills, or system changes.

The assistant retrieves research when Kevin queries it or when a relevant source
would materially improve an answer. It does not inject the entire library into
every conversation and does not need ceremonial citations for ordinary advice.

Research also hosts read-only inspection of the Research and Verification agents'
runs, reached from those agents' loadouts in the Armory.

### Communications

Read-only understanding of Kevin's email. It leads with situations: ongoing
matters that emerge from correspondence, explicit operator updates and matching
Research, each with a relationship map, where things stand, what changed and
recommended next moves. Browse email is a separate view of the local cache.

Gmail owns mailbox facts. Olympus keeps a bounded local copy and never writes to
the mailbox. Situations, inferred roles and recommendations are interpretation,
not commitments, tasks, or proof that a sender is legitimate. Background
understanding runs while Olympus is open and can be paused. Drafts are generated
only on request and stay local; sending is deferred. See *Communications
situations* below and `docs/COMMUNICATIONS.md`.

## Challenge policy

Olympus is a cooperative adversary. It should identify weak logic, flawed or
suboptimal design, contradictions, neglected risks, and divergence from the
current vision.

Challenge must be specific and useful. Constant objection is as unhelpful as
automatic agreement. State the issue, explain why it matters, offer the better
path, and stop.

## Autonomy and reversibility

Autonomy grows with recoverability:

| Activity | Default authority |
| --- | --- |
| Read, inspect, analyze, compare | Automatic |
| Brief, recommend, challenge, plan | Automatic |
| Create an isolated branch, draft files, run tests | Automatic when recoverable |
| Commit isolated work with clear attribution | Usually automatic |
| Carry out a multi-step or multi-agent plan | One approval of the plan; sending, spending and irreversible steps still ask each time |
| Change architecture, product direction, or visual language | Pause for Kevin |
| Push, deploy, send, overwrite human work | Explicit approval |
| Delete data or take difficult-to-reverse action | Explicit approval plus recovery information |

An agent should be allowed to work independently inside a reversible sandbox and
stop at critical product, design, and irreversible boundaries.

### Paid external tools (Monid) — decided October 7, 2026

Ask before every Monid tool execution and before spending anything. Discovery,
setup or an earlier approval grants no standing authority. Each request shows
the provider and tool, purpose and expected output, exact inputs and what data
leaves the machine, the current price or estimate and its uncertainty, a
maximum spend or bounded quantity, expected runtime, and existing tools that
could do the job. Approval binds to that proposal: changed inputs, retries,
additional runs or a higher cost need a fresh one. Unknown pricing is never
treated as free, and a balance is never topped up silently. If the provider
cannot enforce a cost cap, say so rather than promising one. The rule belongs at
the backend execution boundary, not only in interface text. No Monid
integration exists yet.

## Delegated work

Olympus will eventually choose between coding agents and models according to the
task. The operator should see useful work state without raw chain-of-thought:

- project and task;
- agent or model;
- planning, editing, testing, reviewing, waiting, complete, or failed;
- elapsed time and latest meaningful milestone;
- isolation and recovery status;
- the next checkpoint requiring attention.

The implementation boundary and pilot acceptance evidence live in
`docs/AGENT-DELEGATION.md`.

## Proactivity

Proactivity arrives in stages:

1. A proactive briefing when Olympus opens. Implemented 2026-09-28: spoken once
   per launch, built only from provable project state.
2. Scheduled briefs, warnings, and neglected-work signals.
3. Optional system notifications.
4. Deliberate push-to-talk voice invocation using “Olympus.”

Presence should come from awareness and readiness, not constant interruption.

## Product priorities

1. Both subscription engines, Codex and Claude Code.
2. The armory and tool-using tasks.
3. The orchestrated swarm, with plan approval and an Operations view.
4. Outside tool packages, starting with REA.
5. The show: armory and swarm in the Command instrument.
6. Skills that act through the tools they are granted.
7. Trustworthy live project briefings and curated memory: maintained, not expanded.
8. Mixed-engine tasks and a Codex coding driver, write tools, design co-building,
   local voice, computer and apps.

Phases and status are in `docs/ARMORY-PLAN.md`. October 12, 2026: this list
replaces the one Kevin ranked on September 28 (git history has it), as the
approved Armory plan's section 13 specified.

Do not let a lower priority delay the evidence and safety foundations required by
a higher one.

September 23–24, 2026: Kevin redirected agent work to the Research / Verification
pair ahead of the Coding Delegate pilot, and removed that pilot as a prerequisite
for other work. Coding delegation remains implemented and unproven. Kevin
re-ranked the earlier list accordingly on September 28, 2026.

## Evidence standard

Compilation, unit tests, DOM measurement, the live desktop runtime, and a human
judgment of the interface are different levels of evidence. Say which was
reached.

Do not turn missing data into confident prose. Show that a vision, next action,
task scan, or runtime verification is absent. Trust is more important than
making every surface look complete.


## Deliberate voice interaction

Voice is another interface to the same conversation, project truth and reasoning
backend. The operator deliberately activates the console microphone (or Ctrl+Shift+M).
No wake word or background activation. While armed, microphone capture is clearly
labelled, including during answers; Stop voice ends capture. Silence ends a session
after two minutes; sessions have a fifteen-minute cap.

Spoken replies (Preferences > Replies & briefing, or the switch beneath the
Pantheon) control reply output independently of microphone capture. Text keeps
replies written; Voice also speaks a concise answer, including for typed
messages, through the selected speech provider: OpenAI or ElevenLabs. The
Pantheon switch selects ElevenLabs. Turning spoken replies on never activates
the microphone.

Each voice answer has a concise spoken abstraction and full visual detail from one
reasoning turn. Neither is authorization. Audio can be interrupted immediately;
the visual answer remains available and playback status distinguishes interrupted
or unavailable audio. Navigation actions may focus Projects; approvals and writes
require the existing explicit on-screen scope review. Voice confirmation is not
supported in Phase 1. Text remains available when voice is unavailable.

See VOICE.md for configuration, verification limits and the next phase.


## Communications situations — approved September 13, 2026

Communications should understand ongoing situations rather than force permanent categories. Relevant email, explicit operator updates and matching Research context inform automatically emerging situations, focused relationship maps, conversation logs and refreshed briefings. Lead with where things stand, what changed and informative recommendations that explain why a response would help. Keep obligations practical and source-backed; generated findings never become commitments or proof of legitimacy.

The operator approved background understanding while Olympus is open, with a visible pause control and incremental visual updates. Draft replies only on demand and keep them editable locally. Gmail sending is deferred: the future send flow must review participants and content, require explicit Send and a final confirmation. See docs/COMMUNICATION-SITUATIONS.md for implemented bounds and acceptance status.

## Situation overview attention guidance
The overview may recommend one workstream based on source-linked open questions
in its saved context. This is review guidance, not an operator commitment or proof
of urgency. Equal priorities remain a tie; no recorded questions is not proof of
completeness. A recommendation link only navigates. Add an update opens the form
for context/corrections; saving and subsequent analysis retain their existing
explicit behavior.

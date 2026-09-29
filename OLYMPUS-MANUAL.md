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

## Opening experience

On launch, Command is the ambient, glanceable state of Olympus. It should be
readable from across the room: the full omega instrument, the Agent Catalog on
the left, and the conversation workspace in its own right column (compact on
request). The instrument is the mode, not an illustration beside another
interface. The ring shows what Olympus can do — its capability domains, derived
from real runtime Tools and Skills — not projects (decided 2026-09-29, Command
Armory redesign). Projects, briefing prose and repository details belong in
Project mode.

Project mode opens the Project Command Board: compact operational status,
operator checkpoints, next move and owner, and clearly labelled deterministic
recommendations. Detailed vision, recent work, tasks and delegation controls belong
behind Open Project. Unknown state stays explicit; recorded intent does not imply
readiness, approval or execution. Review with Olympus supplies context to the existing
Command Console and waits for the operator to send. See PROJECT-COMMAND-BOARD.md.

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

The ambient command and conversation surface. Its centre column contains the
full-size omega instrument: the day arc, the capability-domain ring, the linked
note constellation (ambient), and central glyph. A lens (the selected agent),
a selected domain, or a recorded mission reveals individual Tools and Skills
inside their domain's wedge with an honest state: available, in scope, active,
completed, unavailable, or requires approval. Revealing and inspecting never
invoke anything. The conversation workspace fills the right column by default
(idle suggestions, conversation, a Mission View projected from recorded run
events, pinned composer) and compacts to the anchored command bar on request.

The operational Agent Catalog occupies the left region beside the slim global
rail. Olympus Core is listed separately as orchestrator; only actual executable
roles appear here. Selected-role details stay in the same left panel. The right
region belongs to the conversation workspace, which must cover neither the
catalog nor the central instrument. Catalog inspection
is read-only and never launches agents. Deeper graph/run inspection links to the
existing Research surface. See `docs/COMMAND-AGENT-CATALOG.md` and
`docs/COMMAND-ARMORY-REDESIGN.md`.

Command's defining test is “one instrument, readable across the room.”
A proposal that adds a card, list, or scroll container to its centre column
belongs in Project mode. The instrument must not shrink to make room for a panel;
that inversion turns the mode's primary display into decoration.

### Projects

The complete portfolio. Active, watching, scaffold, and archived projects remain
visible with their repository state, vision, accomplishments, tasks, committed
actions, recommendations, and attention items. Its hero area presents the
primary active session path; additional active or optional watching paths appear
as secondary cards. This is the mode for leaning in and reading detail.

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
runs, reached from the Command catalog.

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
| Change architecture, product direction, or visual language | Pause for Kevin |
| Push, deploy, send, overwrite human work | Explicit approval |
| Delete data or take difficult-to-reverse action | Explicit approval plus recovery information |

An agent should be allowed to work independently inside a reversible sandbox and
stop at critical product, design, and irreversible boundaries.

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

1. Trustworthy live project briefings.
2. Research and verification agents.
3. Curated project memory.
4. Proactive warnings and briefs.
5. The full project constellation.
6. Voice commands.
7. Delegating work to coding agents (implemented, unproven; no pilot prerequisite).

Do not let a lower priority delay the evidence and safety foundations required by
a higher one.

September 23–24, 2026: Kevin redirected agent work to the Research / Verification
pair ahead of the Coding Delegate pilot, and removed that pilot as a prerequisite
for other work. Coding delegation remains implemented and unproven. Kevin
re-ranked the list above accordingly on September 28, 2026.

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

The Command Console's Text | Voice toggle controls reply output independently of
microphone capture. Text keeps replies written; Voice also reads a concise spoken
answer, including for typed messages. This is the same saved preference as Auto
Speak in Voice Lab. Choosing Voice does not activate the microphone.

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

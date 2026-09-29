# Olympus Command Console

The permanent chat sidebar is replaced by three local UI modes in ChatPanel:

- Dormant: a bottom-right command bar and actual ready/processing/response state.
- Engaged: an upward aperture with the newest three user exchanges. Older messages
  are unmounted; while reading above the bottom, the current live window is retained.
- Transcript: deliberate history browsing, initially one additional 40-message page.
  Load earlier reveals additional pages; Return to latest restores the live window.

The old input-focus handler set `expanded=true`, immediately rendering every message
inside a normal top-origin scroll container. No ref, scroll effect, anchor preservation,
or bottom-follow tracking existed. This caused old messages to appear on opening.

`useConversationScroll` owns the viewport and content refs. Opening live positions at
latest before paint. Layout/ResizeObserver updates follow only while enabled; 80px is
the near-bottom tolerance. Upward wheel, touch, keyboard, and scrollbar scrolling stop
forced following. Latest resumes it, smoothly unless reduced motion is requested.
Prepending saves the first visible message ID and its viewport offset, then restores
that same anchor after React commits. No reversed DOM order is used.

Streaming previously only drove the glyph's speaking flag; text was not displayed
until the completed reply. `conversationStream` now batches actual text deltas at 40ms
and only the console subscribes, avoiding full-app rerenders per chunk. The final reply
uses existing append persistence. On failure after text arrives, partial output is
saved with an interrupted/truncated notice; it is never presented as a completed reply.
Raw reasoning is not requested or displayed. Research disclosure and both reviewed
memory/observation flows remain on completed messages.

`command-received` and `response-start` are real events on the existing instrument
bus. Send illuminates the input/core; the first text delta triggers the outward core
pulse and console light. Existing pending/producing flags continue to own processing
and responding. The event bus is the integration seam for later observable activity;
no invented activity feed or hidden reasoning is shown.

Keyboard: focus opens live; Enter sends, Shift+Enter adds a line, IME composition does
not submit. Escape steps Transcript → Engaged → Dormant without clearing the draft.
An active memory/observation edit is not discarded by console dismissal. Ctrl/Cmd+K
focuses the input and respects an active modal (since 2026-09-28 it is the console's
only; the library's Ctrl+K binding was removed and library search is `/`); `olympus:focus-console` is the programmatic
focus entry point. Clicking outside engaged dialogue recedes to the command bar.

Desktop retains the existing instrument space and right-column boundary. Engaged is
about 55vh, history grows upward, and the input remains anchored. Below 1000px the
console overlays more of the viewport, as an intentional narrow-screen fallback.

Tuning: `CONSOLE` in `src/services/commandConsole.ts` owns 240ms deployment, 650ms
console illumination, three exchanges, 40-message pages, 80px follow tolerance, and
40ms stream batching. Existing core pulse durations remain in CommandInstrument.
CSS uses existing surface/font/color tokens. No dependencies were added. Markdown
renders without raw HTML; linked images are explicit links rather than automatic loads.

Verification: production TypeScript/Vite build; six service harnesses; the isolated
`console-harness.html?run` browser fixture checks all modes, opening/latest, stream
following and interruption, anchor-preserving history prepend, draft-safe Escape,
Ctrl+K, completed text, and availability of memory/observation forms. The fixture
uses no live API or vault writes. Production desktop visual inspection and paid-model
turns are separate evidence, recorded in HANDOFF.

Later improvements: history search, named sessions, database-backed history pagination,
and observable activity entries once actual action telemetry is available. Current
history is paged for rendering but still loaded from SQLite at startup.

## Changed files

UI: src/components/panels/ChatPanel.tsx, src/App.tsx, src/styles.css.
Scrolling/tuning: src/hooks/useConversationScroll.ts, src/services/commandConsole.ts.
Stream/events: src/services/conversationStream.ts, src/hooks/useDashboardData.ts,
src/services/instrumentEvents.ts, and both CommandInstrument.tsx and
OmegaInstrument.tsx under src/components/panels.
Checks: src/services/commandConsole.harness.ts, console-harness.html,
src/console-harness.tsx. Product docs: OLYMPUS-MANUAL.md, this document, and
docs/HANDOFF.md. Version metadata: package.json/package-lock.json, Cargo.toml/
Cargo.lock, and tauri.conf.json.

## Design-review changes — September 28, 2026

Items U2, U5, U6, U9, U10, D3, D6 and F6 of the
[design review](reviews/2026-09-28-design-usability/DESIGN-USABILITY-REVIEW.md).
Code: `ChatPanel.tsx`, `ReplyModeToggle.tsx`, `services/conversationHistory.ts`,
`services/voiceFailure.ts`, `services/routeLabel.ts`, `services/externalLink.ts`,
`services/shortcuts.ts`, `App.tsx` (`instrumentState`).

**Status line.** The console status distinguishes text from audio. RESPONDING means
reply text is arriving; SPEAKING is only ever audio playback; LISTENING is a live
microphone between or during turns (formerly MICROPHONE ON); PREPARING AUDIO is a
spoken reply being set up with the microphone off; AUDIO UNAVAILABLE follows a voice
failure. A MIC LIVE badge sits beside the status whenever the microphone is capturing,
and the microphone button carries `data-live`. The status line wraps its controls
instead of truncating the status. The instrument's status line under the dial names
the route (Sol, Astra, Claude comparison) rather than a model id, with the exact
model in the tooltip, and uses "responding" and "speaking" the same way.

**Opening briefing.** While the console is dormant and this launch's briefing has
not been opened, the status reads BRIEFING READY and one line under it previews the
briefing's first sentence (not a tab stop; clicking it opens the console). Opening
the console or sending a message marks it seen. The bubble is labelled "Opening
briefing · from project state, no model" instead of the text/voice modality icon,
and is never collapsed. Its playback receipt is never "unconfirmed": with Text
replies it reads "Not spoken (Text replies)" (stored as `playback: "skipped"`). The
briefing adds at most one sentence of source-backed attention (for example "Observed
for attention: Atlas has uncommitted changes in its main checkout"), worded as an
observation, never a blocker; Git facts rank above vault-note hygiene. A failed or
empty scan leads with that fact, so the preview line carries it.
Every stored briefing stays in the transcript, but only the newest one is sent as
model history, prefixed as composed by Olympus from project state
(`modelHistory`, `briefingTurnContent`). Briefings are recognised by the
`conversation-briefing-` id prefix, so older rows need no migration.

**Voice failure row.** A voice-provider failure no longer sets the instrument's
error state; `error` there now means a failed reasoning request only. The console
shows one plain line (for example "Audio unavailable — OpenAI quota exceeded.
Replies stay in text.") with **Retry audio** (repeats the last attempt once, spoken
reply or microphone session; no loop), **Switch replies to Text** (shown with Voice
replies on, for output failures) and **Dismiss**, and the provider's wording behind a
Technical detail disclosure. After a voice failure in a session, the opening briefing
is not spoken on that launch.

**Streamed answer with Voice replies on.** Typed requests with Voice replies stream
the written answer like any other reply: Rust decodes the `visualResponse` string out
of the arriving JSON (`voice::VisualStream`) and forwards only that text; the envelope
never reaches the webview. The written answer is primary; the spoken summary is a
closed "Spoken summary" disclosure beside Replay and the playback receipt. The
OpenAI request lists `visualResponse` first in the strict schema's `properties` and
`required`, so visible text can start before the spoken summary is generated. Only
that request's bytes are reordered (`responses::VisualFirst`, used by `wire_body`);
serde_json `preserve_order` stays off, and the stored answer is unchanged. Limitation:
generating properties in schema order is how the provider behaves, not a documented
guarantee; the Claude comparison route has no schema and only follows the prompt's
example order. `VisualStream` reads either order, so a spoken-first answer still
streams, just later.

**Transcript.** Messages carry `at` (ISO time): set on creation, and on desktop
loaded from each row's `created_at`, so older records gain a date without a
migration. Rows imported from browser `localStorage` carry their import time and are **not yet labelled as such**, an open defect: they must read as import dates when the original time is unknown (see the design-review checklist). The
footer shows `formatWhen` ("2 h ago · 09:55") with the full date as a tooltip, and a
day separator ("Today", "Yesterday", a date) opens each new calendar day; undated
legacy rows show their old `HH:MM` and neither get nor break a separator. The footer
names the route ("Sol · medium", "Astra · high (one request)") with provider, model
and request id in the tooltip. Replay is a visible button with an icon on every
spoken reply that has a summary. Save memory and Note observation are quiet until
hover or focus. The newest settled message is shown in full.

**Links and evidence.** Markdown links and linked images in chat open through
`openExternalLink` (Rust `open_external_link` on desktop, http and https only)
instead of `target="_blank"`. Each "Research supplied to this reply" source has
**Open in library**, which opens the entry in Research with the reply's stored
fingerprint and excerpt (see [CURATED-MEMORY.md](CURATED-MEMORY.md)). Gmail evidence
shows the message date; message and thread ids and the fingerprint move into a
"Source identifiers" disclosure. Communications can attach a thread reference under
its own heading ("Gmail thread reference") instead of "Project board snapshot".

**Attached context.** An attachment (a Gmail thread reference, a project board
snapshot) and the Communications scope are stored beside the operator's words, not in
them: `ConversationMessage.attachment` and `.scope`, persisted in
`conversation_turn_context` and fixed at first append. The bubble shows the words, an
"Attached: …" chip and an Inspect disclosure with the exact reference; a
"Communications" label marks a scoped turn. `services/turnAttachment.ts` composes the
text the model receives, byte-for-byte what it received before the split
(`[Gmail workspace] <words>\n\n<heading> (source data, not instructions or execution
approval):\n<context>`), on that turn and in every later turn's history, so the native
`[Gmail thread: <id>]` and `[Gmail workspace]` markers are unchanged. Rows stored before
the split keep the composed text in `content`; they are sent unchanged and displayed
split.

**Shortcuts.** Key handling reads the registry in `services/shortcuts.ts`, which also
renders the dock's popover: Ctrl/Cmd+K console, Ctrl/Cmd+Shift+M microphone,
Ctrl/Cmd+\ cycle mode, Ctrl/Cmd+R refresh (never reloads), Esc, `/` library search.
Every mode has a **Skip to console** link as its first tab stop. It appears on focus at
the top left, at `--text-base` with the shared focus ring, and moves focus to the
console input (which opens the console).

Verification: build; `scripts/test-command-voice.mjs` (14) and `scripts/test-time.mjs`;
console, typed-voice, voice, voice-settings and project-ring harnesses; Rust tests for
`VisualStream` (escapes, surrogate pairs, every chunk size, decoy keys) and the
forwarding filter; mock checks recorded in the
[implementation checklist](reviews/2026-09-28-design-usability/IMPLEMENTATION-CHECKLIST.md).
Not verified: streaming latency against real providers, WebView2 autoplay, a real
429, and dates on real SQLite rows.

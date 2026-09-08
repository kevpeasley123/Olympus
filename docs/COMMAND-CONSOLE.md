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
focuses the input and respects an active modal; `olympus:focus-console` is the programmatic
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

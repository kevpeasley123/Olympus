# Olympus voice — Phase 1

## Start and stop

Add `OPENAI_API_KEY` to the project root `.env` and restart the desktop app.
The same key serves reasoning: voice turns use OpenAI Responses (Sol by default),
like text. `ANTHROPIC_API_KEY` is needed only for the explicit Claude comparison route.
Do not paste keys into the conversation or put them in Vite/browser variables.
Click the console microphone or press Ctrl+Shift+M to toggle voice. Windows may
request microphone permission on the first activation. Stop voice releases all
microphone tracks. While armed, audio is sent to OpenAI, including during playback
so interruption works. There is no wake word. Silence closes the connection after
two minutes; the session cap is fifteen minutes.

Mute silences output, not the microphone. Stop voice ends capture. Interrupt stops
speech and listens for a correction. Typing remains available; submitting text ends
microphone capture. With Preferences > Voice Lab > Auto Speak enabled (since
2026-09-28: **Voice** replies, set in the console or under Preferences > Replies &
briefing), typed replies play a concise spoken summary through a receive-only connection, with the microphone
off. That connection closes after playback. With Auto Speak off, typed replies are
text-only. Replay can open its own receive-only connection and uses the API; it does
not retain a raw audio recording.

Opening briefing: once per launch, after the first project scan, Olympus adds a short
briefing built from provable project state to the conversation and, with Auto Speak on,
speaks it through the same receive-only path. Preferences > Voice Lab > Opening Briefing
turns it off (since 2026-09-28 the switch is under Preferences > Replies & briefing). After
a voice failure earlier in the session the briefing is not spoken. WebView2 runs with `--autoplay-policy=no-user-gesture-required` because no
gesture precedes it.

## Architecture

Rust `commands/voice.rs` mints a 60-second client secret with the permanent key.
The webview negotiates WebRTC with `/v1/realtime/calls`. Microphone sessions send
input audio; typed replies and auditions only receive audio, with VAD disabled.
Data-channel events carry transcription, VAD, audio
transcripts, and playback lifecycle. No new server process or package is required.
Production builds set a CSP whose `connect-src` allows `https://api.openai.com` for
the SDP exchange; WebRTC media is not governed by `connect-src`. `npm run tauri dev`
applies no CSP, so voice in a packaged build is its own check (added 2026-09-28).

The current configuration is `gpt-realtime-2.1`, `marin`, output speed 1.0,
`gpt-4o-mini-transcribe` in English, near-field noise reduction and server VAD
(threshold .5, 650 ms silence, 300 ms prefix). Automatic answers are disabled.

A completed utterance enters `useDashboardData.sendChatMessage`, the same handler
used by text. The same Command Board projection, vault retrieval, history, and
reasoning model produce one validated `VoiceAnswer` containing spokenResponse,
visualResponse, proposedActions, requiresConfirmation and conversationState.
Default spoken responses are capped at 55 words; explicit BRIEF allows 110 and
DEEP_DIVE 90, one conversational part at a time. Oversized speech is replaced with
a short invitation to inspect the visual detail, never a reading of the full answer.
Malformed envelopes fail visibly without affecting existing history. A refused
reasoning turn returns a minimal spoken answer carrying the refusal notice, so the
microphone session continues (2026-09-28).

Realtime receives only the spoken abstraction in an out-of-band response and is
instructed to render it verbatim. It cannot answer independently or call tools.
This adds reasoning/transcription latency compared with a standalone speech agent;
latency and exact delivery still need measurement with a configured live account.
The actual generated audio transcript is retained alongside the planned summary.

## Shared state and safety

`RealtimeVoice` owns the peer, media tracks and IDLE/LISTENING/PROCESSING/SPEAKING/
ERROR state. The console and existing instrument consume its state; low-rate output
energy provides a restrained brightness cue, disabled under reduced motion.
SPEAKING follows output-buffer events, not completion of model generation. IDLE can
still mean an armed microphone between turns, explicitly labelled MICROPHONE ON
(since 2026-09-28 the console labels it LISTENING and shows a MIC LIVE badge; a
voice ERROR no longer reaches the instrument — see the section at the end).

VAD speech-start and Interrupt mute/pause locally, cancel the response and clear
the server audio buffer. Connection/turn generations reject late setup callbacks
and old spoken answers. Accepted reasoning turns finish visually after interruption.
Completed queued commands are not discarded when the microphone is stopped.

Only show_projects, open_project and review_proposal are allowed, with validated
status and project IDs. They navigate; they cannot approve, execute, defer or write.
Requests for consequential actions carry a visible authorization notice and direct
the operator to the existing proposal review controls. No spoken "confirm" bypass.

Voice and text use the same SQLite conversation_messages table. The additive
conversation_voice table stores spoken summary, actual audio transcript and playback
status by message ID. Older messages need no migration. Later typed turns include
both visual and spoken context plus interruption status. Raw audio is not persisted.

## Verification

Rust tests cover contract separation, oversized output, action rejection, shared
project context and voice metadata persistence. The fake WebRTC/audio harness covers
permission denial, output timing, barge-in, stale response suppression, late permission,
cleanup, connection loss, playback failure, project navigation validation and context
continuity. The browser fixture checks draft preservation, continued text sending,
transcript and authorization display after voice failure. Existing regression tests
are also run. No lint script is configured.

Live WebRTC negotiation, real Windows microphone permission, acoustic echo, actual
barge-in timing, voice quality and model-generated summary fidelity remain unverified
without an OpenAI API key. Simulations do not establish these hardware/API outcomes.

## Tuning and Phase 2

Server voice/model/VAD/personality: commands/voice.rs. Client shortcut/timeouts:
voiceContract.ts. Browser devices currently use the OS defaults. The transport has
injected dependencies so later device selection/local activation can be added without
changing project state or conversation ownership.

Next: configure the key and run a live acceptance pass; measure end-of-turn latency;
add device selection and persisted preferences; improve immediate spoken feedback
while the orchestrator works. Scoped voice confirmation needs an explicit binding
to the existing immutable proposal, expiry and one-use authorization records before
it can safely be supported. Wake word/custom voices remain later work.

## Official API references checked 2026-09-07

- https://developers.openai.com/api/docs/guides/realtime-webrtc
- https://developers.openai.com/api/docs/guides/realtime-conversations
- https://developers.openai.com/api/docs/guides/realtime-vad
- https://developers.openai.com/api/docs/models/gpt-realtime-2.1
- https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe

## Voice settings (0.8.0)

Open the existing bottom-right Preferences control for Olympus Voice. The curated
selector offers Marin and Cedar; All voices exposes all ten currently documented
Realtime identities without invented personality descriptions. Each can be previewed
using the identical neutral Olympus phrase. Preview uses a receive-only Realtime
connection, pauses the conversation microphone, never invokes the reasoning handler
and never appends messages. Resume microphone explicitly after a preview.

The single catalog is src/config/olympusVoice.json, imported by TypeScript and
embedded/validated by Rust. It owns voice IDs, curated membership, defaults, preview
phrase and behavior/style instructions. Add future supported voices there after
checking official Realtime documentation, then rebuild the application.

The six preferences (selectedVoice, speechStyle, responseDepth, autoSpeak,
captionsEnabled, bargeInEnabled) extend OlympusSettings. Existing persistPreferences
stores their normalized JSON as the voicePreferences key in SQLite settings; browser
fixtures use the existing localStorage path. Older installations receive defaults.
No conversation table or project-state migration is involved.

Voice/style/interruption changes stop playback, close the old peer/data channel,
release capture and request fresh credentials with the selected voice. Existing
connection/turn generations suppress stale audio. Only the transport restarts;
the common reasoning handler, project context, conversation and message IDs remain.
There is no Agents SDK / RealtimeAgent in this application.

Auto Speak governs typed and microphone reply audio; disabling it preserves visual
answers and explicit Replay. Live Captions hides only in-progress recognition; persisted
turns stay readable. Interruption off both disables server auto-interruption and
pauses input capture during output; manual Interrupt restores capture. Brief uses a
25-word spoken limit, Standard preserves the existing 55-word default, Detailed uses
the existing bounded deep-dive contract. Explicit requests for briefings/deep dives
still override the default. Behavior instructions remain separate from voice identity.

Official voice list and immutable-after-audio limitation verified 2026-09-08:
https://developers.openai.com/api/docs/guides/realtime-conversations#voice-options

Verification includes 22 settings/session protocol checks, existing 20 voice checks,
201 Rust tests, TypeScript/build, and browser UI plus actual reload persistence.
Simulated microphone reconnection and interruption are not physical acoustic tests.


## Voice Lab — 0.8.1

All ten Realtime voices are visible in Preferences > Voice Lab. The shared
`src/config/olympusVoice.json` remains the single frontend/backend catalog;
Cedar and Marin are marked OpenAI recommended, with no personality claims.
Preview and Use as Olympus voice are separate actions. The fixed sample contains
fictional project counts for fair comparison and never enters conversation.

Auditions use the existing isolated receive-only Realtime adapter. Starting a new
preview closes the previous preview. The live conversation stays connected;
capture and playback pause during audition and capture resumes after completion,
stop, error or closing settings. Applying a voice keeps the existing session
recreation and SQLite `voicePreferences` persistence. No default was changed.

Verification: 35 preferences/preview protocol checks, 20 existing voice checks;
browser fixture verified all six preferences through a real page reload and
unchanged conversation/project state. Ten live Realtime WebSocket generations
on gpt-realtime-2.1 returned completed audio and exact sample transcripts, with
no rejected voices. This is API generation evidence, not a ten-voice physical
speaker or microphone acceptance test. Build includes TypeScript; no lint script
is configured. Official catalog checked 2026-09-08:
https://developers.openai.com/api/docs/guides/realtime-conversations#voice-options


## Typed replies with audio (September 12, 2026, development)

Typed requests now use the common reasoning handler with the spoken-answer contract
when Auto Speak is enabled. Input remains labelled Text in shared history. The
selected voice, concise summary, full written answer and playback metadata are reused;
no microphone permission is requested. The browser development page remains a
text-only preview because it has no desktop credential bridge.

The transport waits for the data channel to open before sending the reply. New
messages, Stop, Interrupt and preference changes suppress stale audio. Output-only
connections close after playback. Replay works without an armed microphone. The
console distinguishes microphone capture from spoken output, reports audio failures,
and labels a reply Played only after its output-buffer completion event. Backend
instructions distinguish preparing a reply from activating or completing playback.

Protocol coverage includes 21 typed-reply checks in addition to the existing 20
voice and 35 preference checks. The isolated typed-voice-harness.html fixture checks
the actual chat UI, keyboard input identity, microphone-off status, playback receipts,
Replay and failure fallback with simulated audio. Live speaker playback still needs
an acceptance check in a desktop build; browser simulation cannot establish audibility.
Receive-only response behavior checked against the official Realtime conversations
guide on September 12, 2026.

## Design-review changes (September 28, 2026)

See [COMMAND-CONSOLE.md](docs/COMMAND-CONSOLE.md) for the console side of each item.

- **Failure is not an alarm.** A Realtime failure (quota, spend limit, 429, missing or
  refused key, microphone, timeout, blocked playback) no longer puts the instrument in
  its error state; `instrumentState` in `App.tsx` reserves `error` for a failed
  reasoning request. The console reads the failure in one line (`voiceFailure.ts`)
  with Retry audio, Switch replies to Text and Dismiss. `RealtimeVoice.retry()`
  repeats the last attempt once — the spoken reply or the microphone session — and
  `dismissError()` clears it without retrying. `create_voice_session` now names the
  provider's error code (for example `insufficient_quota`) so the line can say why;
  the response body is never echoed. The session counts failures, and the opening
  briefing is not spoken after one.
- **Text leads.** With Voice replies on, the written answer streams as it is
  generated (Rust `VisualStream` forwards only the decoded `visualResponse`) and is
  shown first; the spoken summary is a closed disclosure. No second reasoning call is
  made and the request payload is unchanged; `parse_answer` still validates the whole
  object at the end. Because the schema's properties are serialised alphabetically,
  `spokenResponse` is generated first, so the visible answer starts only after the
  spoken summary has been produced.
- **Receipts.** `playback: "skipped"` records that no audio was attempted because
  replies were set to Text; the receipt reads "Not spoken (Text replies)" instead of
  "Playback unconfirmed". In the browser preview an unrecorded receipt reads "Not
  spoken · audio plays in the desktop app".
- **Names.** Responding (text arriving) is distinct from Speaking (audio). MIC LIVE
  shows while the microphone captures.
- **Preferences.** Reply mode (Text / Voice, the same control as the console) and
  Opening Briefing sit first under Replies & briefing; the voice lab is behind a
  disclosure in the Voice section.

Not verified in this environment: WebView2 autoplay of the opening briefing, a real
429 or quota failure, and streaming latency on real Sol and Claude voice turns.

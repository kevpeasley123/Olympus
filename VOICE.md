# Olympus voice — Phase 1

## Start and stop

Add `OPENAI_API_KEY` to the project root `.env` and restart the desktop app.
Keep `ANTHROPIC_API_KEY`: Olympus still uses its existing reasoning backend.
Do not paste keys into the conversation or put them in Vite/browser variables.
Click the console microphone or press Ctrl+Shift+M to toggle voice. Windows may
request microphone permission on the first activation. Stop voice releases all
microphone tracks. While armed, audio is sent to OpenAI, including during playback
so interruption works. There is no wake word. Silence closes the connection after
two minutes; the session cap is fifteen minutes.

Mute silences output, not the microphone. Stop voice ends capture. Interrupt stops
speech and listens for a correction. Typing remains available; submitting text exits
voice. Replay regenerates the short spoken summary in an active session, so it uses
the API; it does not retain a raw audio recording.

## Architecture

Rust `commands/voice.rs` mints a 60-second client secret with the permanent key.
The webview negotiates WebRTC with `/v1/realtime/calls` and sends microphone audio
through its peer connection. Data-channel events carry transcription, VAD, audio
transcripts, and playback lifecycle. No new server process or package is required.

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
Malformed envelopes fail visibly without affecting existing history.

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
still mean an armed microphone between turns, explicitly labelled MICROPHONE ON.

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

# Voice Lab and usage

Open Preferences, choose ElevenLabs as the Speech provider, then open **Voice Lab · short speech tests** (desktop app).
Enter one to five words (at most 200 characters), then choose Generate. This ends
any live microphone conversation and sends only the script to ElevenLabs. It does
not call OpenAI or reason over the script. The browser preview cannot use saved
native credentials.

Generate uses credits. Stop cancels local work and playback, but cannot guarantee
that the provider has not already charged. Replay reuses the current audio in
memory without a generation request. Editing the script or voice/model, starting
a new generation, or closing settings releases the cached audio. No audio is saved
to disk by Voice Lab.

The quiet Voice session disclosure in the ElevenLabs preferences totals this
native app run. (It left the Command voice dock in the 2026-10-13 redesign.)
The backend captures valid `character-cost` response headers as confirmed
ElevenLabs credits, including when audio delivery subsequently fails. Missing
headers and in-flight/cancelled requests remain unconfirmed. Failures before
submission are shown separately. Records persist, while the displayed session
starts fresh after a native restart. Concurrent app processes have separate IDs.
The query uses a session index and is not truncated to the diagnostics page size.

OpenAI transcription request/token usage is shown separately as client-reported;
its dollar cost remains unconfirmed. A manually entered USD-per-1,000-credits rate
estimates the value of confirmed ElevenLabs credits only. This estimate excludes
unconfirmed usage, OpenAI speech/transcription, reasoning, taxes, and plan billing
adjustments. It is not an invoice or a complete session dollar total.

Live microphone conversations still need an OpenAI API key for transcription.
ElevenLabs speech-only tests need only the ElevenLabs key saved through Windows
Credential Manager. No key belongs in chat, frontend storage, or Git.

Synthetic checks: `node scripts/test-voice-lab.mjs`,
`node scripts/test-voice-lab-browser.mjs`, `node scripts/test-command-voice.mjs`,
`node scripts/test-eleven-voice.mjs`, and the native Rust tests. Live provider
acceptance is separate; these checks do not prove billing or voice quality.

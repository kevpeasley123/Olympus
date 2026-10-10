# ElevenLabs voice

Olympus can use ElevenLabs for spoken answers while keeping the current reasoning route and OpenAI microphone transcription. Typed replies and manual replay do not open a microphone or OpenAI audio session when ElevenLabs is selected.

## Setup in the native development app
1. Open Preferences, then select **ElevenLabs** under Speech provider.
2. Click **Connect API key**. In the Windows credential dialog, paste the API key into **Password**; leave the user name unchanged. The key is stored as `Olympus.ElevenLabs` / `api-key` in Windows Credential Manager. It never crosses webview IPC, enters settings/SQLite, or appears in frontend logs.
3. Keep voice `NOpBlnGInO9m6vDvFkFC`, model `eleven_v4`, English. Both IDs can be changed explicitly as the service evolves. Save edited IDs before checking or previewing.
4. Click **Check connection**. This performs read-only voice/model discovery and generates no audio. The key needs voice/model read access, plus text-to-speech permission for playback.
5. Click **Preview voice** to generate the fixed sample. It uses ElevenLabs credits. **Stop preview** cancels pending work and playback. Cancellation cannot promise a refund for work already received by the provider.
6. Set Replies to Voice for automatic spoken answers. Text mode remains silent; explicit Replay still works. Opening Briefing follows the existing preference.

The browser harness displays configuration controls but cannot connect credentials or generate paid speech. The installed app must contain this code before these controls are available there; running native dev does not install an update.

## Boundaries
- Rust sends only the chosen spoken response, voice ID, model ID and English language code. It requests MP3 audio, with a 50-second HTTP timeout and 8 MiB response ceiling. The frontend plays a transient Blob and releases it on completion/stop/error; speech files are not saved.
- Provider failures are explicit; no automatic paid retries or silent fallback. Check connection validates availability, not account quota or synthesis quality. ElevenLabs' own data-retention policy still applies.
- Windows key entry is native. Replace/remove affects future requests; already-submitted provider work may still be billed. Remove key is local credential deletion, not remote key revocation.
- A maximum of two native generation requests permits live speech and isolated preview. Request IDs reject duplicate submission and remember recent cancellation; old results cannot resume after a new turn or stop.
- Diagnostics record the requested speech model and generation status without keys or speech text. Actual model remains unconfirmed because the audio response does not attest its ID. Audio generation is separate from completed playback; local ended/error/interrupted events determine the latter.
- Speech style choices apply to OpenAI speech and are hidden for ElevenLabs rather than implying unsupported control. Response depth, captions and interruption retain their existing behavior.
- Tests and acceptance profiles never use the production keyring or ElevenLabs API. Local mock HTTP tests cover size/error boundaries. Live verification requires the owner's local key and explicit Preview action.

## References
[ElevenLabs synthesis API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert), [voice discovery](https://elevenlabs.io/docs/api-reference/voices/get), [model discovery](https://elevenlabs.io/docs/api-reference/models/list), [Windows credential dialog](https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-creduipromptforcredentialsw).

## Verification commands
`node scripts/test-eleven-voice.mjs`, `node scripts/test-command-voice.mjs`, `node scripts/test-eleven-browser.mjs <dev-url>`, `cargo test --lib` from `src-tauri`, `npm run build`, and `npm run visual:review`. Browser screenshot output is `output/elevenlabs-review/`; browser checks are not native desktop or live-provider acceptance.

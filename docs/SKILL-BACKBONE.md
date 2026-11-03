# Skill backbone

## Operator workflow

Open **Armory → Skills → Project Change Review**, choose a visible registered Git project or a project under the configured root and run it. Chat accepts `/project-review <folder>` and `Project Change Review for <folder>`. The retained observation distinguishes baseline, changed, unchanged and unavailable, includes the full revision and the commit subject, and leaves the last successful revision intact after a failed read. Temporary chats do not create review history. Daily review is disabled until the operator selects a project for it. Olympus checks the schedule on startup and once a minute while open, with at most one scheduled observation per project and local calendar day. Manual reviews remain available independently.

The native skill reads committed HEAD. It cannot infer release, deployment or task completion from a commit subject. The ordinary portfolio scan retains its own working-tree and session information. For factual briefs, a separate read-only query accepts visible registered project IDs and reads Git activity since the project progress last displayed. The first observation window starts seven days before initial use. Unread or lower-priority findings remain eligible. Each displayed progress item advances only that project's cursor. The pending receipt is saved with its briefing message and consumed transactionally on display, including when an unread message is reopened after restarting Olympus. Timestamp ties use Git object IDs. A failed repository read contributes a coverage item without suppressing healthy repositories. Personal details and private conversations are outside the skill's inputs.

Armory is the executable skill entry point. Registry entries declare an input, authority, command, result and runner. Source-grounded changes may be combined with independently eligible email and remembered context when the evidence explicitly identifies one project. A shared project name alone does not establish a shared deadline, causal relationship or operator obligation.

## Command scene

The engine selector is bound to the existing conversation selection. Engine choice and Claude model are captured at dispatch. A switch updates the accent without rebuilding the scene. Spending protections and explicit feedback handling remain in the native routes. The flagship field represents bounded real assets in stable positions and retains its two-minute revolution. A source observation highlights its actual endpoints in the same rotating group. The reduced-motion path uses a static connection and the textual activity history. The panel distinguishes source-read failures from successful reads. Project review results persist. Mission status is shown separately from observed source reads. Athena and Themis citation pulses require a completed child output whose quoted text and fingerprint match a parent-owned research source. The event points to the real vault note and is labeled as a citation. The session activity panel is a bounded transient history.

## Local voice

In Settings choose **Local · Whisper and Kokoro** to use local speech with the microphone control and spoken replies. The console also exposes local dictation and playback explicitly. Dictation places text in the composer for review. Sending it invokes the chosen reasoning route. Local synthesis and transcription never fall back to cloud speech.

The native worker uses an isolated Python interpreter with `faster-whisper` and `kokoro-onnx`. Set `OLYMPUS_VOICE_PYTHON` to the interpreter and `OLYMPUS_VOICE_MODELS` to the local model folder. In this development checkout the default Windows paths are `.local-voice/runtime/Scripts/python.exe` and `.local-voice/models`. Release builds require explicit paths. Python 3.11, faster-whisper 1.2.1 and kokoro-onnx 0.6.1 were exercised on this machine. The development model directory contains:

- `whisper/` with the CTranslate2 tiny English model, tokenizer, vocabulary and config from [Systran](https://huggingface.co/Systran/faster-whisper-tiny.en).
- `kokoro-v1.0.onnx` and `voices-v1.0.bin` from the [Kokoro ONNX model release](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1).

Model acquisition is separate from runtime. The development assets are ignored by Git. The worker reads local files with the model hub in offline mode. Input audio and synthesized clips are transient. The test phrase is synthetic. Physical microphone, speaker and accent-specific recognition remain hardware acceptance checks.

## Verification

- Run `npm run build` and `cargo test --offline --manifest-path src-tauri/Cargo.toml --lib`. Native fixtures cover committed changes, missing sources, recovery after failure and daily deduplication.
- Run `node scripts/test-review-brief.mjs`, `node scripts/test-briefing-memory.mjs`, and `node scripts/test-conversation-feedback.mjs` for source association, private scope, corrections, revision changes and display receipts.
- With the local models provisioned, run `cargo test --offline --manifest-path src-tauri/Cargo.toml --lib offline_worker_round_trip -- --ignored --nocapture`. It exercises the native synthesis and transcription commands using generated audio.
- Run `node scripts/test-local-speech-browser.mjs` against a loopback Vite server at port 31430 to exercise the microphone control with generated audio, offline Whisper and the editable composer. The test uses a fake audio device.
- Run a loopback Vite server at port 31430, then `node scripts/test-skill-backbone-browser.mjs`. This uses the flagship browser fixture and synthetic IPC to exercise switching, visual continuity, reduced motion, Armory review results, scheduling and activity history. The ring review checks two visible legacy rings in their non-flagship scene and zero in the flagship, where the real assets rotate.

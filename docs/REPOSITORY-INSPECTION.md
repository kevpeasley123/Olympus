# Bounded repository inspection

Command's idle workspace offers **Inspect a project (read-only)**. Choose a
project, review the filled request, and press Send. The equivalent console
request is `/inspect Exact project folder: question`. Ordinary conversation
does not automatically read repositories. Selecting a project never sends a
request or creates memory.

This is a bounded JSON planning workflow, not native provider function calling,
a subscription engine, or a general agent framework. It uses the selected
OpenAI API route, with at most three planning requests and one final answer.
The Claude comparison route refuses inspection without switching providers.
There is no automatic retry or fallback. The whole console turn has a
four-minute deadline and a Stop control. Stop drops the local HTTP future;
provider work already accepted may still incur usage.

The backend resolves an exact direct-child Git project from the persisted
projects root. It does not trust the frontend's root or the model's paths.
Tools list a bounded set of source/document filenames and read an exact
allowlisted file. They cannot run a shell, write, search the vault, or delegate.
Links/reparse points, traversal, hidden paths, generated folders, secret-like
filenames, non-source data, and common credential signatures are refused.
This conservative filter can withhold legitimate authentication implementation
files; report missing evidence rather than relaxing it silently.

Limits: 1,500 directory entries, depth eight, 300 filenames, 128 KB per file,
120 lines and 6,000 characters per read, three reads total. File listings are
always described as potentially partial. Evidence is supplied through the
existing untrusted-evidence boundary. A deterministic receipt appended to the
saved answer records the inspected filenames, line ranges, and full SHA-256
fingerprints. It does not claim a test ran or that a recommendation was approved.
Interrupted request receipts retain an interrupted status rather than an
unfinished success claim. Profile Observations remain excluded from memory.

Verification uses synthetic/mocked planning, including a read of this checkout's
project CSS, not a paid model. A live issue-finding answer's quality and native
WebView2 behavior still require an explicitly authorized desktop pass. The
browser harness's `?inspect-check` verifies scope selection fills the draft
without sending or opening a memory writer.

## Verification on October 7, 2026

The combined local checkout includes the owner's pre-existing visual edits.
Production TypeScript/Vite build passes (existing large-chunk warning remains).
Full offline Rust suite: 431 passed, zero failed, 16 ignored. The six focused
repository-inspection tests also passed after Markdown receipt escaping was
hardened. Focused frontend suites passed for project board/delegation, Library,
console/voice routing, and capabilities.

Full Command visual review: 21 captures and 57 functional checks. Additional
synthetic browser checks verify inspection selection does not send or create
memory, research unavailable state does not start work, galaxy motion leaves
nine cards stationary, reduced motion freezes rendering, and context loss
restores the SVG fallback. Run `node scripts/pantheon-visual-review.mjs <url>`
against a local Vite harness for the latter captures. This checks browser GPU
rendering, not installed WebView2 performance. Shared scene depth testing
provides front/back occlusion; no desktop visual acceptance was possible because
native computer control was unavailable in the agent runtime.

No application release/install, push, live provider task, credential change, or
production-data mutation was performed. Live answer quality and the installed
application version remain unverified.

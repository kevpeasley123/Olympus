# ChatGPT connection offline progress

Implementation approved by Kevin; approval covers continued offline work without
reconfirmation. No browser consent, real credential access, settings changes or
generation has occurred. No install/push/merge.

Implemented authorization preparation and one-use callback validation in
`src-tauri/src/commands/chatgpt_plan.rs`. The tokens module verifies RSA signatures
using ring (already present in the lockfile, now a direct offline dependency),
issuer, audience, nonce, expiry, subject and granted scopes. Credential records
have no Debug implementation; Windows storage uses an Olympus-specific service and
hashed client/subject keys. Refresh/store is serialized in the session object.
Tests inject an in-memory store and refresh transport. The checked-in fixture
contains a generated public key and synthetic token, never its signing private key.

Fixed-origin bounded OAuth exchange/refresh and trusted discovery/JWKS transport
functions are implemented but uncalled. Redirects are disabled and key discovery
is constrained to auth.openai.com HTTPS. No provider network test was executed.
This is not an end-to-end connection. Remaining implementation includes the
bounded OAuth listener/controller, persistent host
metadata, singleton session orchestration, disconnect/revocation, and connecting
the native controls to it. There is no real token-exchange or generation entry point
from the UI. The settings component is a disabled disclosure, not completed native
acceptance. Existing spending refusal is untouched.

Verification: frontend build passed; focused token/callback tests passed; full
Rust run passed before the final credential-key isolation adjustment, with a final
rerun recorded in `output/chatgpt-plan-tokens-host.txt`. Engine usage formatting
fixtures passed. Targeted engine browser harness timed out on initial local page
load; no changed-screen visual acceptance was obtained. Full visual runner status
is recorded separately in `output/chatgpt-plan-visual.txt`. Do not present either
browser coverage or native acceptance as passing without a completed result.
The full visual runner stalled without captures and was interrupted.

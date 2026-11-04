# Native briefing boundaries — 2026-11-04

Uncommitted isolated work in codex/olympus-brief-synthesis. No accounts, installed app, production DB, consent, credentials or generation settings changed.

## Implementation and remaining work

Origin metadata now persists through opening/requested hooks and conversation storage without a schema migration. Native model attribution requires a completed briefing request plus exact native-issued binding to content, conversation, source/packet revisions and preparation time. Replay under a new message ID is refused. Existing IDs cannot acquire or replace origin. Historical missing origins stay unknown. No production binding issuer exists: save fails closed until trusted native composition is implemented.

The native source resolver uses the real schema in synthetic in-memory tests. It loads mail and remembered context itself, validates eligibility and native revisions in a single snapshot, rejects caller prose/authority and leaves memory lower-authority. A separate source gate prevents the aggregate webview packet from starting inference, even if spending readiness later changes. The resolver is not hooked to IPC. Session ownership/reference issuance, operator resolution retrieval, relevant context selection, and live semantic quality remain outstanding. Source authentication does not authenticate the truth of a sender's claims.

Independent review found a request replay gap; the exact native binding and single-use validation address it. Tests cover wrong account, stale/changed/deleted sources, imported memory, injected text, authority spoofing, missing/forged model records, cross-conversation replay, changed text/time/references and legacy immutability.

## Spending: precise route applicability and least-privilege next action

Claude's official support page documents that disabling Usage credits leaves only included plan usage and applies to Claude Code: https://support.claude.com/en/articles/12429409-manage-usage-credits-for-paid-claude-plans . This matches the intended claude.ai subscription runner, not API-key or cloud-provider billing. The source currently accepts an account-bound Max confirmation but still unconditionally blocks generation for pre-launch spending and plugin-isolation qualification. A saved confirmation alone is not ongoing provider enforcement proof.

Least-privilege verification: on the exact Claude subscription account, view Settings > Usage and confirm the saved Usage credits state is Disabled. Do not toggle it, purchase funds, alter auto-reload, log in again, or launch inference. If enabled, a separate user decision is needed to disable it. We did not inspect that account. Auto-reload off only prevents automatic purchases; it does not prevent consuming existing paid credits. A low positive monetary cap still permits extra spending.

OpenAI local integration docs explicitly support open-source/locally hosted apps using a registered client, consented plan usage, and public Responses with store:false/stream:true: https://developers.openai.com/siwc/token-sharing-open-source and https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference . This is distinct from the existing Codex CLI path and does not grant conversations or memories.

The official app controls are described at https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites : app credit use is a separate saved opt-in; an app limit below 100% prevents that app using credits. A below-100% limit is a percentage cap on included allowance, not a dollar budget or a claim of zero total subscription cost. It can prevent overage for the eligible app under the documented rule, but does not establish settings for another route/account or prevent Olympus offering a separate paid fallback. Olympus must continue refusing that fallback.

Least-privilege verification: view ChatGPT Settings > Usage for the exact already-registered Olympus client and workspace, inspect the saved app credit-use preference and per-app limit. No new registration/consent should be created merely to inspect settings. If the client is absent, this route is not yet established; stop before registering or consenting. No account was viewed or changed. We found no documented request-level included-only switch that replaces this provider/account qualification. Disabling automatic purchases is insufficient because existing credits can still be spent; see https://help.openai.com/en/articles/12642688-using-credits-for-flexible-usage-in-chatgpt-personal-plans .

These actions are pending account verification, not denied by automatic review. Synthetic source/persistence implementation is complete at its documented boundary; end-to-end model briefing remains deliberately disabled.

Verification: full offline Rust unit suite 700 passed / 26 ignored; focused frontend checks and TypeScript passed. The repository suite includes a read-only vault graph diagnostic; feature fixtures use in-memory databases. Independent follow-up review found the binding gap closed. Single-use protection currently lasts while the attribution row exists; permanent prevention after deleting history needs an independent consumption record.

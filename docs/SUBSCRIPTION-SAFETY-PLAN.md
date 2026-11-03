# Subscription conversation safety plan

## Goal and authority

Establish a Claude-subscription conversation in native Olympus using included
allowance only. Preserve data, credentials, UI identity and ElevenLabs. No API or
Codex fallback. Read-only account checks and offline fixes are authorized; delivery,
installation, new permissions and billing changes require separate authorization.
Current findings and verification live in `NEXT-SESSION.md`.

## Required sequence

- [x] Reconcile checkout, newer work, installed app and account identity.
- [x] Close Codex generation; preserve independent read-only quota inspection.
- [x] Remove background Codex fallback; preserve paid API and voice denials.
- [x] Add managed-policy checks and strict retrospective Claude overage validation.
- [x] Prepare isolated debug acceptance data and read-only confirmation access.
- [ ] Establish current supported pre-launch subscription-only / overage-off proof.
- [ ] Establish plugin isolation before submitting another prompt.
- [ ] Reopen Claude through reviewed pre-launch gates and repeat offline checks.
- [ ] Minimal live adapter acceptance, then native reply and contextual follow-up.
- [ ] Native cancellation/recovery; simulated faults where possible.
- [ ] Record exact accepted revision/build; request delivery approval separately.

## Fail-closed boundary

Both Claude and Codex chat/job entry points refuse generation while required
pre-launch evidence is unavailable. Existing confirmation files, account readers,
transport implementations and model choices are preserved. No frontend flag or
environment variable bypasses the generation refusal. Post-submission overage
telemetry validates results but cannot establish pre-request spending protection.
The isolated profile suppresses background generation, Gmail and speech; production
settings are not changed. Preserve the strict built-in plugin allowlist.

## Verification requirements

Tests must establish denial before authorization reads, child processes or prompts,
paid boundary coverage, cancellation cleanup, malformed/unknown event rejection,
and no fallback. Offline fixtures are not native or provider acceptance. Record
submitted live attempts and unknown usage honestly, including failed initialization.

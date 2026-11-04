# Next session

## Olympus 0.44.0

This release integrates the skill backbone with the published 0.43.0 release. See [Skill backbone](SKILL-BACKBONE.md) for operations and fixture verification. Local voice requires a provisioned Python runtime and model folder. Production Gmail recovery, provider generation and physical microphone acceptance remain separate. Migration 4 is additive.

## Remaining boundaries

Live Gmail recovery and Google consent publishing mode remain unverified. Preserve
the seven-day horizon and all provider/consent/spending gates. Native rollout still
requires a restorable operational DB backup; migration 3 is additive and uninstalled,
and older binaries reject the newer schema. Historical auth/acceptance blockers:
archive/NEXT-SESSION-before-2026-11-02-gmail-foundation.md. Research import and
the original checkout remain separate; the committed Zeus-height branch is included. Saving this milestone does not complete the
requested Obsidian audit.

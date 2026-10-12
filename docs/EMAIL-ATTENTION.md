# Email attention and local analysis

October 11, 2026 (released from 0.28.0; part of the installed 0.30.0). The Mission brief in the console's idle view shows up to three source-grounded suggestions, separately from mission activity and situation maps, with a count of any further ones. Review reveals the source quote; Snooze 1 day, Handled and Dismiss save account/thread/source-signature-bound local decisions. They never modify Gmail or establish an operator commitment. Changed evidence can resurface; unchanged evidence preserves decisions. Stale sources are withheld. Empty suggestions do not prove all mail has been reviewed. Discovery retains bounded six-thread batches and validates exact source quotations, message identities and literal date text. Interpretation remains generated and needs review.

## Install a local model later

As of 2026-10-11 no local model was downloaded or installed. The email-only Ollama adapter is opt-in through the private project .env:

```
OLYMPUS_EMAIL_ANALYSIS_PROVIDER=ollama
# Set this only after installing and evaluating the exact model:
# OLYMPUS_EMAIL_MODEL=qwen3:8b
```

Missing local model configuration fails visibly without cloud fallback. Absence of the provider variable preserves the existing OpenAI route; explicit openai selects it. Chat/voice routes remain independent. Later, install Ollama and download/import a model, enter its exact installed tag, restart Olympus, and perform synthetic acceptance before live analysis. Olympus does not pull models.

Transport is fixed to http://127.0.0.1:11434 with proxies and redirects disabled. Local installed-model and remote-host metadata checks precede sending content. No cloud model tags, tools or fallback. Requests use JSON schema, 16K context, 4096 output tokens, 120-second timeout and 48KB serialized context ceiling. Oversized, malformed and incomplete results fail rather than publishing partial findings. Actual local output quality and throughput remain unverified until a model is installed.

This computer (2026-10-11): approximately 32 GB RAM, RTX 4070 SUPER with 12 GB VRAM, approximately 1.1 TB free disk. Example Qwen3 downloads: 8B 5.2 GB, 14B 9.3 GB. Initial planning allowance: 10–15 GB disk for an 8B setup; runtime memory exceeds weight size. These are estimates, not benchmarks. https://registry.ollama.com/library/qwen3/tags

## Gmail quota repair

Google's May 2026 quotas charge 20 units per messages.get, with 6,000 units per minute per user per project. Runtime 403 metadata confirmed totalQueryCostPerMinutePerUser=6000. The old 100 ms pacing could use 12,000 units per minute. Shared 250 ms pacing budgets 4,800 units per minute, leaving 20% headroom. 2,000 reads require 500 seconds of base pacing. A rate-limit response imposes a shared 60-second cooldown and doubles spacing up to one second; workers claim slots only at send time. The import ceiling is 30 minutes to allow bounded recovery. Regression checks base quota headroom and pacing. Logging includes only route categories, allowlisted errors and quota metadata, never tokens or message content. https://developers.google.com/workspace/gmail/api/reference/quota

Only one native app should use a given operational database at once. Installed and development apps were both running during diagnosis; installed app was closed. This change does not introduce cross-process locking. Cache commits remain atomic; large imports or other activity may still require retries.

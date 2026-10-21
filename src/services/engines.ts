import { invoke } from "@tauri-apps/api/core";

/** Which sign-in an engine would use when Olympus launches it (`engines.rs`). */
export type EngineSignIn =
  | { state: "subscription"; plan: string | null }
  | { state: "apiBilled"; detail: string }
  | { state: "signedOut" }
  | { state: "notFound"; detail: string }
  | { state: "unknown"; detail: string };

export interface EngineStatus {
  engine: "codex" | "claude-code";
  name: string;
  executable: string | null;
  version: string | null;
  signIn: EngineSignIn;
  observedAt: string;
  selection: string;
  capabilities: { streaming: boolean | null; structuredOutput: boolean | null; ephemeral: boolean | null; source: string };
  billing: EngineBilling;
}

export type EngineBilling = { state: "unknown" | "ineligible"; detail: string };

export function describeBilling(billing: EngineBilling): string {
  return `Generation blocked. ${billing.detail}`;
}

export function loadEngineStatus(): Promise<EngineStatus[]> {
  return invoke<EngineStatus[]>("engine_status");
}

const SIGN_IN_COMMAND: Record<EngineStatus["engine"], string> = {
  codex: "codex login",
  "claude-code": "claude auth login",
};

/** One sentence per engine, in the app's own words. */
export function describeSignIn(status: EngineStatus): string {
  const sign = status.signIn;
  switch (sign.state) {
    case "subscription":
      if (status.engine === "codex") return "ChatGPT subscription.";
      return sign.plan?.trim() ? `Claude ${sign.plan[0].toUpperCase()}${sign.plan.slice(1)} subscription.` : "Claude subscription.";
    case "apiBilled":
      return `Would bill the API: ${sign.detail}. Olympus will not launch it.`;
    case "signedOut":
      return `Not signed in. Run ${SIGN_IN_COMMAND[status.engine]} and sign in with your subscription.`;
    case "notFound":
      return `Not found. ${sign.detail}`;
    case "unknown":
      return `Not confirmed: ${sign.detail}. Olympus treats it as not a subscription.`;
  }
}

/** The operator's confirmation that Claude usage credits are off (`claude_subscription.rs`). */
export interface ClaudeSubscriptionAuthorization { statement: string; confirmedAt: string | null; email: string | null }

export function loadClaudeAuthorization(): Promise<ClaudeSubscriptionAuthorization> {
  return invoke<ClaudeSubscriptionAuthorization>("claude_subscription_authorization");
}
/** Checks the live sign-in first; records nothing unless it is a claude.ai Max account. */
export function confirmClaudeSubscription(statement: string): Promise<ClaudeSubscriptionAuthorization> {
  return invoke<ClaudeSubscriptionAuthorization>("confirm_claude_subscription", { statement });
}
export function revokeClaudeSubscription(): Promise<ClaudeSubscriptionAuthorization> {
  return invoke<ClaudeSubscriptionAuthorization>("revoke_claude_subscription");
}

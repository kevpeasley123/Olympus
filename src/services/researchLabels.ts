/**
 * Human wording for the Research inspectors' stored states (review D3/D4).
 * The stored strings stay untouched and remain visible under Internals; the
 * ordinary view reads "Evidence snapshot ready", not `snapshot_ready`.
 * An unknown value is shown humanised rather than hidden.
 */

export function humanize(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const text = value.replace(/[_-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Not recorded";
}

const RUN_STATUS: Record<string, string> = {
  running: "Running",
  completed: "Completed",
  insufficient: "Completed · insufficient evidence",
  failed: "Failed",
  interrupted: "Interrupted",
  cancelled: "Cancelled",
  pending: "Not dispatched",
  stale: "Stopped · past its deadline"
};

/** Research Verification run and agent execution states. */
export function runStatusLabel(status: string): string {
  return RUN_STATUS[status] ?? humanize(status);
}

const AUDIT_STATUS: Record<string, string> = {
  running: "Running",
  snapshot_ready: "Evidence snapshot ready",
  incomplete: "Incomplete",
  failed: "Failed",
  interrupted: "Interrupted"
};

export function auditStatusLabel(status: string): string {
  return AUDIT_STATUS[status] ?? humanize(status);
}

const AUDIT_OUTCOME: Record<string, string> = {
  needs_you: "Needs your review",
  no_findings_in_scope: "No findings in the inspected scope",
  incomplete: "Incomplete"
};

export function auditOutcomeLabel(outcome: string): string {
  return AUDIT_OUTCOME[outcome] ?? humanize(outcome);
}

const AUDIT_VERIFICATION: Record<string, string> = {
  source_snapshot_verified: "Source snapshot verified",
  incomplete: "Incomplete"
};

export function auditVerificationLabel(value: string): string {
  return AUDIT_VERIFICATION[value] ?? humanize(value);
}

const HEALTH: Record<string, string> = {
  unchanged: "Unchanged since this audit",
  stale: "Changed since this audit",
  changed: "Changed since this audit",
  missing: "Missing from the vault",
  unavailable: "Could not be checked"
};

/** Current state of an audit's evidence, from `inspect_knowledge_audit`. */
export function healthLabel(state: string): string {
  return HEALTH[state] ?? humanize(state);
}

const FINDING_KIND: Record<string, string> = {
  source_review: "Source review",
  prior_evidence_changed: "Earlier evidence changed",
  operator_checkpoint: "Operator checkpoint"
};

export function findingKindLabel(kind: string): string {
  return FINDING_KIND[kind] ?? humanize(kind);
}

const VERDICT: Record<string, string> = {
  SUPPORTED: "Supported",
  CONTRADICTED: "Contradicted",
  INSUFFICIENT: "Insufficient"
};

export function verdictLabel(status: string): string {
  return VERDICT[status] ?? humanize(status.toLowerCase());
}

const NODE: Record<string, string> = {
  scope: "Scope",
  research: "Research",
  verification: "Verification",
  clarification: "Clarification",
  reverification: "Re-verification",
  join: "Olympus brief",
  history: "Earlier audits",
  reviews: "Delegation reviews",
  verify: "Snapshot check",
  route: "Route"
};

export function nodeLabel(id: string): string {
  return NODE[id] ?? humanize(id);
}

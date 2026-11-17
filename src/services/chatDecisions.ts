import { decideExpectation, decideProposal, proposalEffect, readProposals, readVision, type Expectation, type Proposal } from "./loops";

/**
 * Kevin deciding on the weekly review's proposals and on his expectations from
 * the chat window or the microphone, since those are the only places he talks
 * to Olympus. Deliberately literal: a decision changes how Olympus behaves, so
 * only a short message that names the thing and the verb counts. A question
 * about proposals, or a sentence that merely mentions them, goes to the model.
 */
export interface ChatDecision { action: "accept" | "dismiss" | "list"; proposals: boolean; expectations: boolean }

const ACCEPT = /\b(?:accept|approve|adopt)\b/i, DISMISS = /\b(?:dismiss|reject|decline)\b/i;
const LIST = /\b(?:what are|what were|show|list|read)\b/i, NEGATED = /\b(?:don'?t|do not|not|never|should i|can i|how do i)\b/i;

export function matchChatDecision(text: string): ChatDecision | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("/") || trimmed.split(/\s+/).length > 12 || NEGATED.test(trimmed)) return null;
  const proposals = /\bproposals?\b/i.test(trimmed), expectations = /\bexpectations?\b/i.test(trimmed);
  if (!proposals && !expectations) return null;
  const accept = ACCEPT.test(trimmed), dismiss = DISMISS.test(trimmed);
  if (accept !== dismiss && !trimmed.includes("?")) return { action: accept ? "accept" : "dismiss", proposals, expectations };
  return !accept && !dismiss && LIST.test(trimmed) ? { action: "list", proposals, expectations } : null;
}

const NUMBERS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const count = (n: number, noun: string) => `${NUMBERS[n] ?? n} ${noun}${n === 1 ? "" : "s"}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const titles = (items: readonly { title: string }[]) => items.map(p => p.title).join("; ");

/** The reply for a decision, given what was waiting. Pure, so the wording is testable. */
export function describeDecision(decision: ChatDecision, waiting: { proposals: readonly Proposal[]; expectations: readonly Expectation[] }): string {
  const parts: string[] = [];
  if (decision.proposals) {
    const now = waiting.proposals.filter(p => proposalEffect(p) === "in-effect"), later = waiting.proposals.filter(p => proposalEffect(p) !== "in-effect");
    if (!waiting.proposals.length) parts.push("No proposals are waiting on you.");
    else if (decision.action === "list") parts.push(`${cap(count(waiting.proposals.length, "proposal"))} waiting: ${titles(waiting.proposals)}. Say "accept the proposals" or "dismiss the proposals".`);
    else if (decision.action === "dismiss") parts.push(`Dismissed ${count(waiting.proposals.length, "proposal")}. Nothing changes.`);
    else {
      if (now.length) parts.push(`Accepted. ${cap(count(now.length, "instruction"))} now in effect: ${titles(now)}.`);
      if (later.length) parts.push(`${now.length ? "" : "Accepted. "}${cap(count(later.length, "build task"))} for the next coding session: ${titles(later)}.`);
    }
  }
  if (decision.expectations) {
    const n = waiting.expectations.length;
    if (!n) parts.push("No expectations are waiting on you.");
    else if (decision.action === "list") parts.push(`${cap(count(n, "expectation"))} waiting: ${waiting.expectations.map(e => e.statement).join(" ")} Say "approve the expectations" to have me scored against them.`);
    else if (decision.action === "dismiss") parts.push(`Retired ${count(n, "expectation")}.`);
    else parts.push(`Approved ${count(n, "expectation")}. I am scored against them from now on.`);
  }
  return parts.join(" ");
}

/** Carries the decision out and says what changed. Only what is still `proposed` is touched. */
export async function applyChatDecision(decision: ChatDecision): Promise<string> {
  const proposals = decision.proposals ? (await readProposals()).filter(p => p.status === "proposed") : [];
  const expectations = decision.expectations ? ((await readVision())?.expectations ?? []).filter(e => e.status === "proposed") : [];
  if (decision.action !== "list") {
    for (const p of proposals) await decideProposal(p.id, decision.action === "accept" ? "accepted" : "dismissed");
    for (const e of expectations) await decideExpectation(e.id, decision.action === "accept" ? "approved" : "retired");
  }
  return describeDecision(decision, { proposals, expectations });
}

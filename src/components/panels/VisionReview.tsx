import { invoke } from "@tauri-apps/api/core";
import { Fragment, useEffect, useState, useSyncExternalStore } from "react";
import { decideExpectation, decideProposal, describeExpectation, proposalEffect, readProposals, readVision, type Expectation, type Proposal, type VisionReport } from "../../services/loops";
import { isVisionReview, runOperation, skillRunsSnapshot, subscribeSkillRuns, type SkillRun } from "../../services/skillRuns";
import { isTauriRuntime } from "../../services/launcher";

const PROPOSAL_KIND: Record<string, string> = { instruction: "Instruction", setting: "Setting", check: "New check", build: "Build task" };
const SKILL_NAME: Record<string, string> = { "opening-brief": "the brief", "work-request": "Ask Olympus", "answer-from-sources": "answers from your sources", "research-assignment": "Athena", "verification-assignment": "Themis", "vision-review": "the weekly review" };

/**
 * The review's proposals and Kevin's decisions. Accepting an instruction puts it into effect for
 * its skill at once; other kinds go to the next coding session. Each button is his decision.
 */
function Proposals({ name }: { name: (id: string) => string }) {
  const [items, setItems] = useState<Proposal[]>([]);
  const [error, setError] = useState("");
  const load = () => readProposals().then(setItems).catch(e => setError(String(e)));
  useEffect(() => { void load(); }, []);
  const decide = async (p: Proposal, status: Proposal["status"]) => { try { await decideProposal(p.id, status); await load(); } catch (e) { setError(String(e)); } };
  const waiting = items.filter(p => p.status === "proposed");
  const inEffect = items.filter(p => p.status === "accepted" && proposalEffect(p) === "in-effect");
  const queued = items.filter(p => p.status === "accepted" && proposalEffect(p) === "coding-session");
  const line = (p: Proposal) => <><b>{PROPOSAL_KIND[p.kind] ?? p.kind}{p.skill !== "none" ? ` for ${SKILL_NAME[p.skill] ?? p.skill}` : ""}: {p.title}</b> {p.detail} <small>For: {name(p.expectation)}</small></>;
  if (error) return <p className="vision-score">Proposals are unavailable: {error}</p>;
  if (!items.length) return null;
  return <>
    {waiting.length > 0 && <><h4>Proposed improvements</h4><ol>{waiting.map(p => <li key={p.id}>{line(p)}
      <span className="vision-actions inline"><button type="button" onClick={() => void decide(p, "accepted")}>{proposalEffect(p) === "in-effect" ? "Accept and apply" : "Accept"}</button><button type="button" onClick={() => void decide(p, "dismissed")}>Dismiss</button></span></li>)}</ol></>}
    {inEffect.length > 0 && <><h4>In effect</h4><ul>{inEffect.map(p => <li key={p.id}>{line(p)}<span className="vision-actions inline"><button type="button" className="quiet" onClick={() => void decide(p, "dismissed")}>Remove</button></span></li>)}</ul></>}
    {queued.length > 0 && <><h4>For the next coding session</h4><ul>{queued.map(p => <li key={p.id}>{line(p)}<span className="vision-actions inline"><button type="button" className="quiet" onClick={() => void decide(p, "done")}>Mark done</button></span></li>)}</ul></>}
  </>;
}

/** The latest weekly review, its switch and a way to run it now. Running it is Kevin's choice; it spends one capped run. */
function WeeklyReview({ statements }: { statements: Map<string, string> }) {
  const { runs } = useSyncExternalStore(subscribeSkillRuns, skillRunsSnapshot);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { if (isTauriRuntime()) void invoke<{ settings: Record<string, string> }>("load_persisted_state").then(({ settings }) => setEnabled(settings["vision.review.enabled"] !== "false")).catch(() => setEnabled(true)); }, []);
  const reviews = runs.filter(run => run.skillId === "vision-review");
  const running = reviews.find(run => run.status === "running");
  const latest: SkillRun | undefined = reviews.find(run => run.status === "completed" && run.output && isVisionReview(run.output));
  const review = latest?.output && isVisionReview(latest.output) ? latest.output : null;
  const name = (id: string) => statements.get(id) ?? (id === "new" ? "Something not yet in your expectations" : id);
  const toggle = async () => {
    const next = !enabled;
    try { await invoke("save_settings", { settings: { "vision.review.enabled": String(next) } }); setEnabled(next); }
    catch (e) { setMessage(String(e)); }
  };
  const runNow = async () => { setMessage("Reviewing the week…"); try { const run = await runOperation(null, "claude-code", "vision-review"); setMessage(run.status === "completed" ? "" : `The review stopped: ${run.error ?? "no reason recorded"}`); } catch (e) { setMessage(String(e)); } };
  return <div className="vision-weekly">
    <div className="vision-weekly-bar">
      <span>Weekly review{latest ? ` · last ${new Date(latest.finishedAt ?? latest.startedAt).toLocaleDateString()}` : " · not run yet"}</span>
      {enabled !== null && <button type="button" className="quiet" aria-pressed={enabled} onClick={() => void toggle()}>{enabled ? "On" : "Off"}</button>}
      <button type="button" disabled={!!running} onClick={() => void runNow()}>{running ? "Reviewing…" : "Run now"}</button>
    </div>
    {message && <p className="vision-score" role="status">{message}</p>}
    {review && <div className="vision-latest">
      <p>{review.summary}</p>
      {review.slipped.length > 0 && <><h4>Slipped</h4><ul>{review.slipped.map((entry, i) => <li key={i}><b>{name(entry.expectation)}</b> {entry.evidence}</li>)}</ul></>}
      {review.held.length > 0 && <><h4>Held</h4><ul>{review.held.map((entry, i) => <li key={i}><b>{name(entry.expectation)}</b> {entry.evidence}</li>)}</ul></>}
      <Proposals key={latest?.id} name={name}/>
      {review.newExpectations.length > 0 && <p className="vision-score">{review.newExpectations.length} new expectation{review.newExpectations.length === 1 ? "" : "s"} from your own words added to the list for your approval.</p>}
    </div>}
  </div>;
}

/**
 * Kevin's expectations of Olympus, in his words, and how this week went
 * (docs/VISION-REVIEW.md). Proposals count once he approves them; approving
 * or retiring one is his decision and the only write here.
 */
export function VisionReview({ report: supplied, decide = decideExpectation }: { report?: VisionReport; decide?: typeof decideExpectation }) {
  const [report, setReport] = useState<VisionReport | null>(supplied ?? null);
  const [error, setError] = useState("");
  const load = () => readVision().then(setReport).catch(e => setError(String(e)));
  useEffect(() => { if (!supplied) void load(); }, [supplied]);
  if (error) return <p className="skill-trial-note">Expectations are unavailable: {error}</p>;
  if (!report) return null;
  const act = async (expectation: Expectation, status: Expectation["status"]) => {
    try { await decide(expectation.id, status); if (supplied) setReport({ ...report, expectations: report.expectations.map(e => e.id === expectation.id ? { ...e, status } : e) }); else await load(); }
    catch (e) { setError(String(e)); }
  };
  const proposed = report.expectations.filter(e => e.status === "proposed").length;
  return <section className="loop-scorecard vision-review" aria-label="Your expectations">
    <h3>Your expectations</h3>
    <WeeklyReview statements={new Map(report.expectations.map(e => [e.id, e.statement]))}/>
    <p className="vision-score">{report.score === null ? "No score yet: it counts approved expectations once their checks have run." : `Vision score this week: ${Math.round(report.score * 100)}% (${report.passed} of ${report.total} checks).`}{proposed ? ` ${proposed} proposed from your own words, waiting for you.` : ""}</p>
    <ul>{report.expectations.map(expectation => <li key={expectation.id} data-status={expectation.status}>
      <details>
        <summary><strong>{expectation.statement}</strong><span>{expectation.status === "retired" ? "Retired." : describeExpectation(expectation)}</span></summary>
        <blockquote>{expectation.kevinSaid}<footer>You, {expectation.saidOn}, {expectation.source}</footer></blockquote>
        {expectation.checks.length > 0 && <dl>{expectation.checks.map(check => <Fragment key={check.id}><dt>{check.id}</dt><dd>{check.total ? `${check.passed} of ${check.total}` : "Not run yet"}{check.lastFailure ? ` · last miss: ${check.lastFailure}` : ""}</dd></Fragment>)}</dl>}
      </details>
      {expectation.status === "proposed" && <div className="vision-actions"><button type="button" onClick={() => void act(expectation, "approved")}>Approve</button><button type="button" onClick={() => void act(expectation, "retired")}>Not mine</button></div>}
      {expectation.status === "approved" && <div className="vision-actions"><button type="button" className="quiet" onClick={() => void act(expectation, "retired")}>Retire</button></div>}
      {expectation.status === "retired" && <div className="vision-actions"><button type="button" className="quiet" onClick={() => void act(expectation, "proposed")}>Restore</button></div>}
    </li>)}</ul>
  </section>;
}

import { Fragment, useEffect, useState } from "react";
import { decideExpectation, describeExpectation, readVision, type Expectation, type VisionReport } from "../../services/loops";

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

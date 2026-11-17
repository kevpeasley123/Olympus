import { useEffect, useState } from "react";
import { describeSchedule, readSchedules, runSelfCheck, type ScheduleCard } from "../../services/loops";

/** What Olympus does on a rhythm without being asked, and what its self-check last found. Read when opened. */
export function ScheduledLoops({ cards: supplied }: { cards?: ScheduleCard[] }) {
  const [cards, setCards] = useState<ScheduleCard[] | null>(supplied ?? null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { if (supplied) return; let live = true; readSchedules().then(next => { if (live) setCards(next); }).catch(e => { if (live) setError(String(e)); }); return () => { live = false; }; }, [supplied]);
  if (error) return <p className="skill-trial-note">Scheduled loops are unavailable: {error}</p>;
  if (!cards?.length) return null;
  const check = async () => { setBusy(true); try { setCards(await runSelfCheck()); } catch (e) { setError(String(e)); } finally { setBusy(false); } };
  return <section className="loop-scorecard" aria-label="Scheduled loops">
    <h3>On a schedule, while Olympus is open</h3>
    <ul>{cards.map(card => <li key={card.id}>
      <details open={card.findings.length > 0}>
        <summary><strong>{card.name}</strong><span>{describeSchedule(card, Date.now())}</span></summary>
        <dl>
          <dt>Does</dt><dd>{card.does}</dd>
          <dt>Costs</dt><dd>{card.cost}</dd>
          {card.findings.length > 0 && <><dt>Found</dt><dd>{card.findings.map(f => <span key={f.id} style={{ display: "block" }}>{f.text}{f.needsKevin ? " Needs you." : ""}</span>)}</dd></>}
        </dl>
        {card.id === "self-check" && !supplied && <button type="button" className="quiet" disabled={busy} onClick={() => void check()}>{busy ? "Checking" : "Check now"}</button>}
      </details>
    </li>)}</ul>
  </section>;
}

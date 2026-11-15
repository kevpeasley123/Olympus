import { useEffect, useState } from "react";
import { describeScore, readScorecard, type LoopCard } from "../../services/loops";

/** Each loop's contract and how it did this week, for Diagnostics. Read when opened, never polled. */
export function LoopScorecard({ cards: supplied }: { cards?: LoopCard[] }) {
  const [cards, setCards] = useState<LoopCard[] | null>(supplied ?? null);
  const [error, setError] = useState("");
  useEffect(() => { if (supplied) return; let live = true; readScorecard().then(next => { if (live) setCards(next); }).catch(e => { if (live) setError(String(e)); }); return () => { live = false; }; }, [supplied]);
  if (error) return <p className="skill-trial-note">Loop scores are unavailable: {error}</p>;
  if (!cards?.length) return null;
  return <section className="loop-scorecard" aria-label="Loop scorecard, last 7 days">
    <h3>Loops, last 7 days</h3>
    <ul>{cards.map(card => <li key={card.id}>
      <details>
        <summary><strong>{card.name}</strong><span>{describeScore(card)}</span></summary>
        <dl>
          <dt>Trigger</dt><dd>{card.trigger}</dd>
          <dt>Goal</dt><dd>{card.goal}</dd>
          <dt>Verifier</dt><dd>{card.verifier}</dd>
          <dt>Actions</dt><dd>{card.actions}</dd>
          <dt>Memory</dt><dd>{card.memory}</dd>
          <dt>Cap</dt><dd>{card.cap}</dd>
          <dt>Your gate</dt><dd>{card.gate}</dd>
          <dt>Weakest part</dt><dd>{card.gap}</dd>
        </dl>
      </details>
    </li>)}</ul>
  </section>;
}

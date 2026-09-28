import { stanceLabel } from "./libraryModel";

/**
 * Glyphs rather than icon components: a list of thousands of rows renders one
 * of these per row, and an SVG each was the most expensive part of the row.
 */
const SHAPES = {
  endorsed: "✓",
  provisional: "◐",
  disputed: "▲",
  unevaluated: "◌"
} as const;

/**
 * The operator's judgement of a source, as a word and a shape — never colour
 * alone. `unevaluated` stays the quietest: the absence of a judgement should
 * not draw the eye more than a judgement does.
 */
export function StanceMark({ stance, compact = false }: { stance: string | undefined; compact?: boolean }) {
  const value = (stance && stance in SHAPES ? stance : "unevaluated") as keyof typeof SHAPES;
  return (
    <span className={`library-stance is-${value}${compact ? " is-compact" : ""}`}>
      <span className="library-stance__shape" aria-hidden="true">{SHAPES[value]}</span>
      <span>{stanceLabel(value)}</span>
    </span>
  );
}

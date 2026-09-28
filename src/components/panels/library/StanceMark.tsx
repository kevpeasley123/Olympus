import { CircleCheck, CircleDashed, CircleDot, TriangleAlert } from "lucide-react";
import { stanceLabel } from "./libraryModel";

const SHAPES = {
  endorsed: CircleCheck,
  provisional: CircleDot,
  disputed: TriangleAlert,
  unevaluated: CircleDashed
} as const;

/**
 * The operator's judgement of a source, as a word and a shape — never colour
 * alone. `unevaluated` stays the quietest: the absence of a judgement should
 * not draw the eye more than a judgement does.
 */
export function StanceMark({ stance, compact = false }: { stance: string | undefined; compact?: boolean }) {
  const value = (stance && stance in SHAPES ? stance : "unevaluated") as keyof typeof SHAPES;
  const Shape = SHAPES[value];
  return (
    <span className={`library-stance is-${value}${compact ? " is-compact" : ""}`}>
      <Shape size={compact ? 11 : 12} aria-hidden="true" strokeWidth={2.25} />
      <span>{stanceLabel(value)}</span>
    </span>
  );
}

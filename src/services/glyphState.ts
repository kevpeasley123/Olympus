/**
 * The omega glyph's three presence states.
 *
 * Kept out of the component so the envelope and the state rule are assertable
 * without a DOM — the same reason the ring's layout lives in `projectRing.ts`.
 */

export type GlyphState = "idle" | "thinking" | "speaking";

export interface GlyphStateInput {
  /** A request is in flight and nothing has come back. */
  pending: boolean;
  /**
   * Response text is arriving incrementally.
   *
   * **Always false today.** `assistant.rs` calls `.send().await` and parses one
   * complete JSON body — there is no stream, so there is no moment at which text
   * starts arriving. Wiring this up is the single change needed once the chat
   * streams; nothing else here has to move.
   */
  producing: boolean;
}

/**
 * Derived, never scheduled.
 *
 * **This is the whole reset mechanism.** No state is entered by a timer, so none
 * can be stranded by one. An error, a cancellation and a normal completion all
 * clear `pending`, and the glyph falls back to idle through the same transition —
 * there is no path that leaves an animation running because a callback did not
 * fire.
 */
export function glyphStateFor({ pending, producing }: GlyphStateInput): GlyphState {
  if (producing) return "speaking";
  if (pending) return "thinking";
  return "idle";
}

/**
 * The idle breath.
 *
 * Slow enough to read as ambient rather than as a signal: nothing on this
 * instrument should be mistaken for data because it moves. Exposed as CSS custom
 * properties so the later wake behaviour — instrument dims and the breath slows
 * after several minutes idle — is a variable change rather than a rewrite.
 */
/**
 * **These three are the source for the idle breath. Tune them here.**
 *
 * `CommandInstrument` writes them onto `.omega-presence` as `--breath-duration`,
 * `--breath-scale-low` and `--breath-scale-high`; the declarations in
 * `styles.css` are fallbacks that apply only if that element never mounts, and
 * `glyphState.harness.ts` asserts the two agree **by equality**.
 *
 * **[V] They were two truths and drifted within one turn, on 2026-07-30**: the
 * CSS went 7s → 6s while this stayed at 7. Nothing caught it — nothing in the
 * app imported these, only the harness, and its assertion was a floor (`>= 6`)
 * which 7 satisfied exactly as well as 6. **A constant nothing reads cannot be
 * wrong loudly**, the same failure that killed `TIER_WEIGHT`.
 *
 * Both halves of that were fixed rather than noted, because a note beside the
 * pair had already failed to prevent it once.
 */
export const IDLE_BREATH_SECONDS = 6;
export const IDLE_BREATH_SCALE_FLOOR = 0.94;
export const IDLE_BREATH_SCALE_CEILING = 1.06;

/** Above this the glyph reads as a bouncing logo rather than a presence. */
export const SPEAKING_SCALE_CEILING = 1.12;
export const SPEAKING_LOOP_SECONDS = 5.2;

/**
 * The shortest time the speaking state may be shown once entered.
 *
 * **[V] Derived from measured turns, not chosen.** Speaking windows on the live
 * API, first `text_delta` to `message_stop`: **20ms** for a five-character
 * reply, 1046ms for one sentence, 12585ms for three paragraphs. 20ms is not a
 * brief flash — it is below one frame at 50fps and never renders at all.
 *
 * 500 works because of the *shape* of that distribution rather than its middle:
 * time-to-first-token is near-constant (1.2–2.8s across all three), while the
 * speaking window scales with output length. A floor therefore only ever touches
 * the short case, and 500 clears the 1046ms reply by enough margin that it never
 * interferes with a real one.
 */
export const SPEAKING_FLOOR_MS = 500;

/**
 * What to do when a turn finishes.
 *
 * **The floor holds the glyph, never the transcript.** `renderText` is
 * unconditionally true — a "floor" is exactly the kind of word that becomes a
 * `setTimeout` in front of the render if nobody pins it, so the two decisions
 * are separated here and the harness asserts that the text decision does not
 * vary with elapsed time.
 *
 * The hold is a scheduled **clear**, never a scheduled entry. That distinction
 * is what keeps the presence model honest: no state is ever *entered* by a
 * timer, so none can be stranded on by one. A hold that somehow never fires
 * leaves speaking running until the next turn resets it — visible and
 * self-correcting, not a silent lock.
 */
export interface TurnRelease {
  /** Always true. Text is never gated on the animation. */
  renderText: boolean;
  /** Milliseconds to keep `producing` true before clearing. 0 means clear now. */
  holdSpeakingMs: number;
}

export function planTurnRelease(
  speakingStartedAt: number | null,
  now: number,
  floorMs: number = SPEAKING_FLOOR_MS
): TurnRelease {
  // Never entered speaking — a turn that errored before any text, or one still
  // thinking. There is nothing to hold.
  if (speakingStartedAt === null) {
    return { renderText: true, holdSpeakingMs: 0 };
  }

  const shown = now - speakingStartedAt;
  return {
    renderText: true,
    // `Math.max` also absorbs a clock that moved backwards, which would
    // otherwise produce a hold longer than the floor itself.
    holdSpeakingMs: Math.min(floorMs, Math.max(0, floorMs - shown))
  };
}

/**
 * A canned speaking envelope, irregular by construction.
 *
 * An even rhythm reads as a machine idling. The eye interprets irregularity as
 * language, and **the pauses carry as much of that as the peaks** — so the rests
 * are held stops at 1.0 rather than eased troughs, which is what makes them read
 * as breaks between phrases instead of as a slower wave.
 *
 * Real amplitude or token-arrival rate can replace these values in place; the
 * component only needs `times` and `scale` of equal length.
 */
export const SPEAKING_ENVELOPE: { times: number[]; scale: number[] } = {
  times: [
    0, 0.04, 0.09, 0.13, 0.18, 0.22, 0.29, 0.34, 0.38, 0.43, 0.48, 0.52, 0.57,
    0.64, 0.69, 0.73, 0.78, 0.82, 0.87, 0.92, 1
  ],
  scale: [
    1.0, 1.07, 1.02, 1.11, 1.03, 1.0, 1.0, 1.09, 1.01, 1.12, 1.04, 1.06, 1.0,
    1.0, 1.08, 1.02, 1.1, 1.03, 1.05, 1.0, 1.0
  ]
};

/** Held rests, as `[from, to]` pairs of envelope positions. */
export function envelopePauses(
  envelope = SPEAKING_ENVELOPE
): Array<[number, number]> {
  const pauses: Array<[number, number]> = [];
  for (let index = 1; index < envelope.scale.length; index += 1) {
    if (envelope.scale[index] === 1 && envelope.scale[index - 1] === 1) {
      pauses.push([envelope.times[index - 1], envelope.times[index]]);
    }
  }
  return pauses;
}

/** Distinct local maxima. Irregularity is the point, so it is measurable. */
export function envelopePeaks(envelope = SPEAKING_ENVELOPE): number[] {
  const peaks: number[] = [];
  for (let index = 1; index < envelope.scale.length - 1; index += 1) {
    const value = envelope.scale[index];
    if (value > envelope.scale[index - 1] && value >= envelope.scale[index + 1]) {
      peaks.push(value);
    }
  }
  return peaks;
}

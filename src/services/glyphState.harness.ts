import {
  IDLE_BREATH_SCALE_CEILING,
  IDLE_BREATH_SCALE_FLOOR,
  IDLE_BREATH_SECONDS,
  SPEAKING_ENVELOPE,
  SPEAKING_FLOOR_MS,
  SPEAKING_LOOP_SECONDS,
  SPEAKING_SCALE_CEILING,
  envelopePauses,
  envelopePeaks,
  glyphStateFor,
  planTurnRelease
} from "./glyphState";
import type { GlyphState } from "./glyphState";
import stylesheet from "../styles.css?raw";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/**
 * The breath's fallback declarations in `styles.css`, asserted **equal** to the
 * constants that write them.
 *
 * **The floor assertion this replaces is how the drift hid.** `IDLE_BREATH_SECONDS
 * >= 6` is satisfied by 6 and by 7 and by 600, so when the CSS moved to 6s and
 * the constant stayed at 7 the harness reported success. **A floor does not pin a
 * value.** If two things must be equal, assert equality.
 *
 * **[V] The CSS/TS boundary is crossable**, which is worth recording because the
 * alternative conclusion — "this cannot be checked mechanically" — would have
 * been wrong and would have left the pair unguarded. Vite's `?raw` import serves
 * the stylesheet as text through the same SSR loader the harnesses already run
 * under, so the fallbacks are readable without a DOM or a browser.
 *
 * These are fallbacks now, not the rendered values: `CommandInstrument` writes
 * the custom properties inline from the constants. They still have to agree, or
 * a path where that element never mounts animates on different numbers.
 */
function assertStylesheetFallbacksMatchTheConstants() {
  const read = (property: string): string => {
    const found = stylesheet.match(
      new RegExp(`${property}:\\s*([^;]+);`)
    );
    assert(
      found !== null,
      `${property} is not declared in styles.css — the fallback was removed, or ` +
        `renamed, and nothing else pins it`
    );
    return found[1].trim();
  };

  const pairs: Array<[string, string, number | string]> = [
    ["--breath-duration", read("--breath-duration"), `${IDLE_BREATH_SECONDS}s`],
    ["--breath-scale-low", read("--breath-scale-low"), IDLE_BREATH_SCALE_FLOOR],
    ["--breath-scale-high", read("--breath-scale-high"), IDLE_BREATH_SCALE_CEILING]
  ];

  for (const [property, declared, expected] of pairs) {
    assert(
      declared === String(expected),
      `${property} in styles.css is "${declared}" but glyphState.ts says ` +
        `"${expected}". The constant is the source; edit it there, not in the CSS.`
    );
  }
}

export function runGlyphStateHarness() {
  // Every input combination, including the one that cannot occur yet.
  const cases: Array<[boolean, boolean, GlyphState]> = [
    [false, false, "idle"],
    [true, false, "thinking"],
    [false, true, "speaking"],
    [true, true, "speaking"]
  ];
  for (const [pending, producing, expected] of cases) {
    const actual = glyphStateFor({ pending, producing });
    assert(
      actual === expected,
      `pending=${pending} producing=${producing} gave ${actual}, expected ${expected}`
    );
  }

  // The reset rule. Whatever the state was, clearing the request returns idle —
  // this is what makes an error or a cancellation unable to strand an animation,
  // and it holds because nothing here is entered by a timer.
  //
  // **[V] This block used to assert nothing.** It looped over the four cases,
  // `void`ed both loop variables, and then asserted the constant expression
  // `glyphStateFor({ pending: false, producing: false }) === "idle"` — the same
  // check four times, with the case data discarded. It could only fail if the
  // first loop had already failed. Four iterations of one restated assertion is
  // not coverage of a transition.
  //
  // What it must actually establish is that the function has no memory: enter a
  // state, clear the request, and land on idle *regardless of where you were*.
  // That is a two-call sequence, and it is the thing that would break if anyone
  // ever gave this function internal state.
  for (const [pending, producing, expected] of cases) {
    const entered = glyphStateFor({ pending, producing });
    assert(entered === expected, `setup: ${pending}/${producing} did not enter ${expected}`);

    const cleared = glyphStateFor({ pending: false, producing: false });
    assert(
      cleared === "idle",
      `leaving ${entered} did not settle back to idle — it gave ${cleared}, ` +
        `which means the state is being remembered rather than derived`
    );
  }

  const { times, scale } = SPEAKING_ENVELOPE;
  assert(
    times.length === scale.length,
    `envelope is malformed: ${times.length} times against ${scale.length} scales`
  );
  assert(times[0] === 0 && times[times.length - 1] === 1, "envelope must span 0 to 1");
  for (let index = 1; index < times.length; index += 1) {
    assert(
      times[index] > times[index - 1],
      `envelope times are not strictly increasing at ${index}`
    );
  }

  const peak = Math.max(...scale);
  const floor = Math.min(...scale);
  assert(
    peak === SPEAKING_SCALE_CEILING,
    `envelope peaks at ${peak}, but the declared ceiling is ${SPEAKING_SCALE_CEILING}`
  );
  assert(
    floor === 1,
    `envelope drops to ${floor}; speaking should rest at rendered size, never below`
  );

  // Irregularity is the whole point: an even rhythm reads as a machine idling.
  const peaks = envelopePeaks();
  assert(peaks.length >= 6, `envelope has only ${peaks.length} peaks — too sparse to read as speech`);
  assert(
    new Set(peaks).size >= 5,
    `envelope peaks take only ${new Set(peaks).size} distinct values — too even`
  );

  // Pauses carry as much as peaks, so they are held stops rather than eased dips.
  const pauses = envelopePauses();
  assert(pauses.length >= 2, `envelope has ${pauses.length} held pauses, expected at least 2`);
  assert(
    pauses.every(([from, to]) => to - from >= 0.05),
    "a held pause is too short to read as a break between phrases"
  );

  assert(
    IDLE_BREATH_SCALE_FLOOR < 1 && IDLE_BREATH_SCALE_CEILING > 1,
    "the idle breath must move through its rendered size, not sit to one side of it"
  );
  // Kept as a *perceptual* floor, which is what a floor is legitimately for:
  // below about 6s the cycle starts reading as a signal rather than as ambience.
  // It deliberately does not pin the value — that is the equality check below,
  // and conflating the two is what let the drift through.
  assert(
    IDLE_BREATH_SECONDS >= 6,
    `an idle cycle of ${IDLE_BREATH_SECONDS}s is fast enough to read as a signal rather than as ambience`
  );
  assertStylesheetFallbacksMatchTheConstants();

  // The measured speaking windows, plus the boundaries. 20 is the real
  // five-character reply that never rendered; 1046 is the real one-sentence
  // reply, which must pass through untouched.
  const observed: Array<[number, number]> = [
    [0, SPEAKING_FLOOR_MS],
    [20, SPEAKING_FLOOR_MS - 20],
    [499, 1],
    [500, 0],
    [1046, 0],
    [12585, 0]
  ];

  for (const [shown, expectedHold] of observed) {
    const release = planTurnRelease(1_000, 1_000 + shown);
    assert(
      release.holdSpeakingMs === expectedHold,
      `a ${shown}ms speaking window asked to hold ${release.holdSpeakingMs}ms, expected ${expectedHold}ms`
    );
  }

  // **The property the whole design rests on.** A floor is the kind of word that
  // becomes a delay in front of the render; this asserts the text decision does
  // not vary with elapsed time, at every case above and the never-spoke case.
  for (const [shown] of observed) {
    assert(
      planTurnRelease(1_000, 1_000 + shown).renderText,
      `text was gated at a ${shown}ms speaking window — the floor must hold the glyph, never the transcript`
    );
  }
  assert(
    planTurnRelease(null, 5_000).renderText &&
      planTurnRelease(null, 5_000).holdSpeakingMs === 0,
    "a turn that never entered speaking must render immediately and hold nothing"
  );

  // A clock that steps backwards must not produce a hold longer than the floor.
  assert(
    planTurnRelease(2_000, 1_000).holdSpeakingMs === SPEAKING_FLOOR_MS,
    "a backwards clock produced a hold beyond the floor"
  );

  // The floor is only defensible while it sits under the shortest real reply
  // measured. If it ever exceeds that, it has stopped covering the short case
  // and started delaying ordinary ones.
  assert(
    SPEAKING_FLOOR_MS < 1046,
    `the floor (${SPEAKING_FLOOR_MS}ms) has grown past the shortest measured real reply (1046ms) and now delays ordinary turns`
  );
  assert(
    SPEAKING_LOOP_SECONDS < IDLE_BREATH_SECONDS,
    "speaking must cycle faster than the idle breath or the two are indistinguishable"
  );

  return {
    passed: true,
    states: cases.map(([p, q, s]) => `pending=${p},producing=${q} -> ${s}`),
    envelopeStops: times.length,
    envelopePeak: peak,
    distinctPeaks: new Set(peaks).size,
    heldPauses: pauses.length,
    idleBreathSeconds: IDLE_BREATH_SECONDS,
    speakingLoopSeconds: SPEAKING_LOOP_SECONDS,
    speakingReachableToday: false
  };
}

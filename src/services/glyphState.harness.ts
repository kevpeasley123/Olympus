import {
  IDLE_BREATH_SCALE_CEILING,
  IDLE_BREATH_SCALE_FLOOR,
  IDLE_BREATH_SECONDS,
  SPEAKING_ENVELOPE,
  SPEAKING_LOOP_SECONDS,
  SPEAKING_SCALE_CEILING,
  envelopePauses,
  envelopePeaks,
  glyphStateFor
} from "./glyphState";
import type { GlyphState } from "./glyphState";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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
  for (const [pending, producing] of cases.map(([p, q]) => [p, q] as const)) {
    void pending;
    void producing;
    assert(
      glyphStateFor({ pending: false, producing: false }) === "idle",
      "clearing the request did not settle back to idle"
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
  assert(
    IDLE_BREATH_SECONDS >= 6,
    `an idle cycle of ${IDLE_BREATH_SECONDS}s is fast enough to read as a signal rather than as ambience`
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

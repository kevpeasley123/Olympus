import { Fft, SIGNAL_BANDS, VoiceSignalBus, bandPowerDb, levelFromRmsDb, type SignalSource } from "./voiceSignal";
import { SIGNAL_STATUS, signalStateFor } from "./olympusSignal";
import type { VoiceSnapshot } from "./realtimeVoice";

/** Pure checks for the voice analysis bus and the signal's state mapping. */
export function runVoiceSignalHarness() {
  let passed = 0;
  const check = (ok: unknown, label: string) => { if (!ok) throw Error(label); passed++; };

  // A full-scale 1 kHz tone lands in its own band, at the AnalyserNode's scale.
  const rate = 48000, size = 1024;
  const tone = new Float32Array(size).map((_, i) => Math.sin((2 * Math.PI * 1000 * i) / rate));
  const spectrum = new Float32Array(size / 2);
  new Fft(size).spectrumDb(tone, spectrum);
  const loudestBin = spectrum.indexOf(Math.max(...spectrum));
  check(Math.abs((loudestBin * rate) / size - 1000) < rate / size, "The tone's bin is at 1 kHz");
  check(Math.abs(spectrum[loudestBin] - -13.5) < 2.5, `Blackman-windowed peak near -13.5 dB, saw ${spectrum[loudestBin].toFixed(1)}`);
  const bands = new Float32Array(SIGNAL_BANDS);
  bandPowerDb(spectrum, size / 2, rate, bands);
  const loudestBand = bands.indexOf(Math.max(...bands));
  const edge = (b: number) => 120 * Math.pow(6000 / 120, b / SIGNAL_BANDS);
  check(edge(loudestBand) <= 1000 && edge(loudestBand + 1) > 1000, `1 kHz lands in its band (band ${loudestBand})`);

  // Level: silence floor, full scale, and the midpoint.
  check(levelFromRmsDb(-80) === 0 && levelFromRmsDb(-54) === 0, "Below -54 dBFS is silent");
  check(levelFromRmsDb(-12) === 1 && levelFromRmsDb(0) === 1, "-12 dBFS and above is full");
  check(Math.abs(levelFromRmsDb(-33) - 0.5) < 1e-9, "Level is linear in dB between");

  // The bus: newest source wins, detach restores, unavailable is null, readings are shared per frame.
  const source = (rmsDb: number | null, peakBin = 40): SignalSource & { disposed: boolean } => ({
    disposed: false,
    read(out) { if (rmsDb === null) return null; out.fill(-110); out[peakBin] = -30; return { rmsDb, sampleRate: 48000 }; },
    dispose() { this.disposed = true; },
  });
  const bus = new VoiceSignalBus();
  check(bus.sample("output", 0) === null, "No source, no sample");
  const quiet = source(-40), loud = source(-15);
  const detachQuiet = bus.attach("output", quiet);
  const detachLoud = bus.attach("output", loud);
  const first = bus.sample("output", 100);
  check(first && first.level > 0.9, "The newest source is read");
  check(bus.sample("output", 104) === first, "A second read within the frame reuses the analysis");
  detachLoud();
  check(loud.disposed, "Detach disposes the source");
  const second = bus.sample("output", 200);
  check(second && Math.abs(second.level - levelFromRmsDb(-40)) < 1e-9, "Detach restores the previous source");
  check(Math.max(...second!.bands) > 0.5, "A loud band reads high relative to the recent peak");
  detachQuiet();
  detachQuiet();
  check(bus.sample("output", 300) === null, "Detaching twice is harmless and leaves nothing");
  bus.attach("input", source(-70));
  const gated = bus.sample("input", 400);
  check(gated && gated.level === 0 && Math.max(...gated.bands) === 0, "Below the gate, every band is flat");
  bus.attach("input", source(null));
  check(bus.sample("input", 500) === null, "A source that cannot report gives no sample, not silence");

  // The Omega's envelope: fast rise, slower fall, null without audio.
  const omega = new VoiceSignalBus();
  check(omega.outputEnvelope(0) === null, "No reply audio, no Omega energy");
  const detachSpeech = omega.attach("output", source(-12));
  omega.outputEnvelope(1000);
  const risen = omega.outputEnvelope(1080)!;
  check(risen > 0.55 && risen < 0.75, `Rises about 63% in 80 ms, saw ${risen.toFixed(2)}`);
  detachSpeech();
  omega.attach("output", source(-80));
  for (let t = 1100; t <= 2000; t += 20) omega.outputEnvelope(t);
  const settled = omega.outputEnvelope(2020)!;
  check(settled < 0.15, "Falls back toward silence");

  // State mapping: the voice phase wins, then spoken replies, then a pending request.
  const voice = (patch: Partial<VoiceSnapshot>) => ({ phase: "IDLE", microphoneOn: false, muted: false, ...patch }) as VoiceSnapshot;
  check(signalStateFor(undefined, true, false) === "idle", "Idle with spoken replies on");
  check(signalStateFor(undefined, false, false) === "off", "Off without spoken replies");
  check(signalStateFor(undefined, false, true) === "off", "A typed request without spoken replies is not a voice response");
  check(signalStateFor(undefined, true, true) === "thinking", "A typed request with spoken replies on prepares a voice response");
  check(signalStateFor(voice({ phase: "LISTENING", microphoneOn: true }), false, false) === "listening", "Listening needs the microphone, not spoken replies");
  check(signalStateFor(voice({ phase: "LISTENING", microphoneOn: false }), true, false) === "idle", "No listening claim without the microphone");
  check(signalStateFor(voice({ phase: "PROCESSING" }), true, false) === "thinking", "Processing is thinking");
  check(signalStateFor(voice({ phase: "SPEAKING" }), true, false) === "speaking", "Speaking");
  check(signalStateFor(voice({ phase: "ERROR" }), true, false) === "error", "Errors show");
  check(SIGNAL_STATUS.idle === "" && SIGNAL_STATUS.off === "", "Idle and off stay visually clean");
  return { passed };
}

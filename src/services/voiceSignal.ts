/**
 * Real voice audio for the Command signal and the Omega, read once per animation
 * frame instead of being pushed through React state.
 *
 * Analysis only. A source taps a stream or a playing clip and never changes what
 * the operator hears: nothing here connects to the audio output, requests the
 * microphone or starts playback. When a source cannot be analysed it reports
 * nothing, and the signal shows its ambient state rather than invented speech.
 */

export type SignalKind = "input" | "output";
/** Log-spaced bands across the speech range. */
export const SIGNAL_BANDS = 16;
const LOW_HZ = 120;
const HIGH_HZ = 6000;
const STREAM_FFT = 1024;
const CLIP_RATE = 24000;
const CLIP_FFT = 512;
// Level from RMS in dBFS: -54 dB is silence for this purpose, -12 dB is full.
const LEVEL_FLOOR_DB = -54;
const LEVEL_RANGE_DB = 42;
// Bands are relative to a slowly decaying recent peak, so a quiet voice and a
// loud one both use the bars' range; the gate below keeps silence flat.
const BAND_RANGE_DB = 38;
const PEAK_FLOOR_DB = -62;
const PEAK_DECAY_DB_PER_SECOND = 9;
const GATE_LEVEL = 0.04;

export interface SignalSample {
  level: number;
  /** 0..1 per band, lowest frequency first. Owned by the bus; read, do not keep. */
  bands: Float32Array;
}

/** One analysed source. `read` fills `spectrumDb` and returns the RMS in dBFS, or null when silent or unavailable. */
export interface SignalSource {
  read(spectrumDb: Float32Array): { rmsDb: number; sampleRate: number } | null;
  dispose(): void;
}

/** Exported for the harness; the bus owns its own instances. */
export class Fft {
  private readonly cos: Float32Array;
  private readonly sin: Float32Array;
  private readonly reversed: Uint32Array;
  readonly window: Float32Array;
  private readonly re: Float32Array;
  private readonly im: Float32Array;
  constructor(readonly size: number) {
    this.cos = new Float32Array(size / 2);
    this.sin = new Float32Array(size / 2);
    for (let i = 0; i < size / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / size);
      this.sin[i] = -Math.sin((2 * Math.PI * i) / size);
    }
    const bits = Math.log2(size);
    this.reversed = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.reversed[i] = r;
    }
    // The AnalyserNode's Blackman window, so clip and stream spectra share one scale.
    this.window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const x = (2 * Math.PI * i) / size;
      this.window[i] = 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x);
    }
    this.re = new Float32Array(size);
    this.im = new Float32Array(size);
  }

  /** Magnitude in dB, |X|/N as the AnalyserNode reports it, for bins 0..N/2-1. */
  spectrumDb(samples: Float32Array, out: Float32Array) {
    const { size, re, im } = this;
    for (let i = 0; i < size; i++) {
      re[this.reversed[i]] = samples[i] * this.window[i];
      im[this.reversed[i]] = 0;
    }
    for (let half = 1; half < size; half *= 2) {
      const step = size / (half * 2);
      for (let start = 0; start < size; start += half * 2) {
        for (let k = 0; k < half; k++) {
          const c = this.cos[k * step], s = this.sin[k * step];
          const a = start + k, b = a + half;
          const tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c;
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
        }
      }
    }
    for (let k = 0; k < size / 2; k++) {
      const magnitude = Math.sqrt(re[k] * re[k] + im[k] * im[k]) / size;
      out[k] = 20 * Math.log10(magnitude + 1e-12);
    }
  }
}

const EDGES = Array.from({ length: SIGNAL_BANDS + 1 }, (_, i) => LOW_HZ * Math.pow(HIGH_HZ / LOW_HZ, i / SIGNAL_BANDS));

/**
 * Mean power per band in dB, with +3 dB per octave so the upper bands, which
 * carry less energy in speech, still move.
 */
export function bandPowerDb(spectrumDb: Float32Array, bins: number, sampleRate: number, out: Float32Array) {
  const binHz = sampleRate / (2 * bins);
  for (let b = 0; b < SIGNAL_BANDS; b++) {
    const lo = Math.max(1, Math.floor(EDGES[b] / binHz));
    const hi = Math.min(bins, Math.max(lo + 1, Math.ceil(EDGES[b + 1] / binHz)));
    let power = 0;
    for (let k = lo; k < hi; k++) power += Math.pow(10, spectrumDb[k] / 10);
    const centre = Math.sqrt(EDGES[b] * EDGES[b + 1]);
    out[b] = 10 * Math.log10(power / (hi - lo) + 1e-20) + 3 * Math.log2(centre / LOW_HZ);
  }
}

export function levelFromRmsDb(rmsDb: number) {
  return Math.min(1, Math.max(0, (rmsDb - LEVEL_FLOOR_DB) / LEVEL_RANGE_DB));
}

function rmsDb(samples: Float32Array, from = 0, to = samples.length) {
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i] * samples[i];
  return 10 * Math.log10(sum / Math.max(1, to - from) + 1e-12);
}

/** A MediaStream through an AnalyserNode that is never connected to the output. */
class StreamSource implements SignalSource {
  private readonly node: MediaStreamAudioSourceNode;
  private readonly analyser: AnalyserNode;
  private readonly time: Float32Array<ArrayBuffer>;
  private readonly frequency: Float32Array<ArrayBuffer>;
  constructor(private readonly context: AudioContext, stream: MediaStream) {
    this.node = context.createMediaStreamSource(stream);
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = STREAM_FFT;
    this.analyser.smoothingTimeConstant = 0.2;
    this.node.connect(this.analyser);
    this.time = new Float32Array(STREAM_FFT);
    this.frequency = new Float32Array(STREAM_FFT / 2);
  }
  read(spectrumDb: Float32Array) {
    // A suspended context delivers silence; that is "unavailable", not quiet speech.
    if (this.context.state !== "running") return null;
    this.analyser.getFloatTimeDomainData(this.time);
    this.analyser.getFloatFrequencyData(this.frequency);
    spectrumDb.set(this.frequency.subarray(0, Math.min(spectrumDb.length, this.frequency.length)));
    return { rmsDb: rmsDb(this.time), sampleRate: this.context.sampleRate };
  }
  dispose() {
    this.node.disconnect();
    this.analyser.disconnect();
  }
}

/**
 * A clip that an HTMLMediaElement is playing. The bytes are decoded separately
 * and read at the element's current position, so playback itself is untouched
 * and the analysis does not depend on a running AudioContext.
 */
class ClipSource implements SignalSource {
  private pcm: Float32Array | null = null;
  private disposed = false;
  private readonly fft = new Fft(CLIP_FFT);
  private readonly window = new Float32Array(CLIP_FFT);
  constructor(private readonly audio: HTMLMediaElement, bytes: Uint8Array) {
    if (typeof OfflineAudioContext === "undefined") return;
    const context = new OfflineAudioContext(1, 1, CLIP_RATE);
    void context.decodeAudioData(bytes.slice().buffer).then(buffer => {
      if (this.disposed) return;
      const mixed = new Float32Array(buffer.length);
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < data.length; i++) mixed[i] += data[i] / buffer.numberOfChannels;
      }
      this.pcm = mixed;
    }).catch(() => { /* Undecodable audio leaves the signal ambient; playback is unaffected. */ });
  }
  read(spectrumDb: Float32Array) {
    const pcm = this.pcm;
    if (!pcm || this.audio.paused || this.audio.ended) return null;
    const end = Math.min(pcm.length, Math.floor(this.audio.currentTime * CLIP_RATE));
    const start = end - CLIP_FFT;
    for (let i = 0; i < CLIP_FFT; i++) this.window[i] = start + i >= 0 ? pcm[start + i] : 0;
    this.fft.spectrumDb(this.window, spectrumDb);
    return { rmsDb: rmsDb(this.window), sampleRate: CLIP_RATE };
  }
  dispose() {
    this.disposed = true;
    this.pcm = null;
  }
}

interface Channel {
  sources: SignalSource[];
  spectrum: Float32Array;
  power: Float32Array;
  peakDb: number;
  sample: SignalSample;
  readAt: number;
  available: boolean;
  envelope: number;
  envelopeAt: number;
}

function channel(): Channel {
  return {
    sources: [], spectrum: new Float32Array(STREAM_FFT / 2), power: new Float32Array(SIGNAL_BANDS), peakDb: PEAK_FLOOR_DB,
    sample: { level: 0, bands: new Float32Array(SIGNAL_BANDS) }, readAt: -1, available: false, envelope: 0, envelopeAt: -1,
  };
}

const noop = () => {};

export class VoiceSignalBus {
  private context: AudioContext | null = null;
  private readonly channels: Record<SignalKind, Channel> = { input: channel(), output: channel() };

  private audioContext(): AudioContext | null {
    if (typeof AudioContext === "undefined") return null;
    if (!this.context || this.context.state === "closed") this.context = new AudioContext();
    void this.context.resume().catch(() => {});
    return this.context;
  }

  /** The newest source of a kind is the one read. Returns its detach. */
  attach(kind: SignalKind, source: SignalSource): () => void {
    const list = this.channels[kind].sources;
    list.push(source);
    let attached = true;
    return () => {
      if (!attached) return;
      attached = false;
      const index = list.indexOf(source);
      if (index >= 0) list.splice(index, 1);
      try { source.dispose(); } catch { /* Already released. */ }
      if (!this.channels.input.sources.length && !this.channels.output.sources.length) void this.context?.suspend().catch(() => {});
    };
  }

  /** A microphone or realtime voice stream that is already playing or capturing. */
  attachStream(kind: SignalKind, stream: MediaStream): () => void {
    try {
      const context = this.audioContext();
      if (!context || !stream.getAudioTracks().length) return noop;
      return this.attach(kind, new StreamSource(context, stream));
    } catch {
      return noop;
    }
  }

  /** A synthesized reply: the element that plays it and the same bytes. */
  attachClip(audio: HTMLMediaElement, bytes: Uint8Array): () => void {
    try {
      return this.attach("output", new ClipSource(audio, bytes));
    } catch {
      return noop;
    }
  }

  /**
   * The current reading of a kind, or null when no source can report. Cached
   * for a few milliseconds so the signal and the Omega share one analysis per frame.
   */
  sample(kind: SignalKind, now = performance.now()): SignalSample | null {
    const c = this.channels[kind];
    if (now - c.readAt < 8 && c.readAt >= 0) return c.available ? c.sample : null;
    const elapsed = c.readAt < 0 ? 0 : Math.min(1, (now - c.readAt) / 1000);
    c.readAt = now;
    const source = c.sources[c.sources.length - 1];
    let reading: ReturnType<SignalSource["read"]> = null;
    try { reading = source?.read(c.spectrum) ?? null; } catch { reading = null; }
    c.available = reading !== null;
    if (!reading) return null;
    const bins = reading.sampleRate === CLIP_RATE ? CLIP_FFT / 2 : STREAM_FFT / 2;
    bandPowerDb(c.spectrum, bins, reading.sampleRate, c.power);
    let loudest = -Infinity;
    for (let b = 0; b < SIGNAL_BANDS; b++) loudest = Math.max(loudest, c.power[b]);
    c.peakDb = Math.max(PEAK_FLOOR_DB, loudest, c.peakDb - PEAK_DECAY_DB_PER_SECOND * elapsed);
    const level = levelFromRmsDb(reading.rmsDb);
    const gate = Math.min(1, level / GATE_LEVEL);
    for (let b = 0; b < SIGNAL_BANDS; b++) {
      c.sample.bands[b] = gate * Math.min(1, Math.max(0, (c.power[b] - (c.peakDb - BAND_RANGE_DB)) / BAND_RANGE_DB));
    }
    c.sample.level = level;
    return c.sample;
  }

  /**
   * The Omega's share of the reply: a smoothed output level, or null when no
   * reply audio can be analysed. Rises in about 80 ms and falls over 400 ms.
   */
  outputEnvelope(now = performance.now()): number | null {
    const c = this.channels.output;
    const sample = this.sample("output", now);
    if (!sample) {
      c.envelope = 0;
      c.envelopeAt = -1;
      return null;
    }
    // The first reading of a reply eases in like any other frame; no jump.
    const delta = c.envelopeAt < 0 ? 1 / 60 : Math.min(0.25, (now - c.envelopeAt) / 1000);
    c.envelopeAt = now;
    const target = sample.level;
    const seconds = target > c.envelope ? 0.08 : 0.4;
    c.envelope += (target - c.envelope) * (1 - Math.exp(-delta / seconds));
    return c.envelope;
  }
}

export const voiceSignal = new VoiceSignalBus();

/** For the Omega: a subtle lift, never more than a third of the scene's energy range. */
export function omegaVoiceEnergy(): number | null {
  const envelope = voiceSignal.outputEnvelope();
  return envelope === null ? null : 0.08 + 0.27 * envelope;
}

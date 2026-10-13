import type { VoiceSnapshot } from "./realtimeVoice";
import type { SignalSample } from "./voiceSignal";

/**
 * The Olympus energy signal beneath the Omega: a thin amber conduit with a
 * central voice waveform, drawn on a 2D canvas once per animation frame.
 *
 * Every per-frame value lives here, outside React. The waveform follows real
 * audio when a sample is supplied; without one it shows the state's own
 * ambient motion and never imitates speech.
 */

export type SignalState = "idle" | "listening" | "thinking" | "speaking" | "off" | "error";

const STATES = ["idle", "listening", "thinking", "speaking", "off"] as const;
type Weighted = (typeof STATES)[number];
type Weights = Record<Weighted, number>;

/** What the waveform and status line show for a voice snapshot. */
export function signalStateFor(voice: VoiceSnapshot | undefined, spokenReplies: boolean, assistantPending: boolean): SignalState {
  if (voice?.phase === "ERROR") return "error";
  if (voice?.phase === "SPEAKING") return "speaking";
  if (voice?.phase === "LISTENING" && voice.microphoneOn) return "listening";
  if (voice?.phase === "PROCESSING") return "thinking";
  if (!spokenReplies) return "off";
  // A typed request with spoken replies on is a voice response being prepared.
  return assistantPending ? "thinking" : "idle";
}

export const SIGNAL_STATUS: Record<SignalState, string> = {
  idle: "", off: "", listening: "Listening", thinking: "Thinking", speaking: "Speaking", error: "Speech unavailable",
};

/** Per-state targets, blended by the eased state weights. Indexed like STATES. */
const PARAMS = {
  line: [0.62, 0.8, 0.7, 0.86, 0.2],
  glow: [0.55, 0.74, 0.62, 0.84, 0.14],
  halo: [0.5, 0.86, 0.66, 0.8, 0.1],
  haloScale: [1, 1.05, 0.97, 1.02, 0.95],
  motes: [0.6, 0.78, 0.6, 0.86, 0.16],
  filaments: [0.1, 0.18, 0.1, 0.26, 0],
  packets: [0.11, 0.3, 0.85, 0.42, 0.02],
} satisfies Record<string, readonly number[]>;

const BARS = 15;
const CENTRE_BAR = 7;
const BAR_GAP = 7;
const HALO_RADIUS = 46;
const MOTES = 44;
const SPARKS = 28;
const FILAMENTS = 7;
const PACKETS = 10;
const HOTSPOTS = 5;
const GLINTS = 7;

const COLORS = {
  core: [255, 230, 178],
  inner: [255, 178, 76],
  mid: [255, 136, 36],
  wide: [255, 108, 22],
  barBody: [255, 166, 60],
  barCore: [255, 238, 202],
  teal: [116, 232, 214],
} as const;

const rgba = ([r, g, b]: readonly number[], a: number) => `rgba(${r},${g},${b},${a})`;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smoothstep = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const ease = (current: number, target: number, dt: number, seconds: number) => current + (target - current) * (1 - Math.exp(-dt / seconds));

/** Small deterministic generator, so a static frame and a test repeat exactly. */
function generator(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function sprite(inner: readonly number[], outer: readonly number[], size = 64) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, rgba(inner, 1));
  g.addColorStop(0.22, rgba(inner, 0.55));
  g.addColorStop(0.5, rgba(outer, 0.16));
  g.addColorStop(1, rgba(outer, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

interface Mote { x: number; y: number; vx: number; vy: number; size: number; base: number; phase: number; rate: number; teal: boolean; age: number; life: number }
interface Packet { x: number; v: number; age: number; life: number; width: number; intensity: number }
interface Filament { alive: boolean; age: number; life: number; fade: number; x0: number; span: number; v: number; amp: number; teal: boolean; points: Float32Array; count: number; branch: Float32Array; branchCount: number; rejitter: number }
interface Hotspot { x: number; v: number; width: number; phase: number; rate: number }
interface Glint { x: number; phase: number; rate: number; size: number }

export interface SignalStats { state: SignalState; live: boolean; peak: number; quality: "full" | "reduced"; costMs: number }

export class SignalRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly random: () => number;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private state: SignalState = "idle";
  private weights: Weights = { idle: 1, listening: 0, thinking: 0, speaking: 0, off: 0 };
  private time = 0;
  private last = -1;
  private level = 0;
  private fast = 0;
  private slow = 0;
  private onsetCooldown = 0;
  private live = false;
  private bandMax = 0;
  private readonly bars = new Float32Array(BARS);
  private readonly motes: Mote[] = [];
  private readonly sparks: Mote[] = [];
  private readonly packets: Packet[] = [];
  private readonly filaments: Filament[] = [];
  private readonly hotspots: Hotspot[] = [];
  private readonly glints: Glint[] = [];
  private readonly warm: HTMLCanvasElement;
  private readonly hot: HTMLCanvasElement;
  private readonly tealSprite: HTMLCanvasElement;
  private gradients: { core: CanvasGradient; inner: CanvasGradient; mid: CanvasGradient } | null = null;
  /** The widest glow, rendered once per size: a vertical falloff, tapered at both ends. */
  private band: HTMLCanvasElement | null = null;
  private cost = 0;
  private slowFrames = 0;
  private fastFrames = 0;
  private quality: "full" | "reduced" = "full";
  readonly stats: SignalStats = { state: "idle", live: false, peak: 0, quality: "full", costMs: 0 };

  constructor(private readonly canvas: HTMLCanvasElement, seed = 7) {
    this.ctx = canvas.getContext("2d")!;
    this.random = generator(seed);
    this.warm = sprite([255, 214, 150], [255, 128, 34]);
    this.hot = sprite([255, 246, 226], [255, 190, 110]);
    this.tealSprite = sprite([186, 255, 244], [56, 196, 186]);
    for (let i = 0; i < FILAMENTS; i++) {
      this.filaments.push({ alive: false, age: 0, life: 0, fade: 0, x0: 0, span: 0, v: 0, amp: 0, teal: false, points: new Float32Array(32), count: 0, branch: new Float32Array(14), branchCount: 0, rejitter: 0 });
    }
    for (let i = 0; i < PACKETS; i++) this.packets.push({ x: 0, v: 0, age: 1, life: 0, width: 0, intensity: 0 });
    for (let i = 0; i < SPARKS; i++) this.sparks.push({ x: 0, y: 0, vx: 0, vy: 0, size: 1, base: 0, phase: 0, rate: 0, teal: false, age: 1, life: 0 });
  }

  /** CSS pixels; the backing store follows the device pixel ratio, capped at 2. */
  resize(width: number, height: number, dpr: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = Math.min(2, Math.max(1, dpr));
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    const { left, right } = this.extent();
    const cx = this.width / 2;
    const make = (color: readonly number[], centreBoost: number) => {
      const g = this.ctx.createLinearGradient(left, 0, right, 0);
      for (let i = 0; i <= 20; i++) {
        const u = i / 20;
        const fromEnd = 1 - Math.abs(u - 0.5) * 2;
        const centre = Math.exp(-((((u - 0.5) * (right - left)) / (cx * 0.35)) ** 2));
        g.addColorStop(u, rgba(color, clamp(smoothstep(0, 0.42, fromEnd) * (0.78 + centreBoost * centre))));
      }
      return g;
    };
    this.gradients = { core: make(COLORS.core, 0.22), inner: make(COLORS.inner, 0.3), mid: make(COLORS.mid, 0.4) };
    this.band = this.glowBand(make(COLORS.wide, 0.5));
    this.seed();
  }

  private glowBand(taper: CanvasGradient) {
    const band = document.createElement("canvas");
    const height = 40;
    band.width = this.canvas.width;
    band.height = Math.round(height * this.dpr);
    const ctx = band.getContext("2d")!;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const falloff = ctx.createLinearGradient(0, 0, 0, height);
    for (let i = 0; i <= 16; i++) {
      const y = i / 16;
      falloff.addColorStop(y, `rgba(0,0,0,${Math.exp(-((((y - 0.5) * height) / 6.5) ** 2))})`);
    }
    ctx.fillStyle = taper;
    ctx.fillRect(0, 0, this.width, height);
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = falloff;
    ctx.fillRect(0, 0, this.width, height);
    return band;
  }

  setState(state: SignalState) {
    this.state = state;
    this.stats.state = state;
  }

  private extent() {
    return { left: 6, right: Math.max(7, this.width - 6) };
  }

  /** Distance-from-end taper, 0 at the line's ends and 1 across its middle. */
  private taper(x: number) {
    const { left, right } = this.extent();
    const half = (right - left) / 2;
    return smoothstep(0, 0.42, 1 - Math.abs(x - (left + half)) / half);
  }

  private seed() {
    const { left, right } = this.extent();
    const span = right - left;
    this.motes.length = 0;
    for (let i = 0; i < MOTES; i++) this.motes.push(this.mote(left + span * (0.5 + (this.random() + this.random() + this.random() - 1.5) * 0.62)));
    this.hotspots.length = 0;
    for (let i = 0; i < HOTSPOTS; i++) this.hotspots.push({ x: left + span * this.random(), v: (this.random() < 0.5 ? -1 : 1) * (5 + this.random() * 10), width: 60 + this.random() * 120, phase: this.random() * 6.28, rate: 0.55 + this.random() * 0.7 });
    this.glints.length = 0;
    for (let i = 0; i < GLINTS; i++) this.glints.push(this.glint());
  }

  private mote(x: number): Mote {
    const gaussian = (this.random() + this.random() + this.random() - 1.5) * 2;
    return { x, y: gaussian * 9, vx: (this.random() - 0.5) * 9, vy: (this.random() - 0.5) * 3, size: 0.7 + this.random() * 0.9, base: 0.25 + this.random() * 0.55, phase: this.random() * 6.28, rate: 0.4 + this.random() * 1.4, teal: this.random() < 0.18, age: 0, life: 8 + this.random() * 14 };
  }

  private glint(): Glint {
    const { left, right } = this.extent();
    const cx = this.width / 2;
    let x = left + (right - left) * this.random();
    if (Math.abs(x - cx) < HALO_RADIUS + 24) x += (x < cx ? -1 : 1) * (HALO_RADIUS + 40);
    return { x, phase: this.random() * 6.28, rate: 0.6 + this.random() * 0.9, size: 4 + this.random() * 4 };
  }

  private blend(key: keyof typeof PARAMS) {
    const values = PARAMS[key];
    let total = 0;
    STATES.forEach((s, i) => { total += this.weights[s] * values[i]; });
    return total;
  }

  private target(): Weighted {
    return this.state === "error" ? "off" : this.state;
  }

  /** One animation frame. `sample` is the live audio for the current state, when there is any. */
  frame(seconds: number, sample: SignalSample | null) {
    const started = performance.now();
    const dt = this.last < 0 ? 1 / 60 : clamp(seconds - this.last, 0, 0.05);
    this.last = seconds;
    this.time += dt;
    const target = this.target();
    for (const s of STATES) this.weights[s] = ease(this.weights[s], s === target ? 1 : 0, dt, 0.32);
    this.live = sample !== null;
    const level = sample ? sample.level : 0;
    this.level = ease(this.level, level, dt, level > this.level ? 0.05 : 0.18);
    this.fast = ease(this.fast, level, dt, level > this.fast ? 0.02 : 0.08);
    this.slow = ease(this.slow, level, dt, level > this.slow ? 0.3 : 0.6);
    this.step(dt, sample);
    this.draw(sample, true);
    this.measure(performance.now() - started);
  }

  /** Reduced motion: one composed frame for the state, no filaments or travel. */
  renderStatic(state: SignalState) {
    this.setState(state);
    const target = this.target();
    for (const s of STATES) this.weights[s] = s === target ? 1 : 0;
    this.time = 2.4;
    this.level = state === "speaking" ? 0.55 : state === "listening" ? 0.35 : 0;
    this.live = false;
    for (let i = 0; i < BARS; i++) this.bars[i] = this.barTarget(i, null);
    this.draw(null, false);
  }

  private step(dt: number, sample: SignalSample | null) {
    const w = this.weights;
    const { left, right } = this.extent();
    const cx = this.width / 2;
    this.bandMax = 0;
    if (sample) for (const band of sample.bands) this.bandMax = Math.max(this.bandMax, band);
    for (let i = 0; i < BARS; i++) {
      const t = this.barTarget(i, sample);
      this.bars[i] = ease(this.bars[i], t, dt, t > this.bars[i] ? 0.035 : 0.14);
    }
    // Onsets in real speech spark the line; ambient states never do.
    this.onsetCooldown -= dt;
    const speakingLive = this.live ? w.speaking + w.listening * 0.45 : 0;
    if (speakingLive > 0.3 && this.fast - this.slow > 0.09 && this.onsetCooldown <= 0) {
      this.onsetCooldown = 0.12;
      const strength = clamp((this.fast - this.slow) * 4);
      const sparks = Math.round(2 + strength * 4 * speakingLive);
      for (let k = 0; k < sparks; k++) this.spark(cx + (this.random() - 0.5) * 30, (this.random() - 0.5) * 8, (this.random() < 0.5 ? -1 : 1) * (40 + this.random() * 90), (this.random() - 0.5) * 70);
      if (this.random() < 0.55 * speakingLive) this.filament(true);
      if (this.random() < 0.7 * speakingLive) { this.packet(cx - HALO_RADIUS, -1, 230 + this.random() * 150, 0.5 + strength * 0.5); this.packet(cx + HALO_RADIUS, 1, 230 + this.random() * 150, 0.5 + strength * 0.5); }
    }
    // Poisson spawns at the blended ambient rates.
    const filamentRate = this.blend("filaments") + (this.live ? w.speaking * 2.6 * this.level ** 1.5 + w.listening * 0.8 * this.level : 0);
    if (this.random() < filamentRate * dt) this.filament(w.speaking > 0.5 && this.live);
    const packetRate = this.blend("packets") + (this.live ? w.listening * 1.2 * this.level : 0);
    if (this.random() < packetRate * dt) {
      const inward = w.thinking + w.listening > w.idle + w.speaking;
      const fromLeft = this.random() < 0.5;
      if (inward) this.packet(fromLeft ? left + 20 : right - 20, fromLeft ? 1 : -1, 120 + this.random() * 90, 0.45 + w.listening * this.level * 0.5);
      else this.packet(fromLeft ? left + 10 : right - 10, fromLeft ? 1 : -1, 90 + this.random() * 70, 0.32);
    }
    for (const p of this.packets) {
      if (p.age >= p.life) continue;
      p.age += dt;
      p.x += p.v * dt;
      // Inward travel ends at the halo rather than crossing the waveform.
      if (Math.sign(cx - p.x) !== Math.sign(cx - (p.x - p.v * dt)) || Math.abs(p.x - cx) < HALO_RADIUS * 0.7 && Math.sign(p.v) === Math.sign(cx - p.x)) p.age = Math.max(p.age, p.life - 0.12);
    }
    for (const m of this.motes) {
      m.age += dt;
      m.x += (m.vx + Math.sin(this.time * 0.31 + m.phase) * 2.2) * dt;
      m.y += (m.vy + Math.cos(this.time * 0.47 + m.phase) * 1.4) * dt;
      m.y = clamp(m.y, -26, 26);
      if (m.age > m.life || m.x < left || m.x > right) Object.assign(m, this.mote(left + (right - left) * (0.5 + (this.random() + this.random() + this.random() - 1.5) * 0.62)));
    }
    for (const s of this.sparks) {
      if (s.age >= s.life) continue;
      s.age += dt;
      s.vx *= Math.exp(-1.6 * dt); s.vy *= Math.exp(-1.6 * dt);
      s.x += s.vx * dt; s.y += s.vy * dt;
    }
    for (const h of this.hotspots) {
      h.x += h.v * dt;
      if (h.x < left - h.width) h.x = right + h.width * 0.5;
      if (h.x > right + h.width) h.x = left - h.width * 0.5;
    }
    for (const g of this.glints) {
      g.phase += g.rate * dt;
      if (g.phase > Math.PI * 2) Object.assign(g, this.glint(), { phase: 0 });
    }
    for (const f of this.filaments) {
      if (!f.alive) continue;
      f.age += dt;
      f.x0 += f.v * dt;
      if (f.age > f.rejitter) { this.shape(f); f.rejitter = f.age + 0.07 + this.random() * 0.12; }
      if (f.age >= f.life) {
        f.alive = false;
        if (this.random() < 0.4) this.spark(f.x0 + (f.v >= 0 ? f.span : 0), 0, f.v * 0.25 + (this.random() - 0.5) * 30, (this.random() - 0.5) * 40);
      }
    }
  }

  private barTarget(i: number, sample: SignalSample | null) {
    const w = this.weights;
    const d = Math.abs(i - CENTRE_BAR);
    const shape = 0.35 + 0.65 * Math.cos((d / 7.6) * (Math.PI / 2)) ** 1.2;
    const t = this.time;
    const breath = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * (0.53 + ((i * 7) % 5) * 0.13) + i * 1.7)) * (0.65 + 0.35 * Math.sin(t * (0.21 + (i % 3) * 0.07) + i * 0.9));
    const idle = 1.8 + 5 * shape ** 2.2 * breath;
    const thinking = 1.8 + 2.4 * shape * (0.5 + 0.5 * Math.sin(t * 1.7 - d * 0.55));
    const off = 1.4 + 0.6 * shape;
    let listening: number;
    let speaking: number;
    if (sample) {
      // Loudness sets the height; each bar's band, relative to the loudest band
      // this frame, shapes it. Centre bars read the low bands, outer bars the high.
      const band = i === CENTRE_BAR ? (sample.bands[0] + sample.bands[1]) / 2 : sample.bands[Math.min(15, 2 * d + (i > CENTRE_BAR ? 1 : 0))];
      const relative = this.bandMax > 0.05 ? band / this.bandMax : 0;
      const energy = shape * clamp(sample.level * 1.15) ** 0.85 * (0.42 + 0.58 * relative ** 0.8);
      listening = 2.4 + 30 * energy;
      speaking = 3 + 38 * energy;
    } else {
      // No analysable audio: an attentive or present rhythm, deliberately unlike speech.
      listening = 2.4 + 4.4 * shape * (0.5 + 0.5 * Math.sin(t * 1.3 + d * 0.6));
      speaking = 3 + 7 * shape * (0.5 + 0.5 * Math.sin(t * 2.4 + d * 0.9));
    }
    return w.idle * idle + w.thinking * thinking + w.off * off + w.listening * listening + w.speaking * speaking;
  }

  private spark(x: number, y: number, vx: number, vy: number) {
    const s = this.sparks.find(p => p.age >= p.life);
    if (!s) return;
    Object.assign(s, { x, y, vx, vy, age: 0, life: 0.5 + this.random() * 0.8, size: 0.8 + this.random() * 0.7, base: 0.7 + this.random() * 0.3, teal: this.random() < 0.12 });
  }

  private packet(x: number, direction: number, speed: number, intensity: number) {
    const p = this.packets.find(q => q.age >= q.life);
    if (!p) return;
    const { left, right } = this.extent();
    const distance = direction > 0 ? right - x : x - left;
    Object.assign(p, { x, v: direction * speed, age: 0, life: Math.max(0.4, distance / speed), width: 50 + this.random() * 90, intensity });
  }

  private filament(outward: boolean) {
    const f = this.filaments.find(q => !q.alive);
    if (!f || this.width < 200) return;
    const { left, right } = this.extent();
    const cx = this.width / 2;
    const span = 34 + this.random() * 80;
    let x0: number;
    let v = 0;
    if (outward) {
      const side = this.random() < 0.5 ? -1 : 1;
      x0 = side > 0 ? cx + HALO_RADIUS + 4 + this.random() * 26 : cx - HALO_RADIUS - 4 - this.random() * 26 - span;
      v = side * (120 + this.random() * 140);
    } else {
      // Either side of the halo, wherever the line has room.
      const side = this.random() < 0.5 ? -1 : 1;
      const near = cx + side * (HALO_RADIUS + 10), far = side < 0 ? left + 24 : right - 24;
      const room = Math.abs(far - near) - span;
      if (room <= 0) { f.alive = false; return; }
      x0 = side < 0 ? near - span - room * this.random() : near + room * this.random();
    }
    Object.assign(f, { alive: true, age: 0, life: 0.18 + this.random() * 0.37, fade: 0.1 + this.random() * 0.14, x0, span, v, amp: 3 + this.random() * 8, teal: this.random() < 0.1, rejitter: 0.05 + this.random() * 0.08 });
    this.shape(f);
  }

  /** Midpoint displacement: irregular, never the same twice. */
  private shape(f: Filament) {
    const count = 9 + Math.floor(this.random() * 7);
    const ys = new Array<number>(count).fill(0);
    const split = (a: number, b: number, amp: number) => {
      if (b - a < 2) return;
      const m = (a + b) >> 1;
      ys[m] = (ys[a] + ys[b]) / 2 + (this.random() - 0.5) * 2 * amp;
      split(a, m, amp * 0.58);
      split(m, b, amp * 0.58);
    };
    split(0, count - 1, f.amp);
    for (let i = 0; i < count; i++) { f.points[i * 2] = (i / (count - 1)) * f.span; f.points[i * 2 + 1] = ys[i]; }
    f.count = count;
    f.branchCount = 0;
    if (this.random() < 0.45) {
      const from = 2 + Math.floor(this.random() * (count - 4));
      const direction = Math.sign(ys[from]) || (this.random() < 0.5 ? -1 : 1);
      let x = f.points[from * 2], y = ys[from];
      const steps = 3 + Math.floor(this.random() * 3);
      for (let k = 0; k <= steps && k < 7; k++) {
        f.branch[k * 2] = x; f.branch[k * 2 + 1] = y;
        x += 3 + this.random() * 5; y += direction * (2 + this.random() * 4);
      }
      f.branchCount = Math.min(7, steps + 1);
    }
  }

  private draw(sample: SignalSample | null, animated: boolean) {
    const { ctx, width, height } = this;
    const gradients = this.gradients;
    if (!gradients) return;
    const w = this.weights;
    const cx = width / 2, cy = height / 2;
    const { left, right } = this.extent();
    const L = this.live ? this.level : 0;
    const reduced = this.quality === "reduced";
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";
    const line = this.blend("line") + w.speaking * 0.14 * L;
    const glow = this.blend("glow") + w.speaking * 0.18 * L + w.listening * 0.08 * L;

    // Halo: a faint field, not a disc.
    const haloAlpha = this.blend("halo") * (0.85 + 0.15 * Math.sin(this.time * 0.9)) + w.speaking * 0.35 * L;
    const radius = HALO_RADIUS * (this.blend("haloScale") + w.speaking * 0.07 * L + w.listening * 0.03 * L + (animated ? 0.012 * Math.sin(this.time * 0.85) : 0));
    if (!reduced) {
      const field = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius * 1.25);
      field.addColorStop(0, rgba(COLORS.mid, 0));
      field.addColorStop(0.62, rgba(COLORS.mid, 0.06 * haloAlpha));
      field.addColorStop(0.84, rgba(COLORS.inner, 0.11 * haloAlpha));
      field.addColorStop(1, rgba(COLORS.mid, 0));
      ctx.fillStyle = field;
      ctx.beginPath(); ctx.arc(cx, cy, radius * 1.25, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = rgba([255, 192, 112], 0.22 * haloAlpha);
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgba([255, 172, 90], 0.05 * haloAlpha);
    ctx.beginPath(); ctx.arc(cx, cy, radius + 3.5, 0, Math.PI * 2); ctx.stroke();

    // The conduit: straight wide glow, then a faintly displaced inner line.
    ctx.lineCap = "round";
    if (!reduced && this.band) {
      ctx.globalAlpha = glow * 0.6;
      ctx.drawImage(this.band, 0, cy - 20, width, 40);
    }
    const amplitude = animated ? 0.18 + w.listening * 1.4 * L + w.speaking * 2.8 * L : 0;
    const path = () => {
      ctx.beginPath();
      const steps = 150;
      for (let k = 0; k <= steps; k++) {
        const x = left + ((right - left) * k) / steps;
        const off = x - cx;
        const envelope = Math.exp(-((off / (width * 0.22)) ** 2)) * smoothstep(HALO_RADIUS * 0.6, HALO_RADIUS * 1.1, Math.abs(off));
        const y = cy + amplitude * envelope * (0.55 * Math.sin(x * 0.043 - this.time * 7.3) + 0.3 * Math.sin(x * 0.117 + this.time * 11.9) + 0.15 * Math.sin(x * 0.29 - this.time * 17.3));
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
    };
    path();
    ctx.globalAlpha = glow * 0.26; ctx.strokeStyle = gradients.mid; ctx.lineWidth = 4; ctx.stroke();
    ctx.globalAlpha = line * 0.5; ctx.strokeStyle = gradients.inner; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = line; ctx.strokeStyle = gradients.core; ctx.lineWidth = 1.05; ctx.stroke();

    // Concentrations of current drifting along the line.
    for (const h of this.hotspots) {
      const a = (0.5 + 0.5 * Math.sin(this.time * h.rate + h.phase)) ** 2 * 0.3 * line * this.taper(h.x);
      if (a < 0.01) continue;
      this.sprite(this.warm, h.x, cy, h.width, 6, a);
      this.sprite(this.hot, h.x, cy, h.width * 0.35, 2.2, a * 0.8);
    }
    // Traveling glimmers.
    for (const p of this.packets) {
      if (p.age >= p.life) continue;
      const a = p.intensity * Math.sin(Math.PI * clamp(p.age / p.life)) ** 1.4 * this.taper(p.x) * (0.4 + line);
      this.sprite(this.warm, p.x, cy, p.width, 7, a * 0.7);
      this.sprite(this.hot, p.x, cy, p.width * 0.4, 2.4, a);
    }
    // Rare teal points along the line.
    const glints = this.blend("motes");
    for (const g of this.glints) {
      const a = Math.sin(g.phase / 2) ** 6 * glints * this.taper(g.x);
      if (a < 0.02) continue;
      this.sprite(this.tealSprite, g.x, cy, g.size * 2.6, g.size * 2.6, a * 0.9);
      ctx.globalAlpha = a; ctx.fillStyle = "rgb(214,255,248)"; ctx.fillRect(g.x - 0.75, cy - 0.75, 1.5, 1.5);
    }

    // Electrical filaments.
    for (const f of this.filaments) {
      if (!f.alive) continue;
      const rise = f.age < 0.04 ? f.age / 0.04 : Math.exp(-(f.age - 0.04) / f.fade);
      const flicker = 0.7 + 0.3 * Math.sin(f.age * 97 + f.span);
      const a = rise * flicker * this.taper(f.x0 + f.span / 2) * (w.off > 0.9 ? 0 : 1);
      if (a < 0.02) continue;
      const trace = () => {
        ctx.beginPath();
        for (let i = 0; i < f.count; i++) { const x = f.x0 + f.points[i * 2], y = cy + f.points[i * 2 + 1]; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        for (let i = 0; i < f.branchCount; i++) { const x = f.x0 + f.branch[i * 2], y = cy + f.branch[i * 2 + 1]; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      };
      trace();
      if (!reduced) { ctx.globalAlpha = 0.24 * a; ctx.strokeStyle = f.teal ? "rgb(64,206,194)" : rgba(COLORS.mid, 1); ctx.lineWidth = 2.6; ctx.stroke(); }
      ctx.globalAlpha = 0.92 * a; ctx.strokeStyle = f.teal ? "rgb(206,255,246)" : rgba(COLORS.core, 1); ctx.lineWidth = 0.75; ctx.stroke();
      this.sprite(f.teal ? this.tealSprite : this.hot, f.x0, cy, 7, 7, a * 0.5);
      this.sprite(f.teal ? this.tealSprite : this.hot, f.x0 + f.span, cy, 7, 7, a * 0.5);
    }

    // Motes and sparks.
    const motes = this.blend("motes");
    this.motes.forEach((m, i) => {
      if (reduced && i % 2) return;
      const fade = animated ? Math.min(1, m.age / 1.5, (m.life - m.age) / 1.5) : 1;
      const twinkle = animated ? 0.55 + 0.45 * Math.sin(this.time * m.rate + m.phase) : 0.8;
      const a = m.base * twinkle * fade * motes * this.taper(m.x) * (1 - Math.abs(m.y) / 30);
      if (a < 0.02) return;
      this.sprite(m.teal ? this.tealSprite : this.warm, m.x, cy + m.y, m.size * 6, m.size * 6, a * 0.75);
      ctx.globalAlpha = a; ctx.fillStyle = m.teal ? "rgb(196,255,246)" : "rgb(255,226,170)";
      ctx.fillRect(m.x - m.size / 2, cy + m.y - m.size / 2, m.size, m.size);
    });
    for (const s of this.sparks) {
      if (s.age >= s.life) continue;
      const a = s.base * (1 - s.age / s.life) ** 1.5;
      this.sprite(s.teal ? this.tealSprite : this.hot, s.x, cy + s.y, s.size * 5, s.size * 5, a);
    }

    // The waveform, last and brightest.
    ctx.globalAlpha = 0.1 + 0.22 * clamp(L * 1.4) * (w.speaking + w.listening) + 0.08 * w.idle;
    const centreGlow = 70 + 30 * L * w.speaking;
    ctx.drawImage(this.warm, cx - centreGlow / 2, cy - centreGlow / 2, centreGlow, centreGlow);
    const barAlpha = (0.25 + 0.75 * (1 - w.off)) * (1 - 0.32 * w.idle);
    let peak = 0;
    for (let i = 0; i < BARS; i++) {
      const x = cx + (i - CENTRE_BAR) * BAR_GAP, h = this.bars[i];
      peak = Math.max(peak, h * 2);
      if (!reduced) this.sprite(this.warm, x, cy, 13, h * 2 + 16, (0.1 + 0.016 * h) * barAlpha);
    }
    ctx.globalAlpha = 0.86 * barAlpha;
    ctx.strokeStyle = rgba(COLORS.barBody, 1); ctx.lineWidth = 3.2;
    ctx.beginPath();
    for (let i = 0; i < BARS; i++) { const x = cx + (i - CENTRE_BAR) * BAR_GAP; ctx.moveTo(x, cy - this.bars[i]); ctx.lineTo(x, cy + this.bars[i]); }
    ctx.stroke();
    ctx.globalAlpha = 0.9 * barAlpha;
    ctx.strokeStyle = rgba(COLORS.barCore, 1); ctx.lineWidth = 1.7;
    ctx.beginPath();
    for (let i = 0; i < BARS; i++) { const x = cx + (i - CENTRE_BAR) * BAR_GAP, h = Math.max(0, this.bars[i] - 1.2); ctx.moveTo(x, cy - h); ctx.lineTo(x, cy + h); }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    this.stats.peak = Math.round(peak);
    this.stats.live = this.live && !!sample;
    this.stats.quality = this.quality;
  }

  private sprite(image: HTMLCanvasElement, x: number, y: number, w: number, h: number, alpha: number) {
    if (alpha <= 0.004) return;
    this.ctx.globalAlpha = Math.min(1, alpha);
    this.ctx.drawImage(image, x - w / 2, y - h / 2, w, h);
  }

  /** Lower-powered machines drop the widest glows rather than frames. */
  private measure(ms: number) {
    this.cost = this.cost * 0.95 + ms * 0.05;
    this.stats.costMs = this.cost;
    if (this.cost > 6) { this.slowFrames++; this.fastFrames = 0; } else if (this.cost < 2.5) { this.fastFrames++; this.slowFrames = 0; }
    if (this.quality === "full" && this.slowFrames > 120) this.quality = "reduced";
    if (this.quality === "reduced" && this.fastFrames > 600) this.quality = "full";
  }
}

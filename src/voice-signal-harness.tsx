import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { OlympusVoiceDock } from "./components/panels/OlympusVoiceDock";
import { voiceSignal, type SignalKind } from "./services/voiceSignal";
import type { VoiceSnapshot } from "./services/realtimeVoice";
import altar from "./assets/olympus-altar-v5.png";
import "./styles.css";

/**
 * The voice dock on its own, without the WebGL scene, so its motion and audio
 * response can be measured. SYNTHETIC: the "clip" source is a generated
 * speech-shaped WAV played through an <audio> element and analysed by the real
 * ClipSource path; "stream" feeds an oscillator stream through the real
 * StreamSource path. Nothing here uses the microphone or a provider.
 *
 * `?state=idle|listening|thinking|speaking|off|error&source=clip|stream|none&muted`
 */
const params = new URLSearchParams(location.search);
const base: VoiceSnapshot = { phase: "IDLE", captionsEnabled: true, active: false, connecting: false, microphoneOn: false, microphoneCapturing: false, muted: false, inputText: "", outputText: "", error: null, level: 0, failures: 0, retryable: false };
const SNAPSHOTS: Record<string, Partial<VoiceSnapshot>> = {
  idle: {}, off: {},
  listening: { phase: "LISTENING", active: true, microphoneOn: true, microphoneCapturing: true },
  thinking: { phase: "PROCESSING", active: true },
  speaking: { phase: "SPEAKING", active: true },
  error: { phase: "ERROR", error: "Fixture failure" },
};

/** A speech-like clip: voiced harmonics under formants, in irregular syllables. */
function speechWav(seconds = 8, rate = 24000) {
  const samples = new Int16Array(seconds * rate);
  let phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate;
    const f0 = 118 + 22 * Math.sin(t * 1.7) + 9 * Math.sin(t * 5.1);
    phase += (2 * Math.PI * f0) / rate;
    const syllable = Math.max(0, 0.55 * Math.sin(t * 8.7) + 0.32 * Math.sin(t * 4.9 + 1) + 0.22 * Math.sin(t * 13.3 + 2));
    const pause = (t % 3.1) > 2.6 ? 0 : 1;
    const f1 = 560 + 160 * Math.sin(t * 2.3), f2 = 1500 + 380 * Math.sin(t * 1.4 + 1);
    let voice = 0;
    for (let h = 1; h <= 24; h++) {
      const hz = h * f0;
      const gain = Math.exp(-(((hz - f1) / 160) ** 2)) + 0.6 * Math.exp(-(((hz - f2) / 240) ** 2)) + 0.18 / h;
      voice += gain * Math.sin(h * phase);
    }
    samples[i] = Math.max(-32767, Math.min(32767, voice * 0.32 * Math.min(1, syllable) * pause * 32767 * 0.5));
  }
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + samples.length * 2, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  new Int16Array(bytes.buffer, 44).set(samples);
  return bytes;
}

function startSource(kind: SignalKind, source: string): () => void {
  // A clip is reply audio; listening always reads a stream, as the microphone does.
  if (source === "clip" && kind === "output") {
    const bytes = speechWav();
    const audio = new Audio(URL.createObjectURL(new Blob([bytes], { type: "audio/wav" })));
    audio.loop = true;
    audio.volume = 0.25;
    const detach = voiceSignal.attachClip(audio, bytes);
    void audio.play().catch(() => { document.documentElement.dataset.signalPlayback = "blocked"; });
    return () => { detach(); audio.pause(); URL.revokeObjectURL(audio.src); };
  }
  if (source === "stream" || source === "clip") {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const destination = context.createMediaStreamDestination();
    oscillator.frequency.value = 220;
    gain.gain.value = 0.2;
    // An irregular amplitude, so the stream is not a steady tone.
    const lfo = context.createOscillator(); const depth = context.createGain();
    lfo.frequency.value = 3.3; depth.gain.value = 0.18; lfo.connect(depth).connect(gain.gain);
    oscillator.connect(gain).connect(destination);
    oscillator.start(); lfo.start();
    const detach = voiceSignal.attachStream(kind, destination.stream);
    return () => { detach(); void context.close(); };
  }
  return () => {};
}

function Harness() {
  const [state, setState] = useState(params.get("state") ?? "idle");
  const [spoken, setSpoken] = useState(state !== "off");
  const source = params.get("source") ?? "clip";
  const voice = { ...base, ...SNAPSHOTS[state], muted: params.has("muted") } as VoiceSnapshot;
  useEffect(() => {
    if (state !== "speaking" && state !== "listening") return;
    return startSource(state === "speaking" ? "output" : "input", source);
  }, [state, source]);
  return <main style={{ minHeight: "100vh", background: `#020509 url(${altar}) center 62% / cover no-repeat`, display: "grid", placeItems: "center" }}>
    <div className="command-instrument" data-flagship style={{ width: 724, paddingTop: 160 }}>
      <OlympusVoiceDock voice={voice} spokenReplies={spoken && state !== "off"} onToggle={() => setSpoken(!spoken)} ready assistantPending={false} active />
    </div>
    <nav style={{ position: "fixed", left: 16, bottom: 12, display: "flex", gap: 8, font: "10px monospace", color: "#9fb0bd" }}>
      <span>SYNTHETIC · source {source}</span>
      {Object.keys(SNAPSHOTS).map(s => <button key={s} onClick={() => setState(s)} aria-pressed={s === state}>{s}</button>)}
    </nav>
  </main>;
}

createRoot(document.getElementById("root")!).render(<Harness />);

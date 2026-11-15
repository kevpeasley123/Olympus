"""Offline speech worker. stdin and stdout are private pipes owned by Olympus."""
import base64
import io
import json
import os
from pathlib import Path
import sys
import wave

def lead_in(samples, rate, lead=0.3, margin=0.08, tail=0.25):
    import numpy as np
    peak = float(np.max(np.abs(samples))) if samples.size else 0.0
    if peak > 0:
        loud = np.flatnonzero(np.abs(samples) > peak * 0.01)  # 40 dB below peak
        start = max(0, int(loud[0]) - int(margin * rate))
        end = min(samples.size, int(loud[-1]) + int(margin * rate))
        samples = samples[start:end].copy()
        fade = min(samples.size, int(0.005 * rate))
        samples[:fade] *= np.linspace(0, 1, fade, dtype=samples.dtype)
    return np.concatenate([np.zeros(int(lead * rate), samples.dtype), samples, np.zeros(int(tail * rate), samples.dtype)])

def run(payload):
    root = Path(os.environ["OLYMPUS_VOICE_MODELS"])
    if payload["kind"] == "transcribe":
        from faster_whisper import WhisperModel
        import numpy as np
        model_dir = root / "whisper"
        if not model_dir.is_dir():
            raise FileNotFoundError("Missing local Whisper directory.")
        samples = np.frombuffer(base64.b64decode(payload["value"], validate=True), dtype="<i2")
        model = WhisperModel(str(model_dir), device="cpu", compute_type="int8", local_files_only=True)
        segments, _ = model.transcribe(samples.astype("float32") / 32768, beam_size=1)
        return "".join(segment.text for segment in segments).strip()
    from kokoro_onnx import Kokoro
    import numpy as np
    voice = Kokoro(str(root / "kokoro-v1.0.onnx"), str(root / "voices-v1.0.bin"))
    name = payload.get("voice") or "af_sarah"
    # Kokoro's own trim cuts at coarse frames and can clip a soft first sound, and
    # a clip that starts on speech loses its first moments while the output device
    # wakes. Keep the model's edges, trim gently, and lead in with silence.
    samples, rate = voice.create(payload["value"], voice=name, lang="en-gb" if name[0] == "b" else "en-us", trim=False)
    samples = lead_in(np.asarray(samples, dtype="float32"), rate)
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes((np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes())
    return base64.b64encode(output.getvalue()).decode("ascii")

try:
    print(json.dumps({"value": run(json.load(sys.stdin))}))
except (ImportError, FileNotFoundError, KeyError):
    print(json.dumps({"error": "Local speech setup incomplete. Configure OLYMPUS_VOICE_PYTHON and OLYMPUS_VOICE_MODELS with the offline voice dependencies and model files."}))
except Exception:
    print(json.dumps({"error": "Local speech processing failed. Check the local model files and audio format."}))

//! Private local speech process. No provider or network fallback.
use serde_json::{json, Value};
use std::{path::PathBuf, process::Stdio, sync::Mutex, time::Duration};
use tokio::{io::AsyncWriteExt, process::Command, sync::oneshot};

static ACTIVE: Mutex<Option<oneshot::Sender<()>>> = Mutex::new(None);

#[tauri::command]
pub fn cancel_local_speech() {
    if let Ok(mut active) = ACTIVE.lock() {
        if let Some(sender) = active.take() {
            let _ = sender.send(());
        }
    }
}

/// Where the voice runtime is found, first match wins: the environment
/// (`OLYMPUS_VOICE_PYTHON`, `OLYMPUS_VOICE_MODELS`), then `local-voice` in the
/// app data folder, then `.local-voice` in a development checkout. A configured
/// path that no longer exists falls through rather than failing: moving the
/// checkout on November 10 left both the environment and the runtime pointing
/// at a folder that was gone, and speech stopped without saying why.
fn voice_paths(app_data: Option<PathBuf>) -> Result<(PathBuf, PathBuf), String> {
    let dev_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.local-voice");
    let roots: Vec<PathBuf> = app_data.map(|dir| dir.join("local-voice")).into_iter().chain(cfg!(debug_assertions).then_some(dev_root)).collect();
    let find = |key: &str, relative: &str, ok: fn(&PathBuf) -> bool| {
        std::env::var_os(key)
            .map(PathBuf::from)
            .into_iter()
            .chain(roots.iter().map(|root| root.join(relative)))
            .find(ok)
    };
    let python = find("OLYMPUS_VOICE_PYTHON", "runtime/Scripts/python.exe", |p| p.is_file()).ok_or("Configure the local Olympus voice Python runtime.")?;
    let models = find("OLYMPUS_VOICE_MODELS", "models", |p| p.is_dir()).ok_or("Configure the local Olympus voice model folder.")?;
    Ok((python, models))
}

#[tauri::command]
pub async fn local_speech(app: tauri::AppHandle, kind: String, value: String) -> Result<String, String> {
    use tauri::Manager;
    let (python, models) = voice_paths(app.path().app_data_dir().ok())?;
    speak_or_transcribe(python, models, kind, value).await
}

async fn speak_or_transcribe(python: PathBuf, models: PathBuf, kind: String, value: String) -> Result<String, String> {
    match kind.as_str() {
        "transcribe" if !value.is_empty() && value.len() <= 2_560_000 => {}
        "speak" if !value.trim().is_empty() && value.chars().count() <= 2500 => {}
        _ => return Err("Local speech input is empty or too long.".into()),
    }
    let data =
        serde_json::to_vec(&json!({"kind":kind,"value":value})).map_err(|e| e.to_string())?;
    let (sender, cancel) = oneshot::channel();
    let mut command = Command::new(python);
    command
        .args([
            "-I",
            "-X",
            "utf8",
            "-c",
            include_str!("local_speech.py").trim_start_matches('\u{feff}'),
        ])
        .env("OLYMPUS_VOICE_MODELS", models)
        .env("HF_HUB_OFFLINE", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    let mut child = command
        .spawn()
        .map_err(|_| "Local speech worker could not start.")?;
    if let Some(prior) = ACTIVE
        .lock()
        .map_err(|_| "Speech state unavailable")?
        .replace(sender)
    {
        let _ = prior.send(());
    }
    let work = async {
        let mut input = child.stdin.take().ok_or("Speech input unavailable")?;
        input
            .write_all(&data)
            .await
            .map_err(|_| "Speech input failed")?;
        drop(input);
        let output = child
            .wait_with_output()
            .await
            .map_err(|_| "Speech worker failed")?;
        let parsed = worker_answer(&output.stdout).ok_or_else(|| worker_failure(output.status.code(), &output.stderr))?;
        parsed["value"].as_str().map(String::from).ok_or_else(|| {
            parsed["error"]
                .as_str()
                .unwrap_or("Local speech unavailable")
                .to_owned()
        })
    };
    tokio::select! {
        _ = cancel => Err("Local speech cancelled.".into()),
        result = tokio::time::timeout(Duration::from_secs(120),work) => result.map_err(|_|"Local speech timed out.")?,
    }
}

/// The worker's answer: the last stdout line that is a JSON object. A model library
/// may print its own lines first; they are not the answer.
fn worker_answer(stdout: &[u8]) -> Option<Value> {
    String::from_utf8_lossy(stdout).lines().rev().map(str::trim).filter(|line| line.starts_with('{')).find_map(|line| serde_json::from_str::<Value>(line).ok().filter(Value::is_object))
}

/// Why a worker gave no answer, from its exit code and the last lines it wrote to
/// stderr (a Python traceback ends with the exception). Bounded; never the input text.
fn worker_failure(code: Option<i32>, stderr: &[u8]) -> String {
    let text = String::from_utf8_lossy(stderr);
    let tail: Vec<&str> = text.lines().map(str::trim).filter(|line| !line.is_empty()).collect();
    let tail = tail[tail.len().saturating_sub(2)..].join(" | ");
    let tail: String = tail.chars().take(300).collect();
    match (code, tail.is_empty()) {
        (Some(code), true) => format!("Local speech worker exited with code {code} and no answer."),
        (None, true) => "Local speech worker stopped without an answer.".into(),
        (_, false) => format!("Local speech worker failed: {tail}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_answer_is_the_last_json_line_and_a_failure_says_why() {
        assert_eq!(worker_answer(b"espeak: loaded\r\n{\"value\":\"UklGRg\"}\r\n").unwrap()["value"], "UklGRg");
        assert!(worker_answer(b"").is_none() && worker_answer(b"[1,2]\nnot json").is_none());
        assert_eq!(worker_failure(Some(1), b"Traceback (most recent call last):\n  File x\nModuleNotFoundError: No module named 'kokoro_onnx'\n"), "Local speech worker failed: File x | ModuleNotFoundError: No module named 'kokoro_onnx'");
        assert_eq!(worker_failure(Some(3), b""), "Local speech worker exited with code 3 and no answer.");
        assert!(worker_failure(None, "x".repeat(900).as_bytes()).chars().count() < 340);
    }

    #[test]
    fn a_stale_configured_path_falls_through_to_the_app_data_runtime() {
        let data = std::env::temp_dir().join(format!("olympus-voice-{}", std::process::id()));
        let root = data.join("local-voice");
        std::fs::create_dir_all(root.join("runtime/Scripts")).unwrap();
        std::fs::create_dir_all(root.join("models")).unwrap();
        std::fs::write(root.join("runtime/Scripts/python.exe"), "").unwrap();
        std::env::set_var("OLYMPUS_VOICE_PYTHON", data.join("moved-away/python.exe"));
        std::env::set_var("OLYMPUS_VOICE_MODELS", data.join("moved-away/models"));
        let (python, models) = voice_paths(Some(data.clone())).unwrap();
        assert_eq!((python, models), (root.join("runtime/Scripts/python.exe"), root.join("models")));
        std::env::remove_var("OLYMPUS_VOICE_PYTHON");
        std::env::remove_var("OLYMPUS_VOICE_MODELS");
        let _ = std::fs::remove_dir_all(&data);
    }
    #[test]
    #[ignore = "requires locally provisioned Whisper and Kokoro models"]
    fn offline_worker_round_trip() {
        use base64::{engine::general_purpose::STANDARD, Engine};
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt.block_on(async {
            let start = std::time::Instant::now();
            let (python, models) = voice_paths(std::env::var_os("APPDATA").map(|dir| PathBuf::from(dir).join("com.projectolympus.commandstation"))).unwrap();
            let result = speak_or_transcribe(python.clone(), models.clone(), "speak".into(), "Olympus project review is ready.".into())
                .await
                .unwrap();
            let wav = STANDARD.decode(result).unwrap();
            assert_eq!(&wav[..4], b"RIFF");
            let sample_rate = u32::from_le_bytes(wav[24..28].try_into().unwrap()) as usize;
            let samples: Vec<_> = wav[44..]
                .chunks_exact(2)
                .map(|b| i16::from_le_bytes([b[0], b[1]]))
                .collect();
            let mut resampled = Vec::new();
            for i in 0..samples.len() * 16000 / sample_rate {
                resampled.extend_from_slice(&samples[i * sample_rate / 16000].to_le_bytes());
            }
            let synthesis = start.elapsed();
            let transcript = speak_or_transcribe(python, models, "transcribe".into(), STANDARD.encode(resampled))
                .await
                .unwrap();
            println!(
                "Local synthesis {:?}; whole round trip {:?}; transcript {}",
                synthesis,
                start.elapsed(),
                transcript
            );
            assert!(transcript
                .to_lowercase()
                .contains("project review is ready"));
        });
    }
}

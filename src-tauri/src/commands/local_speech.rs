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

#[tauri::command]
pub async fn local_speech(kind: String, value: String) -> Result<String, String> {
    match kind.as_str() {
        "transcribe" if !value.is_empty() && value.len() <= 2_560_000 => {}
        "speak" if !value.trim().is_empty() && value.chars().count() <= 2500 => {}
        _ => return Err("Local speech input is empty or too long.".into()),
    }
    let dev_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.local-voice");
    let configured = |key, relative: &str| {
        std::env::var_os(key)
            .map(PathBuf::from)
            .or_else(|| cfg!(debug_assertions).then(|| dev_root.join(relative)))
    };
    let python = configured("OLYMPUS_VOICE_PYTHON", "runtime/Scripts/python.exe")
        .filter(|p| p.is_file())
        .ok_or("Configure the local Olympus voice Python runtime.")?;
    let models = configured("OLYMPUS_VOICE_MODELS", "models")
        .filter(|p| p.is_dir())
        .ok_or("Configure the local Olympus voice model folder.")?;
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
        .stderr(Stdio::null())
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
        let parsed: Value =
            serde_json::from_slice(&output.stdout).map_err(|_| "Invalid local speech response")?;
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

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "requires locally provisioned Whisper and Kokoro models"]
    fn offline_worker_round_trip() {
        use base64::{engine::general_purpose::STANDARD, Engine};
        let rt=tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        rt.block_on(async {
            let start=std::time::Instant::now();
            let result=local_speech("speak".into(),"Olympus project review is ready.".into()).await.unwrap();
            let wav=STANDARD.decode(result).unwrap();
            assert_eq!(&wav[..4],b"RIFF");
            let sample_rate=u32::from_le_bytes(wav[24..28].try_into().unwrap()) as usize;
            let samples:Vec<_>=wav[44..].chunks_exact(2).map(|b|i16::from_le_bytes([b[0],b[1]])).collect();
            let mut resampled=Vec::new();
            for i in 0..samples.len()*16000/sample_rate {
                resampled.extend_from_slice(&samples[i*sample_rate/16000].to_le_bytes());
            }
            let synthesis=start.elapsed();
            let transcript=local_speech("transcribe".into(),STANDARD.encode(resampled)).await.unwrap();
            println!("Local synthesis {:?}; whole round trip {:?}; transcript {}",synthesis,start.elapsed(),transcript);
            assert!(transcript.to_lowercase().contains("project review is ready"));
        });
    }
}

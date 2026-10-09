//! Curated memory is quoted evidence. Indexing grants no execution authority.
mod index;
mod record;
mod retrieve;
#[cfg(test)]
mod tests;
use notify::Watcher;
pub use retrieve::{Packet, Query};
use rusqlite::{params, OptionalExtension};
use std::{
    collections::HashSet,
    path::PathBuf,
    sync::{mpsc, Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::State;

enum Signal {
    Changed(Vec<PathBuf>),
    Rebuild,
    Stop,
}
pub struct MemoryService {
    vault: PathBuf,
    path: PathBuf,
    signal: mpsc::SyncSender<Signal>,
    health: Arc<Mutex<index::IndexStatus>>,
}
#[derive(Clone)]
pub struct MemoryReader {
    vault: PathBuf,
    path: PathBuf,
    health: Arc<Mutex<index::IndexStatus>>,
}
impl Drop for MemoryService {
    fn drop(&mut self) {
        let _ = self.signal.try_send(Signal::Stop);
    }
}
impl MemoryService {
    pub fn start(vault: PathBuf, path: PathBuf) -> Self {
        let (tx, rx) = mpsc::sync_channel(256);
        let health = Arc::new(Mutex::new(index::IndexStatus {
            state: "indexing".into(),
            ..Default::default()
        }));
        let worker_health = health.clone();
        let worker_vault = vault.clone();
        let worker_path = path.clone();
        let events = tx.clone();
        std::thread::Builder::new().name("olympus-memory-index".into()).spawn(move||{
            let mut watcher=notify::recommended_watcher(move|event:notify::Result<notify::Event>|{
                if let Ok(event)=event{if !matches!(event.kind,notify::EventKind::Access(_)){let _=events.try_send(Signal::Changed(event.paths));}}
            }).ok();
            if watcher.as_mut().is_some_and(|w|w.watch(&worker_vault,notify::RecursiveMode::Recursive).is_err()){watcher=None;}
            let mut connection=None;let mut force=true;let mut rebuild=false;let mut dirty=HashSet::new();let mut last_integrity=Instant::now();
            loop{
                let result=(||{
                    if connection.is_none(){
                        connection=Some(match index::open(&worker_path,&worker_vault){
                            Ok(c)=>c,
                            Err(_) if rebuild=>{index::archive_unreadable_index(&worker_path)?;index::open(&worker_path,&worker_vault)?},
                            Err(error)=>return Err(error),
                        });
                    }
                    index::reconcile(connection.as_mut().unwrap(),&worker_vault,force,&dirty,rebuild)
                })();
                match result{
                    Ok(mut status)=>{if watcher.is_none(){status.warnings.push("Filesystem notifications unavailable; periodic reconciliation remains active".into());}if let Ok(mut h)=worker_health.lock(){*h=status;}},
                    Err(error)=>{connection=None;if let Ok(mut h)=worker_health.lock(){h.state="unavailable".into();h.warnings=vec![error];}},
                }
                force=false;rebuild=false;dirty.clear();
                match rx.recv_timeout(Duration::from_secs(60)){
                    Ok(Signal::Stop)|Err(mpsc::RecvTimeoutError::Disconnected)=>break,
                    Ok(Signal::Rebuild)=>{rebuild=true;force=true;},
                    Ok(Signal::Changed(paths))=>{
                        dirty.extend(paths);
                        // Wait for atomic-replace saves and short write bursts to settle.
                        let start=Instant::now();
                        while start.elapsed()<Duration::from_secs(2){match rx.recv_timeout(Duration::from_millis(250)){
                            Ok(Signal::Changed(paths))=>dirty.extend(paths),
                            Ok(Signal::Rebuild)=>{rebuild=true;force=true;},
                            Ok(Signal::Stop)|Err(mpsc::RecvTimeoutError::Disconnected)=>return,
                            Err(mpsc::RecvTimeoutError::Timeout)=>break,
                        }}
                    },
                    Err(mpsc::RecvTimeoutError::Timeout)=>{},
                }
                if last_integrity.elapsed()>=Duration::from_secs(600){force=true;last_integrity=Instant::now();}
            }
        }).expect("memory indexing worker starts");
        Self {
            vault,
            path,
            signal: tx,
            health,
        }
    }
    pub fn reader(&self) -> MemoryReader {
        MemoryReader {
            vault: self.vault.clone(),
            path: self.path.clone(),
            health: self.health.clone(),
        }
    }
}
impl MemoryReader {
    pub fn query(&self, query: &Query) -> Packet {
        if query.question.len() > 16_384
            || query
                .recent_questions
                .iter()
                .map(String::len)
                .sum::<usize>()
                > 16_384
        {
            return Packet::unavailable("Memory query exceeds its bounded input size");
        }
        let health = self.health.lock().map(|h| h.clone()).unwrap_or_default();
        if health.state == "unavailable" {
            return Packet::unavailable(
                health
                    .warnings
                    .first()
                    .map(String::as_str)
                    .unwrap_or("Memory index unavailable"),
            );
        }
        match index::reader(&self.path).and_then(|c| retrieve::retrieve(&c, &self.vault, query)) {
            Ok(packet) => packet,
            Err(error) => Packet::unavailable(&error),
        }
    }
}

#[tauri::command]
pub fn memory_status(memory: State<MemoryService>) -> Result<index::IndexStatus, String> {
    memory
        .health
        .lock()
        .map(|h| h.clone())
        .map_err(|_| "Memory status unavailable".into())
}
#[tauri::command]
pub async fn memory_preview(
    memory: State<'_, MemoryService>,
    query: Query,
) -> Result<Packet, String> {
    let reader = memory.reader();
    if query.question.len() > 16_384
        || query
            .recent_questions
            .iter()
            .map(String::len)
            .sum::<usize>()
            > 16_384
    {
        return Err("Memory query too large".into());
    }
    tauri::async_runtime::spawn_blocking(move || Ok(reader.query(&query)))
        .await
        .map_err(|_| "Memory preview task failed")?
}
#[tauri::command]
pub fn memory_rebuild(memory: State<MemoryService>) -> Result<(), String> {
    memory
        .signal
        .try_send(Signal::Rebuild)
        .map_err(|_| "Memory worker is busy; retry shortly".into())
}

/// Stored before dispatch. The webview cannot supply or rewrite these receipts.
pub fn save_packet(
    db: &super::persistence::Db,
    request_id: &str,
    packet: &Packet,
) -> Result<(), String> {
    let c = db.0.lock().map_err(|_| "Memory provenance unavailable")?;
    c.execute("INSERT INTO request_memory(request_id,packet_json) SELECT ?1,?2 WHERE EXISTS(SELECT 1 FROM model_requests WHERE id=?1) ON CONFLICT(request_id) DO NOTHING",params![request_id,packet.json()]).map_err(|e|e.to_string())?;
    Ok(())
}
pub fn previous_scope(db: &super::persistence::Db) -> Option<String> {
    let c = db.0.lock().ok()?;
    let raw:String=c.query_row("SELECT m.packet_json FROM request_memory m JOIN model_requests r ON r.id=m.request_id ORDER BY json_extract(r.record_json,'$.requestedAt') DESC,r.rowid DESC LIMIT 1",[],|r|r.get(0)).ok()?;
    let packet: Packet = serde_json::from_str(&raw).ok()?;
    if packet.scope.len() == 1 {
        packet.scope.into_iter().next()
    } else {
        None
    }
}
#[tauri::command]
pub fn memory_request_evidence(
    db: State<super::persistence::Db>,
    request_id: String,
) -> Result<Option<Packet>, String> {
    if request_id.len() > 160 {
        return Err("Invalid request identity".into());
    }
    let c = db.0.lock().map_err(|_| "Memory provenance unavailable")?;
    let raw: Option<String> = c
        .query_row(
            "SELECT packet_json FROM request_memory WHERE request_id=?1",
            [request_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    raw.map(|s| {
        serde_json::from_str(&s).map_err(|_| "Saved memory evidence could not be read".into())
    })
    .transpose()
}

/// The library is queried once, then reused by both provider routes. The legacy
/// path is an explicit local rollback switch, never an automatic substitution.
pub fn load_for_turn(service: &MemoryReader, query: &Query) -> super::vault_context::VaultMemory {
    if std::env::var("OLYMPUS_MEMORY_MODE").ok().as_deref() == Some("legacy") {
        let mut memory = super::vault_context::load_vault_memory_for_query(&query.question);
        memory.recall = Some(Packet {
            status: "disabled".into(),
            policy: retrieve::POLICY.into(),
            warnings: vec![
                "Indexed recall disabled by local rollback setting; legacy context only".into(),
            ],
            ..Default::default()
        });
        return memory;
    }
    let mut memory = super::vault_context::load_stable_memory();
    memory.recall = Some(service.query(query));
    memory
}

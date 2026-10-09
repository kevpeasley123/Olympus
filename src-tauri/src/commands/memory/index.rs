use super::record::{self, Parsed, Record, MAX_FILE_BYTES};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    io::Read,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

const SCHEMA: &str = r#"
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS documents(path TEXT PRIMARY KEY,id TEXT NOT NULL,kind TEXT NOT NULL,revision TEXT NOT NULL,json TEXT NOT NULL,stamp TEXT NOT NULL,bytes INTEGER NOT NULL,valid INTEGER NOT NULL DEFAULT 1);
CREATE INDEX IF NOT EXISTS document_id ON documents(id);
CREATE INDEX IF NOT EXISTS document_kind ON documents(kind,valid);
CREATE TABLE IF NOT EXISTS chunks(rowid INTEGER PRIMARY KEY,path TEXT NOT NULL REFERENCES documents(path) ON DELETE CASCADE,title TEXT NOT NULL,heading TEXT NOT NULL,body TEXT NOT NULL,start INTEGER NOT NULL,end INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS chunk_path ON chunks(path);
CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(title,heading,body,content='chunks',content_rowid='rowid',tokenize='unicode61');
CREATE TRIGGER IF NOT EXISTS chunks_insert AFTER INSERT ON chunks BEGIN INSERT INTO search(rowid,title,heading,body) VALUES(new.rowid,new.title,new.heading,new.body); END;
CREATE TRIGGER IF NOT EXISTS chunks_delete AFTER DELETE ON chunks BEGIN INSERT INTO search(search,rowid,title,heading,body) VALUES('delete',old.rowid,old.title,old.heading,old.body); END;
CREATE TABLE IF NOT EXISTS aliases(alias TEXT NOT NULL,project_id TEXT NOT NULL,path TEXT NOT NULL,PRIMARY KEY(alias,project_id,path));
CREATE INDEX IF NOT EXISTS aliases_project ON aliases(project_id);
CREATE TABLE IF NOT EXISTS refs(path TEXT NOT NULL REFERENCES documents(path) ON DELETE CASCADE,alias TEXT NOT NULL,PRIMARY KEY(path,alias));
CREATE INDEX IF NOT EXISTS refs_alias ON refs(alias);
CREATE TABLE IF NOT EXISTS bindings(path TEXT NOT NULL REFERENCES documents(path) ON DELETE CASCADE,project_id TEXT NOT NULL,PRIMARY KEY(path,project_id));
CREATE INDEX IF NOT EXISTS bindings_project ON bindings(project_id,path);
CREATE TABLE IF NOT EXISTS relations(path TEXT NOT NULL REFERENCES documents(path) ON DELETE CASCADE,target TEXT NOT NULL,kind TEXT NOT NULL,PRIMARY KEY(path,target,kind));
CREATE INDEX IF NOT EXISTS relations_target ON relations(target,kind);
CREATE TABLE IF NOT EXISTS diagnostics(path TEXT PRIMARY KEY,message TEXT NOT NULL);
"#;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexStatus {
    pub state: String,
    pub generation: u64,
    pub indexed_at: Option<String>,
    pub documents: u64,
    pub chunks: u64,
    pub source_bytes: u64,
    pub issues: u64,
    pub warnings: Vec<String>,
    pub changed: u64,
}

pub fn open(path: &Path, vault: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let c = Connection::open(path).map_err(|e| e.to_string())?;
    c.busy_timeout(std::time::Duration::from_secs(2))
        .map_err(|e| e.to_string())?;
    c.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| e.to_string())?;
    c.execute_batch(SCHEMA).map_err(|e| e.to_string())?;
    let version: Option<String> = c
        .query_row("SELECT value FROM meta WHERE key='schema'", [], |r| {
            r.get(0)
        })
        .optional()
        .map_err(|e| e.to_string())?;
    if version.as_deref().is_some_and(|v| v != "1") {
        return Err(
            "Unsupported memory index schema; rebuild with a compatible application".into(),
        );
    }
    let owner = vault.to_string_lossy().to_string();
    let stored: Option<String> = c
        .query_row("SELECT value FROM meta WHERE key='vault'", [], |r| r.get(0))
        .optional()
        .map_err(|e| e.to_string())?;
    if stored.as_deref().is_some_and(|v| v != owner) {
        return Err("Memory index belongs to a different vault".into());
    }
    c.execute("INSERT OR IGNORE INTO meta VALUES('schema','1')", [])
        .map_err(|e| e.to_string())?;
    c.execute("INSERT OR IGNORE INTO meta VALUES('vault',?1)", [owner])
        .map_err(|e| e.to_string())?;
    let check: String = c
        .query_row("PRAGMA quick_check", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if check != "ok" {
        return Err("Memory index integrity check failed; source notes are untouched".into());
    }
    Ok(c)
}

pub fn reader(path: &Path) -> Result<Connection, String> {
    let c = Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|_| "Memory index is not ready")?;
    c.busy_timeout(std::time::Duration::from_millis(250))
        .map_err(|e| e.to_string())?;
    Ok(c)
}

/// Explicit recovery touches only the derived index family. Retain unreadable
/// bytes for diagnosis; never rename or rewrite anything in the source vault.
pub fn archive_unreadable_index(path: &Path) -> Result<(), String> {
    if path.file_name().and_then(|n| n.to_str()) != Some("memory-index.sqlite") {
        return Err("Unexpected index recovery target".into());
    }
    let suffix = chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default();
    for ending in ["", "-wal", "-shm"] {
        let from = PathBuf::from(format!("{}{ending}", path.display()));
        if from.exists() {
            let to = PathBuf::from(format!("{}.unreadable-{suffix}{ending}", path.display()));
            fs::rename(&from, &to).map_err(|_| "Close other index readers and retry recovery")?;
        }
    }
    Ok(())
}

/// Read only a contained, bounded, stable revision. Canonicalization also
/// protects against Windows junctions that WalkDir does not identify as links.
pub fn read_source(root: &Path, relative: &str) -> Result<Vec<u8>, String> {
    if !record::eligible_path(relative) || relative.split('/').any(|p| p == "..") {
        return Err("Ineligible memory source".into());
    }
    let root = root.canonicalize().map_err(|_| "Vault unavailable")?;
    let path = root
        .join(relative)
        .canonicalize()
        .map_err(|_| "Source unavailable")?;
    if !path.starts_with(&root) {
        return Err("Source escapes vault".into());
    }
    let mut file = fs::File::open(&path).map_err(|_| "Source unreadable")?;
    let before = file.metadata().map_err(|_| "Source metadata unavailable")?;
    if !before.is_file() || before.len() > MAX_FILE_BYTES as u64 {
        return Err("Source exceeds 2 MiB indexing limit".into());
    }
    let mut bytes = Vec::new();
    Read::by_ref(&mut file)
        .take(MAX_FILE_BYTES as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Source read failed")?;
    let after = fs::metadata(&path).map_err(|_| "Source changed while reading")?;
    if bytes.len() > MAX_FILE_BYTES
        || before.len() != after.len()
        || before.modified().ok() != after.modified().ok()
        || bytes.len() as u64 != after.len()
    {
        return Err("Source changed while reading; retry on next reconciliation".into());
    }
    Ok(bytes)
}

pub fn put(c: &Connection, parsed: &Parsed, stamp: &str, bytes: usize) -> rusqlite::Result<()> {
    let r = &parsed.record;
    c.execute("DELETE FROM documents WHERE path=?1", [&r.path])?;
    c.execute("INSERT INTO documents(path,id,kind,revision,json,stamp,bytes) VALUES(?1,?2,?3,?4,?5,?6,?7)", params![r.path,r.id,r.kind,r.revision,serde_json::to_string(r).unwrap(),stamp,bytes])?;
    for chunk in &parsed.chunks {
        c.execute(
            "INSERT INTO chunks(path,title,heading,body,start,end) VALUES(?1,?2,?3,?4,?5,?6)",
            params![
                r.path,
                r.title,
                chunk.heading,
                chunk.body,
                chunk.start,
                chunk.end
            ],
        )?;
    }
    for alias in &r.project_refs {
        c.execute(
            "INSERT OR IGNORE INTO refs VALUES(?1,?2)",
            params![r.path, record::key(alias)],
        )?;
    }
    for (kind, targets) in [
        ("supersedes", &r.supersedes),
        ("corrects", &r.corrects),
        ("derived_from", &r.derived_from),
    ] {
        for target in targets {
            c.execute(
                "INSERT OR IGNORE INTO relations VALUES(?1,?2,?3)",
                params![r.path, target, kind],
            )?;
        }
    }
    Ok(())
}

pub fn registry(c: &Connection) -> rusqlite::Result<()> {
    c.execute("DELETE FROM aliases", [])?;
    let mut stmt = c.prepare("SELECT json FROM documents WHERE kind='project' AND valid=1")?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
    for row in rows {
        let r: Record = serde_json::from_str(&row?).map_err(|_| rusqlite::Error::InvalidQuery)?;
        let Some(id) = r.project_id else { continue };
        for alias in r.aliases.iter().chain(r.repository.iter()) {
            c.execute(
                "INSERT OR IGNORE INTO aliases VALUES(?1,?2,?3)",
                params![record::key(alias), id, r.path],
            )?;
        }
    }
    // Duplicate project IDs are ambiguous even when their display names differ.
    c.execute("DELETE FROM aliases WHERE project_id IN (SELECT project_id FROM aliases GROUP BY project_id HAVING COUNT(DISTINCT path)>1)", [])?;
    c.execute("DELETE FROM bindings", [])?;
    c.execute("INSERT OR IGNORE INTO bindings SELECT refs.path,MIN(aliases.project_id) FROM refs JOIN aliases ON refs.alias=aliases.alias GROUP BY refs.path,refs.alias HAVING COUNT(DISTINCT aliases.project_id)=1", [])?;
    Ok(())
}

pub fn status(c: &Connection) -> Result<IndexStatus, String> {
    let raw: Option<String> = c
        .query_row("SELECT value FROM meta WHERE key='status'", [], |r| {
            r.get(0)
        })
        .optional()
        .map_err(|e| e.to_string())?;
    raw.map(|s| serde_json::from_str(&s).map_err(|e| e.to_string()))
        .unwrap_or_else(|| {
            Ok(IndexStatus {
                state: "indexing".into(),
                ..IndexStatus::default()
            })
        })
}

pub fn reconcile(
    c: &mut Connection,
    vault: &Path,
    force: bool,
    dirty: &HashSet<PathBuf>,
    rebuild: bool,
) -> Result<IndexStatus, String> {
    // A missing root must not erase the last committed inventory.
    let canonical = vault
        .canonicalize()
        .map_err(|_| "Vault unavailable; retained previous index")?;
    fs::read_dir(&canonical).map_err(|_| "Vault unreadable; retained previous index")?;
    let previous = status(c)?;
    let tx = c.transaction().map_err(|e| e.to_string())?;
    let work = (|| -> rusqlite::Result<IndexStatus> {
        tx.execute_batch("CREATE TEMP TABLE IF NOT EXISTS seen(path TEXT PRIMARY KEY); DELETE FROM seen; DELETE FROM diagnostics;")?;
        let mut complete = true;
        let mut changed = 0;
        let mut visited = 0;
        // A whole collection disappearing during sync is not evidence that
        // each contained note was intentionally deleted.
        for folder in [
            "01 - Projects",
            "02 - Research",
            "04 - Decisions",
            "08 - Daily Briefs/Sessions",
            "09 - System/History",
        ] {
            let prior: u64 = tx.query_row(
                "SELECT COUNT(*) FROM documents WHERE path LIKE ?1",
                [format!("{folder}/%")],
                |r| r.get(0),
            )?;
            if prior > 0 && fs::read_dir(vault.join(folder)).is_err() {
                complete = false;
            }
        }
        // Reparse reachable sources on rebuild, retaining the prior inventory
        // until enumeration is complete. An offline collection is not deletion.
        for entry in walkdir::WalkDir::new(vault)
            .follow_links(false)
            .max_depth(8)
            .into_iter()
            .filter_entry(|e| {
                if e.depth() == 0 {
                    return true;
                }
                let relative = e
                    .path()
                    .strip_prefix(vault)
                    .unwrap_or(e.path())
                    .to_string_lossy()
                    .replace('\\', "/");
                if relative
                    .split('/')
                    .any(|s| s.starts_with('.') || s.starts_with('_'))
                {
                    return false;
                }
                if e.depth() == 1 {
                    return [
                        "01 - Projects",
                        "02 - Research",
                        "04 - Decisions",
                        "08 - Daily Briefs",
                        "09 - System",
                    ]
                    .contains(&relative.as_str());
                }
                if relative.starts_with("09 - System/") {
                    return relative.starts_with("09 - System/History");
                }
                if relative.starts_with("08 - Daily Briefs/") {
                    return relative.starts_with("08 - Daily Briefs/Sessions");
                }
                true
            })
        {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => {
                    complete = false;
                    continue;
                }
            };
            if entry.file_type().is_dir() {
                if entry.depth() == 8 {
                    complete = false;
                }
                continue;
            }
            if !entry.file_type().is_file() {
                continue;
            }
            let path = entry
                .path()
                .strip_prefix(vault)
                .unwrap()
                .to_string_lossy()
                .replace('\\', "/");
            if !record::eligible_path(&path) {
                continue;
            }
            visited += 1;
            if visited > 300_000 {
                complete = false;
                break;
            }
            tx.execute("INSERT OR IGNORE INTO seen VALUES(?1)", [&path])?;
            let stamp = fs::metadata(entry.path())
                .ok()
                .map(|m| {
                    format!(
                        "{}:{}",
                        m.len(),
                        m.modified()
                            .ok()
                            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                            .map(|d| d.as_nanos())
                            .unwrap_or(0)
                    )
                })
                .unwrap_or_default();
            let prior: Option<(String, String, i64)> = tx
                .query_row(
                    "SELECT stamp,revision,valid FROM documents WHERE path=?1",
                    [&path],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
                )
                .optional()?;
            if !force
                && !rebuild
                && !dirty.contains(entry.path())
                && prior.as_ref().is_some_and(|p| p.0 == stamp && p.2 == 1)
            {
                continue;
            }
            let result = read_source(vault, &path).and_then(|bytes| {
                if !rebuild
                    && prior
                        .as_ref()
                        .is_some_and(|p| p.1 == record::fingerprint(&bytes) && p.2 == 1)
                {
                    return Ok((bytes, None, true));
                }
                let parsed = record::parse(&path, &bytes)?;
                Ok((bytes, parsed, false))
            });
            match result {
                Ok((_, _, true)) => {
                    tx.execute(
                        "UPDATE documents SET stamp=?2 WHERE path=?1",
                        params![path, stamp],
                    )?;
                }
                Ok((bytes, Some(parsed), false)) => {
                    put(&tx, &parsed, &stamp, bytes.len())?;
                    changed += 1;
                }
                Ok((_, None, false)) => {
                    changed += tx.execute("DELETE FROM documents WHERE path=?1", [&path])? as u64;
                }
                Err(message) => {
                    tx.execute("UPDATE documents SET valid=0 WHERE path=?1", [&path])?;
                    tx.execute(
                        "INSERT OR REPLACE INTO diagnostics VALUES(?1,?2)",
                        params![path, message],
                    )?;
                }
            }
        }
        if complete {
            changed += tx.execute(
                "DELETE FROM documents WHERE path NOT IN (SELECT path FROM seen)",
                [],
            )? as u64;
        }
        // Duplicate stable identities never select a winner. Reparse on a later
        // pass so removing a conflict copy can restore the remaining document.
        tx.execute("UPDATE documents SET valid=0 WHERE id IN (SELECT id FROM documents GROUP BY id HAVING COUNT(*)>1)", [])?;
        tx.execute("INSERT OR IGNORE INTO diagnostics SELECT path,'duplicate record identity' FROM documents WHERE id IN (SELECT id FROM documents GROUP BY id HAVING COUNT(*)>1)", [])?;
        registry(&tx)?;
        if rebuild {
            tx.execute("INSERT INTO search(search) VALUES('rebuild')", [])?;
            tx.execute(
                "INSERT INTO search(search,rank) VALUES('integrity-check',1)",
                [],
            )?;
        }
        tx.execute("INSERT OR IGNORE INTO diagnostics SELECT d.path,'project references unresolved or ambiguous' FROM documents d WHERE d.valid=1 AND EXISTS(SELECT 1 FROM refs WHERE path=d.path) AND NOT EXISTS(SELECT 1 FROM bindings WHERE path=d.path)", [])?;
        let issues: u64 = tx.query_row("SELECT COUNT(*) FROM diagnostics", [], |r| r.get(0))?;
        let mut warnings: Vec<String> = tx
            .prepare("SELECT path || ': ' || message FROM diagnostics ORDER BY path LIMIT 20")?
            .query_map([], |r| r.get(0))?
            .collect::<Result<_, _>>()?;
        if !complete {
            warnings.push("Incomplete scan; missing paths were not treated as deleted".into());
        }
        let (documents, bytes) = tx.query_row(
            "SELECT COUNT(*),COALESCE(SUM(bytes),0) FROM documents WHERE valid=1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        let result = IndexStatus {
            state: if complete && issues == 0 {
                "ready"
            } else {
                "partial"
            }
            .into(),
            generation: previous.generation + 1,
            indexed_at: Some(chrono::Utc::now().to_rfc3339()),
            documents,
            source_bytes: bytes,
            chunks: tx.query_row("SELECT COUNT(*) FROM chunks", [], |r| r.get(0))?,
            issues,
            warnings,
            changed,
        };
        tx.execute(
            "INSERT OR REPLACE INTO meta VALUES('status',?1)",
            [serde_json::to_string(&result).unwrap()],
        )?;
        Ok(result)
    })();
    let result = work.map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(result)
}

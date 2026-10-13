//! Versioned schema migrations (docs/SCHEMA-MIGRATIONS.md).
//!
//! Every database, fresh or years old, reaches the current schema through the
//! same ordered steps, so a fresh install and Kevin's database cannot diverge.
//! `PRAGMA user_version` records the last step applied. Each step runs in one
//! transaction that also advances the version, so a failure leaves both the
//! data and the version as they were.
//!
//! Never edit a migration that has shipped: change an existing table with a new
//! one. `schema.sql` is migration 1 and is frozen; a test pins its contents.

use std::path::{Path, PathBuf};

use rusqlite::{Connection, Transaction};

pub struct Migration {
    pub version: i64,
    pub name: &'static str,
    pub sql: &'static str,
    /// Data work that SQL cannot express, run after `sql` in the same transaction.
    pub after: Option<fn(&Transaction) -> rusqlite::Result<()>>,
}

pub const MIGRATIONS: &[Migration] = &[
    Migration { version: 1, name: "baseline", sql: include_str!("../../schema.sql"), after: Some(baseline_fixups) },
    Migration {
        version: 2,
        name: "conversations",
        sql: include_str!("../../migrations/0002_conversations.sql"),
        after: Some(super::conversations::backfill),
    },
];

/// Every migration's SQL in order, for test fixtures that build a fresh
/// database in one call. `fresh_schema_matches_the_runner` keeps it honest.
#[cfg(test)]
pub const TEST_SCHEMA: &str = concat!(
    include_str!("../../schema.sql"),
    include_str!("../../migrations/0002_conversations.sql"),
    "PRAGMA user_version = 2;"
);

pub fn latest() -> i64 {
    MIGRATIONS.last().map(|m| m.version).unwrap_or(0)
}

pub fn version(connection: &Connection) -> rusqlite::Result<i64> {
    connection.query_row("PRAGMA user_version", [], |row| row.get(0))
}

/// Applies every migration newer than the database. Refuses a database written
/// by a newer Olympus rather than running old code against a schema it does not
/// know.
pub fn apply(connection: &Connection) -> Result<(), String> {
    let current = version(connection).map_err(|e| e.to_string())?;
    if current > latest() {
        return Err(format!(
            "This database was written by a newer Olympus (schema {current}; this build knows {}). \
             Install the newer version, or restore a backup made for this one.",
            latest()
        ));
    }
    for migration in MIGRATIONS.iter().filter(|m| m.version > current) {
        let transaction = connection.unchecked_transaction().map_err(|e| e.to_string())?;
        transaction
            .execute_batch(migration.sql)
            .and_then(|_| migration.after.map_or(Ok(()), |step| step(&transaction)))
            .and_then(|_| transaction.pragma_update(None, "user_version", migration.version))
            .map_err(|e| format!("Database migration {} ({}) failed and was rolled back: {e}", migration.version, migration.name))?;
        transaction.commit().map_err(|e| e.to_string())?;
    }
    // Per connection and a no-op inside a transaction, so set after the steps.
    connection.execute_batch("PRAGMA foreign_keys = ON;").map_err(|e| e.to_string())
}

/// Whether `apply` has work to do on this connection.
pub fn pending(connection: &Connection) -> Result<bool, String> {
    Ok(version(connection).map_err(|e| e.to_string())? < latest())
}

/// Copies the database beside itself before a migration touches it, keeping
/// the three newest copies. `VACUUM INTO` is consistent under WAL.
pub fn backup(connection: &Connection, db_path: &Path) -> Result<Option<PathBuf>, String> {
    let from = version(connection).map_err(|e| e.to_string())?;
    let is_empty: bool = connection
        .query_row("SELECT count(*) = 0 FROM sqlite_master", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    if is_empty {
        return Ok(None);
    }
    let name = db_path.file_name().and_then(|n| n.to_str()).unwrap_or("olympus.sqlite");
    let target = db_path.with_file_name(format!("{name}.pre-v{}-from-v{from}.bak", latest()));
    let _ = std::fs::remove_file(&target);
    connection
        .execute("VACUUM INTO ?1", [target.to_string_lossy()])
        .map_err(|e| format!("Could not back up the database before migrating; nothing was changed: {e}"))?;
    prune_backups(db_path, name, 3);
    Ok(Some(target))
}

fn prune_backups(db_path: &Path, name: &str, keep: usize) {
    let Some(dir) = db_path.parent() else { return };
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    let mut backups: Vec<(std::time::SystemTime, PathBuf)> = entries
        .filter_map(Result::ok)
        .filter(|e| e.file_name().to_string_lossy().starts_with(&format!("{name}.pre-v")))
        .filter_map(|e| Some((e.metadata().ok()?.modified().ok()?, e.path())))
        .collect();
    backups.sort_by(|a, b| b.0.cmp(&a.0));
    for (_, path) in backups.into_iter().skip(keep) {
        let _ = std::fs::remove_file(path);
    }
}

/// Before versioning, `open_database` added this column by hand. A database
/// from that era reaches the same baseline through this step.
fn baseline_fixups(transaction: &Transaction) -> rusqlite::Result<()> {
    let has_process_id = transaction
        .prepare("PRAGMA table_info(delegation_runs)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(Result::ok)
        .any(|name| name == "process_id");
    if !has_process_id {
        transaction.execute("ALTER TABLE delegation_runs ADD COLUMN process_id INTEGER", [])?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Tables, columns, indexes, foreign keys and triggers: everything a query
    /// could depend on. Order-independent.
    fn signature(connection: &Connection) -> Vec<String> {
        let mut out = Vec::new();
        let objects: Vec<(String, String, String)> = connection
            .prepare("SELECT type, name, COALESCE(sql, '') FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name")
            .unwrap()
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        for (kind, name, sql) in &objects {
            // A table's CREATE text records column order, which differs when a
            // column was added later by ALTER; its columns are compared below.
            let ordinary_table = kind == "table" && !sql.contains("VIRTUAL");
            if !ordinary_table {
                out.push(format!("{kind} {name} {}", sql.split_whitespace().collect::<Vec<_>>().join(" ")));
            } else {
                out.push(format!("{kind} {name}"));
            }
            if ordinary_table {
                for pragma in ["table_info", "foreign_key_list", "index_list"] {
                    let rows: Vec<String> = connection
                        .prepare(&format!("PRAGMA {pragma}('{name}')"))
                        .unwrap()
                        .query_map([], |r| {
                            let n = r.as_ref().column_count();
                            // Skip the first field: a position (cid, id, seq), not a property.
                            Ok((1..n).map(|i| format!("{:?}", r.get_ref(i).unwrap())).collect::<Vec<_>>().join("|"))
                        })
                        .unwrap()
                        .collect::<Result<_, _>>()
                        .unwrap();
                    for row in rows {
                        out.push(format!("{pragma} {name} {row}"));
                    }
                }
            }
        }
        out.sort();
        out
    }

    fn fresh() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        apply(&c).unwrap();
        c
    }

    /// A database as it stood before versioning: schema.sql run by hand,
    /// version 0, `process_id` possibly missing, and real rows.
    fn unversioned(with_process_id: bool) -> Connection {
        let c = Connection::open_in_memory().unwrap();
        let mut sql = include_str!("../../schema.sql").to_string();
        if !with_process_id {
            assert!(sql.contains("process_id INTEGER"), "fixture assumption");
            sql = sql.replace(", process_id INTEGER", "").replace(",process_id INTEGER", "").replace("process_id INTEGER,", "");
        }
        c.execute_batch(&sql).unwrap();
        c.execute_batch(
            "INSERT INTO conversation_messages (id, role, content, timestamp, created_at) VALUES
               ('m1', 'user', 'Plan the Olympus memory work', '09:00', '2026-10-01 09:00:00'),
               ('m2', 'assistant', 'Here is a plan.', '09:01', '2026-10-01 09:01:00'),
               ('m3', 'user', 'Weather tomorrow?', '18:00', '2026-10-02 18:00:00'),
               ('m4', 'user', 'imported from the browser', '08:00', '2026-10-03 08:00:00');
             INSERT INTO conversation_imports (message_id) VALUES ('m4');
             INSERT INTO settings (key, value) VALUES ('projectsRootPath', 'C:/Projects');",
        )
        .unwrap();
        c
    }

    #[test]
    fn a_fresh_database_and_a_migrated_one_have_the_same_schema() {
        let target = signature(&fresh());
        for with_process_id in [true, false] {
            let old = unversioned(with_process_id);
            apply(&old).unwrap();
            assert_eq!(signature(&old), target, "process_id present before: {with_process_id}");
            assert_eq!(version(&old).unwrap(), latest());
        }
    }

    #[test]
    fn fresh_schema_matches_the_runner() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(TEST_SCHEMA).unwrap();
        assert_eq!(signature(&c), signature(&fresh()), "TEST_SCHEMA must list every migration's SQL");
        assert_eq!(version(&c).unwrap(), latest(), "TEST_SCHEMA must end at the latest version");
        apply(&c).unwrap();
    }

    #[test]
    fn migrating_keeps_every_row_and_assigns_each_message_to_a_conversation() {
        let c = unversioned(true);
        apply(&c).unwrap();
        let unassigned: i64 = c.query_row("SELECT count(*) FROM conversation_messages WHERE conversation_id IS NULL", [], |r| r.get(0)).unwrap();
        assert_eq!(unassigned, 0);
        let messages: i64 = c.query_row("SELECT count(*) FROM conversation_messages", [], |r| r.get(0)).unwrap();
        assert_eq!(messages, 4);
        let setting: String = c.query_row("SELECT value FROM settings WHERE key='projectsRootPath'", [], |r| r.get(0)).unwrap();
        assert_eq!(setting, "C:/Projects");
    }

    #[test]
    fn opening_twice_applies_nothing_the_second_time() {
        let c = unversioned(true);
        apply(&c).unwrap();
        let before = signature(&c);
        let conversations: i64 = c.query_row("SELECT count(*) FROM conversations", [], |r| r.get(0)).unwrap();
        assert!(!pending(&c).unwrap());
        apply(&c).unwrap();
        assert_eq!(signature(&c), before);
        assert_eq!(c.query_row("SELECT count(*) FROM conversations", [], |r| r.get::<_, i64>(0)).unwrap(), conversations);
    }

    #[test]
    fn a_database_from_a_newer_olympus_is_refused_untouched() {
        let c = fresh();
        c.pragma_update(None, "user_version", latest() + 1).unwrap();
        let before = signature(&c);
        let error = apply(&c).unwrap_err();
        assert!(error.contains("newer Olympus"), "{error}");
        assert_eq!(signature(&c), before);
    }

    #[test]
    fn a_failing_migration_rolls_back_its_data_and_version() {
        let c = unversioned(true);
        // Make migration 2 fail half way: its index name is taken by a table.
        c.execute_batch("CREATE TABLE idx_conversations_updated_at (x);").unwrap();
        let error = apply(&c).unwrap_err();
        assert!(error.contains("migration 2"), "{error}");
        assert_eq!(version(&c).unwrap(), 1, "the baseline committed; migration 2 did not");
        let has_column = c
            .prepare("PRAGMA table_info(conversation_messages)")
            .unwrap()
            .query_map([], |r| r.get::<_, String>(1))
            .unwrap()
            .filter_map(Result::ok)
            .any(|n| n == "conversation_id");
        assert!(!has_column, "the column added before the failure was rolled back");
    }

    #[test]
    fn a_backup_is_written_before_migrating_an_existing_database() {
        let dir = std::env::temp_dir().join(format!("olympus-migrate-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("olympus.sqlite");
        {
            let c = Connection::open(&path).unwrap();
            c.execute_batch(include_str!("../../schema.sql")).unwrap();
            c.execute("INSERT INTO settings (key, value) VALUES ('k', 'v')", []).unwrap();
            let backup_path = backup(&c, &path).unwrap().expect("a backup for a non-empty database");
            let copy = Connection::open(&backup_path).unwrap();
            assert_eq!(copy.query_row("SELECT value FROM settings WHERE key='k'", [], |r| r.get::<_, String>(0)).unwrap(), "v");
        }
        let empty = Connection::open(dir.join("new.sqlite")).unwrap();
        assert!(backup(&empty, &dir.join("new.sqlite")).unwrap().is_none(), "nothing to back up");
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Migration 1 is frozen. Changing an existing table means a new migration;
    /// editing schema.sql would silently skip every installed database.
    #[test]
    fn the_baseline_is_frozen() {
        assert_eq!(
            super::super::vault_write::content_fingerprint(include_str!("../../schema.sql")),
            BASELINE_FINGERPRINT,
            "schema.sql changed. Add a migration instead (docs/SCHEMA-MIGRATIONS.md)."
        );
    }

    const BASELINE_FINGERPRINT: &str = "e4ca1eb1ed2e243be24cfa81558fa5b1a1fe7b76d5ecf44d3a2dc9b5629b0223";
}

//! The blocking channel between a pending vault write and the operator.
//!
//! Rust holds the write until the webview answers. The rules that make this a
//! gate rather than a formality:
//!
//! - **Timeout denies.** A webview that never answers — closed, crashed, or
//!   wedged — must not leave the write hanging or, worse, let it through.
//! - **A dropped sender denies.** Same reasoning, for the case where the
//!   pending entry is cleared without a decision.
//! - **Deny is the default in every failure path.** The only route to a write
//!   is an explicit approval arriving in time.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use once_cell::sync::Lazy;
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;

use super::vault_write::{operation_of, ConfirmReason, DiffSummary, WriteIntent, WriteOperation};

/// Long enough for a human to read a diff, short enough that a dead webview
/// does not wedge a write indefinitely.
const CONFIRM_TIMEOUT: Duration = Duration::from_secs(120);

const PENDING_EVENT: &str = "vault-write-pending";

static PENDING: Lazy<Mutex<HashMap<String, oneshot::Sender<bool>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Monotonic within a run. A request id only has to be unique among the
/// handful of writes alive at once, and this avoids depending on a clock.
static NEXT_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingWrite {
    pub id: String,
    /// Vault-relative, for display — the absolute path is noise in a dialog.
    pub path: String,
    /// Drives the dialog's wording. The webview must not infer this from the
    /// diff counts: an append that happens to change nothing still adds.
    pub operation: WriteOperation,
    pub reason: String,
    pub summary: DiffSummary,
}

fn describe(operation: WriteOperation, reason: ConfirmReason) -> String {
    match reason {
        ConfirmReason::EditedSinceLastWrite => {
            "This file has changed since Olympus last wrote it, so someone edited it by hand. \
             Overwriting will discard those edits."
                .to_string()
        }
        ConfirmReason::NoRecordedFingerprint => {
            "Olympus has no record of writing this file, so it cannot tell whether what is there \
             now was written by hand. This is the one chance to catch an edit before it is \
             replaced — check the changes below before approving."
                .to_string()
        }
        ConfirmReason::IntentRequiresConfirmation => match operation {
            WriteOperation::Append => {
                "Olympus wants to add the lines below to a note you also write in. Nothing \
                 already in the note is removed."
                    .to_string()
            }
            WriteOperation::Overwrite => {
                "This write modifies a file that may contain your own writing.".to_string()
            }
        },
    }
}

/// Emits a pending write to the webview and waits for a decision.
///
/// Returns `false` on timeout, on a dropped channel, and on an emit failure —
/// every failure path denies.
pub async fn request_confirmation(
    app: &AppHandle,
    path: String,
    intent: WriteIntent,
    reason: ConfirmReason,
    summary: DiffSummary,
) -> bool {
    let operation = operation_of(intent);
    let id = format!("write-{}", NEXT_ID.fetch_add(1, Ordering::Relaxed));
    let (sender, receiver) = oneshot::channel();

    {
        let mut pending = match PENDING.lock() {
            Ok(pending) => pending,
            Err(error) => {
                eprintln!("[Olympus::WriteGate] pending map poisoned: {error}");
                return false;
            }
        };
        pending.insert(id.clone(), sender);
    }

    let request = PendingWrite {
        id: id.clone(),
        path,
        operation,
        reason: describe(operation, reason),
        summary,
    };

    if let Err(error) = app.emit(PENDING_EVENT, &request) {
        eprintln!("[Olympus::WriteGate] could not reach the webview: {error}");
        forget(&id);
        return false;
    }

    match tokio::time::timeout(CONFIRM_TIMEOUT, receiver).await {
        Ok(Ok(approved)) => approved,
        Ok(Err(_)) => {
            // Sender dropped without a decision.
            eprintln!("[Olympus::WriteGate] confirmation channel closed; denying {id}");
            false
        }
        Err(_) => {
            eprintln!("[Olympus::WriteGate] confirmation timed out; denying {id}");
            forget(&id);
            false
        }
    }
}

fn forget(id: &str) {
    if let Ok(mut pending) = PENDING.lock() {
        pending.remove(id);
    }
}

/// The webview's answer. Unknown ids are not an error: a timed-out request has
/// already been denied and removed, and the dialog may still be on screen.
#[tauri::command]
pub fn resolve_vault_write(id: String, approved: bool) -> Result<(), String> {
    let sender = PENDING
        .lock()
        .map_err(|error| error.to_string())?
        .remove(&id);

    match sender {
        Some(sender) => {
            let _ = sender.send(approved);
            Ok(())
        }
        None => {
            eprintln!("[Olympus::WriteGate] no pending write for {id}; it likely timed out");
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolving_an_unknown_id_is_not_an_error() {
        assert!(resolve_vault_write("write-does-not-exist".to_string(), true).is_ok());
    }

    #[test]
    fn ids_are_unique_within_a_run() {
        let first = NEXT_ID.fetch_add(1, Ordering::Relaxed);
        let second = NEXT_ID.fetch_add(1, Ordering::Relaxed);
        assert_ne!(first, second);
    }

    /// A decision arriving after the pending entry is gone must not panic and
    /// must not resurrect the write.
    #[test]
    fn a_late_decision_cannot_revive_a_forgotten_write() {
        let (sender, receiver) = oneshot::channel::<bool>();
        PENDING
            .lock()
            .unwrap()
            .insert("write-late".to_string(), sender);

        forget("write-late");
        resolve_vault_write("write-late".to_string(), true).unwrap();

        // The receiver sees a closed channel, which the caller treats as a deny.
        assert!(receiver.blocking_recv().is_err());
    }

    #[test]
    fn every_reason_has_operator_facing_text() {
        for operation in [WriteOperation::Overwrite, WriteOperation::Append] {
            for reason in [
                ConfirmReason::EditedSinceLastWrite,
                ConfirmReason::NoRecordedFingerprint,
                ConfirmReason::IntentRequiresConfirmation,
            ] {
                assert!(!describe(operation, reason).is_empty());
            }
        }
    }

    /// The append prompt must not borrow the overwrite prompt's language. An
    /// operator told their note is about to be replaced, when it is only being
    /// added to, learns to disbelieve the dialog.
    #[test]
    fn an_append_is_not_described_as_a_replacement() {
        let text = describe(
            WriteOperation::Append,
            ConfirmReason::IntentRequiresConfirmation,
        );

        assert!(text.contains("add"));
        assert!(!text.to_lowercase().contains("overwrit"));
        assert!(!text.to_lowercase().contains("replac"));
    }

    /// The webview picks its wording from this field, so it has to survive
    /// serialization as the string the dialog switches on.
    #[test]
    fn the_operation_serializes_for_the_dialog() {
        let json = serde_json::to_value(PendingWrite {
            id: "write-1".to_string(),
            path: "09 - System/Profile Observations.md".to_string(),
            operation: WriteOperation::Append,
            reason: "because".to_string(),
            summary: DiffSummary {
                added: 1,
                removed: 0,
                preview: vec!["+ a line".to_string()],
            },
        })
        .expect("a pending write serializes");

        assert_eq!(json["operation"], "append");
    }
}

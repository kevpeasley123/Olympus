import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { emitInstrumentEvent } from "../../services/instrumentEvents";

/**
 * The operator half of the vault write gate.
 *
 * Rust blocks on this dialog before touching anything it did not author.
 * Three rules mirror the Rust side and must not drift:
 *
 *  - Keeping the file is the default. Escape, the backdrop, and the primary
 *    button all cancel; approving takes a deliberate click on the secondary.
 *  - Unmounting denies. If this component goes away without answering, the
 *    Rust side times out and denies, so the file survives either way.
 *  - The wording comes from `operation`, which Rust derives from the declared
 *    write intent. Asking "overwrite?" about an append would be false, and a
 *    dialog the operator learns to disbelieve is worse than no dialog.
 */

interface DiffSummary {
  added: number;
  removed: number;
  preview: string[];
}

type WriteOperation = "overwrite" | "append";

interface PendingWrite {
  id: string;
  path: string;
  operation: WriteOperation;
  reason: string;
  summary: DiffSummary;
}

const COPY: Record<WriteOperation, { title: string; keep: string; approve: string }> = {
  overwrite: {
    title: "Overwrite this vault file?",
    keep: "Keep the file as it is",
    approve: "Overwrite"
  },
  append: {
    title: "Add these lines to this vault note?",
    keep: "Leave the note as it is",
    approve: "Append"
  }
};

export function WriteConfirmDialog() {
  const [pending, setPending] = useState<PendingWrite | null>(null);

  useEffect(() => {
    // listen() resolves to an unlisten function; StrictMode mounts effects
    // twice in dev, so the cleanup has to run even if the promise settles
    // after unmount, or the second mount stacks a duplicate listener and each
    // pending write renders twice.
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void listen<PendingWrite>("vault-write-pending", (event) => {
      setPending(event.payload);
    }).then((dispose) => {
      if (cancelled) {
        dispose();
        return;
      }
      unlisten = dispose;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const resolve = async (approved: boolean) => {
    if (!pending) {
      return;
    }

    const id = pending.id;
    setPending(null);

    // The omega pulses on approval, which is the only write moment the webview
    // knows about — Rust emits nothing on completion. A declined write is not
    // an event, so nothing pulses for one.
    if (approved) {
      emitInstrumentEvent("vault-write");
    }

    try {
      await invoke("resolve_vault_write", { id, approved });
    } catch (error) {
      // The write denies itself on timeout, so a failure to deliver the answer
      // is safe — the file is kept either way.
      console.warn("[Olympus] Could not deliver the write decision.", error);
    }
  };

  useEffect(() => {
    if (!pending) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void resolve(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!pending) {
    return null;
  }

  // An unrecognised operation falls back to the strictest wording rather than
  // rendering an empty title.
  const copy = COPY[pending.operation] ?? COPY.overwrite;

  return createPortal(
    <div className="write-gate-backdrop" onClick={() => void resolve(false)}>
      <div
        className="write-gate"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="write-gate-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="write-gate-title" className="write-gate__title">
          {copy.title}
        </h2>

        <p className="write-gate__path">{pending.path}</p>
        <p className="write-gate__reason">{pending.reason}</p>

        <div className="write-gate__counts">
          <span className="write-gate__added">+{pending.summary.added}</span>
          <span className="write-gate__removed">−{pending.summary.removed}</span>
          <span className="write-gate__counts-label">lines changed</span>
        </div>

        {pending.summary.preview.length > 0 && (
          <pre className="write-gate__diff">
            {pending.summary.preview.map((line, index) => (
              <span
                key={`${index}-${line}`}
                className={
                  line.startsWith("+")
                    ? "write-gate__diff-added"
                    : "write-gate__diff-removed"
                }
              >
                {line}
                {"\n"}
              </span>
            ))}
          </pre>
        )}

        <div className="write-gate__actions">
          <button
            type="button"
            className="write-gate__keep"
            autoFocus
            onClick={() => void resolve(false)}
          >
            {copy.keep}
          </button>
          <button
            type="button"
            className="write-gate__overwrite"
            onClick={() => void resolve(true)}
          >
            {copy.approve}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

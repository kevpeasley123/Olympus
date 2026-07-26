import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

/**
 * The operator half of the vault write gate.
 *
 * Rust blocks on this dialog before overwriting anything it did not author.
 * Two rules mirror the Rust side and must not drift:
 *
 *  - Keeping the file is the default. Escape, the backdrop, and the primary
 *    button all cancel; approving takes a deliberate click on the secondary.
 *  - Unmounting denies. If this component goes away without answering, the
 *    Rust side times out and denies, so the file survives either way.
 */

interface DiffSummary {
  added: number;
  removed: number;
  preview: string[];
}

interface PendingWrite {
  id: string;
  path: string;
  reason: string;
  summary: DiffSummary;
}

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
          Overwrite this vault file?
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
            Keep the file as it is
          </button>
          <button
            type="button"
            className="write-gate__overwrite"
            onClick={() => void resolve(true)}
          >
            Overwrite
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

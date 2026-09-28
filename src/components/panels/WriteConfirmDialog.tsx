import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { emitInstrumentEvent } from "../../services/instrumentEvents";
import { isTauriRuntime } from "../../services/launcher";

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
 *
 * Requests queue in arrival order: a second write must not replace the first
 * on screen and leave it to time out unseen. Each request times out on its
 * own clock in Rust, so an answer can arrive too late; only an answer Rust
 * says it accepted counts as a write.
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

/** How long the "nothing was written" notice stays before the next request. */
const EXPIRED_NOTICE_MS = 4000;

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function WriteConfirmDialog() {
  const [queue, setQueue] = useState<PendingWrite[]>([]);
  const [expired, setExpired] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const pending = queue[0] ?? null;
  const open = pending !== null || expired;

  useEffect(() => {
    // The browser preview has no Tauri event transport. Keeping the listener
    // desktop-only makes preview diagnostics meaningful instead of logging a
    // transport error that cannot correspond to a pending vault write.
    if (!isTauriRuntime()) {
      return;
    }

    // listen() resolves to an unlisten function; StrictMode mounts effects
    // twice in dev, so the cleanup has to run even if the promise settles
    // after unmount, or the second mount stacks a duplicate listener and each
    // pending write renders twice.
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void listen<PendingWrite>("vault-write-pending", (event) => {
      // Taken before the dialog renders: by the time an effect runs, autofocus
      // has already moved focus onto the dialog's own button.
      const active = document.activeElement;
      if (active instanceof HTMLElement && !dialogRef.current?.contains(active)) {
        restoreFocusRef.current = active;
      }
      setQueue((current) =>
        current.some((request) => request.id === event.payload.id)
          ? current
          : [...current, event.payload]
      );
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
    setQueue((current) => current.filter((request) => request.id !== id));

    let accepted = false;
    try {
      accepted = await invoke<boolean>("resolve_vault_write", { id, approved });
    } catch (error) {
      // The write denies itself on timeout, so a failure to deliver the answer
      // is safe — the file is kept either way.
      console.warn("[Olympus] Could not deliver the write decision.", error);
    }

    // The omega pulses on an approval Rust accepted, which is the only write
    // moment the webview knows about — Rust emits nothing on completion. A
    // declined write is not an event, so nothing pulses for one.
    if (approved && accepted) {
      emitInstrumentEvent("vault-write");
    } else if (approved) {
      setExpired(true);
    }
  };

  useEffect(() => {
    if (!expired) {
      return;
    }
    const timer = window.setTimeout(() => setExpired(false), EXPIRED_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [expired]);

  // Focus returns to wherever the operator was once the last request is
  // answered, not to the top of the document.
  useEffect(() => {
    if (open) {
      return;
    }
    const target = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (target?.isConnected) {
      target.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    // Capture phase, and stopped there: Escape here must not also reach the
    // window-level shortcuts of whatever is underneath, such as the library
    // closing itself behind the gate.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (expired) {
          setExpired(false);
        } else {
          void resolve(false);
        }
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const inside = dialogRef.current.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  });

  // Shown before the next queued request, so an approval that did not land is
  // never followed straight into a dialog that looks like its confirmation.
  if (expired) {
    return createPortal(
      <div className="write-gate-backdrop" onClick={() => setExpired(false)}>
        <div
          ref={dialogRef}
          className="write-gate"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="write-gate-title"
          onClick={(event) => event.stopPropagation()}
        >
          <h2 id="write-gate-title" className="write-gate__title">
            Nothing was written
          </h2>
          <p className="write-gate__reason">
            That request had already expired. Olympus denies a write nobody answers within
            two minutes, and the file was kept as it was.
          </p>
          <div className="write-gate__actions">
            <button
              type="button"
              className="write-gate__keep"
              autoFocus
              onClick={() => setExpired(false)}
            >
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (!pending) {
    return null;
  }

  // An unrecognised operation falls back to the strictest wording rather than
  // rendering an empty title.
  const copy = COPY[pending.operation] ?? COPY.overwrite;

  return createPortal(
    <div className="write-gate-backdrop" onClick={() => void resolve(false)}>
      <div
        ref={dialogRef}
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
        {queue.length > 1 ? (
          <p className="write-gate__reason">
            {queue.length - 1} more {queue.length === 2 ? "request" : "requests"} waiting after this one.
          </p>
        ) : null}

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
            key={pending.id}
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

import { useEffect, useId, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The shared dialog primitive (review U9).
 *
 * It follows the write gate's rules (WriteConfirmDialog, which keeps its own
 * copy because it is the safety boundary and stays untouched): role and
 * aria-modal, a label, focus moved in on open, Tab trapped, Escape closes,
 * focus restored on close.
 *
 * Escape and Tab are handled in the capture phase and stopped there, but only
 * by the topmost open modal — the last `[aria-modal="true"]` in the document.
 * If the write gate opens above this dialog, the gate gets the keys; if this
 * dialog is open, the window-level shortcuts underneath never see Escape.
 * Those shortcuts also bail on `isModalOpen()` from services/shortcuts.ts.
 *
 * `placement="below-header"` anchors the panel under the header so the mode
 * switcher stays visible; the backdrop still covers it, because the dialog is
 * modal and Ctrl+\ is suppressed while it is open.
 */

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Visible heading text; also the accessible name unless `labelledBy` is given. */
  title: ReactNode;
  /** Id of an element inside `children` that names the dialog instead of `title`. */
  labelledBy?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  /** `alertdialog` for confirmations that interrupt; defaults to `dialog`. */
  role?: "dialog" | "alertdialog";
  placement?: "center" | "below-header";
  /** Close on a backdrop click. Default true. */
  dismissOnBackdrop?: boolean;
  /** Selector inside the dialog to focus on open; else the first control, else the dialog. */
  initialFocus?: string;
  /** Render a heading from `title`. Off when the children supply their own header. */
  showTitle?: boolean;
}

function isTopmost(node: HTMLElement | null): boolean {
  if (!node) return false;
  const modals = document.querySelectorAll('[aria-modal="true"]');
  return modals[modals.length - 1] === node;
}

export function Modal({
  open, onClose, title, labelledBy, description, children, className = "", role = "dialog",
  placement = "center", dismissOnBackdrop = true, initialFocus, showTitle = true
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Captured while rendering the first open frame: by the time an effect runs,
  // an autoFocus child has already taken focus. Refs, so it is captured once
  // per opening and never re-read from inside the dialog.
  const returnTo = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current && typeof document !== "undefined") {
    wasOpen.current = true;
    const active = document.activeElement;
    returnTo.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }

  useLayoutEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog || dialog.contains(document.activeElement)) return;
    const target = (initialFocus && dialog.querySelector<HTMLElement>(initialFocus))
      || dialog.querySelector<HTMLElement>(FOCUSABLE)
      || dialog;
    target.focus();
  }, [open, initialFocus]);

  useEffect(() => {
    const restore = () => {
      if (!wasOpen.current) return;
      wasOpen.current = false;
      const target = returnTo.current;
      returnTo.current = null;
      if (target?.isConnected) target.focus();
    };
    if (!open) restore();
    // Also on unmount while open, for parents that render `{x && <Modal open>}`.
    // Deferred and checked against the DOM: StrictMode's simulated unmount
    // leaves the dialog connected and must not pull focus out of it.
    return () => {
      if (open) queueMicrotask(() => { if (!dialogRef.current?.isConnected) restore(); });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog || !isTopmost(dialog)) return;
      if (event.key === "Escape") {
        if (event.isComposing) return;
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((node) => node.offsetParent !== null || node === document.activeElement);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const inside = dialog.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={`modal-backdrop modal-backdrop--${placement}`}
      onPointerDown={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`modal-dialog ${className}`.trim()}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy ?? titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        {showTitle ? <h2 id={titleId} className="modal-dialog__title">{title}</h2> : !labelledBy ? <span id={titleId} hidden>{title}</span> : null}
        {description ? <p id={descriptionId} className="modal-dialog__description">{description}</p> : null}
        {children}
      </div>
    </div>,
    document.body
  );
}

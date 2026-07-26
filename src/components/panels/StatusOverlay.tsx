import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

interface StatusOverlayProps {
  label: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * The panel behind a status rail segment.
 *
 * Residency, not a rewrite: `MarketsPanel` and `WeatherPanel` render unchanged
 * inside this, so the rail never becomes a second implementation of either that
 * can drift from the panel it summarises.
 */
export function StatusOverlay({ label, onClose, children }: StatusOverlayProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="status-overlay-backdrop" onClick={onClose}>
      <div
        className="status-overlay"
        role="dialog"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Its own row rather than floating over the panel. Both of these
            panels already put actions in their top-right corner, and an
            absolutely positioned close landed on top of Weather's Retry —
            invisible, and swallowing the click. */}
        <div className="status-overlay__bar">
          <span className="status-overlay__label">{label}</span>
          <button
            type="button"
            className="ghost-action icon-only-action status-overlay__close"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>
        <div className="status-overlay__content">{children}</div>
      </div>
    </div>,
    document.body
  );
}

import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

/**
 * Contains a render error to one region (review F6).
 *
 * Without a boundary, one throwing panel blanks the whole window — including
 * the console and the write gate. App wraps each mode surface separately and
 * keeps the header, the console and WriteConfirmDialog outside those
 * boundaries, so a broken view never takes the operator's input or a pending
 * write decision with it. (If the gate did unmount, Rust would deny the write
 * on timeout; the boundary keeps it from coming to that.)
 *
 * "Reload view" remounts the children with fresh component state. Session
 * view state (state/viewState.ts) survives, so drafts come back with it.
 */

interface ErrorBoundaryProps {
  /** Names the region in the fallback: "Research view", "Command console". */
  label: string;
  children: ReactNode;
  className?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  attempt: number;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[Olympus] ${this.props.label} failed to render.`, error, info.componentStack);
  }

  private reload = () => {
    this.setState((state) => ({ error: null, attempt: state.attempt + 1 }));
  };

  render() {
    const { error, attempt } = this.state;
    if (!error) {
      // The key forces a clean remount after "Reload view", so the same bad
      // component state is not simply rendered again.
      return <ErrorBoundaryContent key={attempt}>{this.props.children}</ErrorBoundaryContent>;
    }
    return (
      <section className={`error-boundary ${this.props.className ?? ""}`.trim()} role="alert">
        <p className="error-boundary__title">{this.props.label} failed to render.</p>
        <p className="error-boundary__copy">
          The rest of Olympus is still running. A pending write confirmation stays on screen.
        </p>
        <button type="button" className="ghost-action" onClick={this.reload}>Reload view</button>
        <details className="error-boundary__details">
          <summary>Technical detail</summary>
          <pre>{error.message || String(error)}</pre>
        </details>
      </section>
    );
  }
}

function ErrorBoundaryContent({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/**
 * The omega instrument's event feed.
 *
 * Deliberately a frontend bus rather than a Rust event: the two things worth
 * animating already happen in the webview. Rust emits `vault-write-pending`
 * and nothing on completion, so the write pulse fires when the operator
 * approves — which is the honest moment anyway. The instrument shows that
 * something is happening, and it must never imply a write landed that didn't.
 */

export type InstrumentEvent = "vault-write" | "graph-node" | "poll";

type Listener = (event: InstrumentEvent) => void;

const listeners = new Set<Listener>();

export function emitInstrumentEvent(event: InstrumentEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}

export function subscribeToInstrumentEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

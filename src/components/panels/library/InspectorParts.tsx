import type { ReactNode } from "react";
import { humanize, nodeLabel } from "../../../services/researchLabels";
import { formatWhen } from "../../../services/time";
import "./inspector.css";

/**
 * Pieces shared by the Research inspectors, after Workflow Inspection's order
 * (review D4): the question, the answer and its counts, evidence, a small
 * structure view, and everything else under Internals.
 */

export interface FlowNode {
  id: string;
  kind: string;
  dependsOn: string[];
}

export interface FlowEvent {
  node: string;
  state: string;
  at?: string;
}

export function isFlowNodeList(value: unknown): value is FlowNode[] {
  return Array.isArray(value) && value.every((node) => node && typeof node === "object"
    && typeof (node as FlowNode).id === "string" && typeof (node as FlowNode).kind === "string"
    && Array.isArray((node as FlowNode).dependsOn));
}

/** Saved steps in order, each with its last recorded event. No event reads as such, never as success. */
export function FlowStructure({ nodes, events, caption }: { nodes: FlowNode[]; events: FlowEvent[]; caption?: string }) {
  const last = new Map<string, FlowEvent>();
  events.forEach((event) => last.set(event.node, event));
  return (
    <figure className="inspector-flow">
      <ol aria-label="Saved workflow structure">
        {nodes.map((node) => {
          const event = last.get(node.id);
          return (
            <li key={node.id} className={event ? `has-event is-${event.state.replace(/[^a-z]+/gi, "-")}` : "no-event"}>
              <strong>{nodeLabel(node.id)}</strong>
              <span>{event ? `${humanize(event.state)}${event.at ? ` · ${formatWhen(event.at, { relative: false })}` : ""}` : "No recorded event"}</span>
              {node.dependsOn.length > 1 ? <small>after {node.dependsOn.map(nodeLabel).join(", ")}</small> : null}
            </li>
          );
        })}
      </ol>
      <figcaption>{caption ?? "Saved dependencies in order, with the last event recorded for each step."}</figcaption>
    </figure>
  );
}

export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="inspector-facts">
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Counts({ items }: { items: { label: string; count: number; tone: string }[] }) {
  return (
    <p className="inspector-counts">
      {items.map((item) => (
        <span key={item.label} className={`inspector-count is-${item.tone}${item.count === 0 ? " is-zero" : ""}`}>
          <strong className="tabular-data">{item.count}</strong> {item.label}
        </span>
      ))}
    </p>
  );
}

export function Internals({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="inspector-internals">
      <summary>Internals · {summary}</summary>
      <div className="inspector-internals__body">{children}</div>
    </details>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  return <pre className="inspector-json">{JSON.stringify(value, null, 2)}</pre>;
}

export function when(value: string | null | undefined, fallback = "Not recorded"): string {
  return value ? formatWhen(value) : fallback;
}

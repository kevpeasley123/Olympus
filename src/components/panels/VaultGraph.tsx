import { useState } from "react";
import {
  describeNode,
  isGraphLegible,
  layoutVaultGraph
} from "../../services/vaultGraph";
import type { PositionedNode, VaultGraphPayload } from "../../services/vaultGraph";

interface VaultGraphProps {
  centre: number;
  graph: VaultGraphPayload;
  /** Vault-relative path. The same prop the tier ring's empty state uses. */
  onOpenNote: (notePath: string) => void;
}

/**
 * The inner bands: the vault's link structure, rooted at the declared projects.
 *
 * Radius is hop distance from active work — outermost is the rim of notes
 * nothing links to. Nothing here moves, and that is deliberate: it replaced five
 * poll-freshness dots and a sweeping ring, both of which reported infrastructure
 * health that changed no decision the operator makes. The day arc's now-marker
 * already says the instrument is live.
 *
 * Draws nothing when no anchor carries an edge — see `GRAPH_MIN_CONNECTED_ANCHORS`.
 */
export function VaultGraph({ centre, graph, onOpenNote }: VaultGraphProps) {
  const [hovered, setHovered] = useState<PositionedNode | null>(null);

  if (!isGraphLegible(graph)) return null;

  const { nodes, edges } = layoutVaultGraph(graph, centre);
  if (nodes.length === 0) return null;

  return (
    <g className="vault-graph">
      {/* Edges under nodes, and faint. They carry the structure; the nodes are
          what the eye lands on. */}
      {edges.map((edge) => (
        <line
          key={edge.key}
          x1={edge.from.x}
          y1={edge.from.y}
          x2={edge.to.x}
          y2={edge.to.y}
          className="vault-graph__edge"
          pointerEvents="none"
        />
      ))}

      {nodes.map((node) => (
        <circle
          key={node.id}
          cx={node.x}
          cy={node.y}
          r={node.size}
          className={`vault-graph__node vault-graph__node--${node.band} ${
            hovered?.id === node.id ? "is-hovered" : ""
          }`}
          onMouseEnter={() => setHovered(node)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onOpenNote(node.id)}
        >
          {/* A native tooltip rather than a tab stop. Thirty-eight focusable
              specks in an ambient mode would make the keyboard path through
              Command mode worse than useless, and every note here is reachable
              in Project and Research mode. */}
          <title>{describeNode(node)}</title>
        </circle>
      ))}

      {/* Fixed slot rather than a label beside the node. At this density a
          label hung off each speck would collide with its neighbours; the tier
          ring can hang its own because it has at most five arcs. This reuses
          the position the poll-dot label occupied. */}
      {hovered ? (
        <text
          x={centre}
          y={centre + 166}
          className="instrument-hover-label"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {describeNode(hovered)}
        </text>
      ) : null}

      {/* Truncation is surfaced, never silent — a view that dropped nodes while
          looking complete is the failure this instrument keeps designing
          against. */}
      {!hovered && graph.dropped > 0 ? (
        <text
          x={centre}
          y={centre + 166}
          className="vault-graph__meta"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {graph.dropped} further {graph.dropped === 1 ? "note" : "notes"} not drawn
        </text>
      ) : null}
    </g>
  );
}

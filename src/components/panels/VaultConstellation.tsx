import { useState } from "react";
import type { VaultGraphPayload } from "../../services/vaultGraph";
import { openVaultNote } from "../../services/launcher";

/** A bounded projection of the existing vault scan, never synthetic memories. */
export function VaultConstellation({ graph, error, loading }: {
  graph: VaultGraphPayload; error: string | null; loading: boolean;
}) {
  const [message, setMessage] = useState("");
  const nodes = [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const positions=new Map(nodes.map((n,i)=>{const a=i*2.399963,r=Math.sqrt((i+.5)/Math.max(1,nodes.length));return [n.id,{x:50+Math.cos(a)*r*46,y:50+Math.sin(a)*r*39}]}));
  async function open(id: string) {
    try {
      const result = await openVaultNote(id);
      setMessage(result === "unsupported" ? "Open notes from the desktop app." : "");
    } catch { setMessage("Could not open this note in Obsidian."); }
  }
  return <div className="vault-constellation" data-dense={nodes.length > 60} role="group" aria-label={`Obsidian Memory constellation: ${nodes.length} notes${error ? ", refresh unavailable" : ""}`}>
    <span className="vault-constellation__label">Obsidian Memory <b>{nodes.length}</b>
      {graph.dropped > 0 && <small> · {graph.dropped} more outside this view</small>}
      {error && <small> · {nodes.length ? "last snapshot" : "unavailable"}</small>}
      {!error && !nodes.length && <small> · {loading ? "loading" : "no notes in graph"}</small>}
    </span>
    <div className="vault-constellation__field"><svg className="architecture-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{graph.edges.slice(0,60).map((edge,i)=>{const a=positions.get(edge.from),b=positions.get(edge.to);return a&&b?<line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>:null})}</svg>{nodes.map((node, i) => {
      const angle = i * 2.399963;
      const radius = Math.sqrt((i + .5) / Math.max(1, nodes.length));
      return <button key={node.id} className="vault-star" style={{ left: `${50 + Math.cos(angle) * radius * 46}%`, top: `${50 + Math.sin(angle) * radius * 39}%` }}
        aria-label={`Open Obsidian note: ${node.title}`} onClick={() => void open(node.id)}>
        <span className="vault-star__light" aria-hidden="true"/>
        <span className="vault-star__name">{node.title}<small>{node.folder}</small></span>
      </button>;
    })}</div>
    {message && <p role="status" className="vault-constellation__message">{message}</p>}
  </div>;
}

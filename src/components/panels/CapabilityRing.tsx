import { OrbitalCardSurface } from "./OrbitalCardSurface";
import { FileText, Settings, Compass, Database, Code2, Brain, Mic, FolderOpen, MessagesSquare } from "lucide-react";
import type { CSSProperties, KeyboardEvent } from "react";
import { AMBIENT } from "../../services/ambientMotion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CommandLayout } from "../../services/hybridCore";
import { layoutCentreReadout, pointOnProjectRing } from "../../services/projectRing";
import type { RingSegment } from "../../services/capabilityRing";
import { segmentCaption } from "../../services/capabilityRing";
import {
  CAPABILITY_WORD, layoutRevealed, shortName,
  type ArmoryView, type Capability, type CapabilityDomain
} from "../../services/capabilities";

/**
 * The Command ring as Olympus's capability armory: one glass sector per
 * domain, the note constellation as an ambient field, and — only when a lens,
 * a domain or a recorded mission asks — the individual Tools and Skills.
 * Selecting anything here is inspection; nothing is invoked.
 */
interface CapabilityRingProps {
  onProjects?: () => void;
  domainActions?: Partial<Record<string, () => void>>;
  layout: CommandLayout;
  domains: CapabilityDomain[];
  view: ArmoryView;
  centre: number;
  radius: number;
  renderScale: number;
  selectedDomain: string | null;
  selectedCapability: string | null;
  /** True while a recorded mission step is active: draws the paths through Ω. */
  working: boolean;
  idleReadout?: string[];
  /** The focused domain or capability in words. The disc under the Ω fits a
   * name and little else, so kind, state and counts are read out below the dial. */
  onDetail?: (detail: string | null) => void;
  onHoverDomain: (id: string | null) => void;
  onSelectDomain: (id: string | null) => void;
  onSelectCapability: (id: string) => void;
}

const BAND = 23;
const NAME_RATIO = .62;
const NAME_FONT = 10.5;
const END_PADDING = 6;

export function bandPath(segment: Pick<RingSegment, "startAngle" | "endAngle">, centre: number, outer: number, inner: number) {
  const a = pointOnProjectRing(segment.startAngle, outer, centre), b = pointOnProjectRing(segment.endAngle, outer, centre);
  const c = pointOnProjectRing(segment.endAngle, inner, centre), d = pointOnProjectRing(segment.startAngle, inner, centre);
  const large = segment.endAngle - segment.startAngle > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${outer} ${outer} 0 ${large} 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${inner} ${inner} 0 ${large} 0 ${d.x} ${d.y} Z`;
}
export function arcPath(segment: Pick<RingSegment, "startAngle" | "endAngle">, centre: number, radius: number) {
  const a = pointOnProjectRing(segment.startAngle, radius, centre), b = pointOnProjectRing(segment.endAngle, radius, centre);
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${segment.endAngle - segment.startAngle > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
}
/** Upright text along a sector: the lower half draws its arc reversed. */
function namePath(segment: RingSegment, centre: number, radius: number) {
  const flipped = segment.midAngle > 90 && segment.midAngle < 270;
  const from = pointOnProjectRing(flipped ? segment.endAngle : segment.startAngle, radius, centre);
  const to = pointOnProjectRing(flipped ? segment.startAngle : segment.endAngle, radius, centre);
  return `M ${from.x} ${from.y} A ${radius} ${radius} 0 0 ${flipped ? 0 : 1} ${to.x} ${to.y}`;
}
export function captionCapacity(segment: Pick<RingSegment, "startAngle" | "endAngle">, radius: number, renderScale: number) {
  const usable = (segment.endAngle - segment.startAngle) * Math.PI * radius / 180 - END_PADDING * 2;
  return Math.floor(usable / (NAME_FONT / Math.max(renderScale, .01) * NAME_RATIO));
}

function domainName(domain: CapabilityDomain | undefined) {
  if (!domain) return "";
  const parts = [`${domain.tools} ${domain.tools === 1 ? "tool" : "tools"}`, `${domain.skills} ${domain.skills === 1 ? "skill" : "skills"}`];
  return `${domain.label}: ${parts.join(", ")}${domain.available === 0 ? ", none available" : ""}`;
}

type RingKey = `domain:${string}` | `node:${string}`;

export function CapabilityRing({ onProjects, domainActions, layout, domains, view, centre, radius, renderScale, selectedDomain, selectedCapability, working, idleReadout, onDetail,
  onHoverDomain, onSelectDomain, onSelectCapability }: CapabilityRingProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Capability | null>(null);
  const [focusKey, setFocusKey] = useState<RingKey | null>(null);
  const group = useRef<SVGGElement>(null);
  const segments = layout.ring.segments;
  const byId = useMemo(() => new Map(domains.map(domain => [domain.id, domain])), [domains]);
  const labelFont = 10.5 / Math.max(renderScale, .01);
  const nodes = useMemo(() => layoutRevealed(view.revealed, segments, centre, labelFont * .92).map((node,index)=>{const x=180+(index%2)*80;const y=95+Math.floor(index/2)*26;return {...node,x,y,labelX:x,labelY:y+12};}), [view.revealed, segments, centre, labelFont]);
  const hoverDomain = (id: string | null) => { setHovered(id); onHoverDomain(id); };

  const ids = segments.map(segment => segment.id);
  const tabKey: RingKey | null = focusKey && (focusKey.startsWith("domain:") ? ids.includes(focusKey.slice(7)) : nodes.some(node => node.item.id === focusKey.slice(5)))
    ? focusKey : ids.length ? `domain:${ids[0]}` : null;
  function move(next: RingKey | null) {
    if (!next) return;
    setFocusKey(next);
    [...(group.current?.querySelectorAll<SVGElement>("[data-ring-key]") ?? [])].find(element => element.dataset.ringKey === next)?.focus();
  }
  function activateDomain(id: string) {
    const navigate = domainActions?.[id];
    if (navigate) navigate();
    else onSelectDomain(selectedDomain === id ? null : id);
  }
  function keyDown(event: KeyboardEvent<SVGElement>, key: RingKey) {
    const step = (list: string[], id: string, delta: number) => list[(list.indexOf(id) + delta + list.length) % list.length];
    let next: RingKey | null = null;
    if (key.startsWith("domain:")) {
      const id = key.slice(7);
      if (event.key === "ArrowRight") next = `domain:${step(ids, id, 1)}`;
      else if (event.key === "ArrowLeft") next = `domain:${step(ids, id, -1)}`;
      else if (event.key === "Home") next = `domain:${ids[0]}`;
      else if (event.key === "End") next = `domain:${ids[ids.length - 1]}`;
      else if (event.key === "ArrowDown") { const first = nodes.find(node => node.item.domain === id); next = first ? `node:${first.item.id}` : null; }
      else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activateDomain(id); return; }
      else if (event.key === "Escape" && selectedDomain) { event.preventDefault(); event.stopPropagation(); onSelectDomain(null); return; }
      else return;
    } else {
      const node = nodes.find(candidate => candidate.item.id === key.slice(5));
      if (!node) return;
      const siblings = nodes.filter(candidate => candidate.item.domain === node.item.domain).map(candidate => candidate.item.id);
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = `node:${step(siblings, node.item.id, 1)}`;
      else if (event.key === "ArrowLeft") next = `node:${step(siblings, node.item.id, -1)}`;
      else if (event.key === "ArrowUp" || event.key === "Escape") next = `domain:${node.item.domain}`;
      else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectCapability(node.item.id); return; }
      else return;
    }
    event.preventDefault(); event.stopPropagation(); move(next);
  }

  const focusDomain = hovered ?? selectedDomain;
  const focused = focusDomain ? byId.get(focusDomain) : undefined;
  const readout = hoveredNode ? [shortName(hoveredNode).toUpperCase()] : focused ? [focused.label.toUpperCase()] : idleReadout ?? [];
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
  const detail = hoveredNode ? `${hoveredNode.name} · ${hoveredNode.kind === "tool" ? "Tool" : "Skill"} · ${CAPABILITY_WORD[view.states[hoveredNode.id]]}`
    : focused ? `${focused.label} · ${plural(focused.tools, "tool")} · ${plural(focused.skills, "skill")}` : null;
  useEffect(() => { onDetail?.(detail); }, [detail, onDetail]);
  const constellation = layout.constellation;

  return <g ref={group} className="capability-ring" data-focused={Boolean(focusDomain) || undefined} data-working={working || undefined}
    role="group" aria-label="Olympus capability armory. Arrow keys move between domains; Enter reveals a domain's Tools and Skills; Down enters them.">
    {/* The note constellation stays as an ambient field: drawn by the flat
        instrument, followed by the 3D stars, never interactive in Command. */}
    <g className="capability-ring__field" aria-hidden="true" pointerEvents="none">
      {constellation.treeEdges.map(edge => <line key={edge.key} x1={edge.from.x} y1={edge.from.y} x2={edge.to.x} y2={edge.to.y}
        className={`project-ring__tree-edge project-ring__tree-edge--${edge.depth <= 1 ? "hop1" : "deep"}`} />)}
      {constellation.nodes.map((node, index) => <g key={node.id} data-node-id={node.id} className={`capability-ring__star project-ring__node-group project-ring__node-group--depth-${Math.min(node.depth, 3)}`}
        style={{ "--node-phase": `${-(index * 3.17)}s`, "--node-drift-duration": `${AMBIENT.nodeDrift + index % 7 * 2}s` } as CSSProperties}>
        <circle cx={node.x} cy={node.y} r={node.size} className="project-ring__node" /></g>)}
    </g>
    {segments.map(segment => {
      const domain = byId.get(segment.id);
      const state = view.domains[segment.id] ?? "idle";
      const positions: Record<string,[number,number]> = {system:[220,40],research:[362,120],communications:[362,270],knowledge:[295,385],code:[135,385],files:[70,270],reasoning:[173,325],voice:[267,325]};
      const descriptions:Record<string,string[]>={system:["System health,","settings and control."],research:["Discover and","connect knowledge."],communications:["Context, teams","and correspondence."],knowledge:["Memory, context","and lasting recall."],code:["Build, run and","iterate safely."],files:["Access and","analyze content."],reasoning:["Plan, reason and","solve complex work."],voice:["Speak and listen","with Olympus."]};
      const icons:Record<string,typeof Settings>={system:Settings,research:Compass,communications:MessagesSquare,knowledge:Database,code:Code2,files:FolderOpen,reasoning:Brain,voice:Mic};
      const compact=segment.id==="reasoning"||segment.id==="voice";
      const [x,y]=positions[segment.id]??[centre,40]; const Icon=icons[segment.id]??Settings;
      return <g key={segment.id} className="orbit-domain capability-ring__segment" data-state={state} data-selected={selectedDomain===segment.id||undefined}>
        <g transform={`translate(${x-(compact?43:69)} ${y-(compact?16:29)})`} className="capability-ring__hit orbit-domain__card"
          data-ring-key={`domain:${segment.id}`} data-domain={segment.id} tabIndex={tabKey === `domain:${segment.id}` ? 0 : -1}
          role="button" aria-pressed={domainActions?.[segment.id] ? undefined : selectedDomain===segment.id} aria-label={domainActions?.[segment.id] ? `Open ${domain?.label ?? segment.id}` : `${domainName(domain)} — ${selectedDomain===segment.id?"hide":"show"} its Tools and Skills`}
          onMouseEnter={()=>hoverDomain(segment.id)} onMouseLeave={()=>hoverDomain(null)}
          onFocus={()=>{setFocusKey(`domain:${segment.id}`);hoverDomain(segment.id)}} onBlur={()=>hoverDomain(null)}
          onClick={()=>activateDomain(segment.id)} onKeyDown={event=>keyDown(event,`domain:${segment.id}`)}>
          <OrbitalCardSurface compact={compact} cool={["system","research","code"].includes(segment.id)} />
          <Icon x={compact?8:11} y={compact?9:15} width={compact?14:20} height={compact?14:20} className="orbit-domain__icon"/>
          <circle cx={compact?79:128} cy="8" r="2.5" className="orbit-domain__status"/>
          <text x={compact?29:44} y={compact?20:18} className="orbit-domain__name capability-ring__name" style={{fontSize: `${(compact?9:segment.id==="communications"?9.5:10.5) / renderScale}px`}}>{domain?.label.toUpperCase()}</text>
          {(!compact?descriptions[segment.id]??[]:[]).map((line,i)=><text key={line} x="44" y={32+i*9} className="orbit-domain__description" style={{fontSize: `${10 / renderScale}px`}}>{line}</text>)}
          <title>{domainName(domain)}</title>
        </g>
      </g>;
    })}

    {onProjects&&<g className="orbit-domain" transform="translate(1 91)"><g className="orbit-domain__card" role="button" tabIndex={0} aria-label="Open Project workspace" onClick={onProjects} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onProjects()}}}>
      <OrbitalCardSurface /><FileText x="11" y="15" width="20" height="20" className="orbit-domain__icon"/>
      <text x="44" y="18" className="orbit-domain__name" style={{fontSize: `${10.5/renderScale}px`}}>PROJECT</text><text x="44" y="32" className="orbit-domain__description" style={{fontSize: `${10/renderScale}px`}}>Plan, track and</text><text x="44" y="42" className="orbit-domain__description" style={{fontSize: `${10/renderScale}px`}}>deliver work.</text>
    </g></g>}
    <g aria-hidden="true" pointerEvents="none" className="orbit-identity" style={{visibility:readout.length?"hidden":"visible"}}><text x="220" y="279" textAnchor="middle">PANTHEON</text><text x="220" y="291" textAnchor="middle" className="orbit-identity__sub">INTELLIGENCE IN ORBIT</text></g>

    {nodes.length > 0 && <g className="capability-ring__reveal">
      {nodes.map(node => {
        const state = view.states[node.item.id];
        const tether = pointOnProjectRing(node.angle, radius - BAND / 2, centre);
        const toCore = pointOnProjectRing(node.angle, 44, centre);
        return <g key={node.item.id} className="capability-node" data-kind={node.item.kind} data-state={state}
          data-selected={selectedCapability === node.item.id || undefined} data-capability={node.item.id}>
          <line x1={node.x} y1={node.y} x2={tether.x} y2={tether.y} className="capability-node__tether" />
          {working && state === "active" && <line x1={node.x} y1={node.y} x2={toCore.x} y2={toCore.y} className="capability-node__path" />}
          {node.item.kind === "tool"
            ? <circle cx={node.x} cy={node.y} r={3.6} className="capability-node__glyph" />
            : <rect x={node.x - 3.1} y={node.y - 3.1} width={6.2} height={6.2} transform={`rotate(45 ${node.x} ${node.y})`} className="capability-node__glyph" />}
          {state === "requires-approval" && <circle cx={node.x + 4.2} cy={node.y - 4.2} r={1.3} className="capability-node__approval" />}
          <text x={node.labelX} y={node.labelY} textAnchor="middle" className="capability-node__label" style={{ fontSize: `${labelFont * .92}px` }}>{shortName(node.item)}</text>
          <circle cx={node.x} cy={node.y} r={Math.max(7, 12 / Math.max(renderScale, .01))} fill="transparent" className="capability-node__hit"
            data-ring-key={`node:${node.item.id}`} tabIndex={tabKey === `node:${node.item.id}` ? 0 : -1} role="button"
            aria-pressed={selectedCapability === node.item.id}
            aria-label={`${node.item.name} · ${node.item.kind === "tool" ? "Tool" : "Skill"} · ${CAPABILITY_WORD[state]} — inspect`}
            onMouseEnter={() => setHoveredNode(node.item)} onMouseLeave={() => setHoveredNode(null)}
            onFocus={() => { setFocusKey(`node:${node.item.id}`); setHoveredNode(node.item); }} onBlur={() => setHoveredNode(null)}
            onClick={() => onSelectCapability(node.item.id)} onKeyDown={event => keyDown(event, `node:${node.item.id}`)}>
            <title>{`${node.item.name} · ${node.item.kind === "tool" ? "Tool" : "Skill"} · ${CAPABILITY_WORD[state]}`}</title>
          </circle>
        </g>;
      })}
    </g>}

    <CentreReadout lines={readout} centre={centre} renderScale={renderScale} />
  </g>;
}

function CentreReadout({ lines, centre, renderScale }: { lines: string[]; centre: number; renderScale: number }) {
  const laid = layoutCentreReadout(lines, centre, renderScale);
  if (!laid.length) return null;
  return <g pointerEvents="none" className="capability-ring__readout">
    {laid.map((line, index) => <text key={index} x={centre} y={line.y} className={index ? "project-ring__meta" : "project-ring__readout"}
      textAnchor="middle" dominantBaseline="middle" style={{ fontSize: `${9 / Math.max(renderScale, .01)}px` }}>{line.text}</text>)}
  </g>;
}

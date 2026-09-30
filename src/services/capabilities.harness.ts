import fixture from "./capabilitiesFixture.json";
import {
  armoryView, currentMission, domainLight, labelBox, layoutRevealed, lensFor, missionFocus, RECENT_MISSION_MS, shortName, suggestionsFor,
  type CapabilitySnapshot, type MissionSnapshot
} from "./capabilities";
import { layoutCapabilityRing, segmentCaption } from "./capabilityRing";

/** Pure checks over the synthetic projection; bundled by scripts/test-capabilities.mjs. */
export function runCapabilitiesHarness() {
  const passed: string[] = [];
  const check = (condition: unknown, label: string) => { if (!condition) throw Error(`FAIL ${label}`); passed.push(label); };
  const snapshot = fixture.capabilities as unknown as CapabilitySnapshot;
  const missions = fixture.missions as unknown as Record<string, MissionSnapshot>;

  // Lens: bindings come from the projection, and the aggregate is everything.
  check(lensFor(snapshot, "olympus").size === snapshot.tools.length + snapshot.skills.length, "Olympus Core's lens is the whole armory");
  check([...lensFor(snapshot, "research")].sort().join() === "evidence-synthesis,model-primary,pantheon,research-retrieval", "Research lens is its contract");
  check([...lensFor(snapshot, "coding-delegate")].sort().join() === "claude-code,git", "Coding Delegate lens has no skills");

  // Idle is clean: aggregate reveals nothing individually.
  const idle = armoryView(snapshot, { agentId: "olympus" });
  check(idle.revealed.length === 0, "Idle aggregate reveals no nodes");
  check(Object.values(idle.domains).every(state => state === "idle" || state === "unavailable"), "Idle domains carry no mission or lens light");
  check(Object.values(domainLight(idle, null)).every(level => level === 0), "Idle ring is unlit");
  const research = armoryView(snapshot, { agentId: "research" });
  check(research.revealed.map(item => item.id).sort().join() === "evidence-synthesis,model-primary,pantheon,research-retrieval", "Research lens reveals only its capabilities");
  check(research.domains.research === "in-scope" && research.domains.reasoning === "in-scope" && research.domains.communications === "idle", "Lens lights only the domains it touches");
  const coding = armoryView(snapshot, { agentId: "coding-delegate" });
  check(coding.states["claude-code"] === "unavailable", "An unavailable tool is never shown in scope");
  const domain = armoryView(snapshot, { agentId: "olympus", selectedDomain: "communications" });
  check(domain.revealed.length === 5 && domain.revealed.every(item => item.domain === "communications"), "A selected domain reveals exactly its items");

  // Missions: only recorded states, and recency is bounded.
  const active = currentMission(missions.mailActive, Date.parse("2026-09-29T09:06:00Z"));
  check(active?.status === "running" && active.kind === "communication-intelligence", "A running mission takes precedence");
  const focus = missionFocus(active);
  check(focus.running && focus.capabilities.get("communication-assess") === "active" && focus.capabilities.get("gmail") === "active", "Active step lights its recorded skill and tool");
  const theater = armoryView(snapshot, { agentId: "olympus", focus });
  check(theater.domains.communications === "active" && theater.revealed.every(item => focus.capabilities.has(item.id)), "Mission reveals only the capabilities its steps name");
  const finished = missions.completed.missions[0];
  const finishedAt = Date.parse(finished.finishedAt!);
  check(currentMission(missions.completed, finishedAt + 60_000)?.id === finished.id, "A just-finished mission stays visible");
  check(currentMission(missions.completed, finishedAt + RECENT_MISSION_MS + 1) === null, "An old mission is not resurrected");
  check(currentMission(missions.completed, finishedAt + 60_000, new Set([finished.id])) === null, "A dismissed mission stays dismissed");
  check(missionFocus(finished).running === false && [...missionFocus(finished).capabilities.values()].every(state => state === "completed"), "A finished mission shows no active capability");
  check(currentMission(missions.none, Date.now()) === null, "No runs, no mission");

  // Geometry: sectors tile the ring with a gap at the top; revealed nodes stay inside.
  const ring = layoutCapabilityRing(snapshot.domains);
  check(ring.segments.length === snapshot.domains.length && ring.segments[0].startAngle > 0, "One sector per domain, gap at twelve o'clock");
  check(ring.segments.every((segment, index) => index === 0 || segment.startAngle > ring.segments[index - 1].endAngle), "Sectors never overlap");
  for (const fontUnits of [8, 9.5, 11]) {
    for (const reveal of [domain.revealed, armoryView(snapshot, { agentId: "olympus", selectedDomain: "research" }).revealed, research.revealed]) {
      const nodes = layoutRevealed(reveal, ring.segments, 220, fontUnits);
      const boxes = nodes.map(node => labelBox(shortName(node.item), node.labelX, node.labelY, fontUnits));
      check(boxes.every((a, i) => boxes.every((b, j) => i === j || a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)), `Labels never overlap at ${fontUnits} units (${reveal.length} nodes)`);
      check(nodes.every(node => Math.hypot(node.x - 220, node.y - 220) < 150 && Math.hypot(node.labelX - 220, node.labelY - 220) > 70), `Nodes inside the ring, labels outside the Ω at ${fontUnits} units`);
    }
  }
  const nodes = layoutRevealed(domain.revealed, ring.segments);
  check(nodes.every(node => { const segment = ring.segments.find(s => s.id === node.item.domain)!; return node.angle > segment.startAngle && node.angle < segment.endAngle; }), "Every node sits inside its own domain's wedge");
  check(segmentCaption(ring.segments[0], 40).includes("·") && !segmentCaption(ring.segments[0], 8).includes("·"), "Counts drop before names truncate");

  // Suggestions only for available capabilities.
  const suggestions = suggestionsFor(snapshot);
  check(suggestions.every(s => s.requires.every(id => snapshot.tools.find(t => t.id === id)?.state === "AVAILABLE")), "Suggestions require available tools");
  check(suggestionsFor(null).length === 0, "No projection, no suggestions");
  return { passed: passed.length, labels: passed };
}

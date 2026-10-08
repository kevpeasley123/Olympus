import { activeMissions } from "../services/pantheonMissions";
import { useCallback, useMemo, useState } from "react";
import {
  armoryView, currentMission, domainLight, missionFocus,
  type CapabilitySnapshot, type MissionSnapshot
} from "../services/capabilities";

/**
 * Command's presentation state, derived in one place for the app and its
 * harnesses: the lens, domain and capability selection, the current mission,
 * and everything the three regions read from them. Conversation state is not
 * here and never changes because of anything here.
 */
export function useCommandView(capabilities: CapabilitySnapshot | null, missions: MissionSnapshot | null, now: number = Date.now()) {
  const [agent, setAgent] = useState("olympus");
  const [hoverDomain, setHoverDomain] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedMission, selectMission] = useState<string | null>(null);
  const liveMissions = useMemo(() => activeMissions(missions), [missions]);
  const selectedMissionId = liveMissions.some(m => m.id === selectedMission) ? selectedMission : null;
  const mission = liveMissions.find(m => m.id === selectedMissionId) ?? currentMission(missions, now, dismissed);
  const focus = useMemo(() => missionFocus(mission), [mission]);
  const view = useMemo(() => capabilities ? armoryView(capabilities, { agentId: agent, hoverDomain, selectedDomain, focus }) : null,
    [capabilities, agent, hoverDomain, selectedDomain, focus]);
  const light = useMemo(() => view ? domainLight(view, hoverDomain) : {}, [view, hoverDomain]);
  const activeDomains = useMemo(() => view ? Object.entries(view.domains).filter(([, state]) => state === "active").map(([id]) => id) : [], [view]);
  const selectAgent = useCallback((id: string) => { setAgent(id); setSelectedDomain(null); setSelectedCapability(null); }, []);
  const dismissMission = useCallback((id: string) => setDismissed(previous => new Set(previous).add(id)), []);
  return {
    agent, selectAgent, hoverDomain, setHoverDomain, selectedDomain, setSelectedDomain, selectedCapability, setSelectedCapability,
    mission, liveMissions, selectedMissionId, selectMission, focus, view, light, activeDomains, dismissMission,
    missionOperation: mission ? mission.steps.filter(step => step.state === "completed").length : 0,
    working: focus.running && focus.capabilities.size > 0
  };
}

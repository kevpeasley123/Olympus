import { INTAKE_CHANGED, resourceSkills, skillDescriptor } from "../services/resourceIntake";
import { useEffect, useState } from "react";
import { capabilityClient, type CapabilityClient, type CapabilitySnapshot, type MissionSnapshot } from "../services/capabilities";
import fixture from "../services/capabilitiesFixture.json";
import { isTauriRuntime } from "../services/launcher";

/** Polling cadence: fast only while a recorded mission is live. */
export const ARMORY_POLL = { capabilitiesMs: 60_000, liveMissionMs: 2_500, idleMissionMs: 15_000 } as const;

export interface CommandArmory {
  capabilities: CapabilitySnapshot | null;
  capabilitiesError: string | null;
  missions: MissionSnapshot | null;
  /** Browser preview: synthetic capabilities, labelled as such, and no missions. */
  preview: boolean;
  missionsError: string | null;
}

/**
 * The armory and mission projections for Command. The desktop reads the
 * backend; the browser preview shows the synthetic fixture and says so, the
 * same way it labels its example projects. Harnesses inject a client.
 */
export function useCommandArmory(active: boolean, client: CapabilityClient | null = isTauriRuntime() ? capabilityClient : null): CommandArmory {
  const preview = client === null;
  const [missionsError, setMissionsError] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<CapabilitySnapshot | null>(preview ? fixture.capabilities as CapabilitySnapshot : null);
  const [capabilitiesError, setError] = useState<string | null>(null);
  const [missions, setMissions] = useState<MissionSnapshot | null>(preview ? fixture.missions.none as MissionSnapshot : null);

  useEffect(() => {
    if (!client) {
      let live=true;
      const refresh=()=>{void resourceSkills().then(skills=>{if(live)setCapabilities({...fixture.capabilities as CapabilitySnapshot,skills:[...fixture.capabilities.skills as CapabilitySnapshot["skills"],...skills.map(skillDescriptor)]})})};
      refresh();window.addEventListener(INTAKE_CHANGED,refresh);return()=>{live=false;window.removeEventListener(INTAKE_CHANGED,refresh)};
    }
    let live = true;
    const read = () => client.capabilities().then(value => { if (live) { setCapabilities(value); setError(null); } })
      .catch(error => { if (live) setError(String(error)); });
    void read();
    const timer = window.setInterval(read, ARMORY_POLL.capabilitiesMs);
    window.addEventListener("focus", read);
    window.addEventListener(INTAKE_CHANGED,read);
    return () => { live = false; window.clearInterval(timer); window.removeEventListener("focus", read);window.removeEventListener(INTAKE_CHANGED,read); };
  }, [client]);

  useEffect(() => {
    if (!client) return;
    let live = true, timer: number | undefined;
    const read = async () => {
      let delay: number = ARMORY_POLL.idleMissionMs;
      try {
        const value = await client.missions();
        if (!live) return;
        setMissions(value); setMissionsError(null);
        if (value.missions.some(mission => mission.status === "running")) delay = ARMORY_POLL.liveMissionMs;
      } catch(error) { if(live)setMissionsError(String(error)); }
      // Hidden Command slows to the idle cadence: nobody is watching the theater.
      if (live) timer = window.setTimeout(read, active ? delay : ARMORY_POLL.idleMissionMs);
    };
    void read();
    return () => { live = false; window.clearTimeout(timer); };
  }, [client, active]);

  return { capabilities, capabilitiesError, missions, preview, missionsError };
}

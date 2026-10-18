import {usageManagementFixture} from "./services/usageManagementFixture";
import {usageFixture} from "./services/usageFixture";
import {createRoot} from "react-dom/client";

import {UsageSummary} from "./components/panels/UsageSummary";

import {EngineSettings} from "./components/panels/EngineSettings";

import type {UsageSnapshot} from "./services/usage";

import "./styles.css";



let calls = 0;

Object.assign(window, {__TAURI_INTERNALS__: {invoke: async (command: string) => {

  if(command !== "engine_status") throw new Error(`Unexpected fixture command: ${command}`);

  calls++;

  if(calls > 1) throw new Error("Synthetic inspection failure");

  return [{engine:"claude-code",name:"Claude Code",version:"2.1.74 (Claude Code)",executable:"C:/Synthetic/Claude/claude.exe",

    signIn:{state:"subscription",plan:"max"},selection:"explicit executable override",observedAt:"2026-01-01T00:00:00Z",

    billing:{state:"unknown",detail:"Paid overage has not been verified."},

    capabilities:{streaming:true,structuredOutput:true,ephemeral:true,source:"Synthetic CLI fixture; no inference."}}];

}}});

const synthetic = usageFixture(new URLSearchParams(location.search).has("fresh"));
const stateParam = new URLSearchParams(location.search).get("state");

if (stateParam && ["loading","failed","unsupported","disconnected"].includes(stateParam)) {

 for (const item of synthetic) {

  item.status = stateParam as UsageSnapshot["status"];

  if (stateParam !== "failed") {item.observedAt=null; item.windows=[]; item.balance=null; item.ytdConsumption=null; item.ytdSpend=null;}

 }

}

const populated = location.search.includes("populated");

createRoot(document.getElementById("root")!).render(<main style={{maxWidth:740,margin:"24px auto",padding:20}}>

  <p className="eyebrow">Synthetic acceptance · no provider calls</p><h2>Olympus usage &amp; engines</h2>

  <section className="command-brief" style={{maxWidth:380}}><h3>Mission brief</h3><p>No active missions reported.</p></section><UsageSummary managementApi={usageManagementFixture} previewLabel="Synthetic usage fixture / no provider calls" snapshots={populated ? synthetic : undefined}/>

  <section className="preferences-section" style={{marginTop:24}}><EngineSettings/></section>

</main>);

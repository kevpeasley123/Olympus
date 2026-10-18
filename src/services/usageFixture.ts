import type {UsageSnapshot} from "./usage";
const fixtureObservedAt = new Date(Date.now()-1000).toISOString();
/** Synthetic test-only data. Imported only by harness entry points. */
export function usageFixture(fresh = false, historical = false): UsageSnapshot[] {
const snapshots: UsageSnapshot[] = [

  {provider:"Codex",capabilityCategory:"models-subscriptions",scope:"Account",source:"Synthetic fixture - no provider call",observedAt:"2026-01-01T00:00:00Z",

    windows:[{label:"Weekly",remaining:{value:100,unit:"%",period:"7-day window"},resetsAt:"2026-01-08T00:00:00Z"},{label:"5-hour",remaining:null,resetsAt:null}],

    balance:{value:12.5,unit:"credits",period:"Current balance"},ytdConsumption:{value:30,unit:"credits",period:"2026 YTD"},ytdSpend:{value:8,unit:"USD",period:"2026 YTD"}},

  {provider:"Claude",capabilityCategory:"models-subscriptions",scope:"Account",source:"Synthetic fixture - no provider call",observedAt:"2026-01-01T00:00:00Z",

    windows:[{label:"Weekly",remaining:{value:65,unit:"%",period:"7-day window"},resetsAt:"2026-01-08T00:00:00Z"}],balance:null,ytdConsumption:null,ytdSpend:null},

  {provider:"ElevenLabs",capabilityCategory:"apis-services",scope:"Account",source:"Synthetic fixture - no provider call",observedAt:"2026-01-01T00:00:00Z",windows:[{label:"Credit allowance",remaining:{value:25,unit:"%",period:"Current allowance"},resetsAt:null}],balance:{value:2.5,unit:"USD",period:"Current balance"},ytdConsumption:null,ytdSpend:null}

];


if(fresh) for(const s of snapshots) {s.observedAt=fixtureObservedAt; for(const w of s.windows) if(w.resetsAt) w.resetsAt=new Date(Date.now()+6*86400000).toISOString();}
if(historical){
 const claude=snapshots[1];Object.assign(claude,{evidence:"historical",source:"https://claude.ai/settings/usage (manually observed)",detail:"Historical snapshot, not current usage. Observation time is approximate. Reset unknown; absolute token allowance unknown."});claude.windows=[{label:"Weekly window — last observed",remaining:{value:90,unit:"%",period:"7 days"},resetsAt:null}];
 snapshots[2].balance={value:72000,unit:"characters",period:"Current billing period remaining"};snapshots[2].windows[0].remaining={value:72,unit:"%",period:"Current allowance"};
}
return snapshots;
}

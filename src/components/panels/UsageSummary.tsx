import {UsageManagement,type ManagementView} from "./UsageManagement";
import {handoffManagement,type ManagementDestination} from "../../services/managementNavigation";
import type {ManagementClient,ManagedService} from "../../services/usageManagement";
import { useEffect, useRef, useState } from "react";
import { siClaude, siElevenlabs } from "simple-icons";
import { createPortal } from "react-dom";
import { BarChart3, Maximize2, X, Layers, Link2, CodeXml } from "lucide-react";
import { formatUsageMetric, unavailableUsage, usageFreshness, type UsageSnapshot, type UsageMetric } from "../../services/usage";
import "./UsageSummary.css";
const groups = [{ id: "models-subscriptions", label: "Models & subscriptions", Icon: Layers }, { id: "apis-services", label: "APIs & services", Icon: Link2 }] as const;
const colors: Record<string, string> = { Codex: "blue", Claude: "orange", ChatGPT: "teal", ElevenLabs: "violet" };
function valid(m: UsageMetric | null | undefined) { return !!m && Number.isFinite(m.value) && m.value >= 0 && !!m.unit.trim() && !!m.period.trim(); }
function percent(s: UsageSnapshot) { const m = s.windows.find(w => valid(w.remaining) && w.remaining?.unit === "%" && w.remaining.value <= 100)?.remaining; return m?.value ?? null; }
function amount(m: UsageMetric | null) { if (!valid(m))
    return "—"; return m!.unit === "USD" ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(m!.value) : `${m!.value.toLocaleString()} ${m!.unit}`; }
function state(s: UsageSnapshot) { return s.status ?? (s.observedAt ? "ready" : "disconnected"); }
const statuses = { disconnected: "Telemetry not connected", unsupported: "Not supported", loading: "Checking", failed: "Check failed", ready: "No reading" };
function Brand({ name }: {
    name: string;
}) {
    const icon = name === "Claude" ? siClaude : name === "ElevenLabs" ? siElevenlabs : null;
    return <span className="usage-brand" aria-hidden="true">{icon ? <svg viewBox="0 0 24 24" fill="currentColor"><path d={icon.path}/></svg> : <CodeXml />}</span>;
}
function Meter({ s, ring = false }: {
    s: UsageSnapshot;
    ring?: boolean;
}) { const p = percent(s); return p === null ? <div className={ring ? "usage-ring-unknown" : "usage-unknown"}><span>—</span></div> : ring ? <div className="usage-ring" role="progressbar" aria-label={`${s.provider} remaining`} aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="51"/><circle className="usage-ring__fill" cx="60" cy="60" r="51" pathLength="100" strokeDasharray={`${p} 100`}/></svg><div><strong>{p}<small>%</small></strong><span>REMAINING</span></div></div> : <div className="usage-summary__track" role="progressbar" aria-label={`${s.provider} remaining`} aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${p}%` }}/></div>; }
/** Account snapshots only; no refresh or provider calls originate in this view. */
export function UsageSummary({ snapshots = unavailableUsage, previewLabel, managementApi }: {
    snapshots?: UsageSnapshot[];
    previewLabel?: string;
    managementApi?:ManagementClient;
}) {
    const [management,setManagement]=useState<ManagementView|null>(null);
    const [readings,setReadings]=useState<Partial<Record<ManagedService,string>>>({});
    const [selection,setSelection]=useState<string|null>(null);
    const returnManager=useRef<ManagementView|null>(null);
    const [open, setOpen] = useState(false);
    const [now, setNow] = useState(Date.now);
    const trigger = useRef<HTMLButtonElement>(null);
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
    useEffect(() => { if (!open)
        return; const d = dialog.current; d?.showModal(); return () => { d?.close(); trigger.current?.focus(); }; }, [open]);
    useEffect(()=>{if(!open)return;requestAnimationFrame(()=>{if(management)dialog.current?.querySelector<HTMLElement>('.usage-management h2')?.focus();else if(returnManager.current){dialog.current?.querySelector<HTMLButtonElement>(`[data-manage="${returnManager.current}"]`)?.focus();returnManager.current=null;}});},[management,selection,open]);
    function leaveManagement(){returnManager.current=management;setManagement(null);setSelection(null);}
    function handoff(target:ManagementDestination){setOpen(false);window.setTimeout(()=>handoffManagement({target,returnToUsage:()=>setOpen(true)}),0);}
    return <><section className="usage-summary" aria-label="Usage and limits"><header className="usage-summary__heading"><h3><BarChart3 />Usage</h3><button ref={trigger} onClick={() => setOpen(true)} aria-label="Expand usage"><Maximize2 /></button></header><div className="usage-summary__body">{groups.map(g => <section className="usage-summary__group" key={g.id} aria-label={g.label}><h3>{g.label}</h3>{snapshots.filter(s => s.capabilityCategory === g.id).map(s => <div className={`usage-row usage-color-${colors[s.provider] ?? "teal"}`} key={s.provider}><Brand name={s.provider}/><span className="usage-row__name">{s.provider}</span><Meter s={s}/><strong title={percent(s) !== null ? `${s.windows.find(w => valid(w.remaining) && w.remaining?.unit === "%" && w.remaining.value <= 100)?.label} remaining · ${usageFreshness(s.observedAt, now)}` : statuses[state(s)]}>{valid(s.balance) && s.capabilityCategory === "apis-services" ? amount(s.balance) : percent(s) !== null ? `${percent(s)}%` : amount(s.balance)}</strong></div>)}</section>)}</div><footer>{snapshots.some(s => state(s) === "failed") ? "Check failed / last known readings are stale" : snapshots.some(s => state(s) === "loading") ? "Checking account telemetry" : snapshots.every(s => state(s) === "unsupported") ? "Account telemetry not supported" : snapshots.every(s => !s.observedAt) ? "Account telemetry not connected" : snapshots.some(s => usageFreshness(s.observedAt, now) === "Stale") ? "Stale snapshot / Remaining" : "Account snapshots / Remaining"}</footer></section>{open && createPortal(<dialog ref={dialog} className="usage-dialog" aria-modal="true" aria-labelledby="usage-title" onCancel={() => setOpen(false)} onKeyDown={e => { if (e.key === "Tab") {
        const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, textarea, summary, [tabindex="0"]');
        if (!controls?.length)
            return;
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        }
        else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    } }} onClick={e => { if (e.target === e.currentTarget)
        setOpen(false); }}><div className="usage-expanded"><header className="usage-expanded__heading"><div><h2 id="usage-title"><BarChart3 />Usage &amp; credits</h2><p>{previewLabel ?? "Models, subscriptions and service balances."}</p></div><button autoFocus aria-label="Close usage" onClick={() => setOpen(false)}><X /></button></header>{management?<UsageManagement readings={readings} onReading={(id,value)=>setReadings(s=>({...s,[id]:value}))} view={management} selection={selection} onSelect={setSelection} onBack={leaveManagement} onHandoff={handoff} client={managementApi}/>:groups.map(g => <section className="usage-expanded__group" key={g.id}><div className="usage-group-heading"><h3><g.Icon />{g.label}</h3><button data-manage={g.id==="models-subscriptions"?"subscriptions":"apis"} onClick={()=>{setSelection(null);setManagement(g.id==="models-subscriptions"?"subscriptions":"apis")}}>Manage {g.id==="models-subscriptions"?"subscriptions":"APIs"}</button></div><p>{g.id === "models-subscriptions" ? "Your model and plan allowances" : "Your API balances and service usage"}</p><div className="usage-cards">{snapshots.filter(s => s.capabilityCategory === g.id).map(s => <article className={`usage-card usage-color-${colors[s.provider] ?? "teal"}`} data-empty={!s.observedAt && !s.windows.length && !valid(s.balance)} key={s.provider}><header><Brand name={s.provider}/><h4>{s.provider}</h4><span className="usage-state">{state(s) === "failed" ? "Check failed" : state(s) === "loading" ? "Checking" : s.observedAt ? usageFreshness(s.observedAt, now) : statuses[state(s)]}</span></header>{s.capabilityCategory === "models-subscriptions" ? <div className="usage-card__main"><Meter s={s} ring/><div className="usage-card__window">{s.windows.map(w => <p key={w.label}><strong>{w.label}</strong><span>{valid(w.remaining) ? formatUsageMetric(w.remaining) : "No reading"}</span>{w.resetsAt && Number.isFinite(Date.parse(w.resetsAt)) && <small>Resets {new Date(w.resetsAt).toLocaleString()}</small>}</p>)}{!s.windows.length && <p>No allowance reading</p>}</div></div> : <div className="usage-card__balance"><strong>{amount(s.balance)}</strong><span>{valid(s.balance) ? s.balance!.period : "No balance reading"}</span>{percent(s) !== null && <Meter s={s}/>}</div>}{valid(s.balance) && s.capabilityCategory === "models-subscriptions" && <div className="usage-detail"><span>Balance</span><strong>{amount(s.balance)}</strong></div>}{s.ytdConsumption && <div className="usage-detail"><span>YTD consumption</span><strong>{formatUsageMetric(s.ytdConsumption)}</strong></div>}{s.ytdSpend && <div className="usage-detail"><span>YTD spend</span><strong>{formatUsageMetric(s.ytdSpend)}</strong></div>}{s.observedAt && <footer><span>{s.scope} · {s.source}</span>{s.observedAt && <time>{new Date(s.observedAt).toLocaleString()}</time>}{state(s) === "failed" && s.observedAt && <span>Check failed · showing last known reading</span>}</footer>}</article>)}</div></section>)}<footer className="usage-expanded__note">Account telemetry is separate from subscription sign-in and voice-session receipts. No live refresh connected.</footer></div></dialog>, document.body)}</>;
}

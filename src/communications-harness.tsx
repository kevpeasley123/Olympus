import {workflowFixture} from './services/workflowInspectionFixture';
import {applyPriorityScenario} from './services/situationPriorityFixture';
import {applyNavigatorFixture} from './services/situationNavigatorFixture';
import {fixtureSituations,fixtureState} from './services/situationsFixture';
import type {IntelligenceClient,IntelligenceRun} from './services/communicationIntelligence';
import { BackgroundLayer } from './components/BackgroundLayer';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { Communications } from './components/panels/Communications';
import { ModeSwitcher } from './components/panels/ModeSwitcher';
import { readStoredMode, type DashboardMode } from './hooks/useDashboardMode';
import type { CommunicationsClient, CommunicationRow } from './services/communications';
import type { GmailStatus } from './services/gmail';
import './styles.css';
if(location.search.includes('navigator'))applyNavigatorFixture(fixtureState);
if(location.search.includes('priority='))applyPriorityScenario(fixtureState.situations[0].localContext!,new URLSearchParams(location.search).get('priority')!);
if(location.search.includes('reduced')){const original=window.matchMedia.bind(window);window.matchMedia=(query:string)=>query==='(prefers-reduced-motion: reduce)'?{...original(query),matches:true,media:query,addEventListener:()=>{},removeEventListener:()=>{}} as MediaQueryList:original(query)}
if(location.search.includes('errors'))fixtureState.backgroundError='OpenAI response failed (response failed). No alternate provider was used. Previous understanding remains available. '+ 'Additional synthetic diagnostic context. '.repeat(12);
if(location.search.includes('long')){fixtureState.situations[0].title='Home — ownership, renovation and coordination across an unusually long situation title';fixtureState.situations[0].localContext!.summary+=' '+ 'Long synthetic briefing context remains inspectable without enlarging the map. '.repeat(35)}
const now = Date.UTC(2026, 8, 12, 18), DAY = 86400000;
const rows: CommunicationRow[] = Array.from({ length: 53 }, (_, i) => ({ id: (160 + i).toString(16), threadId: (160 + i).toString(16), timestamp: now - i * DAY / 10, fingerprint: `synthetic-${i}`, sender: ['Brandon <brandon@example.invalid>', 'GitHub <notifications@example.invalid>', 'Alex <alex@example.invalid>', 'Notion <updates@example.invalid>'][i % 4], subject: ['Olympus architecture review', 'Development activity', 'Contract timeline', 'Weekly project notes'][i % 4], preview: i===0?'Your rental receipt is ready':'Synthetic source evidence for visual iteration. No real mail is included.', labels: ['INBOX'], candidates: i % 3 === 0 ? [{ kind: 'possible_response_needed', text: 'Possible response needed; question detected. Review the source.' }] : i % 3 === 1 ? [{ kind: 'possible_project_relationship', text: 'Possible project relationship: Olympus. Review against project intent.' }, { kind: 'possible_deadline', text: 'Possible deadline mentioned. This is not a commitment.' }] : [] }));
let scenario = location.search.includes('errors')?'error':'populated', settings = 0, syncs = 0;
const state = (): GmailStatus => ({ configured: true, configPath: 'synthetic', busy: scenario === 'syncing', cachedMessages: scenario === 'empty' ? 0 : 53, lastRun: null, candidates: [], account: scenario === 'disconnected' ? null : { id: 'fixture', email: 'operator@example.invalid', enabled: true, status: scenario === 'syncing' ? 'syncing' : scenario === 'auth' ? 'authentication_required' : 'connected', horizonDays: 7, lastSuccess: new Date(now).toISOString(), lastAttempt: null, nextSync: null, lastError: scenario === 'limit' ? 'gmail_scope_limit_reduce_horizon' : scenario === 'error' ? 'gmail_network_unavailable' : scenario === 'auth' ? 'gmail_authentication_required' : null } });
const api: CommunicationsClient = { native: () => true, status: async () => state(), action: async () => { syncs++; }, workspace: async (days, group, sender, page) => { const source = scenario === 'empty' ? [] : rows; const filtered = source.filter(r => group === 'attention' ? r.candidates.length : group === 'actions' ? r.candidates.some(c => c.kind === 'possible_response_needed') : group === 'projects' ? r.candidates.some(c => c.kind === 'possible_project_relationship') : group === 'people' && sender ? r.sender === sender : true); return { days: Math.min(days, 7), horizonDays: 7, total: source.length, attention: source.filter(r => r.candidates.length).length, actions: source.filter(r => r.candidates.some(c => c.kind === 'possible_response_needed')).length, deadlines: source.filter(r => r.candidates.some(c => c.kind === 'possible_deadline')).length, projects: source.filter(r => r.candidates.some(c => c.kind === 'possible_project_relationship')).length, inbox: source.length, sent: 0, threads: source.length, people: [...new Set(source.map(r => r.sender))].map(sender => ({ sender, count: source.filter(r => r.sender === sender).length })), activity: Array.from({ length: 8 }, (_, i) => ({ timestamp: Math.floor(now / DAY) * DAY - (7 - i) * DAY, received: source.filter(r => Math.floor(r.timestamp / DAY) === Math.floor(now / DAY) - 7 + i).length, sent: 0 })), signals: source.filter(r=>r.candidates.length).slice(0,3), rows: filtered.slice(page * 40, page * 40 + 40), matches: filtered.length, page, comparison: null }; }, thread: async (id) => { const r = rows.find(r => r.id === id)!; return [{ id: r.id, threadId: id, sender: r.sender, recipients: 'operator@example.invalid', subject: r.subject, internalDate: r.timestamp, canonicalText: 'Can you review? <script>window.bad=true</script>', cleanText: 'Can you review? <script>window.bad=true</script>', attachments: [{ filename: 'brief.pdf', mimeType: 'application/pdf', size: 2048 }], bodyStatus: 'text_available' }]; }, search: async () => [{ provider: 'gmail', accountId: 'fixture', messageId: 'a0', threadId: 'a0', sender: rows[0].sender, subject: rows[0].subject, timestamp: now, excerpt: 'Synthetic keyword match', fingerprint: 'synthetic-0', retrievedAt: new Date(now).toISOString(), bodyStatus: 'text_available', cachedThreadSubset: true }] };

let analysisCount=0, evaluations=0;
const makeRun=():IntelligenceRun=>({id:'synthetic-run',graph:'communication-intelligence/v3',model:'fixture-model (synthetic)',loop:{passes:2,maxPasses:3},selectedThreads:3,usage:[{actualModel:'fixture-model',status:'completed',usage:{input_tokens:42}}],status:scenario==='analysis-failed'?'failed':'completed',startedAt:new Date(now).toISOString(),finishedAt:new Date(now+18).toISOString(),durationMs:18,days:7,stale:scenario==='stale',error:scenario==='analysis-failed'?'Synthetic source unavailable':null,skills:[{id:'communication-assess',version:2,implementation:'Synthetic fixture only'}],definition:[{id:'snapshot',kind:'cache_read',dependsOn:[],maxIterations:1},{id:'select',kind:'candidate_selection',dependsOn:['snapshot'],maxIterations:1},{id:'assess',kind:'communication-assess@2',dependsOn:['select'],maxIterations:3},{id:'project',kind:'project-relevance@2',dependsOn:['select'],maxIterations:1},{id:'synthesize',kind:'validated_join_and_policy',dependsOn:['assess','project'],maxIterations:1}],items:scenario==='empty'?[]:rows.slice(0,3).map((r,i)=>{const evidenceRefs=[{messageId:r.id,threadId:r.threadId,fingerprint:r.fingerprint,timestamp:r.timestamp}];return {threadId:r.threadId,subject:r.subject,sender:r.sender,assessment:{evidenceState:i===1?'insufficient':'sufficient',missingContextReason:i===1?'The revised attachment is not in the cached text.':null,attention:i===2?'background':i===1?'uncertain':'needs_you',priority:i===0?'high':'low'},stopReason:i===1?'context_unavailable':'evidence_sufficient',triage:{attention:i===2?'background':i===1?'uncertain':'needs_you',summary:'Possible response needed.',reasonCodes:['possible_response_needed'],evidenceRefs},summary:{whatHappened:i===2?'Your delivery date was updated.':'Brandon sent the revised architecture plan.',whatChanged:i===2?'Delivery moved from Thursday to Wednesday.':'The plan now includes a read-only Gmail source.',whatMatters:i===2?'No response or decision is requested.':i===1?'The revised attachment needs checking before a decision.':'Your review is needed before the team proceeds.',likelyNextMove:'Review the source.',evidenceRefs},project:{state:'suggested',reason:'Generated project candidate; not operator-confirmed.',ambiguity:false,suggestedProjects:[{name:'Olympus',source:'01 - Projects/Olympus.md',fingerprint:'fixture-project'}],method:'bounded_name_alias_match'},recommendation:{disposition:i===2?'no_action':i===1?'verify':'review',guidance:i===2?'No reply needed; keep the new date for reference.':i===1?'Open the original attachment to verify the proposed deadline.':'Review the revised Gmail boundary and reply with any changes.',priority:i===0?'high':'low',evidenceRefs}}})});
const intelligence:IntelligenceClient={workflow:async()=>workflowFixture,inspect:async()=>({run:makeRun(),events:[{sequence:1,node:"snapshot",state:"completed",at:new Date(now).toISOString(),result:{cachedThreads:53}}],through:1,next:1,hasMore:false}),list:async()=>[makeRun()],analyze:async()=>{analysisCount++;return makeRun()},events:async()=>[{node:'snapshot',state:'completed',at:new Date(now).toISOString(),result:{cachedThreads:53}},{node:'project',state:'completed',at:new Date(now+18).toISOString(),result:{catalogReads:1}}],feedback:async()=>{evaluations++}};
function Fixture() {
 const [version,setVersion]=useState(0),[mode,setMode]=useState<DashboardMode>('communications'),[narrow,setNarrow]=useState(false),[expanded,setExpanded]=useState(location.search.includes('expanded'));
 return <><BackgroundLayer/><main className={`app-shell mode-communications comms-fixture ${location.search.includes('fit')?'comms-fit-fixture':''}`} data-narrow={narrow||undefined}>
  <header className="comms-fixture-header"><h1 className="olympus-wordmark">OLYMPUS</h1><ModeSwitcher mode={mode} onSelectMode={setMode}/></header>
  <div className="comms-fixture-controls"><label>Synthetic fixture <select aria-label="Fixture state" value={scenario} onChange={e=>{scenario=e.target.value;setVersion(version+1)}}>{['populated','empty','syncing','disconnected','error','limit','auth','stale','analysis-failed'].map(v=><option key={v}>{v}</option>)}</select></label><button className="ghost-action" onClick={()=>setNarrow(!narrow)}>Toggle narrow study</button><small>No real mail or model calls</small></div>
  <div className="dashboard-body"><div className="main-grid"><aside className="tools-rail" aria-label="Fixture navigation rail"/><section className="center-stack dashboard-column" aria-label="Communications page scroll area">
   {mode==='communications'?<Communications key={version} api={api} intelligence={intelligence} situations={fixtureSituations} onSettings={()=>{settings++}}/>:<p>Navigation fixture: {mode}. Return to Communications.</p>}<pre id="result" style={{whiteSpace:'pre-wrap'}}/>
  </section><section className="right-stack dashboard-column" aria-label="Persistent fixture chat"><div className="panel-slot-chat"><div className="command-console"><div className="comms-fixture-chat">
   {expanded&&<div className="comms-fixture-conversation">Synthetic conversation aperture. The page remains scrollable above this reserved console region.</div>}
   <strong>Ω &nbsp; OLYMPUS READY</strong><button className="comms-text-action" onClick={()=>setExpanded(!expanded)}>Toggle fixture conversation</button><input aria-label="Synthetic chat input" placeholder="Ask Olympus anything…" readOnly/>
  </div></div></div></section></div></div>
 </main></>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
const wait = (ms = 120) => new Promise(r => setTimeout(r, ms));
async function run() { const checks: string[] = []; const check = (v: unknown, s: string) => { if (!v)
    throw Error(s); checks.push(s); }; const click = (label: string) => { const b = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === label || b.getAttribute('aria-label') === label); if (!b)
    throw Error(`Missing ${label}`); b.click(); }; const fixture = async (value: string) => { const el = document.querySelector<HTMLSelectElement>('[aria-label="Fixture state"]')!; el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); await wait(); [...document.querySelectorAll<HTMLButtonElement>('.comms-primary-tabs button')].find(b=>b.textContent==='Browse email')?.click(); await wait(); }; try {
    await wait(350);
    check(document.querySelector('.comms-inbox')?.closest('[hidden]'),'Email browser hidden behind its own tab by default');
    click('Browse email');await wait();
    check(document.querySelectorAll('.comms-row').length === 40, 'Bounded 40-row list');
    check(document.body.textContent?.includes('53'), 'Source volume remains available');
    check(document.querySelector('.comms-analytics')?.contains(document.querySelector('.comms-intelligence-strip')), 'Raw counts live within Analytics');
    check(analysisCount===0,'Opening Communications never triggers a model call');
    check(document.querySelector('.comms-brief')?.textContent?.includes('OpenAI'),'Model privacy boundary disclosed before analysis');
    check(document.querySelector('.comms-brief h3')?.textContent==='1 thing needs you','Needs-you count excludes uncertainty and background');
    check(document.querySelector('.comms-background summary')?.textContent?.includes('Background'),'Background interpretation remains available');
    check(document.querySelector('.comms-background')?.textContent?.includes('No reply needed'),'No-action next move is source-specific');
    click('Useful');await wait();check(evaluations===1,'Useful feedback is wired');evaluations=0;
    click('Interpretation incorrect');await wait();check(evaluations===1,'Incorrect interpretation feedback is wired');evaluations=0;
    click('This needs me');await wait();check(evaluations===1,'Missed attention feedback is wired');evaluations=0;
    click('Refresh intelligence');await wait();check(analysisCount===1,'Manual analysis trigger');
    click('Inspect analysis');await wait();check(document.querySelector('.comms-run-details')?.textContent?.includes('project-relevance@2'),'Run inspector shows actual node bindings');
    check(document.querySelector('.comms-run-details')?.textContent?.includes('communication-assess@2'),'Registry and graph use the consolidated assessment skill');
    click('Close run details');await wait();
    check(document.querySelector('.comms-brief')?.textContent?.includes('deterministic match'),'Current matching is not presented as a discovery loop');
    click('Review thread →');await wait();check(evaluations===1&&Boolean(document.querySelector('.comms-inspector')),'Opening recommendation records evaluation and source access');
    click('Close thread inspector');await wait();

    click('Next');
    await wait();
    check(document.querySelectorAll('.comms-row').length === 13, 'Second page contains remaining 13');
    click('Attention');
    await wait();
    check(document.querySelectorAll('.comms-row').length === 36, 'Attention counts messages with candidates');
    click('Responses');
    await wait();
    check(document.querySelectorAll('.comms-row').length === 18, 'Responses only uses supported candidates');
    click('Projects');
    await wait();
    check(document.body.textContent?.includes('not approved actions'), 'Project suggestions retain authority boundary');
    document.querySelector<HTMLButtonElement>('.comms-row')!.click();
    await wait();
    check(document.querySelector('.comms-inspector')?.textContent?.includes('message a1'), 'Thread provenance retained');
    check(!document.querySelector('.comms-source script'), 'HTML remains inert source text');
    check(document.body.textContent?.includes('brief.pdf'), 'Attachment metadata visible');
        check(document.activeElement?.getAttribute('aria-label')==='Close thread inspector','Inspector receives keyboard focus');
        let prepared=''; const capture=(event:Event)=>{prepared=(event as CustomEvent).detail.prompt};
        window.addEventListener('olympus:focus-console',capture);
        document.querySelector<HTMLButtonElement>('.comms-inspector .ghost-action')!.click();
        window.removeEventListener('olympus:focus-console',capture);
        check(prepared.includes('[Gmail thread: a1]')&&syncs===0,'Thread question is prepared without sending or syncing');

    click('Close thread inspector');
    await wait();
    check(!document.querySelector('.comms-inspector'), 'Inspector closes');
    click('Search');
    await wait();
    const input = document.querySelector<HTMLInputElement>('[aria-label="Search cached Gmail"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Olympus');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wait();
    document.querySelector('.comms-search')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await wait();
    check(document.querySelectorAll('.comms-row').length === 1, 'Existing cached search is wired');
    click('People');
    await wait();
    check(document.querySelector('[aria-label="Filter sender"]'), 'People has sender filter');
    check(syncs === 0, 'View navigation does not sync or mutate history');
    check(document.body.textContent?.includes('Not enough history'), 'No fabricated comparison');
    click('Gmail connection settings');
    check(settings === 1, 'Connection settings route');
    for (const mode of ['Command', 'Project', 'Research', 'Communications']) {
        click(mode);
        await wait();
        check(document.querySelector(`[role="tab"][aria-selected="true"]`)?.textContent === mode, `${mode} navigation`);
    }
    check(readStoredMode({ getItem: () => 'communications' }) === 'communications', 'Stored Communications mode restores');
    check(document.querySelector('.comms-brief')!.getAnimations({subtree:true}).length===0,'Brief has no continuous motion, including reduced-motion use');
    await fixture('stale');check(document.querySelectorAll('.comms-brief-item').length===0&&document.body.textContent?.includes('out of date'),'Stale brief is withheld');
    await fixture('analysis-failed');check(document.querySelectorAll('.comms-brief-item').length===0&&document.body.textContent?.includes('Run failed'),'Failed run never publishes recommendations');
    await fixture('empty');check(document.querySelector('.comms-brief')?.textContent?.includes('not a whole-mailbox assessment'),'Empty brief preserves scope uncertainty');
    check(document.body.textContent?.includes('No cached messages match'), 'Empty view');
    await fixture('syncing');
    check(document.querySelector<HTMLButtonElement>('[aria-label="Sync Gmail"]')?.disabled, 'Sync busy disables manual trigger');
    await fixture('disconnected');
    check(!document.querySelector('.comms-row') && document.body.textContent?.includes('Open Gmail settings'), 'Disconnected clears mail');
    await fixture('error');
    check(document.querySelector('.comms-diagnostic')?.textContent?.includes('Network unavailable')&&document.querySelectorAll('.comms-row').length>0, 'Sync error preserves useful cache');
    await fixture('limit');
    check(document.querySelector('.comms-diagnostic')?.textContent?.includes('2,000-message'), 'Import cap explains range action');
    await fixture('auth');
    check(document.body.textContent?.includes('Authentication required'), 'Authentication distinct from sync error');
    await fixture('populated');
    click('Toggle narrow study');
    await wait();
    check(document.documentElement.scrollWidth <= innerWidth, 'Narrow study fits viewport');
    const pageScroll=document.querySelector<HTMLElement>('.center-stack')!;
    const analytics=document.querySelector<HTMLDetailsElement>('.comms-analytics')!;
    check(!analytics.open,'Analytics collapsed by default');analytics.open=true;await wait();
    check(getComputedStyle(document.querySelector('.comms-list')!).overflowY==='visible','Message list uses page scrolling without nested scrollbar');
    pageScroll.scrollTop=pageScroll.scrollHeight;await wait();
    const bounds=pageScroll.getBoundingClientRect(), lower=analytics.getBoundingClientRect();
    check(lower.bottom<=bounds.bottom+1,'Expanded lower analytics reachable at bottom of page');
    const chat=document.querySelector('.right-stack')!.getBoundingClientRect();
    check(bounds.bottom<=chat.top,'Persistent chat has a reserved non-overlapping row');
    click('Toggle fixture conversation');await wait();
    check(pageScroll.getBoundingClientRect().bottom<=document.querySelector('.right-stack')!.getBoundingClientRect().top,'Expanded chat does not cover workspace');
    click('Toggle fixture conversation');analytics.open=false;pageScroll.scrollTop=0;
    const strip=document.querySelector('.comms-intelligence-strip')!.getBoundingClientRect();
    check(strip.height<=90,'Intelligence strip fits within 90 pixels');
    check(document.querySelectorAll('.comms-brief-item').length===3,'Brief leads with three supported recommendations');
    check(document.querySelector('.comms-list')?.textContent?.includes('Your rental receipt is ready'),'Clean rental-email preview fixture');

    click('Toggle narrow study');
    await wait();analytics.open=true;pageScroll.scrollTop=pageScroll.scrollHeight;await wait();
    check(analytics.getBoundingClientRect().bottom<=pageScroll.getBoundingClientRect().bottom+1,'Full-width expanded analytics reachable');
    check(pageScroll.getBoundingClientRect().bottom<=document.querySelector('.right-stack')!.getBoundingClientRect().top,'Full-width chat remains outside scroll area');
    analytics.open=false;pageScroll.scrollTop=0;
    document.getElementById('result')!.textContent = `PASS (${checks.length})\n${checks.join('\n')}`;
}
catch (e) {
    document.getElementById('result')!.textContent = `FAIL ${e}\n${checks.join('\n')}`;
} }
if (location.search.includes('run')&&!location.search.includes('fit')&&!location.search.includes('priority='))
    void run();

if(location.search.includes('fit')&&location.search.includes('run')&&!location.search.includes('priority='))void import('./services/situationViewportChecks').then(m=>m.runSituationViewportChecks());

if(location.search.includes('priority=')&&location.search.includes('run'))void import('./services/situationPriorityChecks').then(m=>m.runSituationPriorityChecks());

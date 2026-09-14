import {fixtureDraftCalls,fixtureState} from './situationsFixture';
export async function runSituationPriorityChecks(){
 const wait=()=>new Promise(r=>setTimeout(r,150));let count=0;
 const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);count++};
 const button=(label:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===label||b.getAttribute('aria-label')===label)!;
 try{await new Promise(r=>setTimeout(r,650));const scenario=new URLSearchParams(location.search).get('priority');
 check(document.querySelectorAll('.graph-workstream-card').length===7,'Overview keeps seven workstreams');
 const viewport=document.querySelector('.relationship-viewport')!.getBoundingClientRect();
 check([...document.querySelectorAll('.graph-node')].every(n=>{const r=n.getBoundingClientRect();return r.left>=viewport.left-1&&r.right<=viewport.right+1&&r.top>=viewport.top-1&&r.bottom<=viewport.bottom+1}),'Priority state retains complete initial map fit');
 check(!document.querySelector('.briefing-next-step')?.textContent?.includes('Choose a workstream'),'No navigation-only recommendation');
 check(!document.querySelector('.workstream-tabs button[aria-pressed=true]')?.textContent?.includes('Mortgage'),'Recommendation does not auto-navigate');
 if(scenario==='tied'){check(!document.querySelector('.priority-workstream-link'),'Equal priority has no forced winner');check(document.querySelector('.briefing-next-step')?.textContent?.includes('No single workstream'),'Tie explained');check(document.querySelectorAll('[data-priority="needs-attention"]').length===2,'Both attention workstreams indicated');}
 else if(scenario==='none'){check(!document.querySelector('.priority-workstream-link'),'No invented follow-up');check(!document.querySelector('.graph-priority-mark'),'Stable snapshot has no attention markers');check(document.querySelector('.briefing-next-step')?.textContent?.includes('not a completeness check'),'No-open snapshot preserves limits');}
 else if(scenario==='renovation'){
  check(document.querySelector('.briefing-next-step')?.getAttribute('data-recommended-workstream')==='w0','Resolved Mortgage lets Renovation lead');
  check(document.querySelector('[data-recommended=true]')?.textContent?.includes('Renovation'),'Emphasis follows new target');
  check(document.querySelectorAll('.priority-edge').length===1,'New priority has one corresponding edge');
  button('Open recommended workstream: Renovation').click();await wait();check(document.querySelector('.graph-anchor-content strong')?.textContent==='Renovation','New target navigates');
  button('Whole situation').click();await wait();
 }
 else{
  check(document.querySelector('.briefing-next-step')?.getAttribute('data-recommended-workstream')==='w1','Mortgage recommended from its open record');check(document.querySelectorAll('[data-recommended=true]').length===1,'Only recommended card emphasized');check(document.querySelectorAll('.priority-edge').length===1,'Recommended edge connected');
  check(document.querySelector('[data-priority="stable"]')!==null,'Explicit stable workstream stays neutral');
  if(scenario==='many'){check(document.querySelectorAll('.briefing-unknowns li').length===3,'Many questions remain bounded');const details=document.querySelector<HTMLDetailsElement>('.additional-questions')!;check(!details.open&&details.textContent?.includes('8 additional'),'Additional count exact and collapsed');details.querySelector('summary')!.click();check(details.open&&details.querySelectorAll('li').length===8,'All remaining questions expandable');}
  button('Open recommended workstream: Mortgage').click();await wait();check(document.querySelector('.graph-anchor-content strong')?.textContent==='Mortgage','Recommendation opens workstream');check(document.querySelector('.workstream-tabs button[aria-pressed=true]')?.textContent==='Mortgage','Briefing and scope synchronized');
  check(document.querySelector('.briefing-next-step')?.textContent?.includes('servicing statement'),'Mortgage retains substantive guidance after navigation');
  check(document.querySelector('.graph-actor')!==null&&!!button('View Current servicer unknown'),'Unknown servicer remains distinct');
  button('View Current servicer unknown').click();await wait();check(document.querySelector('.relationship-dossier')?.textContent?.includes('No current servicing statement'),'Unknown status survives dossier selection');button('← Mortgage').click();await wait();
  button('View Example Financial · Mortgage Broker').click();await wait();check(document.querySelector('.dossier-identity')?.textContent?.includes('Jamie Morgan'),'Contextual representative retained');check(!!document.querySelector('.dossier-contacts'),'Contact near dossier identity');check(document.querySelector('.dossier-next')?.textContent?.includes('servicing statement'),'Dossier preserves scoped verification guidance');button('← Mortgage').click();await wait();check(!!document.querySelector('[aria-label="Ongoing briefing"]'),'Dossier back returns to workstream');button('Whole situation').click();await wait();check(document.querySelector('.briefing-next-step')?.getAttribute('data-recommended-workstream')==='w1','Overview recommendation retained');
 }
 check(!!button('Add an update'),'Context-entry action accurately named');const updatesBefore=fixtureState.updates.length;button('Add an update').click();const focusedAfterClick=document.activeElement?.getAttribute('aria-label')==='Situation update';await wait();check(focusedAfterClick,'Add update opens and focuses context form');
 check(!!document.querySelector('[aria-label="Recent situation activity"]'),'Human-readable activity appears above detailed logs');
 check(fixtureState.updates.length===updatesBefore&&fixtureDraftCalls===0,'Opening context form neither saves nor drafts');
 check(![...document.querySelectorAll('button')].some(b=>/^send$/i.test(b.textContent??'')),'Navigation creates no send action');
 document.querySelector('#result')!.textContent=`PASS ${count} priority checks · ${scenario}`;
 }catch(e){document.querySelector('#result')!.textContent='FAIL '+String(e)}
}

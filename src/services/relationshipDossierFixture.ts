import type {SituationContext} from './situations';
import {documentSituationFixture} from './documentSituationFixture';
// All identities, amounts and contacts in this fixture are invented.
export function dossierFixture():SituationContext{
 const c=structuredClone(documentSituationFixture);
 c.entities[0].contacts=['casey@example.invalid','(202) 555-0148','https://renovations.example.invalid','100 Example Lane'];
 c.entities[1].notes='Introduced by the purchasing agent during the inspection period.';
 c.entities[0].notes='Kitchen and flooring work agreed; final scope changes need confirmation.';
 c.facts.push({label:'Agreed contract',text:'Example Renovations: $24,000 agreed. This is not evidence of payment.',status:'documented',workstream:'w0',refs:c.entities[1].refs},{label:'Scope',text:'Example Renovations: kitchen and flooring; bathroom work remains an estimate.',status:'documented',workstream:'w0',refs:c.entities[1].refs});
 const cases=[['inspector','Northstar Inspections','organization','General inspector','Inspection completed; repair follow-up is not established.','w4'],['inspector-person','Jordan Vale','person','General inspector','Inspection completed; repair follow-up is not established.','w4'],['lender','Example Lending','organization','Mortgage lender','Original loan documented; current servicing status unconfirmed.','w1'],['insurer','Example Assurance','organization','Home insurer','Policy documented; renewal not confirmed.','w2'],['utility','Sample Water','organization','Water service','Active service recorded in operator update.','w5'],['hoa','Sample Association','organization','HOA administrator','Current balance unknown.','w3'],['person','Robin Taylor','person','Roofing contact','Estimate received; work completion unknown.','w4'],['history','Example Archive Services','organization','Service provider','Historical relationship; current status unknown.','w6']] as const;
 for(const [id,name,kind,role,status,workstream] of cases)c.entities.push({id,name,kind,role,status,workstream,notes:id==='inspector'?'Earliest documented interaction: inspection report dated 2026-08-01.':id==='history'?'Historical record. '.repeat(100):'The saved engagement defines this role; no additional business terms are recorded.',contacts:id==='lender'?['loans@example.invalid']:[],refs:[{sourceId:'agreement',locator:'Synthetic engagement'}]});
 c.relationships.push({from:'inspector-person',to:'inspector',description:'Jordan represents Northstar Inspections.',refs:[{sourceId:'agreement',locator:'Synthetic signature'}]});
 for(let i=0;i<30;i++){const id='history-'+i;c.sources.push({id,title:`Synthetic record ${i+1}`,path:`Synthetic / record-${i+1}.pdf`,category:'Invented document evidence',sha256:'synthetic'});c.entities.find(e=>e.id==='history')!.refs.push({sourceId:id,locator:'p. 1'});}
 const documents=[
  ['contract-draft','Operator contract draft','docx','operator-created','contract'],
  ['design','Kitchen 3D renderings','zip','received','design'],
  ['quote','Flooring quote','pdf','received','quote'],
  ['invoice','Renovation invoice','pdf','received','invoice']
 ] as const;
 c.sources[0].document={origin:'local',date:'2026-08-02',kind:'contract',description:'Synthetic signed agreement; receipt of payment is not established.'};
 for(const [id,title,type,origin,kind] of documents){c.sources.push({id,title,path:`Synthetic / ${id}.${type}`,sha256:'synthetic',category:'Invented document evidence',document:{origin,kind,date:'2026-08-10',...(origin==='received'?{from:'Example Renovations'}:{})}});c.entities.find(e=>e.id==='company')!.refs.push({sourceId:id,locator:'Synthetic document association'});}
 for(const [id,name,role] of [['supplier','Sample Materials','Materials supplier'],['subcontractor','Example Flooring','Flooring subcontractor']]){c.entities.push({id,name,kind:'organization',role,status:'reported',workstream:'w0',notes:'Synthetic relationship; current work is not verified.',contacts:[],refs:[{sourceId:'quote',locator:'Synthetic proposal'}]});c.relationships.push({from:'company',to:id,description:`Example Renovations may work with ${name} as a ${role.toLowerCase()}.`,refs:[{sourceId:'quote',locator:'Synthetic proposal'}]});}
 for(const entity of c.entities.filter(e=>e.id!=='history').slice(0,9))c.relationships.push({from:'history',to:entity.id,description:`A historical reference names ${entity.name}; the current association is unconfirmed.`,refs:[{sourceId:'history-0',locator:'Synthetic archive index'}]});
 c.milestones=[
 {id:'signed',title:'Remodeling agreement signed',date:'2026-08-02',state:'completed',workstream:'w0',entityIds:['company','casey'],refs:[{sourceId:'agreement',locator:'Synthetic signature'}]},
 {id:'design-received',title:'Kitchen design received',date:'2026-08-10',state:'reported',workstream:'w0',entityIds:['company'],refs:[{sourceId:'design',locator:'Synthetic receipt'}]},
 {id:'quote-received',title:'Flooring quote received',date:'2026-08-14',state:'reported',workstream:'w0',entityIds:['company'],refs:[{sourceId:'quote',locator:'Synthetic receipt'}]},
 {id:'work-started',title:'Work reported started',date:'2026-08-22',state:'reported',workstream:'w0',entityIds:['company'],refs:[{sourceId:'update',locator:'Synthetic operator update'}]},
 {id:'completion',title:'Estimated completion',date:'2026-09-18',state:'planned',workstream:'w0',entityIds:['company'],refs:[{sourceId:'agreement',locator:'Synthetic schedule'}]}
 ];
 return c;
}

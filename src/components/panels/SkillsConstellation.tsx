import {inspectSuperpowers} from '../../services/skillCollections';
import './skillCollection.css';
import type { CapabilitySnapshot } from '../../services/capabilities';
import { inspectArmoryCapability } from '../../services/armoryNavigation';

export function SkillsConstellation({capabilities}:{capabilities:CapabilitySnapshot|null}) {
  const skills=capabilities?.skills??[];
  const shown=skills.slice(0,24);
  const points=shown.map((_,i)=>{const a=i*2.399963,r=20+Math.sqrt(i)*12;return {x:50+Math.cos(a)*r*.65,y:50+Math.sin(a)*r*.65}});
  const edges=shown.flatMap((a,i)=>shown.slice(i+1).flatMap((b,j)=>a.allowedTools.some(id=>b.allowedTools.includes(id))?[{a:points[i],b:points[i+j+1],id:`${a.id}/${b.id}`}]:[])).slice(0,10);
  return <div className="skills-constellation" role="group" aria-label={`Skills constellation: ${skills.length} skills and one reference collection`}>
    <span className="architecture-label">Skills <b>{capabilities?skills.length:'…'}</b><small className="collection-count">+1 collection</small></span>
    <button className="armory-star collection-star" style={{left:"100%",top:"100%"}} aria-label="Inspect collection: Superpowers" onClick={inspectSuperpowers}><span className="armory-star__light"/><span className="armory-star__name">Superpowers<small>Reference collection</small></span></button>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{edges.map(e=><line key={e.id} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}/>)}</svg>
    {skills.slice(0,24).map((skill,i)=>{const a=i*2.399963,r=20+Math.sqrt(i)*12;return <button key={skill.id} className="armory-star" style={{left:`${50+Math.cos(a)*r*.65}%`,top:`${50+Math.sin(a)*r*.65}%`}} aria-label={`Inspect skill: ${skill.name}`} onClick={()=>inspectArmoryCapability(skill)}><span className="armory-star__light"/><span className="armory-star__name">{skill.name}<small>Reusable instructions</small></span></button>})}
  </div>;
}

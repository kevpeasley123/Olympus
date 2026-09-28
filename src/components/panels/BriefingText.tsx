import {useState} from 'react';
import {briefingPreview} from '../../services/briefingPreview';
/** Expand in place: never replace source qualifiers with a generated summary. */
export function BriefingText({text}:{text:string}){
 const [expanded,setExpanded]=useState(false);
 const preview=briefingPreview(text);
 const long=preview!==text;
 return <div className="briefing-text"><p>{long&&!expanded?preview:text}</p>{long&&<button aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'Show less':'Read full context'}</button>}</div>;
}

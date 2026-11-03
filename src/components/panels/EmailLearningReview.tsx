import {useState} from 'react';
import type {EmailLearning,EmailLearningRequest} from '../../services/situations';
import {formatWhen} from '../../services/time';
export function EmailCorrectionForm({initial='',pending,onSave,onCancel}:{initial?:string;pending:boolean;onSave:(text:string)=>Promise<boolean>;onCancel:()=>void}) {
 const [text,setText]=useState(initial);
 return <form className="email-correction" onSubmit={event=>{event.preventDefault();if(text.trim()&&!pending)void onSave(text.trim());}}>
  <label>Your correction<textarea aria-label="Your correction" value={text} maxLength={1000} disabled={pending} onChange={event=>setText(event.target.value)} rows={3}/></label>
  <p>Saved as your context for this email source. It does not verify a claim or change your mailbox.</p>
  <div className="email-attention-actions"><button type="submit" disabled={pending||!text.trim()}>Save correction</button><button type="button" disabled={pending} onClick={onCancel}>Cancel correction</button></div>
 </form>;
}
const labels:Record<EmailLearning['action'],string>={corrected:'Your correction',handled:'Handled for attention; completion not assumed',dismissed:'Dismissed for this source',snoozed:'Snoozed for this source',restored:'Original suggestion restored',forgotten:'Feedback forgotten for this source.'};
export function EmailLearningReview({accountId,records,pending,onChange}:{accountId:string;records:EmailLearning[];pending:boolean;onChange:(request:EmailLearningRequest)=>Promise<boolean>}) {
 const [editing,setEditing]=useState<EmailLearning|null>(null),[forgetting,setForgetting]=useState<EmailLearning|null>(null);
 return <details className="email-learning"><summary>What Olympus learned ({records.length})</summary>
  <p>These are your explicit decisions for individual email sources. They do not establish a general preference. Changed or expired sources stop earlier feedback from applying.</p>
  {!records.length&&<p>No email feedback saved yet.</p>}
  {records.map(record=><article className="email-learning-record" key={record.threadId}>
   <strong>{labels[record.action]}</strong>
   {record.correction&&<p>{record.correction}</p>}
   <small>{record.current?'Matches the cached source':'Source changed or is outside coverage; feedback is not applied'} · {formatWhen(record.updatedAt)}</small>
   {record.sourceForgotten&&record.action!=='forgotten'&&<p>Feedback for the current cached source was forgotten; its suggestion stays hidden.</p>}
   {record.until&&record.action==='snoozed'&&<p>Snoozed until {formatWhen(record.until)}.</p>}
   {record.original&&<details><summary>Original suggestion and source</summary><p>{record.original.title}</p><p>{record.original.action}</p><blockquote>{record.original.quote}</blockquote><small>Generated interpretation of an email claim.</small></details>}
   <div className="email-attention-actions">
    {record.current&&record.action==='corrected'&&<button type="button" disabled={pending} onClick={()=>{setEditing(record);setForgetting(null);}}>Edit correction</button>}
    {record.canUndo&&<button type="button" disabled={pending} onClick={()=>void onChange({accountId,threadId:record.threadId,signature:record.signature,expectedRevision:record.revision,action:'undo'}).then(ok=>{if(ok)setEditing(null);})}>Undo last change</button>}
    {record.action!=='forgotten'&&<button type="button" disabled={pending} onClick={()=>{setForgetting(record);setEditing(null);}}>Forget feedback</button>}
   </div>
   {editing?.threadId===record.threadId&&<EmailCorrectionForm key={editing.revision} initial={editing.correction} pending={pending} onCancel={()=>setEditing(null)} onSave={async text=>{const ok=await onChange({accountId,threadId:editing.threadId,signature:editing.signature,expectedRevision:editing.revision,action:'corrected',text});if(ok)setEditing(null);return ok;}}/>}
   {forgetting?.threadId===record.threadId&&<div role="group" aria-label="Forget feedback confirmation"><p>Delete this feature's saved correction and edit history? This cannot be undone. The suggestion stays hidden for this source revision. Original email and existing chat history remain separately controlled.</p><div className="email-attention-actions"><button type="button" disabled={pending} onClick={()=>setForgetting(null)}>Keep feedback</button><button type="button" disabled={pending} onClick={()=>void onChange({accountId,threadId:forgetting.threadId,signature:forgetting.signature,expectedRevision:forgetting.revision,action:'forget'}).then(ok=>{if(ok)setForgetting(null);})}>Forget permanently</button></div></div>}
  </article>)}
 </details>;
}

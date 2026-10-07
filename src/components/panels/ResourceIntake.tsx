import { invoke } from "@tauri-apps/api/core";
import { FilePlus2, Plus, Upload, X, FileText } from "lucide-react";
import { useEffect,useRef,useState } from "react";
import { Modal } from "../Modal";
import { usePantheon } from "../../hooks/usePantheon";
import { isTauriRuntime } from "../../services/launcher";
import { openResearchEntry } from "../../services/navigation";
import { INTAKE_CHANGED,outlineResource,resourceBody,resourceSkills,saveResourceSkill,saveResource,previewResources,type ResourceSkill,type ResourceOutline,type SavedResource } from "../../services/resourceIntake";
import "./resourceIntake.css";
let sessionDraft:{title:string;source:string;url:string;notes:string;skillName:string;instructions:string;skillId:string;outline:ResourceOutline|null;attachment:{token:string;name:string;saved:string|null}|null}={title:"",source:"",url:"",notes:"",skillName:"",instructions:"",skillId:"",outline:null,attachment:null};
export function ResourceIntake(){
 const desktop=isTauriRuntime(),library=usePantheon();
 const [mode,setMode]=useState<"resource"|"skill"|"saved"|null>(null),[title,setTitle]=useState(sessionDraft.title),[source,setSource]=useState(sessionDraft.source),[url,setUrl]=useState(sessionDraft.url),[notes,setNotes]=useState(sessionDraft.notes);
 const [skillName,setSkillName]=useState(sessionDraft.skillName),[instructions,setInstructions]=useState(sessionDraft.instructions),[skills,setSkills]=useState<ResourceSkill[]>([]),[skillId,setSkillId]=useState(sessionDraft.skillId);
 const [outline,setOutline]=useState<ResourceOutline|null>(sessionDraft.outline),[error,setError]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const [attachment,setAttachment]=useState<{token:string;name:string;saved:string|null}|null>(sessionDraft.attachment),[preview,setPreview]=useState<SavedResource[]>(previewResources),[selected,setSelected]=useState<SavedResource|null>(null);
 const file=useRef<HTMLInputElement>(null),outlineView=useRef<HTMLElement>(null);
 useEffect(()=>{if(outline)outlineView.current?.scrollIntoView({block:"start",behavior:"instant"})},[outline]);
 useEffect(()=>{sessionDraft={title,source,url,notes,skillName,instructions,skillId,outline,attachment}},[title,source,url,notes,skillName,instructions,skillId,outline,attachment]);
 useEffect(()=>{let alive=true;const read=()=>{void resourceSkills().then(s=>{if(alive)setSkills(s)}).catch(e=>{if(alive)setError(String(e))});setPreview(previewResources())};read();window.addEventListener(INTAKE_CHANGED,read);return()=>{alive=false;window.removeEventListener(INTAKE_CHANGED,read)}},[]);
 const recent=desktop?library.entries.filter(e=>e.tags.includes("resource-capture")).slice(0,3).map(e=>({id:e.id,title:e.title,body:e.body,sourceFile:e.sourceFile,createdAt:e.fileModifiedAt})):preview.slice(0,3);
 function open(next:"resource"|"skill"){setMode(next);setError("");setNotice("")}
 async function choose(){setError("");if(!desktop){file.current?.click();return}setBusy(true);try{const picked=await invoke<{token:string;fileName:string}|null>("pick_attachment_file");if(!picked)return;const text=await invoke<string>("extract_resource_text",{token:picked.token});if(mode==="skill"){setInstructions(text);if(!skillName)setSkillName(picked.fileName.replace(/\.[^.]+$/,""))}else{setSource(text);setOutline(null);setAttachment({token:picked.token,name:picked.fileName,saved:null});if(!title)setTitle(picked.fileName.replace(/\.[^.]+$/,""))}}catch(e){setError(String(e))}finally{setBusy(false)}}
 async function readFile(f:File|undefined){if(!f)return;setError("");try{if(!/\.(md|txt)$/i.test(f.name))throw Error("Browser preview supports Markdown and text; use desktop for PDF.");if(f.size>180000)throw Error("Use a file smaller than 180 KB.");const text=await f.text();if(mode==="skill"){setInstructions(text);if(!skillName)setSkillName(f.name.replace(/\.[^.]+$/,""))}else{setSource(text);setOutline(null);setAttachment(null);if(!title)setTitle(f.name.replace(/\.[^.]+$/,""))}}catch(e){setError(String(e))}}
 async function save(){if(busy)return;setBusy(true);setError("");try{if(mode==="skill"){const s=await saveResourceSkill(skillName,instructions);setSkillId(s.id);setSkillName("");setInstructions("");setNotice(`Added ${s.name}`);setMode(null);return}if(!outline||!title.trim())throw Error("Add a title and build the outline first.");if(url&&!/^https?:\/\//i.test(url))throw Error("Source URL must start with https:// or http://.");let path=attachment?.saved??null;if(attachment&&!path){path=await invoke<string>("save_attachment_to_vault",{token:attachment.token});setAttachment({...attachment,saved:path})}await saveResource(title.trim(),resourceBody(source,outline,skills.find(s=>s.id===skillId),notes),url,path);if(desktop)await library.refresh();setTitle("");setSource("");setUrl("");setNotes("");setOutline(null);setAttachment(null);setNotice("Resource saved to the library");setMode(null)}catch(e){setError(String(e))}finally{setBusy(false)}}
 return <section className="resource-intake" aria-label="Add to Olympus">
  <div className="resource-intake__actions"><button onClick={()=>open("resource")}><FilePlus2 size={14}/>Add resource</button><button onClick={()=>open("skill")}><Plus size={14}/>Add skill</button></div>
  {notice&&<p role="status">{notice}</p>}
  {recent.length>0&&<div className="resource-recent"><span>Resources</span>{recent.map(r=><button key={r.id} onClick={()=>{if(desktop)openResearchEntry({sourceFile:r.sourceFile});else{setSelected(r);setMode("saved")}}}><FileText size={12}/>{r.title}</button>)}</div>}
  <Modal open={mode!==null} onClose={()=>{if(!busy)setMode(null)}} title={mode==="skill"?"Add skill":mode==="saved"?selected?.title??"Resource":"Add resource"} className="resource-dialog">
   <div className="resource-form">
    {!desktop&&<p className="resource-notice">Browser preview · saved only in this browser</p>}
    {mode==="saved"?<pre>{selected?.body}</pre>:<>
     <div className="resource-form__toolbar"><button onClick={choose} disabled={busy}><Upload size={14}/>{mode==="skill"?"Import instructions":"Upload document"}</button><small>{desktop?"PDF, Markdown or text":"Markdown or text"}</small></div>
     <input ref={file} type="file" accept=".txt,.md" hidden onChange={e=>{void readFile(e.target.files?.[0]);e.target.value=""}}/>
     <label>{mode==="skill"?"Skill name":"Title"}<input aria-label={mode==="skill"?"Skill name":"Title"} value={mode==="skill"?skillName:title} maxLength={160} disabled={busy} onChange={e=>mode==="skill"?setSkillName(e.target.value):setTitle(e.target.value)}/></label>
     {mode==="skill"?<><label>Instructions<textarea aria-label="Instructions" value={instructions} disabled={busy} rows={10} onChange={e=>setInstructions(e.target.value)} placeholder="Describe what to look for, how to assess it, and the desired output."/></label><p className="resource-notice">Reusable review guidance. Importing instructions does not install code, tools, or an executable agent.</p></>:<>
      <label>Source text<textarea aria-label="Source text" value={source} disabled={busy} rows={8} onChange={e=>{setSource(e.target.value);setOutline(null)}} placeholder="Paste the article or document here."/></label>
      {attachment&&<p>{attachment.name} <button disabled={busy} onClick={()=>setAttachment(null)} aria-label="Remove attachment"><X size={12}/></button></p>}
      <label>Source URL (optional)<input aria-label="Source URL (optional)" value={url} disabled={busy} onChange={e=>setUrl(e.target.value)} placeholder="https://"/></label>
      <label>Review skill<select aria-label="Review skill" value={skillId} disabled={busy} onChange={e=>setSkillId(e.target.value)}><option value="">No additional guidance</option>{skills.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      {skillId&&<details><summary>Selected review guidance</summary><p className="resource-guidance">{skills.find(s=>s.id===skillId)?.instructions}</p></details>}
      <button disabled={busy||!source.trim()} onClick={()=>{try{setOutline(outlineResource(source));setError("")}catch(e){setError(String(e))}}}>Build local outline</button>
      {outline&&<section ref={outlineView} className="resource-outline"><h3>Local outline</h3><p>{outline.wordCount.toLocaleString()} words · selected excerpts, not AI conclusions</p>{outline.headings.length>0&&<details><summary>Document structure</summary><ul>{outline.headings.map((h,i)=><li key={i}>{h}</li>)}</ul></details>}{outline.passages.map((s,i)=><blockquote key={i}>{s}</blockquote>)}<label>Your review notes<textarea aria-label="Your review notes" rows={3} value={notes} disabled={busy} onChange={e=>setNotes(e.target.value)}/></label></section>}
     </>}
     {error&&<p role="alert" className="resource-error">{error}</p>}
     <footer><button disabled={busy} onClick={()=>setMode(null)}>Close · keep draft</button><button disabled={busy||(mode==="skill"? !skillName.trim()||!instructions.trim():!title.trim()||!outline)} onClick={()=>void save()}>{busy?"Saving…":mode==="skill"?"Add skill":"Save resource"}</button></footer>
    </>}
   </div>
  </Modal>
 </section>;
}

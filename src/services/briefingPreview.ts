/// <reference lib="es2022.intl" />
/** A source excerpt, never a generated summary or a clipped sentence. */
export function briefingPreview(text:string):string {
 if(text.length<=210)return text;
 const sentences=Array.from(new Intl.Segmenter('en',{granularity:'sentence'}).segment(text),s=>s.segment.trim());
 const kept:string[]=[];
 for(const sentence of sentences){
  if(kept.length===2||[...kept,sentence].join(' ').length>300)break;
  kept.push(sentence);
 }
 return kept.length?kept.join(' '):'Read the full context for the recorded details and qualifications.';
}

/** Whole-word labels with a deterministic two-line budget; full names remain in titles. */
export function mapName(name:string,columns=22):string{
 const words=name.trim().split(/\s+/),lines:string[]=[];let line='';
 if(words.some(word=>word.length>columns))return 'Full name in details';
 for(let i=0;i<words.length;i++){
  const word=words[i];
  if(word.length>columns)return lines.concat(line).filter(Boolean).join('\n')+'\nName in details';
  if((line+' '+word).trim().length>columns){lines.push(line);line='';if(lines.length===2)return lines[0]+'\n'+lines[1].replace(/\s+\S+$/,'')+' …';}
  line=(line+' '+word).trim();
 }
 return [...lines,line].filter(Boolean).join('\n');
}


/**
 * The anchor's label: at most two whole-word lines, a trailing ellipsis when
 * the title is longer, and an over-long word cut rather than replaced — the
 * full title is always in the heading above the map and the tooltip.
 */
export function mapAnchorLabel(title:string,columns=14):string{
 const words=title.trim().split(/\s+/).map(w=>w.length>columns?w.slice(0,columns-1)+'…':w),lines:string[]=[];let line='';
 for(const word of words){
  const next=(line+' '+word).trim();
  if(next.length>columns&&line){lines.push(line);line=word;if(lines.length===2)return lines[0]+'\n'+lines[1].slice(0,columns-2).replace(/[\s·,;:—-]+$/,'')+' …';}
  else line=next;
 }
 return [...lines,line].filter(Boolean).slice(0,2).join('\n');
}

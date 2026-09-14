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


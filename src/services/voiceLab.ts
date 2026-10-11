import {cancelEleven,speechUrl,synthesizeEleven,type ElevenAudio,type ElevenRequest} from './elevenSpeech';

export const validLabText=(text:string)=>text.trim().length>0&&Array.from(text).length<=200&&text.trim().split(/\s+/u).length<=5;
type Input={text:string;voiceId:string;modelId:string};
type Snapshot={phase:'idle'|'generating'|'playing'|'ready'|'error';canReplay:boolean;error:string|null;generationMs:number|null};
type Dependencies={synthesize:(request:ElevenRequest)=>Promise<ElevenAudio>;cancel:(id:string)=>Promise<unknown>;audio:()=>HTMLAudioElement;url:(audio:ElevenAudio)=>string;revoke:(url:string)=>void};
/** Audition only: no microphone, reasoning or OpenAI connection. Audio stays in memory. */
export class VoiceLab {
  private state:Snapshot={phase:'idle',canReplay:false,error:null,generationMs:null};
  private listeners=new Set<()=>void>();
  private generation=0;private request:string|null=null;private audio:HTMLAudioElement|null=null;private url:string|null=null;
  constructor(private deps:Dependencies={synthesize:synthesizeEleven,cancel:cancelEleven,audio:()=>new Audio(),url:speechUrl,revoke:URL.revokeObjectURL}){}
  subscribe=(callback:()=>void)=>{this.listeners.add(callback);return()=>{this.listeners.delete(callback);};};
  getSnapshot=()=>this.state;
  private patch(value:Partial<Snapshot>){this.state={...this.state,...value};this.listeners.forEach(fn=>fn());}
  stop(){++this.generation;if(this.request)void this.deps.cancel(this.request).catch(()=>{});this.request=null;this.audio?.pause();this.patch({phase:this.url?'ready':'idle'});}
  dispose(){this.stop();if(this.audio){this.audio.onended=null;this.audio.onerror=null;this.audio.removeAttribute('src');this.audio.load();this.audio=null;}if(this.url)this.deps.revoke(this.url);this.url=null;this.patch({canReplay:false,generationMs:null,error:null});}
  async generate(input:Input){
    if(this.state.phase==='generating')return;
    if(!validLabText(input.text)){this.patch({phase:'error',error:'Use one to five words, up to 200 characters.'});return;}
    this.dispose();const generation=++this.generation;const id=`lab-${crypto.randomUUID()}`;this.request=id;const started=performance.now();
    this.patch({phase:'generating',error:null});
    try{
      const result=await this.deps.synthesize({...input,requestId:id,preview:true,lab:true});
      if(generation!==this.generation)return;
      this.request=null;this.url=this.deps.url(result);this.audio=this.deps.audio();this.audio.src=this.url;
      this.audio.onended=()=>this.patch({phase:'ready'});
      this.audio.onerror=()=>this.patch({phase:'error',error:'Audio could not play. Replay uses the saved audio without another generation.'});
      this.patch({canReplay:true,generationMs:Math.round(performance.now()-started)});await this.replay();
    }catch(error){if(generation===this.generation){this.request=null;this.patch({phase:'error',error:error instanceof Error?error.message:String(error)});}}
  }
  async replay(){
    if(!this.audio||!this.url)return;
    const generation=this.generation;this.audio.currentTime=0;this.patch({phase:'playing',error:null});
    try{await this.audio.play();}catch{if(generation===this.generation)this.patch({phase:'error',error:'Playback was blocked. Press Replay to try the saved audio.'});}
  }
}

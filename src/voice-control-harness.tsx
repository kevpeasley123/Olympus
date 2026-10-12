import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {SpokenRepliesControl} from './components/panels/SpokenRepliesControl';
import {VoiceConversationControl} from './components/panels/VoiceConversationControl';
import type {VoiceSnapshot} from './services/realtimeVoice';
import './styles.css';
const off:VoiceSnapshot={phase:'IDLE',active:false,connecting:false,microphoneOn:false,microphoneCapturing:false,muted:false,captionsEnabled:true,inputText:'',outputText:'',error:null,level:0,failures:0,retryable:false};
function Fixture(){
 const [voice,setVoice]=useState(off);
 const [spoken,setSpoken]=useState(false);
 return <main style={{padding:40,background:'#07121a',minHeight:'100vh'}}><h1>Synthetic voice control · no microphone or API</h1><div className="pantheon-caption" style={{position:'static'}}><SpokenRepliesControl enabled={spoken} voice={voice} ready onToggle={()=>setSpoken(!spoken)}/><VoiceConversationControl voice={voice} ready onToggle={()=>setVoice(voice.microphoneOn?off:{...off,connecting:true,microphoneOn:true})}/></div><button onClick={()=>setVoice({...off,active:true,microphoneOn:true,microphoneCapturing:true,phase:'LISTENING',level:.6})}>Simulate connected</button><button onClick={()=>setVoice({...off,active:true,microphoneOn:true,microphoneCapturing:false,phase:'SPEAKING'})}>Simulate paused microphone</button><button onClick={()=>setVoice({...off,phase:'ERROR',error:'Fixture permission denied'})}>Simulate failure</button></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);

import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {VoiceSettings} from './components/panels/VoiceSettings';
import {DEFAULT_VOICE_PREFERENCES,type VoicePreferences} from './services/voicePreferences';
import './styles.css';
function Fixture(){const [settings,setSettings]=useState<VoicePreferences>({...DEFAULT_VOICE_PREFERENCES,speechProvider:'elevenlabs' as const});return <main style={{maxWidth:460,margin:'20px auto',padding:20,background:'#08151e'}}><h2>Synthetic Voice Lab</h2><p>No provider requests or microphone.</p><VoiceSettings preferences={settings} onChange={patch=>setSettings({...settings,...patch})}/></main>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);

import {mockIPC} from "@tauri-apps/api/mocks";
import {createRoot} from "react-dom/client";
import {ModelRouteControl,ModelDiagnostics,ModelAttribution} from "./components/panels/ModelSettings";
import {consumeNextModel,selectNextModel,loadModelCatalog,resetModelSelection,saveModelSelection,type ModelCatalog,type ModelRequest} from "./services/modelRouting";
import fixture from "./services/modelCatalogFixture.json";
import "./styles.css";
let failSave=false;
const catalog:ModelCatalog=JSON.parse(JSON.stringify(fixture));
catalog.routes[0].label="Primary fixture";
catalog.routes[1].label="Future model fixture";
catalog.routes[2].available=false;catalog.routes[2].unavailableReason="Provider not configured";
if(new URLSearchParams(location.search).has("restore"))catalog.selection={capability:"DEEP_REASONING",scope:"chat"};
if(new URLSearchParams(location.search).has("default"))catalog.defaultCapability="DEEP_REASONING";
const saved:Array<unknown>=[];
mockIPC((command,args)=>{
 if(command==="model_routes")return catalog;
 if(command==="save_model_selection"){if(failSave)throw Error('Cannot save fixture');saved.push(args);return null;}
 if(command==="model_diagnostics")return [record];
 throw Error(`Unexpected command ${command}`);
});
const record:ModelRequest={id:"fixture-record",provider:"fixture-provider",requestedModel:"requested-fixture",actualModel:"actual-fixture-snapshot",capability:"PRIMARY",purpose:"command",status:"completed",latencyMs:123,firstTokenMs:30,requestedAt:new Date().toISOString(),reasoningEffort:"medium",fallbackFrom:null,escalationReason:null,usage:null,errorCode:null};
createRoot(document.getElementById("root")!).render(<main style={{position:'fixed',right:8,bottom:8,width:'min(330px, calc(100vw - 16px))',overflow:'hidden',background:'#09151f',padding:12,boxSizing:'border-box'}}><output id="result">Ready</output><ModelAttribution request={record}/><ModelAttribution request={{...record,id:'unknown',actualModel:null}}/><ModelRouteControl/><button id="outside">Outside control</button><ModelDiagnostics/></main>);
Object.assign(window,{pickerTest:{consume:consumeNextModel,select:selectNextModel,reset:resetModelSelection,save:saveModelSelection,refresh:loadModelCatalog,saved,failSave:(v:boolean)=>{failSave=v;}}});

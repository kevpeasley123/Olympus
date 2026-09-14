const frame=document.querySelector<HTMLIFrameElement>('#preview')!,size=document.querySelector<HTMLSelectElement>('#size')!;
let polling:ReturnType<typeof setInterval>|undefined;
function run(){if(polling)clearInterval(polling);const [width,height]=size.value.split('x').map(Number);frame.width=String(width);frame.height=String(height);const scale=Math.min(1,(innerWidth-8)/width,(innerHeight-70)/height);frame.style.transform=`scale(${scale})`;document.querySelector<HTMLElement>('#frame-box')!.style.height=`${height*scale}px`;document.querySelector('#result')!.textContent=' Running…';const suite=document.querySelector<HTMLSelectElement>('#suite')!.value;
 const urls:Record<string,string>={Viewport:'/communications-harness.html?navigator&fit&run',Communications:'/communications-harness.html?navigator&run',Situations:'/situations-harness.html?run',Gmail:'/gmail-harness.html?run',Navigator:'/situations-harness.html?navigator&run'};
 let loaded=false;frame.onload=()=>{loaded=true};
 frame.src=urls[suite]+(document.querySelector<HTMLInputElement>('#errors')!.checked?'&errors&long':'')+(document.querySelector<HTMLInputElement>('#chat')!.checked?'&expanded':'')+(document.querySelector<HTMLInputElement>('#reduced')!.checked?'&reduced':'');
 let attempts=0;polling=setInterval(()=>{if(!loaded)return;const value=frame.contentDocument?.querySelector('#result')?.textContent??'';if(value.startsWith('PASS')||value.startsWith('FAIL')){document.querySelector('#result')!.textContent=' '+value.split('\n')[0];clearInterval(polling)}else if(++attempts>100){document.querySelector('#result')!.textContent=' Timed out waiting for harness';clearInterval(polling)}},250);}
document.querySelector('#reload')!.addEventListener('click',run);
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.kind!=='olympus-viewport-result')return;document.querySelector('#result')!.textContent=' '+event.data.result});
run();

document.querySelector<HTMLButtonElement>('#matrix-run')!.addEventListener('click',async()=>{
 const trigger=document.querySelector<HTMLButtonElement>('#matrix-run')!,output=document.querySelector('#matrix-results')!;trigger.disabled=true;
 const cases=[
 ['Clear priority',1755,950,'communications-harness.html?navigator&fit&run&priority=clear'],
 ['Renovation priority',1755,950,'communications-harness.html?navigator&fit&run&priority=renovation'],
 ['Equal priorities',1755,950,'communications-harness.html?navigator&fit&run&priority=tied'],
 ['Stable snapshot',1755,950,'communications-harness.html?navigator&fit&run&priority=none'],
 ['Many open questions',1755,950,'communications-harness.html?navigator&fit&run&priority=many'],
 ['Relationship dossier',1920,1080,'relationship-dossier-harness.html?run'],
 ['Wide overview',1755,950,'communications-harness.html?navigator&fit&run'],
 ['Wide errors / expanded chat / reduced motion',1755,950,'communications-harness.html?navigator&fit&run&errors&long&expanded&reduced'],
 ['1080p overview',1920,1080,'communications-harness.html?navigator&fit&run'],
 ['Narrow desktop stress',1280,900,'communications-harness.html?navigator&fit&run&errors&long&expanded&reduced'],
 ['Short desktop',1280,720,'communications-harness.html?navigator&fit&run'],
 ['Communications regression',1920,1080,'communications-harness.html?navigator&run'],
 ['Situations regression',1920,1080,'situations-harness.html?run'],
 ['Gmail regression',1920,1080,'gmail-harness.html?run'],
 ['Navigator regression',1920,1080,'situations-harness.html?navigator&run'],
 ['Reduced-motion navigator',1920,1080,'situations-harness.html?navigator&reduced&run']
 ] as const;
 const results=cases.map(c=>c[0]+': running');const render=()=>{output.textContent=results.join('\n')};render();
 await Promise.all(cases.map(([name,width,height,url],index)=>new Promise<void>(resolve=>{
 const test=document.createElement('iframe');test.title=name;test.width=String(width);test.height=String(height);test.style.cssText='position:fixed;left:-10000px;top:0;border:0;';
 let loaded=false;test.onload=()=>{loaded=true};test.src='/'+url;document.body.append(test);const start=Date.now();
 const poll=setInterval(()=>{const value=loaded?(test.contentDocument?.querySelector('#result')?.textContent??''):'';if(value.startsWith('PASS')||value.startsWith('FAIL')||Date.now()-start>60000){results[index]=name+': '+(value.split('\n')[0]||'TIMEOUT');clearInterval(poll);test.remove();render();resolve()}},250);
 })));
 trigger.disabled=false;
});

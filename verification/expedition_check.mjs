// Browser check of the sea expedition page (expedition.html) in four set-ups, headless Chrome via DevTools (no deps):
// desktop 1440x900 (WebGL through SwiftShader), phone 390x844 with touch, reduced motion, and WebGL disabled.
// Flow per set-up: start → sail to 3 stops → 4 discovery steps → detail open/close → '지도에서 보기' selects the species.
// Usage: node verification/expedition_check.mjs <output-directory>   (site served at URL0, default http://127.0.0.1:8765/)
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import {fileURLToPath} from 'node:url';
const OUT=process.argv[2];
if(!OUT)throw Error('Usage: node verification/expedition_check.mjs <output-directory>');
fs.mkdirSync(OUT,{recursive:true});
const DIST=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','dist');
const stops=JSON.parse(fs.readFileSync(path.join(DIST,'expedition-stops.json'),'utf8')).stops;
const URL0=process.env.URL0||'http://127.0.0.1:8765/';
const chromePath=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'google-chrome');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const results=[];
const check=(name,ok,detail='')=>{results.push({name,status:ok?'PASS':'FAIL',detail:String(detail).slice(0,600)});console.log(`${ok?'PASS':'FAIL'} ${name}${ok?'':' :: '+String(detail).slice(0,300)}`);};

async function session(flags){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cdp-'));
  const chrome=spawn(chromePath,['--headless=new','--remote-debugging-port=0','--no-first-run','--user-data-dir='+profile,...flags,'about:blank'],{stdio:['ignore','ignore','pipe']});
  let wsUrl;
  for(let i=0;i<300&&!wsUrl;i++){
    try{const port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0]);
      const t=await (await fetch(`http://127.0.0.1:${port}/json`,{signal:AbortSignal.timeout(2000)})).json();wsUrl=t.find(x=>x.type==='page')?.webSocketDebuggerUrl;}catch{}
    if(!wsUrl)await sleep(200);
  }
  if(!wsUrl)throw Error('Chrome DevTools endpoint timeout');
  const ws=new WebSocket(wsUrl);await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let id=0;const pending=new Map(),errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.rej(Error(m.error.message)):p.res(m.result);}
    if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
    if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value??a.description).join(' '));
  };
  const send=(method,params={})=>new Promise((res,rej)=>{const i=++id;pending.set(i,{res,rej});ws.send(JSON.stringify({id:i,method,params}));setTimeout(()=>{if(pending.has(i)){pending.delete(i);rej(Error(method+' timeout'));}},30000);});
  const evaluate=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,300));return r.result.value;};
  await send('Page.enable');await send('Runtime.enable');
  const close=async()=>{ws.close();chrome.kill();await sleep(500);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}catch{}};
  return {send,evaluate,errors,close};
}
async function waitFor(s,expr,timeout=30000){
  const end=Date.now()+timeout;let v;
  do{v=await s.evaluate(expr).catch(()=>null);if(v)return v;await sleep(150);}while(Date.now()<end);
  return v;
}
const shot=async(s,name)=>{const r=await s.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from(r.data,'base64'));};
const cardName="(document.querySelector('#stop-card:not([hidden]) .x-name')?.textContent||'')";
const level="(Number(document.querySelector('#stop-card:not([hidden]) .x-card')?.dataset.level||0))";
const key=async(s,k,code)=>{for(const type of ['keyDown','keyUp'])await s.send('Input.dispatchKeyEvent',{type,key:k,code:code||k,windowsVirtualKeyCode:{ArrowRight:39,ArrowLeft:37,Escape:27,Enter:13}[k],...(k==='Enter'&&type==='keyDown'?{text:String.fromCharCode(13)}:{})});};

async function run(tag,{flags=[],width,height,mobile=false,reduced=false,webgl=true}){
  const s=await session(flags);
  try{
    await s.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
    if(mobile)await s.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
    if(reduced)await s.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await s.send('Page.navigate',{url:URL0+'expedition.html'});
    await waitFor(s,"document.readyState==='complete'&&!document.body.classList.contains('is-loading')");
    const note=await s.evaluate("(()=>{const e=document.getElementById('route-note');const r=e.getBoundingClientRect();return getComputedStyle(e).display!=='none'&&r.width>0&&r.bottom<=innerHeight?e.textContent:''})()");
    check(`${tag}: route disclaimer always visible`,note.includes('연출용 항로')&&note.includes('실제 조사 항로나 선박 위치가 아님'),note);
    const ov=await s.evaluate("({doc:document.documentElement.scrollWidth,vw:innerWidth})");
    check(`${tag}: no horizontal overflow`,ov.doc<=ov.vw,JSON.stringify(ov));
    if(!webgl){
      const cards=await s.evaluate("({cards:document.body.classList.contains('is-cards'),n:document.querySelectorAll('#cards-list .x-card').length,reason:document.getElementById('cards-reason').textContent,maps:[...document.querySelectorAll('#cards-list a.x-ghost')].map(a=>a.getAttribute('href'))})");
      check(`${tag}: WebGL failure falls back to the card list with every stop and map link`,cards.cards&&cards.n===stops.length&&cards.reason.includes('카드 목록')&&stops.every((st,i)=>cards.maps[i]===st.map_link),JSON.stringify(cards));
      await shot(s,`${tag}-cards`);
      await s.evaluate("document.querySelector('#cards-list [data-detail=\"2\"]').click()");
      const d=await waitFor(s,"document.getElementById('detail').open&&document.getElementById('detail-body').textContent");
      check(`${tag}: detail opens from a card (해삼 zinc shown as 자료 없음, not 0)`,d&&d.includes('해삼')&&/아연자료없음/.test(d.replace(/\s/g,'')),String(d).slice(0,200));
      await shot(s,`${tag}-detail`);
      await key(s,'Escape');
      check(`${tag}: Esc closes the detail`,!(await s.evaluate("document.getElementById('detail').open")));
    }else{
      const intro=await s.evaluate("!document.getElementById('intro').hidden&&!document.body.classList.contains('is-cards')");
      check(`${tag}: 3D sea with intro screen`,intro);
      await sleep(reduced?300:1500);await shot(s,`${tag}-1-intro`);
      if(mobile){
        await s.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width/2,y:height*.5}]});await s.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await s.evaluate("document.getElementById('start').click()");
      }else await s.evaluate("document.getElementById('start').focus()").then(()=>key(s,'Enter'));
      if(!reduced){await sleep(1800);await shot(s,`${tag}-2-sailing`);}
      const n1=await waitFor(s,`${cardName}===${JSON.stringify(stops[0].korean_name)}&&${level}>=1`,40000);
      check(`${tag}: arrives at stop 1 (${stops[0].korean_name})`,!!n1);
      const lv1=await s.evaluate(level);
      await shot(s,`${tag}-3-stop1-step${lv1}`);
      const lv=await waitFor(s,`${level}>=3&&${level}`,8000);
      check(`${tag}: discovery steps reach 3 (sea area → species → values)`,lv>=3,`first level ${lv1}`);
      if(reduced)check(`${tag}: reduced motion shows every step at once`,lv1>=3,`first level ${lv1}`);
      await shot(s,`${tag}-4-stop1-values`);
      await s.evaluate("document.querySelector('#stop-card [data-detail]').focus()");
      await s.evaluate("document.querySelector('#stop-card [data-detail]').click()");
      const det=await waitFor(s,"document.getElementById('detail').open&&document.getElementById('detail-body').textContent");
      check(`${tag}: detail has observation, food, bioactivity, conservation and DOI links`,['관측 위치·기간','식량 가치 근거','생리활성 근거','보전 평가 근거','원논문 DOI'].every(t=>det?.includes(t)),String(det).slice(0,200));
      await shot(s,`${tag}-5-detail`);
      const before=await s.evaluate("location.hash");
      await sleep(2500);
      const still=await s.evaluate("({hash:location.hash,open:document.getElementById('detail').open})");
      check(`${tag}: no automatic sailing while the detail is open`,still.open&&still.hash===before,JSON.stringify(still));
      await key(s,'Escape');await sleep(300);
      const after=await s.evaluate("({open:document.getElementById('detail').open,focus:document.activeElement?.dataset?.detail})");
      check(`${tag}: Esc closes the detail and focus returns to 자세히 보기`,!after.open&&after.focus==='0',JSON.stringify(after));
      // fast double move: the ship must end at stop 3 with stop 3's card, not an intermediate one
      if(mobile){
        for(let i=0;i<2;i++){await s.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width/2,y:height*.3}]});await s.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:width/2,y:height*.1}]});await s.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
        // headless touch on a canvas may not reach the page; the buttons are the same path
        if(!(await s.evaluate("location.hash==='#stop=3'||location.hash==='#stop=2'")))await s.evaluate("document.getElementById('next').click();document.getElementById('next').click()");
        if(await s.evaluate("location.hash==='#stop=2'"))await s.evaluate("document.getElementById('next').click()");
      }else{await key(s,'ArrowRight');await key(s,'ArrowRight');}
      const hash3=await s.evaluate("location.hash");
      check(`${tag}: two quick moves target stop 3 in the URL`,hash3==='#stop=3',hash3);
      const n3=await waitFor(s,`${cardName}===${JSON.stringify(stops[2].korean_name)}`,60000);
      check(`${tag}: arrives at stop 3 (${stops[2].korean_name}) with its own card`,!!n3,await s.evaluate(cardName));
      await waitFor(s,`${level}>=3`,8000);await shot(s,`${tag}-6-stop3`);
      // back to stop 1: the steps already seen stay (level 4 = detail read), no replay from step 1
      await s.evaluate("document.querySelector('#progress [data-go=\"0\"]').click()");
      const back=await waitFor(s,`${cardName}===${JSON.stringify(stops[0].korean_name)}&&${level}`,60000);
      check(`${tag}: revisiting stop 1 keeps the discovery state (detail read)`,back===4,`level ${back}`);
      await shot(s,`${tag}-7-stop1-revisit`);
      if(!mobile&&!reduced){
        const fps=await s.evaluate("new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++;performance.now()-t0<3000?requestAnimationFrame(f):r(Math.round(n/((performance.now()-t0)/1000)))};requestAnimationFrame(f);})");
        const bytes=await s.evaluate("performance.getEntriesByType('resource').concat(performance.getEntriesByType('navigation')).reduce((a,e)=>a+(e.encodedBodySize||0),0)");
        check(`${tag}: frame rate and first-load size recorded`,fps>0&&bytes>0,`${fps} fps (headless SwiftShader) · ${(bytes/1024).toFixed(0)} KB encoded`);
      }
    }
    // '지도에서 보기' opens the existing map with this species selected
    const st=webgl?stops[0]:stops[2];
    const href=await s.evaluate(webgl?"document.querySelector('#stop-card a.x-ghost').getAttribute('href')":"document.querySelectorAll('#cards-list a.x-ghost')[2].getAttribute('href')");
    check(`${tag}: map link uses the existing hash format`,href===st.map_link&&/^index\.html#s=\d+&v=explore&m=\d+\/-?\d+\.\d\d\/-?\d+\.\d\d$/.test(href),href);
    await s.send('Page.navigate',{url:URL0+href});
    const sel=await waitFor(s,`(location.hash.includes('s=${st.aphia_id}')&&(document.getElementById('detail')?.textContent||'').includes(${JSON.stringify(st.korean_name)}))&&location.hash`,30000);
    check(`${tag}: existing map opens with ${st.korean_name} selected`,!!sel,await s.evaluate("location.hash"));
    const backLink=await s.evaluate("document.querySelector('a[href=\"expedition.html\"]')?.textContent||''");
    check(`${tag}: the map header links back to the expedition`,backLink.includes('바다 탐험'),backLink);
    await sleep(1200);await shot(s,`${tag}-8-map`);
    check(`${tag}: no uncaught page errors or console.error`,s.errors.length===0,s.errors.join(' | '));
  }catch(e){check(`${tag}: harness`,false,e.stack);}
  finally{await s.close();}
}

const gl=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
await run('desktop',{flags:gl,width:1440,height:900});
await run('mobile',{flags:gl,width:390,height:844,mobile:true});
await run('reduced-motion',{flags:gl,width:1440,height:900,reduced:true});
await run('no-webgl',{flags:['--disable-webgl','--disable-3d-apis'],width:1440,height:900,webgl:false});
fs.writeFileSync(path.join(OUT,'expedition-check-results.json'),JSON.stringify(results,null,2));
const fail=results.filter(r=>r.status!=='PASS').length;
console.log(`${results.length-fail} PASS / ${fail} FAIL`);
process.exitCode=fail?1:0;

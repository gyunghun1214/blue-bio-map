// Browser check of the sea expedition page (expedition.html) in four set-ups, headless Chrome via DevTools (no deps):
// desktop 1440x900 (WebGL through SwiftShader), phone 390x844 with touch, reduced motion, and WebGL disabled.
// Flow per set-up: start → sail to stops 1 and 3 (slow eased sailing, 바로 도착) → 4 discovery steps → detail open/close
// → '지도에서 보기' selects the species.
// Usage: node verification/expedition_check.mjs <output-directory>   (site served at URL0, default http://127.0.0.1:8765/)
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import {fileURLToPath} from 'node:url'; import vm from 'node:vm';
const OUT=process.argv[2];
if(!OUT)throw Error('Usage: node verification/expedition_check.mjs <output-directory>');
fs.mkdirSync(OUT,{recursive:true});
const DIST=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','dist');
const stops=JSON.parse(fs.readFileSync(path.join(DIST,'expedition-stops.json'),'utf8')).stops;
// Sailing times come from the page's own pure part (SAIL, tripSeconds), so the waits follow the speed setting.
const pure={};vm.createContext(pure);
vm.runInContext(fs.readFileSync(path.join(DIST,'expedition.js'),'utf8').split('// ---- browser ----')[0]+';Object.assign(globalThis,{SAIL,sampleRoute,tripSeconds,routeStops});',pure);
// route stops come first; the stop without a published cell at sea (참문어) is listed after them, off the route
const ROUTE_N=pure.routeStops(stops).length, OFF=stops.findIndex(st=>!st.cell);
const STOP_T=pure.sampleRoute(stops.slice(0,ROUTE_N)).stopT, LONGEST=pure.SAIL.avgLegSeconds*pure.SAIL.longest;
const FIRST_LEG=pure.tripSeconds(STOP_T[0],ROUTE_N);
// headless SwiftShader can drop to 1–4 fps and the page caps a frame at 0.1 s, so a trip can take up to 10× longer
// than set; this is only the ceiling, a passing run does not wait it out
const TRIP_WAIT=Math.max(60000,LONGEST*10000);
const SEA_CUCUMBER=stops.findIndex(st=>st.aphia_id===241776); // its zinc is missing in the report
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
  const send=(method,params={},ms=60000)=>new Promise((res,rej)=>{const i=++id;pending.set(i,{res,rej});ws.send(JSON.stringify({id:i,method,params}));setTimeout(()=>{if(pending.has(i)){pending.delete(i);rej(Error(method+' timeout'));}},ms);});
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
const shot=async(s,name)=>{const r=await s.send('Page.captureScreenshot',{format:'jpeg',quality:82});fs.writeFileSync(path.join(OUT,name+'.jpg'),Buffer.from(r.data,'base64'));};
// Mid-voyage pictures are evidence, not checks: on the Windows CI runner a 1440×900 SwiftShader frame of the moving
// sea can take longer than a minute to capture (CI 2026-10-08), so give up after 20 s and carry on.
const sailShot=async(s,name)=>{try{const r=await s.send('Page.captureScreenshot',{format:'jpeg',quality:70},20000);fs.writeFileSync(path.join(OUT,name+'.jpg'),Buffer.from(r.data,'base64'));}catch(e){console.log(`note: ${name} screenshot skipped (${e.message})`);}};
const cardName="(document.querySelector('#stop-card:not([hidden]) .x-name')?.textContent||'')";
const level="(Number(document.querySelector('#stop-card:not([hidden]) .x-card')?.dataset.level||0))";
const key=async(s,k,code)=>{for(const type of ['keyDown','keyUp'])await s.send('Input.dispatchKeyEvent',{type,key:k,code:code||k,windowsVirtualKeyCode:{ArrowRight:39,ArrowLeft:37,Escape:27,Enter:13,' ':32,End:35}[k],...(type==='keyDown'&&(k==='Enter'||k===' ')?{text:k==='Enter'?String.fromCharCode(13):' '}:{})});};

async function run(tag,opts){if(process.env.ONLY&&process.env.ONLY!==tag)return;return run1(tag,opts);}
async function run1(tag,{flags=[],width,height,mobile=false,reduced=false,webgl=true}){
  const s=await session(flags);
  try{
    await s.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
    if(mobile)await s.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
    // set both ways: the Windows CI runner has system animations off, which Chrome reports as reduced motion
    await s.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]});
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
      const oldWords=await s.evaluate("(document.getElementById('cards-list').innerText.match(/.{0,20}(검증 미통과|단일 논문).{0,20}/g)||[]).join(' | ')");
      check(`${tag}: every card shows the neutral label wording (no 검증 미통과 or 단일 논문)`,oldWords==='',oldWords);
      await s.evaluate(`document.querySelector('#cards-list [data-detail="${SEA_CUCUMBER}"]').click()`);
      const d=await waitFor(s,"document.getElementById('detail').open&&document.getElementById('detail-body').textContent");
      check(`${tag}: detail opens from a card (해삼 zinc shown as 자료 없음, not 0)`,d&&d.includes('해삼')&&/아연자료없음/.test(d.replace(/\s/g,'')),String(d).slice(0,200));
      await shot(s,`${tag}-detail`);
      await key(s,'Escape');
      check(`${tag}: Esc closes the detail`,!(await s.evaluate("document.getElementById('detail').open")));
      if(OFF>=0){
        // the stop off the route: a card with its reason, values and a map link without a position
        const off=await s.evaluate(`(()=>{const c=document.querySelector('#cards-list [data-stop="${OFF}"]');return c&&{text:c.innerText,map:c.querySelector('a.x-ghost')?.getAttribute('href')};})()`);
        check(`${tag}: the stop off the route is a card (${stops[OFF].korean_name}, 항로 밖, map link without m=)`,!!off&&off.text.includes('항로 밖')&&off.text.includes(stops[OFF].cell_missing_reason)&&off.map===stops[OFF].map_link&&!/[&#]m=/.test(off.map),JSON.stringify(off).slice(0,300));
        await s.evaluate(`document.querySelector('#cards-list [data-detail="${OFF}"]').click()`);
        const od=await waitFor(s,"document.getElementById('detail').open&&document.getElementById('detail-body').textContent");
        check(`${tag}: the stop off the route opens its detail with scores and evidence`,!!od&&od.includes(stops[OFF].korean_name)&&od.includes('보전 평가 근거')&&od.includes('원논문 DOI'),String(od).slice(0,200));
        await key(s,'Escape');
      }
    }else{
      const intro=await s.evaluate("!document.getElementById('intro').hidden&&!document.body.classList.contains('is-cards')");
      check(`${tag}: 3D sea with intro screen`,intro);
      await sleep(reduced?300:1500);await shot(s,`${tag}-1-intro`);
      await s.evaluate("window.__sail0=performance.now()");
      if(mobile){
        await s.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width/2,y:height*.5}]});await s.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await s.evaluate("document.getElementById('start').click()");
      }else await s.evaluate("document.getElementById('start').focus()").then(()=>key(s,'Enter'));
      const routeT="Number(getComputedStyle(document.getElementById('progress')).getPropertyValue('--t'))";
      if(!reduced){
        // the ship sails visibly: still under way a second after leaving, then 25 / 50 / 75 % of the first leg.
        // A slow runner can stall the page for seconds, so the bound is the eased trip at the page time actually
        // elapsed (a frame never advances more than its own time), not a fixed fraction of the leg.
        await sleep(1000);
        const early=await s.evaluate(`({label:document.getElementById('steer-label').textContent,card:!document.getElementById('stop-card').hidden,skip:!document.getElementById('skip').hidden,t:${routeT},s:(performance.now()-window.__sail0)/1000})`);
        const u=Math.min(1,early.s/FIRST_LEG), eased=STOP_T[0]*u*u*(3-2*u);
        check(`${tag}: still sailing one second after leaving (no jump to the stop)`,early.label.includes('항해 중')&&!early.card&&early.skip&&early.t<STOP_T[0]&&early.t<=eased+1e-6,JSON.stringify({...early,eased}));
        const ts=[];
        for(const f of [25,50,75]){const t=await waitFor(s,`${routeT}>=${STOP_T[0]*f/100}&&${routeT}`,TRIP_WAIT);ts.push(t);await sailShot(s,`${tag}-2-sailing-${f}`);}
        // a slow screenshot may let the ship reach the stop before the next sample, so later samples may equal the stop
        check(`${tag}: the ship moves forward through the first leg`,ts[0]<STOP_T[0]&&ts.every((t,i)=>t&&(i===0||t>=ts[i-1]))&&ts[2]>ts[0],JSON.stringify(ts));
      }
      const n1=await waitFor(s,`${cardName}===${JSON.stringify(stops[0].korean_name)}&&${level}>=1`,TRIP_WAIT);
      check(`${tag}: arrives at stop 1 (${stops[0].korean_name})`,!!n1);
      const lv1=await s.evaluate(level);
      await shot(s,`${tag}-3-stop1-step${lv1}`);
      const lv=await waitFor(s,`${level}>=3&&${level}`,8000);
      check(`${tag}: discovery steps reach 3 (sea area → species → values)`,lv>=3,`first level ${lv1}`);
      if(reduced)check(`${tag}: reduced motion shows every step at once`,lv1>=3,`first level ${lv1}`);
      await shot(s,`${tag}-4-stop1-values`);
      await s.evaluate("document.querySelector('#stop-card [data-detail]').focus()");
      // keyboard path on desktop (focus + Enter), tap path on the phone
      if(mobile)await s.evaluate("document.querySelector('#stop-card [data-detail]').click()");else await key(s,'Enter');
      const det=await waitFor(s,"document.getElementById('detail').open&&document.getElementById('detail-body').textContent");
      check(`${tag}: detail has observation, food, bioactivity, conservation and DOI links`,['관측 위치·기간','식량 가치 근거','생리활성 근거','보전 평가 근거','원논문 DOI'].every(t=>det?.includes(t)),String(det).slice(0,200));
      await shot(s,`${tag}-5-detail`);
      const oldDetail=await s.evaluate("((document.getElementById('stop-card').innerText+' '+document.getElementById('detail-body').innerText).match(/.{0,20}(검증 미통과|단일 논문).{0,20}/g)||[]).join(' | ')");
      check(`${tag}: stop 1 card and detail show the neutral label wording`,oldDetail==='',oldDetail);
      const before=await s.evaluate("location.hash");
      await sleep(2500);
      const still=await s.evaluate("({hash:location.hash,open:document.getElementById('detail').open})");
      check(`${tag}: no automatic sailing while the detail is open`,still.open&&still.hash===before,JSON.stringify(still));
      await key(s,'Escape');await sleep(300);
      if(process.env.DEBUG)console.log(await s.evaluate("JSON.stringify({a:document.activeElement?.outerHTML?.slice(0,120),hash:location.hash,card:document.getElementById('stop-card').dataset.stop})"));
      await waitFor(s,"!document.getElementById('detail').open&&document.activeElement?.dataset?.detail==='0'",3000);
      const after=await s.evaluate("({open:document.getElementById('detail').open,focus:document.activeElement?.dataset?.detail})");
      check(`${tag}: Esc closes the detail and focus returns to 자세히 보기`,!after.open&&after.focus==='0',JSON.stringify(after));
      // fast double move: the ship must end at stop 3 with stop 3's card, not an intermediate one
      if(mobile){
        for(let i=0;i<2;i++){await s.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width/2,y:height*.3}]});await s.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:width/2,y:height*.1}]});await s.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
        // headless touch on a canvas may not reach the page; the buttons are the same path
        if(!(await s.evaluate("location.hash==='#stop=3'||location.hash==='#stop=2'")))await s.evaluate("document.getElementById('next').click();document.getElementById('next').click()");
        if(await s.evaluate("location.hash==='#stop=2'"))await s.evaluate("document.getElementById('next').click()");
      }else if(reduced){await s.evaluate("document.getElementById('next').click();document.getElementById('next').click()");
      // CI 2026-10-08: on the slow Windows runner a key event timed out here under SwiftShader; the keyboard path is covered on desktop
      }else{await key(s,'ArrowRight');await key(s,'ArrowRight');}
      const hash3=await waitFor(s,"location.hash==='#stop=3'&&location.hash",3000)||await s.evaluate("location.hash");
      check(`${tag}: two quick moves target stop 3 in the URL`,hash3==='#stop=3',hash3);
      if(reduced)check(`${tag}: reduced motion moves at once, no 바로 도착 button`,await s.evaluate("document.getElementById('skip').hidden"));
      const n3=await waitFor(s,`${cardName}===${JSON.stringify(stops[2].korean_name)}`,TRIP_WAIT);
      check(`${tag}: arrives at stop 3 (${stops[2].korean_name}) with its own card`,!!n3,await s.evaluate(cardName));
      await waitFor(s,`${level}>=3`,8000);await shot(s,`${tag}-6-stop3`);
      if(!reduced){
        // 바로 도착 mid-trip, on the longest trip (stop 3 → the last route stop from the route dots) so a slow runner
        // cannot arrive first. The jump and the first look happen in one evaluate; then Space on the desktop, the button on the phone.
        const last=ROUTE_N-1;
        const mid=await s.evaluate(`(async()=>{document.querySelector('#progress [data-go="${last}"]').click();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {label:document.getElementById('steer-label').textContent,skip:!document.getElementById('skip').hidden,t:${routeT}};})()`);
        check(`${tag}: a long trip shows its route and 바로 도착`,mid.label.includes(`${stops[2].korean_name} → ${stops[last].korean_name} 항해 중`)&&mid.skip&&mid.t<STOP_T[last],JSON.stringify(mid));
        if(mobile)await s.evaluate("document.getElementById('skip').click()");else await key(s,' ','Space');
        const skipped=await waitFor(s,`${cardName}===${JSON.stringify(stops[last].korean_name)}&&performance.now()`,3000);
        const tAfter=await s.evaluate(routeT);
        check(`${tag}: 바로 도착 (${mobile?'button':'Space'}) arrives at once`,!!skipped&&Math.abs(tAfter-1)<1e-3,await s.evaluate("document.getElementById('steer-label').textContent"));
      }
      // back to stop 1: the steps already seen stay (level 4 = detail read), no replay from step 1
      await s.evaluate("document.querySelector('#progress [data-go=\"0\"]').click()");
      const back=await waitFor(s,`${cardName}===${JSON.stringify(stops[0].korean_name)}&&${level}`,TRIP_WAIT);
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
    const sel=await waitFor(s,`(location.hash.includes('s=${st.aphia_id}')&&(document.getElementById('detail')?.textContent||'').includes(${JSON.stringify(st.korean_name)}))&&location.hash`,60000);
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

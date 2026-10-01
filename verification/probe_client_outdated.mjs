// Manual headless check (not in CI: it needs a served copy of dist/ whose assessments.json was edited).
// Usage: node verification/probe_client_outdated.mjs http://127.0.0.1:<port>/ <out.json>
// Serve a copy of dist/ with assessments.json method_version set above VERIFIED (e.g. verified-pilot-2.4):
// before the fix every comparison axis reads 기술 오류; after it the page reloads once and reads 새 버전 있음.
import {spawn} from 'node:child_process';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';

const [url,out]=process.argv.slice(2);
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cdp-outdated-'));
const chromePath=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'google-chrome');
const chrome=spawn(chromePath,['--headless=new','--remote-debugging-port=0','--no-first-run','--disable-gpu','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0,navigations=0;const pending=new Map();
async function connect(){
  for(let i=0;i<75;i++){
    try{const port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0]);
      const page=(await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(x=>x.type==='page');if(page)return page.webSocketDebuggerUrl;}catch{}
    await sleep(200);
  }
  throw Error('Chrome DevTools not reachable');
}
const send=(method,params={})=>new Promise((res,rej)=>{const i=++id;pending.set(i,{res,rej});ws.send(JSON.stringify({id:i,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,400));return r.result.value;};
async function settled(){
  for(let i=0;i<160;i++){await sleep(250);
    const st=await evaluate("document.getElementById('connection-state')?.textContent||''").catch(()=>'');
    if(/연결됨|불러오기 실패|연결 실패/.test(st)){await sleep(1500);return st;}}
  return 'timeout';
}
const readTable=`[...document.querySelectorAll('#comparison tbody tr')].filter(tr=>/MFPI|MBPI|MCUI|BBVI/.test(tr.querySelector('th').innerText))
  .flatMap(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.replace(/\\s+/g,' ').trim()))`;
try{
  ws=new WebSocket(await connect());await new Promise(r=>ws.onopen=r);
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.method==='Page.frameNavigated'&&!m.params.frame.parentId&&m.params.frame.url.startsWith(url))navigations++;
    if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.rej(Error(m.error.message)):p.res(m.result);}};
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.navigate',{url});
  const state=await settled();
  await evaluate("document.querySelector('[data-view=compare]').click()");await sleep(300);
  const cells=[];
  for(let p=0;p<10;p++){
    cells.push(...await evaluate(readTable));
    if(await evaluate("document.getElementById('comparison-next').disabled"))break;
    await evaluate("document.getElementById('comparison-next').click()");await sleep(150);
  }
  const count=label=>cells.filter(c=>c.startsWith(label)).length;
  const result={url,state,reloads:navigations-1,axisCells:cells.length,technicalError:count('기술 오류'),newVersion:count('새 버전 있음'),
    banner:await evaluate("document.getElementById('error').hidden?'':document.getElementById('error').textContent"),
    reloadKeys:await evaluate("JSON.stringify(Object.fromEntries(Object.keys(sessionStorage).map(k=>[k,sessionStorage.getItem(k)])))")};
  fs.writeFileSync(out,JSON.stringify(result,null,1));
  console.log(JSON.stringify(result));
}finally{try{ws?.close();}catch{}chrome.kill();await sleep(500);try{fs.rmSync(profile,{recursive:true,force:true});}catch{}}

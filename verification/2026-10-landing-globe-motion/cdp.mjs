// A small DevTools-protocol harness (no deps, the same approach as uicheck.mjs and landing_check.mjs) for the turning
// globe's checks: launch headless Chrome with extra flags, send commands, evaluate, capture.
import {spawn} from 'node:child_process';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function launch(flags=[]){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cdp-'));
  const chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0','--no-first-run',
    '--hide-scrollbars','--user-data-dir='+profile,...flags,'about:blank'],{stdio:'ignore'});
  let url=null;
  for(let i=0;i<300&&!url;i++){try{const port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0]);
    const t=await (await fetch(`http://127.0.0.1:${port}/json`)).json();url=t.find(x=>x.type==='page')?.webSocketDebuggerUrl;}catch{}if(!url)await sleep(200);}
  if(!url)throw Error('no DevTools endpoint');
  const ws=new WebSocket(url);let id=0;const pending=new Map(),requests=[],errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.rej(Error(m.error.message)):p.res(m.result);return;}
    if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);
    if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
    if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push('console.error: '+m.params.args.map(x=>x.value??x.description).join(' '));};
  await new Promise(r=>ws.onopen=r);
  const send=(method,params={})=>new Promise((res,rej)=>{const i=++id;pending.set(i,{res,rej});ws.send(JSON.stringify({id:i,method,params}));});
  const evaluate=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,400));return r.result.value;};
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  let scripts=[];
  const onNewDocument=async(...sources)=>{for(const s of scripts)await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:s});scripts=[];
    for(const source of sources)scripts.push((await send('Page.addScriptToEvaluateOnNewDocument',{source})).identifier);};
  const shot=async(file,clip)=>{const r=await send('Page.captureScreenshot',{format:'png',...(clip?{clip:{...clip,scale:1}}:{})});if(file)fs.writeFileSync(file,Buffer.from(r.data,'base64'));return r.data;};
  const close=()=>{try{ws.close();}catch{}chrome.kill();};
  return {send,evaluate,onNewDocument,shot,close,requests,errors};
}

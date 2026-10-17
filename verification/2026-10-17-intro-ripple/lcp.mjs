// First paint and largest paint (LCP) of the main page, before and after the ripple loader, measured the same way on both:
// a fresh headless Chrome per run, 4× CPU slowdown and a slow mobile network (150 ms, 1.6 Mbps down), a 390×844 phone and a
// 1440×900 desktop, the production API answered from live-snapshot.json (it is out of reach in the test machine). Prints the
// median of the runs and the element Chrome took as the largest paint. Not Lighthouse: the same browser, only these numbers.
// Run: serve the two dist folders (e.g. main on 8766, this branch on 8765), then
//      node verification/2026-10-17-intro-ripple/lcp.mjs http://127.0.0.1:8766/ http://127.0.0.1:8765/
import {spawn} from 'node:child_process';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fx=fs.readFileSync(new URL('../../dist/live-snapshot.json',import.meta.url),'utf8');
async function run(url,phone){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cdp-'));
  const chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0','--no-first-run','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
  let ws=null;for(let i=0;i<300&&!ws;i++){try{const port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0]);
    const u=(await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(x=>x.type==='page')?.webSocketDebuggerUrl;if(u)ws=new WebSocket(u);}catch{}if(!ws)await sleep(200);}
  let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}};
  await new Promise(r=>ws.onopen=r);
  const send=(method,params={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
  await send('Page.enable');await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:phone?390:1440,height:phone?844:900,deviceScaleFactor:phone?2:1,mobile:phone});
  await send('Emulation.setCPUThrottlingRate',{rate:4});
  await send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6e6/8,uploadThroughput:7.5e5/8});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`{const FX=${fx};const reply=k=>Promise.resolve(new Response(JSON.stringify(FX[k]),{status:200,headers:{'content-type':'application/json'}}));
    window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return reply('profiles');if(s.includes('/rest/v1/species_map_cells'))return reply('cells');return o(u,...a);})(window.fetch);
    window.__lcp=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lcp.push({t:e.startTime,el:e.element?(e.element.tagName.toLowerCase()+' in .'+(e.element.closest('[class]')?.className||'')):''});}).observe({type:'largest-contentful-paint',buffered:true});}`});
  await send('Page.navigate',{url});await sleep(15000);
  const r=await send('Runtime.evaluate',{expression:"({lcp:window.__lcp.at(-1),fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime})",returnByValue:true});
  ws.close();chrome.kill();return r.result.value;
}
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
for(const phone of [true,false])for(const url of process.argv.slice(2)){
  const runs=[];for(let i=0;i<3;i++)runs.push(await run(url,phone));
  console.log(`${phone?'phone 390':'desktop 1440'} ${url}: FCP ${Math.round(med(runs.map(r=>r.fcp)))} ms · LCP ${Math.round(med(runs.map(r=>r.lcp?.t)))} ms (${[...new Set(runs.map(r=>r.lcp?.el))].join(', ')})`);
}
process.exit(0);

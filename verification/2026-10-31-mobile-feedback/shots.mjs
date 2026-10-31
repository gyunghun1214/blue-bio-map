// 2026-10-31 전후 캡처: 휴대폰 탐색 지도(범례), 어획량 그래프. B=주소, TAG=before|after
//   SUPA=fixture B=http://127.0.0.1:8765/ TAG=after node verification/2026-10-31-mobile-feedback/shots.mjs <폴더>
import fs from 'node:fs'; import path from 'node:path';
import {launch,open,sleep,waitData} from '../2026-10-25-mobile-ux/common.mjs';
const OUT=process.argv[2]||'tmp/shots', B=process.env.B||'http://127.0.0.1:8765/', TAG=process.env.TAG||'after';fs.mkdirSync(OUT,{recursive:true});
const browser=await launch();
async function page(w,h,phone,lang){const o=await open(browser,{w,h,phone,supa:process.env.SUPA||'fixture'});
  await o.ctx.addInitScript(()=>{try{sessionStorage.setItem('bbvm-intro-entered','1');localStorage.setItem('bbChatHintSeen','1');localStorage.removeItem('basemap');}catch{}});
  await o.page.goto(B+(lang==='en'?'?lang=en':''));await waitData(o.page);await sleep(1500);return o;}
const clip=async(p,name)=>{const s=await p.evaluate(()=>{const r=document.querySelector('#explore .map-stage').getBoundingClientRect();return {x:0,y:Math.max(0,r.top),width:innerWidth,height:Math.min(innerHeight,r.bottom)-Math.max(0,r.top)};});
  await p.screenshot({path:path.join(OUT,`${TAG}-${name}.png`),clip:s,animations:'disabled'});};
for(const lang of ['ko','en'])for(const mode of ['occurrence','value']){
  const o=await page(390,750,true,lang),p=o.page;
  if(mode==='value'){await p.click('[data-map-mode="value"]');await sleep(800);}
  else if(await p.evaluate(()=>document.querySelector('#explore .map-ui-bl').classList.contains('legend-collapsed'))){await p.click('#legend-toggle');await sleep(400);}
  for(const y of [0,120,300]){await p.evaluate(y=>scrollTo(0,y),y);await sleep(500);await clip(p,`390-${lang}-${mode}${mode==='occurrence'?'-open':''}-y${y}`);}
  if(mode==='occurrence'){await p.click('#legend-toggle');await sleep(400);for(const y of [0,120]){await p.evaluate(y=>scrollTo(0,y),y);await sleep(500);await clip(p,`390-${lang}-occurrence-folded-y${y}`);}}
  await o.ctx.close();
}
// 어획량 그래프: 꽃게 상세의 '자원 감소 신호'
for(const [w,h,phone] of [[390,844,true],[1440,900,false]]){const o=await page(w,h,phone,'ko'),p=o.page;
  await p.evaluate(()=>selectSpecies(1061762));await sleep(1000);
  await p.evaluate(()=>{const s=data.species.find(x=>x.aphiaID===1061762),h=document.createElement('div');h.id='spark-probe';h.className='stock-decline';h.style.cssText='position:fixed;left:8px;top:8px;z-index:99999;width:300px;padding:8px;background:#fff';h.innerHTML=stockSpark(s.assessment.stock_decline,data.assessmentInfo.method.mcui_stock_decline);document.body.append(h);});
  const sv=p.locator('#spark-probe');if(await sv.count())await sv.screenshot({path:path.join(OUT,`${TAG}-spark-${w}.png`),animations:'disabled'});
  await o.ctx.close();}
await browser.close();console.log('done');

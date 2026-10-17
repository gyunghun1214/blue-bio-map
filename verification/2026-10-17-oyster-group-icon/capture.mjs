// 참굴 임시 그림 → 분류군 아이콘 확인 (2026-10-17): 탐색 지도 오른쪽 패널(1440·1280)과 비교 탭 프로필(1440·390)에서
// 참굴·홍합의 머리 모양(그림/아이콘, 높이)을 재고 캡처한다. 콘솔 오류와 404 요청을 모은다. dist/를 127.0.0.1:8765로 띄운 뒤
// FIXTURE=dist/live-snapshot.json node verification/2026-10-17-oyster-group-icon/capture.mjs [출력 폴더] [before|after]
import {chromium} from 'playwright';
import fs from 'node:fs';
const OUT=process.argv[2]||new URL('.',import.meta.url).pathname, STAGE=process.argv[3]||'after', BASE='http://127.0.0.1:8765/';
const OYSTER=836033, MUSSEL=506159;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
const measured={},errors=[],missing=[];
async function open(w,h,hash){
  const page=await browser.newPage({viewport:{width:w,height:h}});
  await page.addInitScript("try{sessionStorage.setItem('bbvm-intro-entered','1')}catch{}");
  if(process.env.FIXTURE){const fx=fs.readFileSync(process.env.FIXTURE,'utf8');
    await page.addInitScript(`{const FX=${fx};const r=k=>Promise.resolve(new Response(JSON.stringify(FX[k]),{status:200,headers:{'content-type':'application/json'}}));window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return r('profiles');if(s.includes('/rest/v1/species_map_cells'))return r('cells');return o(u,...a);})(window.fetch);}`);}
  page.on('pageerror',e=>errors.push(`${w}px ${hash}: ${e}`));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_|net::/.test(m.text()))errors.push(`${w}px ${hash}: ${m.text()}`);});
  page.on('response',r=>{if(r.status()===404&&r.url().startsWith(BASE))missing.push(r.url());});
  await page.goto(BASE+'#'+hash);
  const ready=()=>page.waitForFunction(()=>typeof selected!=='undefined'&&selected&&typeof data!=='undefined'&&data.species?.length>=30,null,{timeout:30000});
  for(let i=0;i<3;i++){try{await ready();await page.waitForTimeout(1500);await ready();break;}catch(e){if(i===2)throw e;await page.waitForLoadState('load');}}
  await page.evaluate(()=>document.querySelectorAll('.bbc-hint').forEach(e=>e.hidden=true));
  return page;
}
const head=(page,sel)=>page.evaluate(sel=>{const h=document.querySelector(sel);if(!h)return null;const r=h.getBoundingClientRect();
  return {h:Math.round(r.height),w:Math.round(r.width),img:!!h.querySelector('img'),icon:h.querySelector('.group-icon')?.dataset.group||null,
    iconBox:(e=>e&&(b=>[Math.round(b.width),Math.round(b.height)])(e.getBoundingClientRect()))(h.querySelector('.group-icon'))};},sel);

for(const [w,h] of [[1440,900],[1280,720]]){
  for(const id of [OYSTER,MUSSEL]){
    const page=await open(w,h,`s=${id}&v=explore`);
    measured[`explore-${w}-${id}`]=await head(page,'#explore .sp-head');
    if(w===1440)await page.locator('#side-panel').screenshot({path:`${OUT}/${STAGE}-1440-panel-${id===OYSTER?'oyster':'mussel'}.png`});
    await page.close();
  }
}
for(const [w,h] of [[1440,900],[390,844]]){
  for(const id of [OYSTER,MUSSEL]){
    const page=await open(w,h,`s=${id}&v=compare`);
    await page.evaluate(()=>document.getElementById('cmp-profile')?.scrollIntoView({block:'start'}));await page.waitForTimeout(300);
    measured[`compare-${w}-${id}`]=await head(page,'#cmp-profile .cp-art');
    if(id===OYSTER)await page.screenshot({path:`${OUT}/${STAGE}-${w}-compare-oyster.png`});
    await page.close();
  }
}
// every species: no picture in either place, a group icon instead
{const page=await open(1440,900,`s=${OYSTER}&v=explore`);
  measured.all30=await page.evaluate(async()=>{const out=[];for(const s of data.species){selectSpecies(s.aphiaID);await new Promise(r=>setTimeout(r,30));
    const sp=document.querySelector('#explore .sp-head');out.push({id:s.aphiaID,group:s.group,spImg:!!sp?.querySelector('img'),spIcon:sp?.querySelector('.group-icon')?.dataset.group||null});}
    return out;});
  await page.close();}
await browser.close();
const result={stage:STAGE,measured,errors,missing:[...new Set(missing)]};
fs.writeFileSync(`${OUT}/${STAGE}-measured.json`,JSON.stringify(result,null,1));
console.log(JSON.stringify({...result,measured:{...measured,all30:measured.all30.filter(x=>x.spImg||!x.spIcon)}},null,1));

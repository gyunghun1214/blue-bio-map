// 신청서 대비 미구현 기능 (2026-10-15): 현황표·제도 블록(살오징어·참굴·해삼)·정밀 좌표 모달·대체생산 우선 배치를 1440·375에서 캡처하고 잰다.
// dist/를 127.0.0.1:8765로 띄운 뒤: FIXTURE=dist/live-snapshot.json node verification/2026-10-15-application-gaps/capture.mjs [출력 폴더]
import {chromium} from 'playwright';
import fs from 'node:fs';
const OUT=process.argv[2]||new URL('.',import.meta.url).pathname, BASE='http://127.0.0.1:8765/';
fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
const results=[],log=(name,ok,detail)=>{results.push({name,ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
async function open(w,h){
  const page=await browser.newPage({viewport:{width:w,height:h}}),errors=[];
  if(process.env.FIXTURE){const fx=fs.readFileSync(process.env.FIXTURE,'utf8');
    await page.addInitScript(`{const FX=${fx};const r=k=>Promise.resolve(new Response(JSON.stringify(FX[k]),{status:200,headers:{'content-type':'application/json'}}));window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return r('profiles');if(s.includes('/rest/v1/species_map_cells'))return r('cells');return o(u,...a);})(window.fetch);}`);}
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_|net::/.test(m.text()))errors.push(m.text());});
  await page.goto(BASE+'#v=method');await page.waitForFunction(()=>document.getElementById('mt-total')?.textContent!=='—',null,{timeout:30000});
  await page.addStyleTag({content:'.bbc,[class*="bbc-"]{visibility:hidden!important}'}); // 멍이 안내 말풍선이 캡처를 가리지 않게
  await page.waitForTimeout(500);return {page,errors};
}
// text under 11px inside the new blocks (phones keep ≥ 11px, PR #195)
const small=sel=>{const bad=[...document.querySelectorAll(sel)].flatMap(r=>[...r.querySelectorAll('*')]).filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&e.getClientRects().length&&parseFloat(getComputedStyle(e).fontSize)<11).map(e=>(e.className||e.tagName)+':'+getComputedStyle(e).fontSize+':'+e.textContent.trim().slice(0,30));return bad;};
const SPECIES=[[342067,'squid'],[836033,'oyster'],[241776,'sea-cucumber']];
for(const [w,h] of [[1440,900],[375,812]]){
  const {page,errors}=await open(w,h);
  // 1) status table
  await page.evaluate(()=>{const d=document.getElementById('mt-acc-04');d.open=true;d.scrollIntoView();});await page.waitForTimeout(300);
  const t=await page.evaluate(()=>({rows:[...document.querySelectorAll('#promise-table tbody tr')].map(r=>[r.querySelector('th').innerText,r.querySelector('.pt-s').innerText]),count:document.getElementById('promise-count').textContent,
    over:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
  log(`${w}px: 현황표 14행 · 상태 네 낱말만`,t.rows.length===14&&t.rows.every(r=>['구현','부분','미구현','변경'].includes(r[1])),t.count);
  log(`${w}px: 페이지 가로 넘침 없음(표는 자기 칸 안에서 가로 스크롤)`,t.over<=0,{over:t.over});
  await page.locator('#mt-acc-04').screenshot({path:`${OUT}/${w}-01-promise-table.png`});
  if(w<=375)log(`${w}px: 현황표 11px 미만 글자 없음`,(await page.evaluate(small,'#mt-acc-04')).length===0);
  // 2) species: institution block, links, alternative production order
  await page.evaluate(()=>setView('explore',false));await page.waitForTimeout(400);
  for(const [id,name] of SPECIES){
    const m=await page.evaluate(id=>{selectSpecies(id);detailOpen=true;syncFolds();const d=document.getElementById('detail');
      const f=[...d.querySelectorAll('details.detail-more')].find(x=>x.querySelector('summary').innerText.includes('활용 전 확인할 제도'));f.open=true;
      const alt=d.querySelector('.alt-production'),map=d.querySelector('#detail-map-summary');
      return {inst:f.innerText,alt:!!alt,before:!!alt&&!!(alt.compareDocumentPosition(map)&Node.DOCUMENT_POSITION_FOLLOWING),inat:d.querySelector('.detail-actions a').href};},id);
    await page.waitForTimeout(300);
    log(`${w}px ${name}: 제도 블록(기록 위치 비율·유전자원법·ABS·BBNJ·확인 안내)`,['활용 전 확인할 제도','법적 판단 아님','%)','유전자원의 접근·이용 및 이익 공유에 관한 법률','법령 원문 확인이 필요합니다','BBNJ 협정'].every(x=>m.inst.includes(x)),m.inst.split('\n').slice(0,4).join(' / '));
    log(`${w}px ${name}: 대체생산 블록 ${id===342067?'지도 요약보다 먼저':'없음'}`,id===342067?m.before:!m.alt);
    log(`${w}px ${name}: iNaturalist 종 검색 링크`,m.inat.startsWith('https://www.inaturalist.org/taxa/search?q='),m.inat);
    await page.evaluate(()=>{const f=[...document.querySelectorAll('#detail details.detail-more')].find(x=>x.querySelector('summary').innerText.includes('활용 전 확인할 제도'));f.scrollIntoView({block:'start'});});
    await page.locator('#detail details.detail-more:has(summary:text("활용 전 확인할 제도"))').screenshot({path:`${OUT}/${w}-02-institution-${name}.png`});
    if(id===342067){await page.evaluate(()=>{document.getElementById('detail').scrollTop=0;document.querySelector('#detail .detail-head').scrollIntoView({block:'start'});});await page.waitForTimeout(200);
      await page.locator('#detail').screenshot({path:`${OUT}/${w}-03-squid-top.png`});}
    if(w<=375)log(`${w}px ${name}: 새 블록 11px 미만 글자 없음`,...(b=>[b.length===0,b])(await page.evaluate(small,'#detail .alt-production,#detail .detail-actions,#detail details.detail-more:has(.inst-lead)')));
  }
  // 3) dialog
  await page.evaluate(()=>{selectSpecies(342067);document.querySelector('#detail [data-coord-request]').click();});await page.waitForTimeout(300);
  const dl=await page.evaluate(()=>{const d=document.getElementById('coord-dialog');return {open:d.open,text:d.innerText,focus:document.activeElement?.className}});
  log(`${w}px: 정밀 좌표 모달 열림·원좌표 미제공·3등급 계획·닫기 버튼에 초점`,dl.open&&dl.text.includes('원좌표를 누구에게도 제공하지 않습니다')&&['시민','연구자','기관'].every(x=>dl.text.includes(x))&&/coord-close/.test(dl.focus));
  await page.screenshot({path:`${OUT}/${w}-04-coord-dialog.png`});
  await page.keyboard.press('Escape');await page.waitForTimeout(200);
  log(`${w}px: Esc로 모달 닫힘`,!(await page.evaluate(()=>document.getElementById('coord-dialog').open)));
  // 4) compare profile of the both-high species
  await page.evaluate(()=>{setView('compare',false);selectSpecies(342067);});await page.waitForTimeout(500);
  const cp=await page.evaluate(()=>{const a=document.querySelector('#cmp-profile .alt-production'),l=document.querySelector('#cmp-profile .cp-links');return {alt:!!a,before:!!a&&!!l&&!!(a.compareDocumentPosition(l)&Node.DOCUMENT_POSITION_FOLLOWING)};});
  log(`${w}px: 종 프로필(비교와 지표)에서도 대체생산 블록이 ‘출현 기록 지도’ 링크보다 먼저`,cp.before);
  await page.evaluate(()=>scrollTo(0,0));const box=await page.evaluate(()=>{const r=document.getElementById('cmp-profile').getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height};});
  await page.screenshot({path:`${OUT}/${w}-05-compare-profile-squid.png`,fullPage:true,clip:box});
  log(`${w}px: 페이지 오류 없음`,errors.length===0,errors);
  await page.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/results.json`,JSON.stringify(results,null,1));
const failed=results.filter(r=>!r.ok).length;console.log(`${results.length-failed} PASS / ${failed} FAIL`);process.exit(failed?1:0);

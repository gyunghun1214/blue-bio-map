// 2026-10-31 도연 피드백 1·2번 측정 (Playwright, Chromium으로 휴대폰 흉내).
// dist/를 띄운 주소(B, 기본 http://127.0.0.1:8765/)를 열어 잰다. 전후 비교는 main을 8766에 띄워 B=http://127.0.0.1:8766/로 한 번 더 돌린다.
//   SUPA=fixture node verification/2026-10-31-mobile-feedback/measure.mjs <출력.json> [spark|legend|all]
// 1번: 어획량 그래프(stockSpark)에서 마지막 연도 글자와 '25p' 사이 간격(390·1440 × KO·EN).
// 2번: 휴대폰 탐색 지도에서 페이지를 올릴 때 범례(.map-ui-bl)가 시트 윗선 위에 남는지, 눌리는지, 위 버튼 줄·확대 단추와 겹치는지.
import fs from 'node:fs';
import {launch,open,sleep,waitData} from '../2026-10-25-mobile-ux/common.mjs';
const OUT=process.argv[2]||'tmp/measure.json', WHAT=process.argv[3]||'all', B=process.env.B||'http://127.0.0.1:8765/';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
const browser=await launch(), res={base:B,spark:[],legend:[]};
async function page(w,h,phone,lang){
  const o=await open(browser,{w,h,phone,supa:process.env.SUPA||'fixture'});
  await o.ctx.route(/gibs\.earthdata\.nasa\.gov|gebco\.net/,r=>r.fulfill({status:200,contentType:'image/png',body:PNG}));
  await o.ctx.addInitScript(()=>{try{sessionStorage.setItem('bbvm-intro-entered','1');localStorage.setItem('bbChatHintSeen','1');localStorage.removeItem('basemap');}catch{}});
  await o.page.goto(B+(lang==='en'?'?lang=en':''));await waitData(o.page);await sleep(1500);
  return o;
}
// ---- 1번 ----
const SPARK=()=>{const rule=data.assessmentInfo.method.mcui_stock_decline,h=document.createElement('div');h.style.cssText='position:fixed;left:0;top:0;width:358px;visibility:hidden';document.body.append(h);const rows=[];
  for(const s of data.species){const d=s.assessment?.stock_decline;if(!d||d.match_level==='none'||!Number.isFinite(d.reference_2025p?.coastal_t))continue;h.innerHTML=stockSpark(d,rule);
    const svg=h.querySelector('svg'),t=[...h.querySelectorAll('text')].map(x=>({s:x.textContent,b:x.getBoundingClientRect()}));const a=t.find(x=>x.s===String(d.years.at(-1))),b=t.find(x=>x.s==='25p'),f=t.find(x=>x.s===String(d.years[0]));
    rows.push({n:s.label,gap:+(b.b.left-a.b.right).toFixed(1),inside:+(svg.getBoundingClientRect().right-b.b.right).toFixed(1),firstGap:+(a.b.left-f.b.right).toFixed(1),fs:parseFloat(getComputedStyle(h.querySelector('text')).fontSize),svgW:+svg.getBoundingClientRect().width.toFixed(1)});}
  h.remove();return {count:rows.length,overlapping:rows.filter(r=>r.gap<2).length,minGap:Math.min(...rows.map(r=>r.gap)),maxGap:Math.max(...rows.map(r=>r.gap)),minInside:Math.min(...rows.map(r=>r.inside)),fs:rows[0]?.fs,svgW:rows[0]?.svgW};};
// 실제로 화면에 그려진 그래프(종 상세의 '자원 감소 신호')도 한 종 잰다
const SPARK_LIVE=()=>{const out=[];for(const svg of document.querySelectorAll('svg.sd-spark')){const r=svg.getBoundingClientRect();if(!r.width)continue;const t=[...svg.querySelectorAll('text')];const b=t.find(x=>x.textContent==='25p');if(!b)continue;const a=t[t.length-1];
  out.push({w:+r.width.toFixed(1),gap:+(b.getBoundingClientRect().left-a.getBoundingClientRect().right).toFixed(1)});}return out;};
if(WHAT!=='legend')for(const [w,h,phone] of [[390,844,true],[1440,900,false]])for(const lang of ['ko','en']){
  const o=await page(w,h,phone,lang);
  const r=await o.page.evaluate(`(${SPARK})()`);
  // 꽃게(자원 감소 신호가 있는 종) 상세를 열어 화면에 그려진 그래프도 잰다
  await o.page.evaluate(()=>{const s=data.species.find(x=>x.aphiaID===1061762);if(s&&typeof selectSpecies==='function')selectSpecies(s.aphiaID);});await sleep(800);
  const live=await o.page.evaluate(`(${SPARK_LIVE})()`);
  res.spark.push({w,lang,...r,live});console.log('spark',w,lang,JSON.stringify(r),JSON.stringify(live));
  await o.ctx.close();
}
// ---- 2번 ----
const RECT=()=>{const R=e=>{if(!e)return null;const x=e.getBoundingClientRect();return x.width?{l:+x.left.toFixed(1),t:+x.top.toFixed(1),r:+x.right.toFixed(1),b:+x.bottom.toFixed(1)}:null;},q=s=>document.querySelector(s);
  const bl=q('#explore .map-ui-bl'),lg=R(bl),stage=q('#explore .map-stage'),head=R(q('#sheet-head'));
  let hit=null;if(lg){const btn=bl.querySelector('.legend-toggle'),bb=R(btn)&&getComputedStyle(btn).display!=='none'?R(btn):lg,x=(bb.l+bb.r)/2,y=(bb.t+bb.b)/2;const e=document.elementFromPoint(x,y);hit=!!e&&bl.contains(e);}
  const vk=q('#value-key'),vkr=vk&&!vk.hidden?R(vk):null;let vkHit=null;if(vkr){const e=document.elementFromPoint((vkr.l+vkr.r)/2,(vkr.t+vkr.b)/2);vkHit=!!e&&vk.contains(e);}
  return {scrollY:Math.round(scrollY),head:head?.t,legend:lg,hit,valueKey:vkr,vkHit,tl:R(q('#explore .map-ui-tl')),zoom:R(q('#explore .leaflet-control-zoom')),attr:R(q('#explore .attr-toggle')),full:R(q('#explore .map-full-ctl')),stage:R(stage),
    cover:stage?.style.getPropertyValue('--sheet-cover')||'',lift:stage?.style.getPropertyValue('--legend-lift')||'',collapsed:bl?.classList.contains('legend-collapsed'),mapZoom:typeof map!=='undefined'?map.getZoom():null,mapCenter:typeof map!=='undefined'?map.getCenter():null};};
const cut=(a,b)=>!!a&&!!b&&a.l<b.r&&b.l<a.r&&a.t<b.b&&b.t<a.b;
if(WHAT!=='spark')for(const [w,h] of [[360,667],[390,750],[430,932]])for(const lang of ['ko','en'])for(const mode of ['occurrence','value'])for(const fold of ['collapsed','open']){
  const o=await page(w,h,true,lang),p=o.page;
  if(mode==='value'){await p.click('[data-map-mode="value"]');await sleep(800);}
  const st=await p.evaluate(()=>document.querySelector('#explore .map-ui-bl')?.classList.contains('legend-collapsed'));
  if((fold==='collapsed')!==!!st&&await p.locator('#legend-toggle').isVisible()){await p.click('#legend-toggle');await sleep(400);}
  const rows=[];const z0=await p.evaluate(`(${RECT})()`);
  for(const y of [0,40,80,120,160,200,300]){await p.evaluate(y=>scrollTo(0,y),y);await sleep(450);const r=await p.evaluate(`(${RECT})()`);
    r.y=y;r.overTl=cut(r.legend,r.tl);r.overZoom=cut(r.legend,r.zoom);r.overAttr=cut(r.legend,r.attr);r.aboveSheet=r.legend?r.legend.b<=r.head+0.5:null;rows.push(r);}
  const moved=rows.some(r=>JSON.stringify(r.mapCenter)!==JSON.stringify(z0.mapCenter)||r.mapZoom!==z0.mapZoom);
  res.legend.push({w,h,lang,mode,fold,actualCollapsed:rows[0].collapsed,mapMoved:moved,rows});
  console.log(`legend ${w}x${h} ${lang} ${mode} ${fold}(${rows[0].collapsed?'collapsed':'open'}) mapMoved=${moved}`);
  for(const r of rows)console.log(`  y=${r.y} head=${r.head} legend=${r.legend?r.legend.t+'–'+r.legend.b:'-'} cover=${r.cover} lift=${r.lift} hit=${r.hit} vk=${r.valueKey?r.valueKey.t+'–'+r.valueKey.b:'-'} vkHit=${r.vkHit} tl.b=${r.tl?.b} zoom=${r.zoom?r.zoom.t+'–'+r.zoom.b:'-'} overTl=${r.overTl} overZoom=${r.overZoom} overAttr=${r.overAttr}`);
  await o.ctx.close();
}
fs.mkdirSync(OUT.replace(/[^/]*$/,'')||'.',{recursive:true});fs.writeFileSync(OUT,JSON.stringify(res,null,1));
await browser.close();

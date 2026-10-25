// 2026-10-25 휴대폰 흐름 따라가기: 시민 판정단이 QR을 찍고 휴대폰으로 처음 들어온 상황.
// 사용: dist를 8765에 띄운 뒤  OUT=verification/2026-10-25-mobile-ux/before node verification/2026-10-25-mobile-ux/walk.mjs
//   WIDTHS=360,390,430(기본) · BASE=http://127.0.0.1:8765/ · ONLY=04,09(장면 번호 일부만)
// 화면마다 <폭>-<번호>-<이름>.png 를 남기고, 장면별 측정값을 <폭>-walk.json 에 쓴다.
// Supabase는 기본으로 실제 공개 API를 쓴다(SUPA=live, common.mjs; 막힌 곳에서는 SUPA=fixture로 dist/live-snapshot.json).
// 위성 타일은 tmp/tile-cache에서 같은 그림을 준다. 휴대폰 상세 시트(.ss-open)가 있는 판(이 브랜치)에서는 9~11번 장면을
// 시트로 따라가고(열기 → 시트 안 맨 아래 → ✕로 닫기), 없는 판(main)에서는 전처럼 페이지를 내려 상세로 간다.
import fs from 'node:fs'; import path from 'node:path';
import {launch,open,sleep,waitGate,waitData,shot} from './common.mjs';
const OUT=process.env.OUT||'verification/2026-10-25-mobile-ux/before';
const BASE=process.env.BASE||'http://127.0.0.1:8765/';
const WIDTHS=(process.env.WIDTHS||'360,390,430').split(',').map(Number);
const HEIGHT={360:780,390:844,430:932};
const ONLY=process.env.ONLY?new Set(process.env.ONLY.split(',')):null;
fs.mkdirSync(OUT,{recursive:true});

// 화면에 보이는 것만 재는 도구(페이지 안에서 실행)
const MEASURE=`(()=>{
  const vw=innerWidth,vh=innerHeight;
  const vis=e=>{if(!e.isConnected)return false;const s=getComputedStyle(e);if(s.visibility==='hidden'||s.display==='none'||+s.opacity===0)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
  const inView=r=>r.bottom>0&&r.top<vh&&r.right>0&&r.left<vw;
  const over=[...document.querySelectorAll('body *')].filter(e=>vis(e)&&e.getBoundingClientRect().right>vw+1)
    .filter(e=>!e.closest('.leaflet-container,#species-list,#use-chips,.cmp-table-wrap,#comparison,.flow-scroll,.mt-nat-wrap,.type-table-wrap,.mt-ck-wrap,.cmp-groups,.dt-cards,[data-scroll-x]'))
    .filter(e=>{let p=e.parentElement;while(p){const o=getComputedStyle(p).overflowX;if(o==='auto'||o==='scroll'||o==='hidden'||o==='clip')return false;p=p.parentElement;}return true;})
    .slice(0,8).map(e=>(e.id?'#'+e.id:e.className&&typeof e.className==='string'?'.'+e.className.split(' ')[0]:e.tagName)+':'+Math.round(e.getBoundingClientRect().right));
  const targets=[...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,summary,[role=button],[role=tab],[role=switch],label.sc-check')]
    .filter(e=>vis(e)&&inView(e.getBoundingClientRect())&&!e.closest('.leaflet-control-attribution'))
    .map(e=>{const r=e.getBoundingClientRect();return {t:(e.getAttribute('aria-label')||e.innerText||e.value||'').replace(/\\s+/g,' ').trim().slice(0,24),w:Math.round(r.width),h:Math.round(r.height)};});
  const small=targets.filter(t=>t.h<44||t.w<44);
  const fonts={};let tiny=[];
  for(const e of document.querySelectorAll('body *')){
    if(!vis(e))continue;if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
    const r=e.getBoundingClientRect();if(!inView(r))continue;
    const f=parseFloat(getComputedStyle(e).fontSize);fonts[Math.round(f)]=(fonts[Math.round(f)]||0)+1;
    if(f<12)tiny.push((e.className||e.tagName)+':'+f+':'+e.textContent.trim().slice(0,16));
  }
  return {scrollY:Math.round(scrollY),docH:document.documentElement.scrollHeight,scrollW:document.documentElement.scrollWidth,vw,
    overflow:over,targets:targets.length,small:small.length,smallList:small.slice(0,24),fonts,tiny:tiny.slice(0,10)};
})()`;

async function measure(page){try{return await page.evaluate(MEASURE);}catch(e){return {error:e.message};}}
const box=(page,sel)=>page.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),bottom:Math.round(r.bottom)};},sel);
// 아래 탭바 누르기: 손가락으로 누를 수 없으면(가려짐·화면 밖) 기록하고 스크립트로 눌러 흐름을 이어 간다
const tapFails=[];
async function tapTab(page,view,where){
  try{await page.tap(`.tabs [data-view=${view}]`,{timeout:4000});}
  catch(e){tapFails.push(where+' → '+view+': '+(e.message.match(/<[^>]+> from <[^>]+>[^\n]*/)?.[0]||e.message.split('\n')[0]).slice(0,160));
    await page.evaluate(v=>document.querySelector(`.tabs [data-view=${v}]`).click(),view);}
}
const scrollTo=async(page,y)=>{await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),y);await sleep(500);};
// 손가락으로 끌어 올리는 것처럼 화면을 내린다(scroll 이벤트는 같다)
const scrollBy=async(page,dy)=>{await page.evaluate(dy=>window.scrollBy({top:dy,behavior:'instant'}),dy);await sleep(500);};

async function walk(W){
  const H=HEIGHT[W]||844,log={width:W,height:H,scenes:{}};
  const b=await launch();
  const name=(n,s)=>`${W}-${n}-${s}`;
  const want=n=>!ONLY||ONLY.has(n);
  const keep=async(page,n,s,extra={},full=false)=>{if(!want(n))return;await shot(page,OUT,name(n,s),full);log.scenes[n+'-'+s]={...(await measure(page)),...extra};};
  try{
    // ---------- 1. 시작 화면 → '바다 탐색하기' ----------
    const {page,errors}=await open(b,{w:W,h:H});
    const t0=Date.now();
    await page.goto(BASE);
    await sleep(1200);
    await keep(page,'01','loading',{at:Date.now()-t0});
    await waitGate(page);const readyAt=Date.now()-t0;await sleep(900);
    const gate=await page.evaluate(()=>{const g=document.getElementById('site-gate'),r=s=>{const e=g.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)};};
      const motion=g.querySelector('.gate-motion'),ml=g.querySelector('.gate-motion-label');
      return {enter:r('#gate-enter'),more:r('.gate-more'),counts:r('.gate-counts'),globe:r('.gate-globe'),card:r('.gate-card'),legend:r('.gate-legend'),
        motionLabelShown:!!ml&&getComputedStyle(ml).display!=='none'&&ml.getBoundingClientRect().width>1,motionName:motion?.getAttribute('aria-label')||motion?.innerText.trim(),
        vh:innerHeight,scrollH:g.scrollHeight,focus:document.activeElement?.id||document.activeElement?.className};});
    await keep(page,'02','gate',{readyAt,gate});
    // 시작 화면 아래(이렇게 쓸 수 있습니다·다음 단계): 시작 화면 안에서 내린다
    const below=await page.evaluate(()=>{const h=document.querySelector('#site-gate .gate-hero');if(!h)return null;h.scrollTo({top:h.clientHeight-80,behavior:'instant'});return {scrollH:h.scrollHeight,clientH:h.clientHeight};});await sleep(700);
    await keep(page,'03','gate-below',{below});
    await page.evaluate(()=>{const h=document.querySelector('#site-gate .gate-hero');h?.scrollTo({top:0,behavior:'instant'});});await sleep(400);
    await page.tap('#gate-enter');await sleep(2600);
    const first=await page.evaluate(()=>{const r=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {y:Math.round(b.y),h:Math.round(b.height),bottom:Math.round(b.bottom)};};
      const hint=document.querySelector('.bbc-hint');
      return {focus:document.activeElement?.id||document.activeElement?.tagName,hash:location.hash,sheet:r('#sheet-head'),summary:document.getElementById('sheet-summary')?.innerText.replace(/\n+/g,' | '),
        search:r('#search'),chips:r('#use-chips'),firstChip:r('#use-chips button'),list:r('#species-list'),firstCard:r('#species-list .species-card'),tabbar:r('.tabs'),
        hint:hint&&!hint.hidden?r('.bbc-hint'):null,fab:r('.bbc-fab'),detailDocTop:Math.round(document.getElementById('detail').getBoundingClientRect().top+scrollY)};});
    await keep(page,'04','explore',{first});
    await sleep(7000); // 멍이 말풍선이 접힌 뒤의 첫 화면
    await keep(page,'05','explore-settled');

    // ---------- 2. 탐색 지도: 분야 칩 · 종 카드 · 지도 칸 · 종 상세 ----------
    const listTop=await page.evaluate(()=>Math.round(document.getElementById('species-list').getBoundingClientRect().top+scrollY));
    await scrollTo(page,Math.max(0,listTop-H+260));
    await keep(page,'06','cards');
    // 분야 칩 하나 켜기 → 결과
    const chip=await page.evaluate(()=>{const b=[...document.querySelectorAll('#use-chips button')].find(x=>!x.disabled);return b?{t:b.innerText.replace(/\s+/g,' ').trim(),key:b.dataset.use||b.dataset.useKey||''}:null;});
    if(chip){
      await page.tap('#use-chips button:not([disabled])');await sleep(1200);
      const res=await page.evaluate(()=>({count:document.getElementById('species-count')?.textContent,cards:document.querySelectorAll('#species-list .species-card').length,
        pressed:[...document.querySelectorAll('#use-chips button[aria-pressed=true]')].map(x=>x.innerText.replace(/\s+/g,' ').trim()),y:Math.round(scrollY),
        listTop:Math.round(document.getElementById('species-list').getBoundingClientRect().top),extra:document.getElementById('use-extra')?.innerText.replace(/\n+/g,' | ').slice(0,200)}));
      await keep(page,'07','chip-on',{chip,res});
      await page.tap('#use-chips button[aria-pressed=true]');await sleep(900); // 다시 끄기
    }
    // 두 번째 종 카드 누르기
    await scrollTo(page,Math.max(0,listTop-H+260));
    const beforeTap=await page.evaluate(()=>({y:Math.round(scrollY),listLeft:document.getElementById('species-list').scrollLeft}));
    await page.tap('#species-list .sc-wrap:nth-child(2) .species-card');await sleep(1400);
    const afterTap=await page.evaluate(()=>{const d=document.getElementById('detail').getBoundingClientRect();const head=document.querySelector('#detail .detail-head')?.getBoundingClientRect();
      return {y:Math.round(scrollY),hash:location.hash,detailTop:Math.round(d.top),detailHeadTop:head?Math.round(head.top):null,detailH:Math.round(d.height),
        selected:document.querySelector('.species-card.selected b')?.textContent,summary:document.getElementById('sheet-summary')?.innerText.replace(/\n+/g,' | '),historyLength:history.length};});
    await keep(page,'08','card-tapped',{beforeTap,afterTap});
    const backState=()=>page.evaluate(()=>{const c=document.querySelector('.species-card.selected');const r=c?.getBoundingClientRect();
      return {selected:c?.querySelector('b')?.textContent,cardLeft:r?Math.round(r.left):null,cardRight:r?Math.round(r.right):null,cardTop:r?Math.round(r.top):null,listLeft:document.getElementById('species-list').scrollLeft,y:Math.round(scrollY)};});
    const sheetBtn=await page.$('#sheet-summary .ss-open');
    if(sheetBtn){
      // 이 브랜치: 선택 종 요약('근거 자세히 보기')을 누르면 상세가 아래에서 올라오는 시트로 열린다
      const before=await backState();
      await sheetBtn.tap();await sleep(1200);
      const sheet=await page.evaluate(()=>{const d=document.getElementById('ev-drawer'),r=d.getBoundingClientRect(),body=document.getElementById('detail');
        const ax=[...body.querySelectorAll('.axis-card,.ax-card,.detail-axes>*')].slice(0,2).map(e=>Math.round(e.getBoundingClientRect().bottom));
        return {open:d.classList.contains('open'),top:Math.round(r.top),h:Math.round(r.height),title:document.getElementById('ev-drawer-title')?.textContent,
          bodyScrollH:body.scrollHeight,bodyClientH:body.clientHeight,focus:document.activeElement?.className,pageY:Math.round(scrollY),axesBottom:ax};});
      await keep(page,'09','detail',{via:'sheet',sheet});
      await page.evaluate(()=>{const b=document.getElementById('detail');b.scrollTop=b.scrollHeight;});await sleep(600);
      await keep(page,'10','detail-end',{via:'sheet',scrollTop:await page.evaluate(()=>Math.round(document.getElementById('detail').scrollTop))});
      await page.tap('#ev-drawer .evd-close');await sleep(900);
      const back=await backState();
      await keep(page,'11','back-to-list',{via:'sheet',before,back,closed:await page.evaluate(()=>!document.getElementById('ev-drawer').classList.contains('open')),focus:await page.evaluate(()=>document.activeElement?.className)});
    }else{
      // main: 상세는 페이지 맨 아래 → 내려가기
      const detailDocTop=await page.evaluate(()=>Math.round(document.getElementById('detail').getBoundingClientRect().top+scrollY));
      await scrollTo(page,detailDocTop-60);
      await keep(page,'09','detail',{detailDocTop,distance:detailDocTop-60-afterTap.y});
      const docH=await page.evaluate(()=>document.documentElement.scrollHeight);
      await scrollTo(page,docH);
      await keep(page,'10','detail-end',{docH});
      // 목록으로 돌아오기: 사용자는 위로 끌어 올린다. 선택한 카드가 그대로 보이는지
      await scrollTo(page,Math.max(0,listTop-H+260));
      await keep(page,'11','back-to-list',{back:await backState()});
    }
    // 지도 칸: 맨 위로 올려 버블을 눌러 확대 → 셀 하나 누르기
    await scrollTo(page,0);
    const bubble=await page.$('path.occ-bubble');
    if(bubble){await bubble.tap().catch(()=>bubble.click());await sleep(1600);}
    const cell=await page.evaluate(()=>{const ps=[...document.querySelectorAll('#map path.leaflet-interactive')].filter(p=>!p.classList.contains('occ-bubble'));
      const vh=innerHeight;const p=ps.map(p=>({p,r:p.getBoundingClientRect()})).find(({r})=>r.width>14&&r.height>14&&r.top>140&&r.bottom<vh*0.5);
      if(!p)return null;return {x:Math.round(p.r.x+p.r.width/2),y:Math.round(p.r.y+p.r.height/2),w:Math.round(p.r.width),h:Math.round(p.r.height)};});
    if(cell){await page.touchscreen.tap(cell.x,cell.y);await sleep(1300);}
    const popup=await page.evaluate(()=>{const p=document.querySelector('.leaflet-popup,.leaflet-tooltip');const r=p?.getBoundingClientRect();return p?{cls:p.className,text:p.innerText.replace(/\n+/g,' | ').slice(0,220),x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}:null;});
    await keep(page,'12','map-cell',{bubble:!!bubble,cell,popup});
    // 활용 × 보전 지도: 팝업이 열려 있으면 먼저 닫는다(이 브랜치는 팝업이 열린 동안 지도 위 버튼을 숨긴다)
    const pclose=await page.$('.leaflet-popup-close-button');
    if(pclose&&await pclose.isVisible()){await pclose.tap();await sleep(700);}
    const vbtn=await page.$('.map-mode button:nth-child(2)');
    if(vbtn){await vbtn.tap();await sleep(1500);}
    await keep(page,'13','map-value');
    const obtn=await page.$('.map-mode button:nth-child(1)');if(obtn){await obtn.tap();await sleep(800);}

    // ---------- 3. 비교와 지표 ----------
    await tapTab(page,'compare','ko');await sleep(2200);
    const cmp=await page.evaluate(()=>{const r=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {y:Math.round(b.y),h:Math.round(b.height),bottom:Math.round(b.bottom),w:Math.round(b.width)};};
      const pts=[...document.querySelectorAll('#matrix-points .matrix-point')].map(p=>p.getBoundingClientRect());
      const sizes=pts.map(b=>Math.round(Math.min(b.width,b.height)));
      const labels=[...document.querySelectorAll('#matrix-points .point-label')].filter(l=>getComputedStyle(l).display!=='none'&&!l.classList.contains('hidden-label')).map(l=>l.getBoundingClientRect());
      let overlaps=0;for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],c=labels[j];if(a.left<c.right&&c.left<a.right&&a.top<c.bottom&&c.top<a.bottom)overlaps++;}
      return {y:Math.round(scrollY),matrix:r('#matrix'),frame:r('.matrix-frame'),weight:r('.cmp-weight'),bar:r('.cmp-bar'),profile:r('#cmp-profile'),points:pts.length,
        pointSizes:[Math.min(...sizes),Math.max(...sizes)],labelsShown:labels.length,labelOverlaps:overlaps,
        lowestPointBottom:Math.round(Math.max(...pts.map(b=>b.bottom))),vh:innerHeight};});
    await keep(page,'14','compare',{cmp});
    // 매트릭스 점 누르기(가장 아래쪽, 종이 몰린 곳의 점 하나)
    const pt=await page.evaluate(()=>{const ps=[...document.querySelectorAll('#matrix-points .matrix-point')];if(!ps.length)return null;
      const p=ps.map(e=>({e,r:e.getBoundingClientRect()})).sort((a,b)=>b.r.bottom-a.r.bottom)[2]||null;if(!p)return null;
      p.e.scrollIntoView({block:'center'});const r=p.e.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),w:Math.round(r.width),h:Math.round(r.height),name:p.e.getAttribute('aria-label')||p.e.textContent.trim()};});
    await sleep(500);
    if(pt){await page.touchscreen.tap(pt.x,pt.y);await sleep(1500);}
    const picked=await page.evaluate(()=>({y:Math.round(scrollY),profileTop:Math.round(document.getElementById('cmp-profile').getBoundingClientRect().top),cluster:!document.getElementById('matrix-cluster-pop')?.hidden,
      profile:document.getElementById('cmp-profile')?.innerText.replace(/\n+/g,' | ').slice(0,160)}));
    await keep(page,'16','matrix-point',{pt,picked});
    // 데이터 표
    await scrollTo(page,0);
    await page.tap('[data-cmp-mode=table]');await sleep(1600);
    const table=await page.evaluate(()=>{const c=document.getElementById('comparison');const t=c?.querySelector('table');const ths=[...(t?.querySelectorAll('thead th')||[])];
      const vw=innerWidth;const visHeads=ths.filter(th=>{const r=th.getBoundingClientRect();return r.left>=0&&r.right<=vw;}).map(th=>th.innerText.replace(/\s+/g,' ').trim().slice(0,20));
      return {scrollW:c?.scrollWidth,clientW:c?.clientWidth,heads:ths.map(th=>th.innerText.replace(/\s+/g,' ').trim().slice(0,20)),visibleHeads:visHeads,rows:t?.querySelectorAll('tbody tr.cmp-row').length};});
    await keep(page,'17','compare-table',{table});
    const tableTop=await page.evaluate(()=>Math.round(document.getElementById('comparison').getBoundingClientRect().top+scrollY));
    await scrollTo(page,tableTop-80);
    await keep(page,'18','compare-table-rows');
    // 나란히 비교: 두 종을 담고 비교 창 열기
    await scrollTo(page,0);
    await page.tap('[data-cmp-mode=matrix]');await sleep(1000);
    const basket=await page.evaluate(async()=>{const boxes=[...document.querySelectorAll('#cmp-profile [data-basket], .cmp-basket-add, [data-cmp-add]')];return boxes.length;});
    log.scenes['basket-controls']={count:basket};

    // ---------- 4. 근거와 방법 ----------
    await tapTab(page,'method','ko');await sleep(1800);
    const nav0=await page.evaluate(()=>{const t=document.querySelector('.tabs').getBoundingClientRect();return {tabsTop:Math.round(t.top),tabsBottom:Math.round(t.bottom),vh:innerHeight};});
    await keep(page,'19','method',{nav:nav0});
    await scrollBy(page,1500);
    const nav1=await page.evaluate(()=>{const t=document.querySelector('.tabs').getBoundingClientRect(),x=document.querySelector('.expedition-link').getBoundingClientRect();
      return {tabsTop:Math.round(t.top),tabsBottom:Math.round(t.bottom),expTop:Math.round(x.top),vh:innerHeight,y:Math.round(scrollY),tabsVisible:t.bottom>0&&t.top<innerHeight};});
    await keep(page,'19b','method-scrolled',{nav:nav1});
    await scrollTo(page,0);
    const acc=await page.$('#mt-acc-01>summary');
    if(acc){await acc.scrollIntoViewIfNeeded();await sleep(300);await acc.tap();await sleep(900);}
    const accInfo=await page.evaluate(()=>{const d=document.getElementById('mt-acc-01');const s=d?.querySelector('summary')?.getBoundingClientRect();return {open:d?.open,summaryH:s?Math.round(s.height):null,summaryTop:s?Math.round(s.top):null,bodyH:Math.round(d?.querySelector('.mt-acc-body')?.getBoundingClientRect().height||0)};});
    await keep(page,'20','method-acc-open',{accInfo});
    if(acc){await page.evaluate(()=>document.querySelector('#mt-acc-01>summary').scrollIntoView({block:'start'}));await sleep(300);await acc.tap();await sleep(500);}
    const closed=await page.evaluate(()=>!document.getElementById('mt-acc-01')?.open);
    log.scenes['20-method-acc-open'].closedAgain=closed;

    // ---------- 5. 멍이 안내 ----------
    await tapTab(page,'explore','ko');await sleep(1200);await scrollTo(page,0);
    await page.tap('.bbc-fab');await sleep(1500);
    const chat=await page.evaluate(()=>{const p=document.querySelector('.bbc-panel');const r=p?.getBoundingClientRect();const chips=[...document.querySelectorAll('.bbc-chips button')].map(b=>b.innerText.trim());
      const inp=document.querySelector('.bbc-input');return {open:!!p&&!p.hidden,top:r?Math.round(r.top):null,h:r?Math.round(r.height):null,chips:chips.slice(0,8),inputH:inp?Math.round(inp.getBoundingClientRect().height):null,inputFs:inp?getComputedStyle(inp).fontSize:null};});
    await keep(page,'22','guide-open',{chat});
    const q=await page.$('.bbc-chips button');
    if(q){await q.tap();await sleep(2200);}
    const ans=await page.evaluate(()=>{const log=document.querySelector('.bbc-log');return {last:log?.lastElementChild?.innerText.replace(/\n+/g,' | ').slice(0,200),scrollTop:log?.scrollTop,scrollH:log?.scrollHeight};});
    await keep(page,'23','guide-answer',{ans});
    await page.tap('.bbc-close').catch(()=>{});await sleep(600);
    log.errors=errors.slice(0,20);
    await page.context().close();

    // ---------- 6. 바다 탐험 (WebGL이 없는 이 환경에서는 카드 목록으로 열린다) ----------
    if(want('24')||want('24b')){
      process.env.GL='swiftshader';const gb=await launch();delete process.env.GL;
      try{
        const {page}=await open(gb,{w:W,h:H});
        await page.goto(BASE+'expedition.html?sail=2');await sleep(6000);
        const ex=await page.evaluate(()=>{const vis=e=>e.offsetParent!==null&&getComputedStyle(e).visibility!=='hidden';
          const how=[...document.querySelectorAll('.x-howto li')].filter(vis).map(li=>li.innerText.replace(/\s+/g,' ').trim());
          const brand=document.querySelector('.x-brand');const br=brand?.getBoundingClientRect();
          return {howto:how,keys:[...document.querySelectorAll('.x-howto kbd')].filter(vis).map(k=>k.innerText.trim()),brandH:br?Math.round(br.height):null,mode:document.body.className};});
        await keep(page,'24','expedition',{ex});
        await page.tap('#start');await sleep(7000);
        const stop=await page.evaluate(()=>{const c=document.getElementById('stop-card'),s=document.getElementById('steer');const r=c.getBoundingClientRect(),q=s.getBoundingClientRect();
          return {hash:location.hash,cardTop:Math.round(r.top),cardH:Math.round(r.height),steerTop:Math.round(q.top),label:document.getElementById('steer-label')?.innerText};});
        await keep(page,'24b','expedition-stop',{stop});
        await page.context().close();
      }finally{await gb.close();}
    }
    // ---------- 7. 공유 링크로 바로 들어오기 ----------
    {
      const {page}=await open(b,{w:W,h:H});
      await page.goto(BASE+'#v=compare&s=836033');await waitData(page);await sleep(2500);
      const sh=await page.evaluate(()=>({gate:document.documentElement.classList.contains('gate-on'),view:document.querySelector('.view.active')?.id,y:Math.round(scrollY),hash:location.hash}));
      await keep(page,'25','shared-link',{sh});
      await page.context().close();
    }
    // ---------- 8. 한국어 ↔ English ----------
    {
      const {page}=await open(b,{w:W,h:H});
      await page.goto(BASE+'?lang=en#v=explore&s=836033');await waitData(page);await sleep(3000);
      await keep(page,'26','en-explore');
      await tapTab(page,'compare','en');await sleep(2000);
      await keep(page,'27','en-compare');
      await tapTab(page,'method','en');await sleep(1500);
      await keep(page,'28','en-method');
      await page.context().close();
    }
    // ---------- 9. 로딩 · 빈 결과 · 오류 ----------
    {
      process.env.DELAY='9000';
      const {page}=await open(b,{w:W,h:H});
      await page.goto(BASE+'#v=explore&s=836033');await sleep(2500);
      await keep(page,'29','state-loading');
      delete process.env.DELAY;
      await page.context().close();
    }
    {
      const {page}=await open(b,{w:W,h:H});
      await page.goto(BASE+'#v=explore');await waitData(page);await sleep(2500);
      await page.fill('#search','없는이름xyz');await sleep(900);
      const listTop2=await page.evaluate(()=>Math.round(document.getElementById('sheet-head').getBoundingClientRect().top+scrollY));
      await scrollTo(page,listTop2-120);
      await keep(page,'30','state-no-match',{msg:await page.evaluate(()=>document.getElementById('species-list').innerText)});
      await page.context().close();
    }
    {
      const {page}=await open(b,{w:W,h:H,supa:'empty'});
      await page.goto(BASE+'#v=explore');await waitData(page);await sleep(2500);
      await keep(page,'30b','state-api-empty',{state:await page.evaluate(()=>document.getElementById('connection-state')?.textContent)});
      await page.context().close();
    }
    {
      const {page}=await open(b,{w:W,h:H,supa:'block'});
      await page.goto(BASE+'#v=explore');await waitData(page);await sleep(2500);
      await keep(page,'31','state-api-down',{state:await page.evaluate(()=>document.getElementById('connection-state')?.textContent)});
      await page.context().close();
    }
    {
      const {page,ctx}=await open(b,{w:W,h:H,supa:'block'});
      await ctx.route(/live-snapshot\.json/,r=>r.abort());
      await page.goto(BASE+'#v=explore');await waitData(page);await sleep(2500);
      await keep(page,'32','state-error',{state:await page.evaluate(()=>document.getElementById('connection-state')?.textContent)});
      await tapTab(page,'compare','error');await sleep(1200);
      await keep(page,'33','state-error-compare');
      await page.context().close();
    }
  }catch(e){log.fatal=String(e.stack||e);console.error(W,e);}
  finally{await b.close();}
  log.tabTapFailures=tapFails.splice(0);
  fs.writeFileSync(path.join(OUT,`${W}-walk.json`),JSON.stringify(log,null,1));
  console.log(W,'scenes',Object.keys(log.scenes).length,log.fatal?'FATAL':'ok');
}
for(const W of WIDTHS)await walk(W);

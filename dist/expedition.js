// Sea expedition: one state object drives the ship, the camera, the stop card and the detail panel.
// Data: expedition-stops.json (built from the released public files by scripts/build_expedition_stops.py).
// The pure part above the browser marker is evaluated by verification/test_expedition_ui.mjs.

// Lat/lon -> world units on the sea plane (10 units per degree, equirectangular around 35°N 128°E).
const PROJ={lat:35,lon:128,k:10};
const project=(lat,lon)=>({x:(lon-PROJ.lon)*PROJ.k*Math.cos(PROJ.lat*Math.PI/180),z:-(lat-PROJ.lat)*PROJ.k});
// Presentation route (연출용): a start point and waypoints that keep the curve off the coastline in countries.json.
// ROUTE_VIA[i] lies between stop i-1 and stop i (ROUTE_VIA[0] between the start and the first stop).
// It is not a survey track; the page always says so. verification/test_expedition_ui.mjs checks it stays at sea.
const ROUTE_START=[34.0,126.0];
const ROUTE_VIA=[[[34.05,127.0],[34.3,127.7]],[[34.38,128.0]],[[34.2,129.0],[33.97,129.45]]];
const REVEAL_DONE=3, REVEAL_DETAIL=4;

function routePoints(stops){
  const pts=[{lat:ROUTE_START[0],lon:ROUTE_START[1],stop:-1}];
  stops.forEach((s,i)=>{
    for(const [lat,lon] of ROUTE_VIA[i]||[])pts.push({lat,lon,stop:-1});
    pts.push({lat:s.cell.center[0],lon:s.cell.center[1],stop:i});
  });
  return pts;
}
// Catmull-Rom through the route points, sampled; returns lat/lon samples, cumulative length and each stop's t (0..1).
function sampleRoute(stops,perSegment=80){
  const pts=routePoints(stops), P=[pts[0],...pts,pts[pts.length-1]], out=[], stopIdx=[];
  for(let i=1;i<P.length-2;i++){
    const [p0,p1,p2,p3]=[P[i-1],P[i],P[i+1],P[i+2]];
    if(p1.stop>=0)stopIdx[p1.stop]=out.length;
    for(let k=0;k<perSegment;k++){
      const t=k/perSegment,t2=t*t,t3=t2*t,f=key=>.5*(2*p1[key]+(-p0[key]+p2[key])*t+(2*p0[key]-5*p1[key]+4*p2[key]-p3[key])*t2+(-p0[key]+3*p1[key]-3*p2[key]+p3[key])*t3);
      out.push({lat:f('lat'),lon:f('lon')});
    }
  }
  const last=pts[pts.length-1];stopIdx[last.stop]=out.length;out.push({lat:last.lat,lon:last.lon});
  const len=[0];
  for(let i=1;i<out.length;i++){const a=project(out[i-1].lat,out[i-1].lon),b=project(out[i].lat,out[i].lon);len.push(len[i-1]+Math.hypot(b.x-a.x,b.z-a.z));}
  const total=len[len.length-1];
  return {samples:out,len,total,stopT:stopIdx.map(i=>len[i]/total)};
}
// Position on the sampled route at t (0..1).
function routeAt(route,t){
  const d=Math.min(Math.max(t,0),1)*route.total, L=route.len;
  let lo=0,hi=L.length-1;
  while(hi-lo>1){const m=(lo+hi)>>1;if(L[m]<=d)lo=m;else hi=m;}
  const a=route.samples[lo],b=route.samples[hi],f=L[hi]>L[lo]?(d-L[lo])/(L[hi]-L[lo]):0;
  const p=project(a.lat+(b.lat-a.lat)*f,a.lon+(b.lon-a.lon)*f);
  const pa=project(a.lat,a.lon),pb=project(b.lat,b.lon);
  return {x:p.x,z:p.z,dx:pb.x-pa.x,dz:pb.z-pa.z};
}

function makeState(n,stopT){
  return {n,stopT,stop:-1,t:0,phase:'intro',reveal:Array(n).fill(0),detailOpen:false,arrived:-1};
}
// Every input calls go(): it only changes the target stop. step() moves t toward it.
function go(s,i){
  if(!Number.isInteger(i))return s;
  i=Math.min(Math.max(i,0),s.n-1);
  s.detailOpen=false;
  s.stop=i;
  if(s.arrived===i&&Math.abs(s.t-s.stopT[i])<1e-6){s.phase='arrived';return s;}
  s.phase='sailing';s.arrived=-1;
  return s;
}
const next=s=>go(s,s.stop<0?0:s.stop+1);
const prev=s=>go(s,s.stop<0?0:s.stop-1);
// Advance t toward the target stop by at most speed*dt (units of t per second), easing in the last stretch.
// instant=true (reduced motion) jumps. Returns true on the frame the ship arrives.
function step(s,dt,{speed=.09,instant=false}={}){
  if(s.phase!=='sailing'||s.stop<0)return false;
  const goal=s.stopT[s.stop], gap=goal-s.t;
  const move=instant?Math.abs(gap):Math.min(Math.abs(gap),Math.max(.004,Math.min(speed,Math.abs(gap)*1.6))*dt);
  s.t+=Math.sign(gap)*move;
  if(Math.abs(goal-s.t)<1e-5){
    s.t=goal;s.phase='arrived';s.arrived=s.stop;
    if(s.reveal[s.stop]<1)s.reveal[s.stop]=1;
    return true;
  }
  return false;
}
// Discovery steps after arrival: 1 sea area and records, 2 species, 3 values. 4 = detail opened. Never goes back.
function advanceReveal(s){
  if(s.phase!=='arrived'||s.arrived<0)return false;
  if(s.reveal[s.arrived]>=REVEAL_DONE)return false;
  s.reveal[s.arrived]++;return true;
}
function openDetail(s){
  if(s.phase!=='arrived'||s.arrived<0)return false;
  s.detailOpen=true;s.reveal[s.arrived]=REVEAL_DETAIL;return true;
}
function closeDetail(s){s.detailOpen=false;}
// Place the ship on a stop without sailing (deep link, reduced motion, restored session).
function placeAt(s,i,reveal){
  go(s,i);s.t=s.stopT[s.stop];s.phase='arrived';s.arrived=s.stop;
  s.reveal[s.stop]=Math.max(s.reveal[s.stop],reveal??1);
}
const hashFor=s=>s.stop>=0?`#stop=${s.stop+1}`:'';
function stopFromHash(hash,n){
  const m=/(?:^#|&)stop=(\d+)(?:&|$)/.exec(hash||'');
  const i=m?Number(m[1])-1:-1;
  return i>=0&&i<n?i:-1;
}
// The existing map opens this species with its published cell in view (index.html readHash/applyHash format).
const mapHref=stop=>stop.map_link;
// The two largest of the three axes lead the card; the rest stay small. A missing value is never ranked as 0.
function headlineAxes(stop){
  const v=k=>stop.scores[k];
  return ['MFPI','MBPI','MCUI'].filter(k=>v(k)!==null&&v(k)!==undefined).sort((a,b)=>v(b)-v(a)).slice(0,2);
}
const fmtScore=v=>v===null||v===undefined?null:Number(v).toFixed(1);

// ---- browser ----
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=u=>/^https?:\/\//i.test(String(u||''))?u:null;
const link=(url,label)=>safeUrl(url)?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`:`${esc(label)} <span class="x-missing">원자료 링크 없음</span>`;
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
const AXIS={MFPI:'식량자원 잠재력',MBPI:'신약개발(생리활성) 잠재성',MCUI:'보전 시급성',BBVI:'식량·생리활성 결합 가치'};
const SEA_KO={'Yellow Sea':'황해','East China Sea':'동중국해','Sea of Japan':'동해','Kuroshio Current':'쿠로시오 해류'}; // same names as app.js
const KIND={peptide:'펩타이드 비교집단',amp:'항균 펩타이드 비교집단(MIC)',chembl:'ChEMBL 화합물 비교집단',xo:'XO 문헌 비교집단',relaxed:'완화 산출'};
let DATA=null,STATE=null,ROUTE=null,scene=null,revealTimer=null,lastFocus=null;

// Hand-drawn species illustrations (code-generated SVG, no photo in the repository).
const ART={
  836033:`<svg viewBox="0 0 120 90" role="img" aria-label="참굴 일러스트"><path d="M14 52c4-26 30-40 56-38 22 2 38 14 36 30-2 18-26 32-52 32C30 76 11 68 14 52z" fill="#cfd8d6" stroke="#eef6f4" stroke-width="2"/><path d="M22 52c8-14 24-24 44-25M26 60c12-10 30-17 52-16M34 68c14-6 32-9 50-6" fill="none" stroke="#8fa3a0" stroke-width="2" stroke-linecap="round"/><ellipse cx="78" cy="44" rx="14" ry="8" fill="#e9e1cf" opacity=".7"/></svg>`,
  145721:`<svg viewBox="0 0 120 90" role="img" aria-label="미역 일러스트"><path d="M60 86C58 62 52 40 40 12M60 86c4-24 14-44 30-70M60 86c-2-18 2-34 10-48" fill="none" stroke="#7fb59a" stroke-width="3" stroke-linecap="round"/><path d="M40 12c-10 10-14 24-6 34 6-10 10-22 6-34zM90 16c-2 14-10 24-20 28 0-12 8-24 20-28zM70 38c-10 6-14 16-10 26 8-6 12-16 10-26zM46 40c-12 4-18 14-14 26 8-6 14-14 14-26z" fill="#4f8f6f" stroke="#a9dcc2" stroke-width="1.5"/></svg>`,
  241776:`<svg viewBox="0 0 120 90" role="img" aria-label="해삼 일러스트"><path d="M12 54c6-18 30-26 54-24 24 2 44 10 42 24-2 12-24 18-48 18S8 68 12 54z" fill="#6d5b4f" stroke="#c8b4a2" stroke-width="2"/><g fill="#a48a76">${[22,34,46,58,70,82,94].map((x,i)=>`<path d="M${x} ${38+(i%2)*2}l4-10 4 10z"/>`).join('')}</g><circle cx="102" cy="52" r="3" fill="#2b211b"/></svg>`
};
const art=stop=>ART[stop.aphia_id]||`<svg viewBox="0 0 120 90" role="img" aria-label="해양생물 일러스트"><circle cx="60" cy="45" r="28" fill="none" stroke="#9fd6d0" stroke-width="2"/></svg>`;

function seaNames(cell){return (cell.sea_areas||[]).length?cell.sea_areas.map(n=>SEA_KO[n]||n).join(' · '):'해역명 미확인';}
function cellExtent(c){
  const s=c.size_deg;return `${s}° 셀 · 북위 ${c.lat0}–${c.lat0+s}° · 동경 ${c.lon0}–${c.lon0+s}°`;
}
function yearsText(c){return c.year_start===c.year_end?`${c.year_start}년`:`${c.year_start}–${c.year_end}년`;}
function checkTag(k){
  const r=DATA.axis_checks[k];
  if(k==='MFPI'&&r==='passed')return `방법 검증 통과(${DATA.mfpi_check_n}종 비교)`;
  return r==='passed'?'검증 통과':r==='failed'?'검증 미통과':'검증 전';
}
function mcuiTag(stop){
  const m=stop.mcui;
  if(m.basis==='iucn')return `공식 평가 범주 · IUCN ${esc(m.category)}${m.assessment_year?` (${esc(m.assessment_year)} 평가)`:''}`;
  if(m.basis==='national')return `국가 평가 · 한국 ${esc(m.category||'범주 미확인')}`;
  return esc(m.label||m.basis_label||'근거 미확인');
}
function axisTag(stop,k){
  if(k==='MCUI')return mcuiTag(stop);
  if(k==='MBPI')return `${checkTag('MBPI')} · ${esc(DATA.notes.mbpi)}`;
  if(k==='BBVI')return `${checkTag('BBVI')}${stop.bbvi_label?` · ${esc(stop.bbvi_label)}`:''} · ${esc(DATA.notes.score)}`;
  return checkTag(k);
}
function scoreHtml(stop,k,big){
  const v=fmtScore(stop.scores[k]);
  const value=v===null?`<span class="x-missing">자료 없음</span>${stop.withheld_reasons?.[k]?` <small>${esc(stop.withheld_reasons[k])}</small>`:''}`:`<b>${v}</b><small>/100</small>`;
  return `<div class="x-score${big?' is-big':''}" data-axis="${k}"><span class="x-axis">${k} <em>${AXIS[k]}</em></span><span class="x-val">${value}</span><span class="x-tag">${axisTag(stop,k)}</span></div>`;
}
// The arrival card. Sections carry their discovery step; CSS shows a section once state.reveal reaches it.
function cardHtml(stop,i,level,mode){
  const c=stop.cell, lead=headlineAxes(stop), rest=['MFPI','MBPI','MCUI','BBVI'].filter(k=>!lead.includes(k));
  return `<article class="x-card" data-stop="${i}" data-level="${level}">
  <p class="x-step-label">탐사 지점 ${i+1} / ${DATA.stops.length}</p>
  <div class="x-r" data-r="1"><p class="x-sea">${esc(seaNames(c))}</p>
    <p class="x-obs">이 ${c.size_deg}° 셀에서 ${esc(yearsText(c))} 관측 기록 <b>${esc(c.records)}</b>건 <small>(지점 ${esc(c.sites)}곳)</small></p>
    <p class="x-fine">${esc(cellExtent(c))} · ${esc(DATA.notes.cell)}</p></div>
  <div class="x-r x-species" data-r="2"><div class="x-art">${art(stop)}<span>직접 그린 일러스트 · 사진 자료 없음</span></div>
    <div><h2 class="x-name">${esc(stop.korean_name)}</h2><p class="x-sci"><i>${esc(stop.scientific_name)}</i> · AphiaID ${esc(stop.aphia_id)}</p>
    <p class="x-type">${esc(stop.matrix_type.label||'유형 미배정')}</p></div></div>
  <div class="x-r" data-r="3"><div class="x-scores">${lead.map(k=>scoreHtml(stop,k,true)).join('')}</div>
    <div class="x-scores is-small">${rest.map(k=>scoreHtml(stop,k,false)).join('')}</div>
    <div class="x-actions"><button type="button" class="x-primary" data-detail="${i}">자세히 보기</button><a class="x-ghost" href="${esc(mapHref(stop))}">지도에서 보기</a></div>
    ${level>=REVEAL_DETAIL?'<p class="x-fine x-seen">근거 열람함</p>':''}</div>
</article>`;
}
function nutrientRow(n){
  return n.value===null?`<li><span>${esc(n.label)}</span><span class="x-missing">자료 없음</span></li>`
    :`<li><span>${esc(n.label)}</span><b>${esc(n.value)} ${esc(n.unit)}</b><small>비교 식품 중 백분위 ${esc(n.percentile)}</small></li>`;
}
function detailHtml(stop,i){
  const c=stop.cell, f=stop.food, b=stop.bio, m=stop.mcui;
  const pct=v=>v===null||v===undefined?'<span class="x-missing">미확인</span>':`${esc(+(v*100).toFixed(4))}%`;
  const food=f?`<p>${esc(f.food_name||'식품명 미확인')} · ${esc(f.basis||'')} 기준 (비교 ${esc(f.cohort_species??'미확인')}종)</p>
      <ul class="x-nutrients">${f.nutrients.map(nutrientRow).join('')}</ul>
      <p>먹는 부분 비율 ${pct(f.edible_fraction)} · 양식 ${f.aquaculture?.feasible===true?'가능 근거 있음':f.aquaculture?.feasible===false?'근거 없음':'<span class="x-missing">미확인</span>'}${f.aquaculture?.method?` <small>(${esc(f.aquaculture.method)})</small>`:''}</p>
      <p class="x-src">${f.source?link(f.source.url,f.source.title||f.source.id):'<span class="x-missing">원자료 미확인</span>'}</p>`:'<p class="x-missing">자료 없음</p>';
  const bio=b?`<p>${esc(KIND[b.stratum_kind]||b.stratum_kind||'비교집단 미확인')}</p>
      <dl class="x-dl"><dt>물질</dt><dd>${esc(b.subject||'미확인')}</dd><dt>표적</dt><dd>${esc(b.target||'미확인')}</dd>
      <dt>측정</dt><dd>${b.value!==null&&b.value!==undefined?`${esc(b.endpoint)} ${esc(b.relation||'')} ${esc(b.value)} ${esc(b.unit||'')}`:b.median_pchembl!=null?`${esc(b.endpoint)} 중앙 pChEMBL ${esc(b.median_pchembl)}`:'<span class="x-missing">미확인</span>'}</dd>
      <dt>비교집단 백분위</dt><dd>${esc(b.percentile??'미확인')}</dd><dt>근거 계수</dt><dd>${esc(b.evidence_factor??'미확인')}</dd></dl>
      <p class="x-src">${b.links.length?b.links.map((u,j)=>link(u,'원논문 DOI '+b.dois[j])).join('<br>'):'<span class="x-missing">원논문 링크 없음</span>'}</p>
      <p class="x-fine">${esc(DATA.notes.mbpi)}</p>`:'<p class="x-missing">자료 없음</p>';
  const cons=`<p>${esc(m.basis_label||'근거 미확인')} · 범주 ${esc(m.category||'미확인')}${m.assessment_year?` · ${esc(m.assessment_year)}년 평가`:''}${m.criteria?` · 기준 ${esc(m.criteria)}`:''}</p>
      ${m.mapping?`<p class="x-fine">점수 환산: ${esc(m.mapping)}</p>`:''}${m.label?`<p class="x-fine">${esc(m.label)}</p>`:''}${m.scope?`<p class="x-fine">범위: ${esc(m.scope)}</p>`:''}
      <p class="x-src">${m.source?link(m.source.url,m.source.title||m.source.id):'<span class="x-missing">원자료 미확인</span>'}</p>`;
  const cites=(c.citations||[]).map(x=>`<li>${link(x.url,x.title)} <small>${esc((x.licenses||[]).join(' · ')||'라이선스 미확인')}</small></li>`).join('')||'<li class="x-missing">데이터셋 인용 없음</li>';
  const sources=stop.sources.map(s=>`<li>${link(s.url,s.title||s.id)}${s.license?` <small>${esc(s.license)}</small>`:''}</li>`).join('');
  const nextBtn=i<DATA.stops.length-1?`<button type="button" class="x-primary" data-go="${i+1}">다음 지점: ${esc(DATA.stops[i+1].korean_name)}</button>`:'';
  return `<header class="x-detail-head"><p class="x-chips"><span>${esc(seaNames(c))}</span><span>${esc(c.size_deg)}° 셀</span><span>${esc(yearsText(c))}</span></p>
    <h2 id="detail-title">${esc(stop.korean_name)} <i>${esc(stop.scientific_name)}</i></h2>
    <p class="x-type">${esc(stop.matrix_type.label||'유형 미배정')} · 정보충분도 ${stop.information_sufficiency===null?'<span class="x-missing">미확인</span>':esc(Math.round(stop.information_sufficiency*100))+'%'}</p></header>
  <section><h3>관측 위치·기간</h3>
    <p>${esc(cellExtent(c))} · ${esc(c.period)} 기간 · ${esc(yearsText(c))} 기록 ${esc(c.records)}건(지점 ${esc(c.sites)}곳) · ${esc(seaNames(c))}</p>
    <p class="x-fine">${esc(DATA.notes.cell)}. 이 종의 공개 셀 ${esc(stop.public_cells)}개 · 기록 합계 ${esc(stop.public_records)}건 (공개 사본 기준일 ${esc(DATA.cells_snapshot)}).</p>
    <ul class="x-cites">${cites}</ul></section>
  <section><h3>식량 가치 근거 <small>MFPI ${fmtScore(stop.scores.MFPI)??'자료 없음'} · ${checkTag('MFPI')}</small></h3>${food}</section>
  <section><h3>생리활성 근거 <small>MBPI ${fmtScore(stop.scores.MBPI)??'자료 없음'} · ${checkTag('MBPI')}</small></h3>${bio}</section>
  <section><h3>보전 평가 근거 <small>MCUI ${fmtScore(stop.scores.MCUI)??'자료 없음'}</small></h3>${cons}</section>
  <section><h3>종합 <small>BBVI ${fmtScore(stop.scores.BBVI)??'자료 없음'} · ${checkTag('BBVI')}</small></h3>
    <p>MFPI와 MBPI를 식량 가중치 ${esc(DATA.food_weight)}로 결합한 값입니다${stop.bbvi_label?` · ${esc(stop.bbvi_label)}`:''}. ${esc(DATA.notes.score)}.</p>
    <p class="x-fine">지표 ${esc(DATA.method_version)} (${esc(DATA.status)}) · 축별 사후 검증: MFPI ${checkTag('MFPI')}, MBPI ${checkTag('MBPI')}, BBVI ${checkTag('BBVI')}.</p></section>
  <details class="x-sources"><summary>논문·원자료 링크 ${stop.sources.length}개</summary><ul>${sources}</ul></details>
  <div class="x-actions"><a class="x-ghost" href="${esc(mapHref(stop))}">지도에서 보기</a>${nextBtn}</div>`;
}

/* ---------- DOM ---------- */
function renderProgress(){
  const s=STATE;
  $('progress').innerHTML=DATA.stops.map((st,i)=>`<li class="${i===s.arrived?'is-here':''}${s.reveal[i]>0?' is-seen':''}"><button type="button" data-go="${i}" aria-label="지점 ${i+1} ${esc(st.korean_name)}${i===s.arrived?' (현재)':''}"><span>${i+1}</span></button></li>`).join('');
  $('progress').style.setProperty('--t',s.t.toFixed(4));
  $('stop-list-items').innerHTML=DATA.stops.map((st,i)=>`<li><button type="button" data-go="${i}"><b>${i+1}. ${esc(st.korean_name)}</b> <span>${esc(seaNames(st.cell))} · ${esc(st.matrix_type.label||'')}</span></button></li>`).join('');
}
function renderCard(){
  const s=STATE,card=$('stop-card'),steer=$('steer');
  const show=s.phase==='arrived'&&s.arrived>=0&&!document.body.classList.contains('is-cards');
  steer.hidden=s.phase==='intro'||document.body.classList.contains('is-cards');
  $('prev').disabled=s.stop<=0;$('next').disabled=s.stop>=s.n-1;
  $('steer-label').textContent=s.phase==='sailing'?`${DATA.stops[s.stop].korean_name} 지점으로 항해 중`:s.arrived>=0?`지점 ${s.arrived+1} / ${s.n}`:'';
  if(!show){card.hidden=true;card.dataset.stop='';return;}
  const i=s.arrived;
  const key=i+(s.reveal[i]>=REVEAL_DETAIL?':seen':'');
  if(card.dataset.stop!==key){card.innerHTML=cardHtml(DATA.stops[i],i,s.reveal[i],'3d');card.dataset.stop=key;}
  card.querySelector('.x-card').dataset.level=s.reveal[i];
  card.hidden=false;
}
function renderCards(){
  $('cards-list').innerHTML=DATA.stops.map((st,i)=>cardHtml(st,i,Math.max(REVEAL_DONE,STATE.reveal[i]),'cards')).join('');
}
function render(){renderProgress();renderCard();}
function save(){
  try{history.replaceState(null,'',location.pathname+location.search+hashFor(STATE)+(document.body.classList.contains('is-cards')?(STATE.stop>=0?'&':'#')+'view=cards':''));}catch{}
  try{sessionStorage.setItem('bbvm-expedition',JSON.stringify({stop:STATE.stop,reveal:STATE.reveal}));}catch{}
}
function scheduleReveal(){
  clearTimeout(revealTimer);
  if(STATE.phase!=='arrived')return;
  if(reduceMotion.matches){while(advanceReveal(STATE));render();save();return;}
  revealTimer=setTimeout(()=>{if(advanceReveal(STATE)){render();save();scheduleReveal();}},750);
}
function onArrive(){render();save();scheduleReveal();announce(`${DATA.stops[STATE.arrived].korean_name} 지점에 도착했습니다.`);}
function announce(t){$('steer-label').textContent=t;}
function toast(t){const el=$('toast');el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,6000);}

function doGo(i){
  if(STATE.detailOpen)hideDetail(false);
  if(STATE.phase==='intro')leaveIntro();
  go(STATE,i);
  if(document.body.classList.contains('is-cards')){placeAt(STATE,STATE.stop,REVEAL_DONE);document.querySelector(`#cards-list [data-stop="${STATE.stop}"]`)?.scrollIntoView({behavior:reduceMotion.matches?'auto':'smooth',block:'start'});}
  else if(reduceMotion.matches||!scene){placeAt(STATE,STATE.stop);onArrive();return;}
  render();save();
}
function leaveIntro(){$('intro').hidden=true;document.body.classList.remove('is-intro');}
function showDetail(i){
  if(document.body.classList.contains('is-cards')){placeAt(STATE,i,REVEAL_DONE);}
  if(!openDetail(STATE))return;
  lastFocus=document.activeElement;
  $('detail-body').innerHTML=detailHtml(DATA.stops[i],i);
  const d=$('detail');if(!d.open)d.showModal();
  d.scrollTop=0;$('detail-close').focus();
  render();save();
}
function hideDetail(restore=true){
  const d=$('detail');closeDetail(STATE);if(d.open)d.close();
  render();if(document.body.classList.contains('is-cards'))renderCards();
  // the card may have been redrawn (근거 열람함): return focus to its 자세히 보기 button
  if(restore)(lastFocus?.isConnected?lastFocus:document.querySelector(`#stop-card:not([hidden]) [data-detail], #cards-list [data-detail="${STATE.arrived}"]`))?.focus();
}
function setCards(on,reason){
  document.body.classList.toggle('is-cards',on);
  $('view-toggle').setAttribute('aria-pressed',String(on));
  $('view-toggle').textContent=on?'항해 화면':'카드 목록';
  $('cards-reason').textContent=reason||'';
  if(on){leaveIntro();renderCards();}
  render();save();
}

function bindInput(){
  document.addEventListener('click',e=>{
    const g=e.target.closest('[data-go]');if(g){$('stop-list').hidePopover?.();doGo(Number(g.dataset.go));return;}
    const d=e.target.closest('[data-detail]');if(d){showDetail(Number(d.dataset.detail));}
  });
  $('start').onclick=()=>{leaveIntro();doGo(0);};
  $('resume').onclick=()=>{leaveIntro();const s=JSON.parse(sessionStorage.getItem('bbvm-expedition')||'{}');s.reveal?.forEach((r,i)=>STATE.reveal[i]=Math.max(STATE.reveal[i],r|0));placeAt(STATE,s.stop);if(scene)scene.snap();onArrive();};
  $('prev').onclick=()=>doGo(STATE.stop-1);$('next').onclick=()=>doGo(STATE.stop+1);
  $('detail-close').onclick=()=>hideDetail();
  $('detail').addEventListener('close',()=>{if(STATE.detailOpen)hideDetail();});
  $('view-toggle').onclick=()=>setCards(!document.body.classList.contains('is-cards'),scene?'':'3D 화면을 쓸 수 없어 카드 목록으로 보여 줍니다.');
  if(!scene)$('view-toggle').disabled=true;
  document.addEventListener('keydown',e=>{
    if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||STATE.detailOpen)return;
    if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;
    if(document.body.classList.contains('is-cards'))return;
    if(STATE.phase==='intro'){if(e.key==='Enter'&&e.target===document.body){leaveIntro();doGo(0);}return;}
    if(['ArrowRight','ArrowDown','PageDown'].includes(e.key)){e.preventDefault();doGo(STATE.stop+1);}
    else if(['ArrowLeft','ArrowUp','PageUp'].includes(e.key)){e.preventDefault();doGo(STATE.stop-1);}
    else if(/^[1-9]$/.test(e.key)&&Number(e.key)<=STATE.n)doGo(Number(e.key)-1);
  });
  // One wheel gesture = one stop. The panel and the card keep their own scroll.
  let acc=0,lock=0;
  addEventListener('wheel',e=>{
    if(STATE.detailOpen||document.body.classList.contains('is-cards')||STATE.phase==='intro')return;
    // a card that can still scroll that way keeps the wheel
    const box=e.target.closest('.x-stop,.x-list');
    if(box&&box.scrollHeight>box.clientHeight+1&&(e.deltaY>0?box.scrollTop+box.clientHeight<box.scrollHeight-1:box.scrollTop>0))return;
    e.preventDefault();
    const now=performance.now();if(now<lock)return;
    acc+=e.deltaY+e.deltaX;
    if(Math.abs(acc)>40){doGo(STATE.stop+(acc>0?1:-1));acc=0;lock=now+450;}
  },{passive:false});
  let t0=null;
  $('sea').addEventListener('touchstart',e=>{t0=e.touches[0];},{passive:true});
  $('sea').addEventListener('touchend',e=>{
    if(!t0||STATE.phase==='intro'||STATE.detailOpen)return;
    const t=e.changedTouches[0],dx=t.clientX-t0.clientX,dy=t.clientY-t0.clientY;t0=null;
    if(Math.max(Math.abs(dx),Math.abs(dy))<40)return;
    doGo(STATE.stop+((Math.abs(dx)>Math.abs(dy)?-dx:-dy)>0?1:-1));
  },{passive:true});
  addEventListener('hashchange',()=>{const i=stopFromHash(location.hash,STATE.n);if(i>=0&&i!==STATE.stop)doGo(i);});
}

/* ---------- 3D sea (Three.js) ---------- */
async function startSea(){
  const gl=(()=>{try{const c=document.createElement('canvas');return c.getContext('webgl2')||c.getContext('webgl');}catch{return null;}})();
  if(!gl)throw Error('WebGL을 쓸 수 없는 환경입니다.');
  const THREE=await import('./vendor/three-r170/three.module.min.js');
  const geo=await fetch('countries.json').then(r=>r.ok?r.json():null).catch(()=>null);
  return buildSea(THREE,geo);
}
function buildSea(THREE,geo){
  const canvas=$('sea'), mobile=matchMedia('(max-width: 760px)');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile.matches?1.5:1.75));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  const sc=new THREE.Scene(), FOG=new THREE.Color('#041326');
  sc.background=FOG;
  const camera=new THREE.PerspectiveCamera(34,1,.05,600);
  const sun=new THREE.Vector3(.15,.62,-.77).normalize();
  sc.add(new THREE.HemisphereLight('#9fc7e6','#06121f',1.1));
  const dl=new THREE.DirectionalLight('#fff1dc',2.4);dl.position.copy(sun).multiplyScalar(50);sc.add(dl);

  // Coast halo texture: land drawn white with a soft blur. The sea shader turns it into shallow water and surf.
  // Land meshes use a wide extent; the surf texture covers only the route (plus margin) so its pixels stay small.
  const EXT={lon0:117,lon1:141,lat0:27,lat1:45};
  const lats=ROUTE.samples.map(q=>q.lat),lons=ROUTE.samples.map(q=>q.lon);
  const a=project(Math.max(...lats)+1.2,Math.min(...lons)-1.2),b=project(Math.min(...lats)-1.2,Math.max(...lons)+1.2);
  const rect={x:a.x,z:a.z,w:b.x-a.x,h:b.z-a.z};
  const NX=mobile.matches?2048:4096, NY=Math.round(NX*rect.h/rect.w), cv=document.createElement('canvas');cv.width=NX;cv.height=NY;
  const ctx=cv.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,NX,NY);
  const rings=[];
  for(const f of geo?.features||[]){
    const polys=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates];
    for(const p of polys){const r=p[0];if(r.some(([x,y])=>x>EXT.lon0&&x<EXT.lon1&&y>EXT.lat0&&y<EXT.lat1))rings.push(r);}
  }
  const toPx=(lon,lat)=>{const p=project(lat,lon);return [(p.x-rect.x)/rect.w*NX,(p.z-rect.z)/rect.h*NY];};
  const pathAll=()=>{ctx.beginPath();for(const r of rings){r.forEach(([x,y],j)=>{const [u,v]=toPx(x,y);j?ctx.lineTo(u,v):ctx.moveTo(u,v);});ctx.closePath();}};
  // red = wide halo (shallow water tint), green = narrow halo (surf line)
  ctx.globalCompositeOperation='lighter';
  for(const [colour,blur] of [['#f00',NX/60],['#0f0',NX/1400]]){ctx.fillStyle=ctx.shadowColor=colour;ctx.shadowBlur=blur;pathAll();ctx.fill();}
  ctx.shadowBlur=0;ctx.globalCompositeOperation='source-over';
  const coastTex=new THREE.CanvasTexture(cv);coastTex.flipY=false;coastTex.colorSpace=THREE.NoColorSpace;coastTex.minFilter=THREE.LinearFilter;coastTex.generateMipmaps=false; // mipmaps would smear the surf band far out to sea

  const NOISE=`float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
    float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.03;a*=.5;}return v;}`;
  const uniforms={uTime:{value:0},uSun:{value:sun},uCoast:{value:coastTex},uRect:{value:new THREE.Vector4(rect.x,rect.z,rect.w,rect.h)},
    uFog:{value:FOG},uDeep:{value:new THREE.Color('#031a33')},uMid:{value:new THREE.Color('#0b3a5e')},uShallow:{value:new THREE.Color('#1b6f84')},
    uProj:{value:new THREE.Vector3(PROJ.lat,PROJ.lon,PROJ.k*Math.cos(PROJ.lat*Math.PI/180))}};
  const W0=project(EXT.lat1,EXT.lon0),W1=project(EXT.lat0,EXT.lon1);
  const sea=new THREE.Mesh(new THREE.PlaneGeometry((W1.x-W0.x)*1.4,(W1.z-W0.z)*1.4,1,1),new THREE.ShaderMaterial({uniforms,
    vertexShader:`varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform float uTime;uniform vec3 uSun,uFog,uDeep,uMid,uShallow,uProj;uniform sampler2D uCoast;uniform vec4 uRect;varying vec3 vW;${NOISE}
    vec2 waves(vec2 p,float t,float lod){vec2 g=vec2(0.);
      vec2 d[5];d[0]=vec2(.8,.6);d[1]=vec2(-.4,.9);d[2]=vec2(.95,-.3);d[3]=vec2(-.7,-.7);d[4]=vec2(.2,1.);
      float f[5];f[0]=2.1;f[1]=3.3;f[2]=5.7;f[3]=8.9;f[4]=13.;
      for(int i=0;i<5;i++){float ph=dot(d[i],p)*f[i]+t*(1.2+float(i)*.35);g+=d[i]*cos(ph)*.04*(i>2?lod:1.);}
      return g;}
    void main(){
      vec2 p=vW.xz;float t=uTime;float dist=length(cameraPosition-vW);
      float lod=1.-smoothstep(6.,40.,dist);
      vec2 g=waves(p,t,lod)+(vec2(noise(p*6.+t*.4),noise(p*6.3-t*.35))-.5)*.06*lod+(vec2(fbm(p*16.+t*.6),fbm(p*16.7-t*.5))-.5)*.07*lod;
      vec3 n=normalize(vec3(-g.x,1.,-g.y));vec3 v=normalize(cameraPosition-vW);
      vec2 cuv=(p-uRect.xy)/uRect.zw;vec4 cs=texture2D(uCoast,clamp(cuv,0.,1.))*step(0.,cuv.x)*step(cuv.x,1.)*step(0.,cuv.y)*step(cuv.y,1.);float coast=cs.r,surf=cs.g;
      float fres=pow(1.-max(dot(n,v),0.),4.);float diff=.82+.3*max(dot(n,uSun),0.);
      vec3 col=mix(uDeep,uMid,smoothstep(.0,.9,fbm(p*.08+t*.01))*.55);
      col=mix(col,uShallow,smoothstep(.04,.75,coast)*.75);
      col*=diff;col=mix(col,vec3(.42,.6,.78),fres*.35);
      vec3 r=reflect(-v,n);float s=max(dot(r,uSun),0.);
      float near=1.-smoothstep(3.,16.,dist);
      // sparkles: one possible glint per small cell, re-drawn a few times a second, mostly inside the sun's reflection
      vec2 gp=p*70.;vec2 id=floor(gp);vec2 o=vec2(hash(id+3.1),hash(id+7.7))-.5;float tw=floor(t*4.+hash(id)*4.);
      float lobe=pow(s,4.);float glit=step(mix(.988,.9,lobe),hash(id+tw*.137))*smoothstep(.16,.02,length(fract(gp)-.5-o*.6));
      float sheen=pow(max(dot(reflect(-v,vec3(0.,1.,0.)),uSun),0.),16.);
      col+=vec3(1.,.97,.9)*(sheen*.035+glit*near*(lobe*2.+.2));
      float band=smoothstep(.12,.55,surf)*(1.-smoothstep(.9,1.,surf));
      float foam=smoothstep(.55,.9,noise(p*40.+t*.8)*.7+noise(p*12.-t*.3)*.5);
      col=mix(col,vec3(.86,.94,.97),band*mix(.25,1.,foam)*.7);
      float lon=p.x/uProj.z+uProj.y,lat=-p.y/10.+uProj.x;vec2 dg=abs(fract(vec2(lon,lat)+.5)-.5)/fwidth(vec2(lon,lat));
      col+=vec3(.35,.75,.85)*.07*(1.-min(min(dg.x,dg.y),1.))*(1.-smoothstep(20.,90.,dist));
      col=mix(col,uFog,smoothstep(60.,220.,dist));
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`}));
  sea.rotation.x=-Math.PI/2;sea.position.set((W0.x+W1.x)/2,0,(W0.z+W1.z)/2);sc.add(sea);

  // Land: vector polygons (sharp at every zoom), dark rock tinted by noise.
  const landMat=new THREE.ShaderMaterial({uniforms:{uFog:uniforms.uFog},
    vertexShader:`varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform vec3 uFog;varying vec3 vW;${NOISE}void main(){vec2 p=vW.xz;float h=fbm(p*.9)*.6+fbm(p*6.)*.4;
      vec3 c=mix(vec3(.03,.045,.04),vec3(.09,.105,.08),h);c=mix(c,vec3(.15,.13,.1),smoothstep(.62,.8,h));
      float d=length(cameraPosition-vW);gl_FragColor=vec4(mix(c,uFog,smoothstep(60.,220.,d)),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  for(const r of rings){
    const shape=new THREE.Shape(r.map(([x,y])=>{const p=project(y,x);return new THREE.Vector2(p.x,-p.z);}));
    const m=new THREE.Mesh(new THREE.ShapeGeometry(shape),landMat);m.rotation.x=-Math.PI/2;m.position.y=.012;sc.add(m);
  }

  // Route (dashed, faint) and stop cells (published 1° / 4° extents).
  const routePts=ROUTE.samples.map(s=>{const p=project(s.lat,s.lon);return new THREE.Vector3(p.x,.02,p.z);});
  const routeLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(routePts),new THREE.LineDashedMaterial({color:'#cfe9f2',transparent:true,opacity:.22,dashSize:.12,gapSize:.16}));
  routeLine.computeLineDistances();sc.add(routeLine);
  const cells=DATA.stops.map(st=>{
    const c=st.cell,s=c.size_deg,q=[[c.lat0,c.lon0],[c.lat0,c.lon0+s],[c.lat0+s,c.lon0+s],[c.lat0+s,c.lon0],[c.lat0,c.lon0]].map(([la,lo])=>{const p=project(la,lo);return new THREE.Vector3(p.x,.03,p.z);});
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(q),new THREE.LineDashedMaterial({color:'#5ee3d0',transparent:true,opacity:.3,dashSize:.3,gapSize:.18}));
    line.computeLineDistances();sc.add(line);
    const cp=project(...c.center), ring=new THREE.Mesh(new THREE.RingGeometry(.16,.2,48),new THREE.MeshBasicMaterial({color:'#5ee3d0',transparent:true,opacity:.6,depthWrite:false}));
    ring.rotation.x=-Math.PI/2;ring.position.set(cp.x,.035,cp.z);sc.add(ring);
    return {line,ring};
  });

  // Research vessel, built from primitives (no external model). Forward is +X, length about .5 units.
  const ship=new THREE.Group(), body=new THREE.Group();ship.add(body);
  const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.55,metalness:.1});
  const hullShape=new THREE.Shape();
  hullShape.moveTo(-.25,-.055);hullShape.lineTo(.12,-.055);hullShape.quadraticCurveTo(.24,-.045,.27,0);hullShape.quadraticCurveTo(.24,.045,.12,.055);hullShape.lineTo(-.25,.055);hullShape.closePath();
  const hull=new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape,{depth:.06,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:2}),mat('#1b2b38'));
  hull.rotation.x=-Math.PI/2;hull.position.y=-.02;body.add(hull);
  const deckShape=new THREE.Shape();deckShape.moveTo(-.245,-.05);deckShape.lineTo(.11,-.05);deckShape.quadraticCurveTo(.22,-.04,.255,0);deckShape.quadraticCurveTo(.22,.04,.11,.05);deckShape.lineTo(-.245,.05);deckShape.closePath();
  const deck=new THREE.Mesh(new THREE.ShapeGeometry(deckShape),mat('#8f9ea6'));deck.rotation.x=-Math.PI/2;deck.position.y=.049;body.add(deck);
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(.5,.008,.114),mat('#e8eef0'));stripe.position.set(-.005,.036,0);body.add(stripe);
  const box=(w,h,d,c,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.position.set(x,y,z);body.add(m);return m;};
  box(.2,.05,.085,'#eef3f4',.03,.075,0);box(.13,.04,.075,'#f4f7f8',.05,.12,0);
  box(.06,.022,.09,'#0e1a22',.085,.12,0);box(.08,.03,.07,'#f4f7f8',.06,.155,0);box(.05,.012,.074,'#0e1a22',.08,.155,0);
  box(.03,.06,.03,'#f08a4b',-.03,.13,0);box(.006,.1,.006,'#dfe6e8',.07,.22,0);box(.004,.004,.06,'#dfe6e8',.07,.255,0);
  box(.006,.07,.006,'#f08a4b',-.235,.085,.036);box(.006,.07,.006,'#f08a4b',-.235,.085,-.036);box(.008,.008,.08,'#f08a4b',-.235,.12,0);
  box(.04,.014,.016,'#f08a4b',-.02,.08,.05);box(.04,.014,.016,'#f08a4b',-.02,.08,-.05);
  box(.09,.004,.07,'#3c5662',-.15,.053,0);
  sc.add(ship);

  // Wake ribbon from the ship's recent positions: spreads and fades with age, bright edges and a turbulent centre.
  const HIST=140, hist=[];
  const wakeGeo=new THREE.BufferGeometry(), wakePos=new Float32Array(HIST*2*3), wakeAttr=new Float32Array(HIST*2*2);
  const idx=[];for(let i=0;i<HIST-1;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
  wakeGeo.setIndex(idx);wakeGeo.setAttribute('position',new THREE.BufferAttribute(wakePos,3));wakeGeo.setAttribute('aWake',new THREE.BufferAttribute(wakeAttr,2));
  const wakeU={uTime:uniforms.uTime,uStrength:{value:0}};
  const wake=new THREE.Mesh(wakeGeo,new THREE.ShaderMaterial({uniforms:wakeU,transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`attribute vec2 aWake;varying vec2 vA;varying vec3 vW;void main(){vA=aWake;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform float uTime,uStrength;varying vec2 vA;varying vec3 vW;${NOISE}void main(){
      float age=vA.x,side=abs(vA.y);float n=noise(vW.xz*26.+uTime*1.5)*.6+noise(vW.xz*9.-uTime*.6)*.4;
      float edge=smoothstep(.55,.95,side)*(1.-smoothstep(.95,1.,side));float core=1.-smoothstep(0.,.45,side);
      float a=(edge*.85+core*.9*(1.-age))*pow(1.-age,1.2)*(.45+.55*smoothstep(.2,.8,n))*uStrength;
      gl_FragColor=vec4(vec3(.9,.97,1.),a*.85);}`}));
  wake.frustumCulled=false;sc.add(wake);
  const spray=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(60*3),3)),
    new THREE.PointsMaterial({color:'#f2fbff',size:.018,transparent:true,opacity:.0,depthWrite:false}));
  spray.frustumCulled=false;sc.add(spray);
  const sprayLife=new Float32Array(60),sprayVel=new Float32Array(60*3);

  // Camera rig: smoothed look-at and distance. North stays up; the camera looks from the south at about 55°.
  const look=new THREE.Vector3(), camPos=new THREE.Vector3();
  let heading=0, prevHeading=0, bank=0, speedNow=0, last=performance.now(), time=0, frames=0, fpsT=0, lowFps=false;
  const start=routeAt(ROUTE,0);
  const routeBox=(()=>{let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const p of routePts){x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);z0=Math.min(z0,p.z);z1=Math.max(z1,p.z);}return {cx:(x0+x1)/2,cz:(z0+z1)/2,w:x1-x0};})();
  function shipPose(){
    const p=routeAt(ROUTE,STATE.t);return p;
  }
  function target(){
    const p=shipPose(), aspect=innerWidth/innerHeight, mob=mobile.matches;
    if(STATE.phase==='intro')return {x:routeBox.cx,z:routeBox.cz+1,d:routeBox.w*(aspect<1?2.2:1.15)};
    const arrived=STATE.phase==='arrived';
    // Arrived: shift the view so the ship sits beside the card (left of it on desktop, above it on phones).
    const d=arrived?(mob?4.4:4.0):4.6;
    return {x:p.x+(arrived&&!mob?d*.17:0),z:p.z+(arrived&&mob?d*.16:0),d};
  }
  function placeCamera(tg,k){
    look.x+= (tg.x-look.x)*k;look.z+=(tg.z-look.z)*k;
    const want=new THREE.Vector3(look.x,tg.d*Math.sin(.98),look.z+tg.d*Math.cos(.98));
    camPos.lerp(want,k);camera.position.copy(camPos);camera.lookAt(look.x,0,look.z);
  }
  function snap(){const tg=target();look.set(tg.x,0,tg.z);camPos.set(tg.x,tg.d*Math.sin(.98),tg.z+tg.d*Math.cos(.98));hist.length=0;}
  function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  addEventListener('resize',resize);resize();
  look.set(start.x,0,start.z);snap();
  heading=Math.atan2(-start.dz,start.dx);prevHeading=heading;

  function frame(now){
    const dt=Math.min((now-last)/1000,.1);last=now;
    const still=reduceMotion.matches;
    if(!still)time+=dt;
    uniforms.uTime.value=time;
    const before=STATE.t;
    if(step(STATE,dt,{instant:still}))onArrive();
    const moved=STATE.t-before;
    if(Math.abs(moved)>1e-7&&STATE.phase==='sailing'){
      // the bow points the way the ship is going, also when it sails back to an earlier stop
      const p=routeAt(ROUTE,STATE.t),dir=Math.sign(moved);
      const want=Math.atan2(-p.dz*dir,p.dx*dir);
      let dh=want-heading;dh=Math.atan2(Math.sin(dh),Math.cos(dh));
      heading+=dh*Math.min(1,dt*(still?60:4));
    }
    const turn=Math.atan2(Math.sin(heading-prevHeading),Math.cos(heading-prevHeading))/Math.max(dt,1e-3);prevHeading=heading;
    speedNow+=((Math.abs(moved)*ROUTE.total/Math.max(dt,1e-3))-speedNow)*Math.min(1,dt*3);
    bank+=(Math.max(-.25,Math.min(.25,-turn*.12))-bank)*Math.min(1,dt*3);
    const p=routeAt(ROUTE,STATE.t);
    ship.position.set(p.x,still?0:Math.sin(time*1.4)*.006,p.z);ship.rotation.y=heading;
    body.rotation.x=bank+(still?0:Math.sin(time*.9)*.025);body.rotation.z=still?0:Math.sin(time*1.1)*.015-Math.min(speedNow,2)*.01;
    // wake history
    const sternX=p.x-Math.cos(heading)*.22, sternZ=p.z+Math.sin(heading)*.22;
    // one wake point every 0.025 units of travel, filled in when a slow frame jumps further (wake length stays ~3.5 units)
    const gap=hist.length?Math.hypot(sternX-hist[0].x,sternZ-hist[0].z):1;
    if(gap>.025){
      const n=hist.length?Math.min(HIST,Math.floor(gap/.025)):1, h0=hist[0];
      for(let k=n;k>=1;k--){const f=k/n;hist.unshift(h0?{x:h0.x+(sternX-h0.x)*(1-f+1/n),z:h0.z+(sternZ-h0.z)*(1-f+1/n),h:heading}:{x:sternX,z:sternZ,h:heading});}
      hist.length=Math.min(hist.length,HIST);
    }
    for(let i=0;i<HIST;i++){
      const hp=hist[Math.min(i,hist.length-1)]||{x:sternX,z:sternZ,h:heading}, age=i/(HIST-1), w=.04+age*.24;
      const nx=Math.sin(hp.h)*w, nz=Math.cos(hp.h)*w;
      wakePos.set([hp.x-nx,.006,hp.z-nz,hp.x+nx,.006,hp.z+nz],i*6);wakeAttr.set([age,-1,age,1],i*4);
    }
    wakeGeo.attributes.position.needsUpdate=true;wakeGeo.attributes.aWake.needsUpdate=true;
    wakeU.uStrength.value+=((still?.0:Math.min(1,speedNow/1.2))-wakeU.uStrength.value)*Math.min(1,dt*1.5);
    // bow spray when fast
    const sp=spray.geometry.attributes.position, bowX=p.x+Math.cos(heading)*.26, bowZ=p.z-Math.sin(heading)*.26;
    for(let i=0;i<60;i++){
      sprayLife[i]-=dt;
      if(sprayLife[i]<=0&&speedNow>.4&&!still&&Math.random()<dt*speedNow*14){
        sprayLife[i]=.5+Math.random()*.4;const side=Math.random()<.5?-1:1;
        sp.setXYZ(i,bowX,.03,bowZ);
        sprayVel.set([Math.sin(heading)*side*.18+(Math.random()-.5)*.05,.25+Math.random()*.15,Math.cos(heading)*side*.18+(Math.random()-.5)*.05],i*3);
      }
      if(sprayLife[i]>0){sp.setXYZ(i,sp.getX(i)+sprayVel[i*3]*dt,Math.max(0,sp.getY(i)+(sprayVel[i*3+1]-=dt*1.2)*dt),sp.getZ(i)+sprayVel[i*3+2]*dt);}
      else sp.setXYZ(i,0,-10,0);
    }
    sp.needsUpdate=true;spray.material.opacity=Math.min(.85,speedNow*.5);
    cells.forEach(({line,ring},i)=>{
      const on=i===STATE.arrived;line.material.opacity=on?.75:.25;
      ring.material.opacity=on?.1:.55;ring.scale.setScalar(on?1+.15*Math.sin(time*2):1);
    });
    placeCamera(target(),still?1:1-Math.exp(-dt*(STATE.phase==='intro'?1.2:2.4)));
    renderer.render(sc,camera);
    $('progress').style.setProperty('--t',STATE.t.toFixed(4));
    // A slow device keeps working; it is offered the card list once.
    frames++;fpsT+=dt;if(!lowFps&&fpsT>4){if(frames/fpsT<18){lowFps=true;renderer.setPixelRatio(1);toast('화면이 느리면 상단의 "카드 목록"으로 같은 내용을 볼 수 있습니다.');}frames=0;fpsT=0;}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return {snap,renderer};
}

/* ---------- boot ---------- */
async function boot(){
  const res=await fetch('expedition-stops.json').catch(()=>null);
  DATA=res?.ok?await res.json().catch(()=>null):null;
  if(DATA?.schema_version!=='expedition-stops-1'||!Array.isArray(DATA.stops)||!DATA.stops.length){
    $('cards-list').innerHTML='<p class="x-missing">탐사 지점 자료를 불러오지 못했습니다. <a href="index.html">탐색 지도</a>에서 같은 자료를 볼 수 있습니다.</p>';
    document.body.classList.remove('is-loading');document.body.classList.add('is-cards');return;
  }
  ROUTE=sampleRoute(DATA.stops);
  STATE=makeState(DATA.stops.length,ROUTE.stopT);
  $('intro-count').textContent=DATA.stops.length;
  renderCards();
  let reason='';
  if(!/(^#|&)view=cards/.test(location.hash)){
    try{scene=await startSea();}catch(e){reason=`3D 바다를 열 수 없어 카드 목록으로 보여 줍니다(${e.message||'WebGL 오류'}). 모든 정보와 근거, 지도 링크는 그대로입니다.`;}
  }
  document.body.classList.remove('is-loading');
  bindInput();
  const fromHash=stopFromHash(location.hash,STATE.n);
  let saved=null;try{saved=JSON.parse(sessionStorage.getItem('bbvm-expedition')||'null');}catch{}
  if(Array.isArray(saved?.reveal))saved.reveal.forEach((r,i)=>{if(i<STATE.n)STATE.reveal[i]=Math.min(REVEAL_DETAIL,r|0);});
  if(!scene){setCards(true,reason||'카드 목록으로 보고 있습니다.');if(fromHash>=0)doGo(fromHash);return;}
  document.body.classList.add('is-intro');
  if(fromHash>=0){leaveIntro();placeAt(STATE,fromHash);scene.snap();onArrive();}
  else if(saved?.stop>=0&&saved.stop<STATE.n){$('resume').hidden=false;$('resume').textContent=`이어서 항해 (지점 ${saved.stop+1} ${DATA.stops[saved.stop].korean_name})`;}
  render();
  if(!$('intro').hidden)$('start').focus({preventScroll:true});
}
if(typeof document!=='undefined')boot();

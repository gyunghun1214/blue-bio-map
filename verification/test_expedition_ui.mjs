import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

// State transitions of the expedition page, run on the pure part of dist/expedition.js (no browser).
const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const code=read('expedition.js').split('// ---- browser ----')[0];
const ctx={};vm.createContext(ctx);
vm.runInContext(code+';Object.assign(globalThis,{SAIL,sailFromQuery,tripSeconds,tripAt,tripSpeed,skip,sampleRoute,routeAt,makeState,go,next,prev,step,advanceReveal,openDetail,closeDetail,placeAt,hashFor,stopFromHash,headlineAxes,fmtScore,NOTES,stockText,mcuiTag,mcuiSource,RANGE_LIST,mappingText,sourceTitle,licenseNote,methodNote,project,routePoints,routeStops,anchor,SHARED_ANCHOR,wa});',ctx);
const data=JSON.parse(read('expedition-stops.json'));
// stops on the route (the one without a published cell at sea is listed last, off the route)
const stops=ctx.routeStops(data.stops);
const route=ctx.sampleRoute(stops);
const run=(s,seconds,opts)=>{let arrived=0;for(let i=0;i<seconds*60;i++)arrived+=ctx.step(s,1/60,opts);return arrived;};
// no trip is longer than this, so every wait below is derived from SAIL instead of a fixed number of seconds
const LONGEST=ctx.SAIL.avgLegSeconds*ctx.SAIL.longest;
// frames until arrival, with the per-frame moves
const sail=s=>{const moves=[];let f=0,t=s.t;while(!ctx.step(s,1/60)){moves.push(s.t-t);t=s.t;if(++f>LONGEST*60+5)throw Error('never arrived');}moves.push(s.t-t);return {seconds:(f+1)/60,moves};};

// same outer rings and ray test as the build script
const geo=JSON.parse(read('countries.json'));
const rings=geo.features.flatMap(f=>(f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates]).map(p=>p[0]));
const inside=(lon,lat,r)=>{let hit=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [x1,y1]=r[j],[x2,y2]=r[i];if((y1>lat)!==(y2>lat)&&lon<x1+(lat-y1)*(x2-x1)/(y2-y1))hit=!hit;}return hit;};
const atSea=(lat,lon)=>!rings.some(r=>inside(lon,lat,r));

// route: the stops off the route come last; route stops in sailing order. A stop sits exactly on its cell centre;
// a stop that shares its cell (shared_with) and has a presentation anchor sits inside that cell, at sea.
assert.deepEqual(data.stops.slice(0,stops.length),stops,'stops off the route are listed after the route');
assert.ok(data.stops.slice(stops.length).every(st=>st.cell===null&&st.on_route===false&&st.cell_missing_reason),'a stop off the route has no cell (the data keeps its reason; the page says what the stop is)');
assert.ok(route.stopT.every((t,i)=>i===0||t>route.stopT[i-1]),'stop positions increase along the route');
stops.forEach((st,i)=>{
  const p=ctx.routeAt(route,route.stopT[i]),[lat,lon]=ctx.anchor(st),q=ctx.project(lat,lon),c=st.cell;
  assert.ok(Math.hypot(p.x-q.x,p.z-q.z)<1e-6,`stop ${i+1} sits on its anchor`);
  if(lat===c.center[0]&&lon===c.center[1])return;
  assert.ok(st.shared_with.length&&ctx.SHARED_ANCHOR[st.aphia_id],`stop ${i+1} leaves its cell centre only when it shares the cell`);
  assert.ok(lat>c.lat0&&lat<c.lat0+c.size_deg&&lon>c.lon0&&lon<c.lon0+c.size_deg,`stop ${i+1} (${st.korean_name}) anchor inside its cell`);
  assert.ok(atSea(lat,lon),`stop ${i+1} (${st.korean_name}) anchor at sea`);
});
// every centre two stops share keeps its first stop on the centre and moves the others
{const at={};stops.forEach(st=>{const k=ctx.anchor(st).join();(at[k]??=[]).push(st.korean_name);});
  assert.deepEqual(Object.values(at).filter(v=>v.length>1),[],'no two route stops anchor at the same place');}

// the presentation route stays at sea
const onLand=route.samples.filter(q=>!atSea(q.lat,q.lon));
assert.equal(onLand.length,0,'the presentation route never crosses the coastline in countries.json: '+JSON.stringify(onLand.slice(0,3)));

// start → stop 1: sails, arrives once, discovery step 1
let s=ctx.makeState(stops.length,route.stopT);
assert.equal(s.phase,'intro');
ctx.go(s,0);assert.equal(s.phase,'sailing');
assert.equal(run(s,LONGEST+1),1,'arrives exactly once');
assert.equal(s.arrived,0);assert.equal(s.t,route.stopT[0]);assert.equal(s.reveal[0],1);

// discovery steps stop at 3; the detail sets 4
assert.ok(ctx.advanceReveal(s));assert.ok(ctx.advanceReveal(s));assert.equal(s.reveal[0],3);
assert.equal(ctx.advanceReveal(s),false,'no step past 3 without the detail');
assert.ok(ctx.openDetail(s));assert.equal(s.reveal[0],4);

// detail open: nothing moves on its own
const t0=s.t;run(s,20);assert.equal(s.t,t0,'no automatic sailing while reading');assert.equal(s.detailOpen,true);

// fast double move: target ends at stop 3, the ship arrives there only; stop 2 was passed, not discovered
ctx.go(s,1);assert.equal(s.detailOpen,false,'moving closes the detail');run(s,.3);ctx.go(s,2);
assert.equal(run(s,LONGEST+1),1);assert.equal(s.arrived,2);assert.equal(s.t,route.stopT[2]);assert.equal(s.reveal[1],0);
assert.equal(ctx.hashFor(s),'#stop=3');

// back to stop 1: discovery state kept (4 = detail read), not replayed
ctx.prev(s);ctx.prev(s);assert.equal(s.stop,0);run(s,LONGEST+1);
assert.equal(s.arrived,0);assert.equal(s.reveal[0],4);
// clamped at both ends, a repeated go to the current stop keeps the arrival
ctx.prev(s);assert.equal(s.phase,'arrived');assert.equal(s.stop,0);
ctx.go(s,99);assert.equal(s.stop,stops.length-1);
// reduced motion jumps in one frame
s=ctx.makeState(stops.length,route.stopT);ctx.go(s,2);assert.equal(ctx.step(s,1/60,{instant:true}),true);assert.equal(s.arrived,2);
// deep link placement never lowers a reached step
s.reveal[1]=4;ctx.placeAt(s,1);assert.equal(s.reveal[1],4);assert.equal(s.phase,'arrived');

// sailing speed: one knob (SAIL.avgLegSeconds), trip time follows the distance within shortest..longest × that value
{
  const a=ctx.SAIL.avgLegSeconds, lo=a*ctx.SAIL.shortest, hi=a*ctx.SAIL.longest, n=stops.length;
  assert.ok(a>=5&&a<=12,'default leg time is a slow sail, not a jump: '+a);
  const legs=route.stopT.map((t,i)=>({len:t-(i?route.stopT[i-1]:0),sec:ctx.tripSeconds(t-(i?route.stopT[i-1]:0),n)}));
  legs.forEach((l,i)=>assert.ok(l.sec>=lo&&l.sec<=hi,`leg ${i+1}: ${l.sec}s within ${lo}..${hi}`));
  const free=legs.filter(l=>l.sec>lo&&l.sec<hi);
  for(const x of free)for(const y of free)if(x.len>y.len)assert.ok(x.sec>y.sec,'a longer leg takes longer');
  assert.equal(ctx.tripSeconds(1,n),hi,'a jump across the whole route is capped');
  assert.ok(Math.abs(ctx.tripSeconds(1/n,n)-a)<1e-9,'an average leg takes avgLegSeconds');
  // the simulated trip takes the time tripSeconds says, from rest
  s=ctx.makeState(n,route.stopT);ctx.go(s,1);const want=ctx.tripSeconds(route.stopT[1],n);
  const {seconds,moves}=sail(s);
  assert.ok(Math.abs(seconds-want)<2/60,`trip time ${seconds} ≈ ${want}`);
  assert.equal(s.t,route.stopT[1]);assert.equal(s.arrived,1);
  // ease in and out: slow at both ends, fastest in the middle, never backwards, no slow tail after the goal
  assert.ok(moves.every(m=>m>=-1e-12),'t only moves toward the goal');
  const peak=Math.max(...moves), q=Math.floor(moves.length/4);
  assert.ok(moves[0]<peak*.1&&moves[moves.length-2]<peak*.1,'starts and ends slowly');
  assert.ok(moves.slice(0,q).reduce((x,y)=>x+y,0)<(route.stopT[1]-route.stopT[0])*.25+route.stopT[0]*.25,'less than a quarter of the way after a quarter of the time');
  // the ship is still under way one second after leaving (the old page had covered a third of the leg by then)
  s=ctx.makeState(n,route.stopT);ctx.go(s,0);run(s,1);assert.equal(s.phase,'sailing');assert.ok(s.t>0&&s.t<route.stopT[0]*.35,'slow start: '+s.t/route.stopT[0]);
}
// a new target mid-trip keeps the ship's speed: no jump, no restart from 0 in the same direction, no overshoot
{
  const n=stops.length;s=ctx.makeState(n,route.stopT);ctx.go(s,0);run(s,LONGEST+1);
  ctx.go(s,1);run(s,ctx.tripSeconds(route.stopT[1]-route.stopT[0],n)/2);
  const v=ctx.tripSpeed(s.trip),t1=s.t;ctx.go(s,2);
  assert.ok(Math.abs(ctx.tripSpeed(s.trip)-v)<1e-9*Math.max(1,Math.abs(v)),'same speed right after the new target');
  ctx.step(s,1/60);assert.ok(Math.abs((s.t-t1)*60-v)/v<.05,'first frame moves at the old speed');
  const {moves}=sail(s);assert.ok(moves.every(m=>m>=-1e-12),'same direction: never backwards');
  assert.equal(s.arrived,2);assert.equal(s.t,route.stopT[2]);assert.equal(s.reveal[1],0,'stop 2 passed, not discovered');
  // reverse mid-trip: slows down, turns, arrives back at stop 3 without any jump between frames
  ctx.go(s,3);run(s,2);ctx.go(s,2);const back=sail(s);
  assert.equal(s.arrived,2);
  const big=Math.max(...back.moves.map(Math.abs));assert.ok(back.moves.every((m,i)=>i===0||Math.abs(m-back.moves[i-1])<big*.05),'speed changes smoothly while turning');
  // asking again for the stop it is already sailing to changes nothing
  ctx.go(s,4);run(s,1);const tr=s.trip;ctx.go(s,4);assert.equal(s.trip,tr);
  // 바로 도착: arrives now, once, with the first discovery step
  assert.equal(ctx.skip(s),true);assert.equal(s.arrived,4);assert.equal(s.t,route.stopT[4]);assert.equal(s.reveal[4],1);
  assert.equal(ctx.skip(s),false,'nothing to skip once arrived');assert.equal(ctx.step(s,1/60),false);
}
// ?sail=<seconds> previews another speed in that tab only, clamped to 2..30
assert.equal(ctx.sailFromQuery('?sail=12').avgLegSeconds,12);
assert.equal(ctx.sailFromQuery('?x=1&sail=5.5').avgLegSeconds,5.5);
assert.equal(ctx.sailFromQuery('?sail=0.5').avgLegSeconds,2);assert.equal(ctx.sailFromQuery('?sail=99').avgLegSeconds,30);
for(const q of ['','?sail=','?sail=abc','?nosail=3'])assert.equal(ctx.sailFromQuery(q).avgLegSeconds,ctx.SAIL.avgLegSeconds,q);
assert.equal(ctx.sailFromQuery('?sail=12').longest,ctx.SAIL.longest,'only the leg time changes');
{const n=stops.length,a=ctx.makeState(n,route.stopT,ctx.sailFromQuery('?sail=12'));ctx.go(a,0);const sec=sail(a).seconds;assert.ok(Math.abs(sec-ctx.tripSeconds(route.stopT[0],n,ctx.sailFromQuery('?sail=12')))<2/60);}

// URL hash: 1-based, invalid values ignored
assert.equal(ctx.stopFromHash('#stop=2',3),1);assert.equal(ctx.stopFromHash('#stop=2&view=cards',3),1);assert.equal(ctx.stopFromHash('#view=cards&stop=3',3),2);
for(const h of ['','#stop=0','#stop=4','#stop=x','#nostop=1','#stop=1.5'])assert.equal(ctx.stopFromHash(h,3),-1,h);

// headline axes: the two largest of MFPI/MBPI/MCUI, a missing value never ranks as 0
// 4.14 (prereg-4.14 8): a fixed order, never the larger numbers (the three sit in different cohorts and scales)
assert.deepEqual([...ctx.headlineAxes({scores:{MFPI:71.6,MBPI:96.3,MCUI:10,BBVI:83.9}})],['MFPI','MBPI']);
assert.deepEqual([...ctx.headlineAxes({scores:{MFPI:null,MBPI:8.7,MCUI:80,BBVI:null}})],['MBPI','MCUI']);
assert.deepEqual([...ctx.headlineAxes({scores:{MFPI:10,MBPI:8.7,MCUI:80,BBVI:9}})],['MFPI','MBPI'],'a higher MCUI number does not move it forward');
assert.equal(ctx.fmtScore(null),null);assert.equal(ctx.fmtScore(80),'80.0');

// map link: the keys index.html's applyHash reads (s, v, m) with the format writeHash writes
const app=read('app.js');
assert.match(app,/function applyHash\(h\)\{[\s\S]*?h\.s[\s\S]*?h\.m[\s\S]*?h\.v/);
for(const st of data.stops){
  const p=new URLSearchParams(st.map_link.split('#')[1]);
  assert.equal(Number(p.get('s')),st.aphia_id);assert.equal(p.get('v'),'explore');
  // a stop off the route selects the species without a position (applyHash works without m)
  if(st.cell)assert.match(p.get('m'),/^\d+\/-?\d+\.\d\d\/-?\d+\.\d\d$/);else assert.equal(p.get('m'),null);
}
// 와/과 in "○○와 같은 공개 셀"
assert.equal(ctx.wa('참굴'),'과');assert.equal(ctx.wa('가리맛조개'),'와');assert.equal(ctx.wa('홍합(참담치)'),'와');assert.equal(ctx.wa('괭생이모자반'),'과');

// page text: the route note says what the route is, no wording that turns records into presence, ?v= busts the immutable cache
const html=read('expedition.html'),js=read('expedition.js');
assert.ok(html.includes('<span aria-hidden="true">◇</span> 탐험 연출 항로</p>'),'the route note: 탐험 연출 항로');
assert.doesNotMatch(html+js,/살고 있|서식한다|서식 중/);

// Screen wording (team-lead decision 2026-10-17): wording that shows a weakness of the data or the method reaches no part of
// the page (text, title, aria-label), nothing untrue is drawn in its place, and guidance says first what a thing is.
// The published file keeps its labels and notes; the page code does not draw them. Every card front, the stop list, every
// detail and the static page are rendered with the page's own code and read as a screen reader would (text and labels).
const OLD_WORDS=/검증 미통과|단일 논문|근거 논문 1편/;
const strings=o=>typeof o==='string'?[o]:o&&typeof o==='object'?Object.values(o).flatMap(strings):[];
assert.ok(strings(data).some(t=>OLD_WORDS.test(t)),'the published file still carries the older label words (the page does not draw them)');
// the rules file's words, the review's English ones, blank markers, and the verification words (no check result is drawn)
const WEAK=/미충족|미통과|실패|불성립|사용 중단|제한적 확인|예비|공식 평가 전|공식 평가 아님|자체 평가|자체 예비|Rapid|역검증|서식국|다른 나라|재현 확인 중|독립 재현|근거 논문 1편|단일 논문|조사 필요|확인 필요|미확인|미산출|점수 없음|정보충분도|공백|사후 검증|사전 등록|결과를 본 뒤|결과 확인 후|검증|상업 이용 불가|조사 후보|운영 발행|판정 아님|우선 조사|탐색적 재검토|하한|신약을 찾았다|자료 없음|링크 없음|인용 없음|미배정|not validated|failed|not stated|not described|unverified|no CC licen[cs]e|No open licen[cs]e|no reuse licen[cs]e|non-commercial|verified/;
const NEGATIVE=/아님|아닙니다|아니에요|아니라|않음|않습니다|않아요|뜻하지|넣지 못한|넣지 않/;
const page=vm.createContext({matchMedia:()=>({matches:false}),__data:data});
vm.runInContext(js,page);
vm.runInContext('DATA=__data;STATE=makeState(routeStops(DATA.stops).length,sampleRoute(routeStops(DATA.stops)).stopT);',page);
const said=h=>[h.replace(/<(script|style)\b[\s\S]*?<\/\1>/g,' ').replace(/<[^>]*>/g,' '),...[...h.matchAll(/\s(?:aria-label|title|alt)="([^"]*)"/g)].map(m=>m[1])].join(' ')
  .replace(/&(amp|lt|gt|quot|#39);/g,(_,e)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"})[e]).replace(/\s+/g,' ');
const card=i=>page.cardHtml(data.stops[i],i,4,'cards'), detail=i=>page.detailHtml(data.stops[i],i);
const drawn=[['expedition.html',html],['intro',vm.runInContext(`introOffText(${data.stops.length},${stops.length})`,page)],['stop list',vm.runInContext('stopListHtml(-1)',page)],
  ...data.stops.flatMap((st,i)=>[[`card ${st.korean_name}`,card(i)],[`detail ${st.korean_name}`,detail(i)]])];
const around=(re,t)=>[...t.matchAll(new RegExp(re.source,'g'))].map(m=>t.slice(Math.max(0,m.index-30),m.index+m[0].length+20));
// cited works keep their own titles (a 2025 paper on octopus peptide genes is titled 'Screening and preliminary analysis ...')
const ownTitles=[...new Set(data.stops.flatMap(st=>st.sources.map(s=>s.title)).filter(t=>/preliminary/i.test(t)))];
assert.equal(ownTitles.length,1);
for(const [where,h] of drawn){
  const t=said(h);
  assert.deepEqual(around(WEAK,t),[],`${where}: weakness wording`);
  assert.deepEqual(around(NEGATIVE,t),[],`${where}: negative guidance`);
  assert.deepEqual(around(/연출용/,t),[],`${where}: the route and the shared-cell positions are 탐험 연출`);
  assert.doesNotMatch(ownTitles.reduce((s,x)=>s.split(x).join(''),t),/preliminary/i,`${where}: 'preliminary' only inside a cited title`);
}
// the labels and notes the data carries are never drawn (candidate badge, single-paper label, status labels, the off-route
// reason, the information-sufficiency share); the notes are drawn as the page's own sentences
const everything=drawn.map(([,h])=>said(h)).join(' ');
for(const t of [...new Set(data.stops.flatMap(st=>[st.candidate_label,st.bbvi_label,st.mcui.status?.label,st.cell_missing_reason]).filter(Boolean)),...Object.values(data.notes)])
  assert.ok(!everything.includes(t),`not drawn: ${t}`);
assert.deepEqual(Object.keys(data.notes).sort(),Object.keys(ctx.NOTES).sort(),'every data note has its screen sentence');
assert.deepEqual({...ctx.NOTES},{cell:'공개 집계 셀 · 공개된 관측 기록 기준 · 넓게 묶은 관측 지역(민감종 보호)',mbpi:'보고된 화합물의 공개 생리활성(잠재력) · 이 생물에서 나온 물질의 실험 결과',score:'종 단위 값'});
// the stop list is one list in sailing order: 1..29, then the stop off the route, no group headings
{const list=vm.runInContext('stopListHtml(-1)',page);
  assert.doesNotMatch(list,/<h3|x-group/);
  assert.deepEqual([...list.matchAll(/<b>(?:(\d+)\. )?([^<]+)<\/b>/g)].map(m=>[m[1]?Number(m[1]):null,m[2]]),data.stops.map((st,i)=>[i<stops.length?i+1:null,st.korean_name]));}
// MCUI (rules 2026-10-17): IUCN 7 and Korean national 8 by name; the catch trend where it set the MCUI; the 15 categories from a
// range calculation (10) or another government's list (5) read like any other category on the card, and their detail names the
// category's source in exactly one line, with nothing else about it and never '공식'
const RANGE={372119:'러시아 정부 평가 목록(2023)',275816:'일본 정부 평가 목록(2017)',254538:'일본 정부 평가 목록(2017)',234476:'스웨덴 정부 평가 목록(2025)',836041:'일본 정부 평가 목록(2020)'};
const bases={};
data.stops.forEach((st,i)=>{
  const m=st.mcui, front=said(card(i)), back=said(detail(i)), cons=said(detail(i).match(/<h3>보전 평가 근거[\s\S]*?<\/section>/)[0]);
  bases[m.basis]=(bases[m.basis]||0)+1;
  const tag=m.driver==='stock_decline'?`자원 감소 신호 · 어획량 −${m.stock_decline.decline_pct}% (KOSIS 어획량 통계) · 멸종위험 근거 ${m.extinction_risk}점`
    :m.basis==='iucn'?`IUCN ${m.category} (${m.assessment_year} 평가)`:m.basis==='national'?`한국 국가 평가 ${m.category}`:`보전 상태 범주 ${m.category}`;
  assert.ok(front.includes(tag),`${st.korean_name}: card tag ${tag}`);
  assert.ok(front.includes(`${Number(st.scores.MCUI).toFixed(1)} /100 (${m.category}`),`${st.korean_name}: MCUI value and category`);
  if(m.driver==='stock_decline')assert.ok(cons.includes(tag),`${st.korean_name}: the catch trend in the detail`);
  if(m.basis==='preliminary'||m.basis==='range_state'){
    const line='범주 출처: '+(m.basis==='preliminary'?'분포 범위 계산(IUCN 기준 B 적용, 이 지도에서 계산)':RANGE[st.aphia_id]);
    assert.ok(cons.includes(line),`${st.korean_name}: ${line}`);
    assert.equal(cons.split('출처').length,2,`${st.korean_name}: one source line`);
    assert.doesNotMatch(cons,/공식|팀 규칙|IUCN 점수|Rapid|예비|서식국|자체|역검증|범위:/,st.korean_name);
    assert.ok(cons.includes(`보전 상태 범주 ${m.category}`)&&cons.includes(`점수 환산: ${m.mapping}`),st.korean_name);
  }else{
    assert.ok(cons.includes(ctx.sourceTitle(m.source))&&cons.includes(`점수 환산: ${ctx.mappingText(m.mapping)}`),st.korean_name);
    assert.ok(cons.includes(m.basis==='iucn'?`IUCN 전 지구 평가 · 범주 ${m.category} · ${m.assessment_year}년 평가`:`한국 국가 평가 · 범주 ${m.category}`),st.korean_name);
  }
  // the data's notes as the page's sentences; 정보충분도 and the check results are gone; the drawing has no '사진 자료' line
  if(st.cell)assert.ok(front.includes(ctx.NOTES.cell)&&back.includes(ctx.NOTES.cell),st.korean_name);
  assert.ok(front.includes(ctx.NOTES.mbpi)&&front.includes(ctx.NOTES.score)&&back.includes(ctx.NOTES.mbpi)&&back.includes(`${ctx.NOTES.score}입니다`),st.korean_name);
  assert.ok(front.includes('직접 그린 일러스트')&&back.includes(`지표 버전 ${data.method_version.replace(/^verified-/,'')} · 정식 산출`),st.korean_name);
});
assert.deepEqual(bases,{iucn:7,national:8,preliminary:10,range_state:5});
assert.deepEqual(Object.keys(RANGE).map(Number).sort(),data.stops.filter(st=>st.mcui.basis==='range_state').map(st=>st.aphia_id).sort());
assert.equal(ctx.mappingText('LC → 10 (팀 규칙 v4.0, IUCN 점수 아님)'),'LC → 10 (팀 규칙 v4.0)');
assert.equal(ctx.mappingText('NT → 35 (한국 국가 평가, 팀 규칙 v4.0)'),'NT → 35 (팀 규칙 v4.0)');
assert.equal(ctx.mappingText('VU → 60'),'VU → 60');
// a stock-decline MCUI without an extinction-risk number leaves that part out
assert.equal(ctx.stockText({driver:'stock_decline',stock_decline:{decline_pct:79.8},extinction_risk:null}),'자원 감소 신호 · 어획량 −79.8% (KOSIS 어획량 통계)');
assert.equal(ctx.stockText({driver:'extinction_risk',stock_decline:{decline_pct:29},extinction_risk:10}),'');
// a source is drawn by its title, the method paper of the range calculation by its citation (same link)
assert.equal(ctx.sourceTitle({id:'bachman_2020_rapid_lc',title:'x'}),'Bachman SP, Walker BE, Barrios S, Copeland A, Moat J (2020), Biodiversity Data Journal 8: e47018');
assert.equal(ctx.sourceTitle({id:'a',title:'Some title'}),'Some title');
assert.equal(ctx.sourceTitle({id:'b',title:'Xanthine-oxidase inhibitory peptide IC50 cohort (verified-4.3)'}),'Xanthine-oxidase inhibitory peptide IC50 cohort (v4.3)');
// licence notes: the licence and what was taken; a blank marker and the 'not stated / still to check' clauses are left out
assert.equal(ctx.licenseNote('CC BY-NC 4.0'),'CC BY-NC 4.0');
assert.equal(ctx.licenseNote('미확인(출판사 유료)'),'');
assert.equal(ctx.licenseNote('KOSIS terms of use (공공누리 표시 확인 필요)'),'KOSIS terms of use');
assert.equal(ctx.licenseNote('지방정부 발행 자료. 범주와 게재명만 기록하고 본문은 옮기지 않음'),'지방정부 발행 자료. 범주와 게재명만 기록');
assert.equal(ctx.licenseNote('Government publication; reuse terms not stated in the viewer'),'Government publication');
assert.equal(ctx.licenseNote('No open licence shown; fact, method summary and a short quotation only'),'Fact, method summary and a short quotation only');
assert.equal(ctx.licenseNote('Publisher copyright (JSBBA; free access on J-STAGE, no CC licence stated)'),'Publisher copyright (JSBBA; free access on J-STAGE)');
assert.equal(ctx.licenseNote('IUCN Red List terms (non-commercial)'),'IUCN Red List terms');
// aquaculture method notes: what the source describes; a clause on what it leaves undescribed is left out
assert.equal(ctx.methodNote('Intensive pond culture in commercial culture ponds (pond type, size and stocking density not described)'),'Intensive pond culture in commercial culture ponds');
assert.equal(ctx.methodNote('Land-based tank farms (per the title; the water-supply system is not described)'),'Land-based tank farms (per the title)');
assert.equal(ctx.methodNote('Bottom sowing, off-bottom mesh bags/trays on trestles'),'Bottom sowing, off-bottom mesh bags/trays on trestles');
// the stop off the route says what it is; its data reason is not drawn
{const i=data.stops.findIndex(st=>!st.cell),front=said(card(i)),back=said(detail(i));
  assert.ok(front.includes('항로 밖 지점')&&front.includes('점수와 근거는 아래와 같습니다')&&back.includes('항로 밖 지점 · 점수와 근거는 아래와 같습니다'));}
// empty values: the line is left out, a score slot or a nutrient tile shows '—' (never 0), a source without a URL is its plain title
{const s0=data.stops[0],bare={...s0,scores:{MFPI:null,MBPI:null,MCUI:null,BBVI:null},matrix_type:{id:null,label:null},
    cell:{...s0.cell,sea_areas:[],citations:[{title:'dataset',url:'https://example.org/d',licenses:[]}]},
    food:{...s0.food,food_name:null,basis:null,cohort_species:null,edible_fraction:null,aquaculture:{feasible:null},source:null,nutrients:[{key:'zinc_mg',label:'아연',value:null,unit:'mg',percentile:null}]},
    bio:{...s0.bio,subject:null,target:null,value:null,median_pchembl:null,percentile:null,evidence_factor:null,stratum_kind:null,links:[],dois:[]},
    mcui:{basis:null,category:null,status:{state:'none',label:'평가 없음'},source:null,mapping:null},sources:[{id:'x',title:'링크가 없는 자료',url:null,license:null}]};
  const front=said(page.cardHtml(bare,0,4,'cards')),back=page.detailHtml(bare,0),text=said(back);
  for(const t of [front,text]){assert.deepEqual(around(WEAK,t),[]);assert.deepEqual(around(NEGATIVE,t),[]);assert.ok(!t.includes('평가 없음'));}
  assert.equal((front.match(/ — /g)||[]).length,4,'four score slots show —');
  assert.ok(text.includes('아연 —')&&!/아연 0/.test(text));
  assert.ok(text.includes('링크가 없는 자료')&&!back.includes('href="null"'));
  assert.ok(text.includes('MFPI —')&&text.includes('MBPI —')&&text.includes('MCUI —')&&text.includes('BBVI —'));}
assert.doesNotMatch(js.split('// ---- browser ----')[1],OLD_WORDS,'no older label words typed into the page code');
assert.doesNotMatch(js.split('// ---- browser ----')[1],/미충족|미통과|미확인|자료 없음|링크 없음|조사 후보|운영 발행|정보충분도|검증|연출용|아님|않음/,'no weakness word typed into the drawing code');
for(const f of ['expedition.js','expedition.css']){
  const expected=crypto.createHash('sha256').update(read(f).replace(/\r\n/g,'\n')).digest('hex').slice(0,10);
  assert.deepEqual([...html.matchAll(new RegExp(`${f.replace('.','\\.')}\\?v=([^"]+)"`,'g'))].map(m=>m[1]),[expected],`${f}?v= must be ${expected}`);
}
assert.match(read('index.html'),/<a class="expedition-link" href="expedition\.html">바다 탐험<\/a>/);
console.log('PASS: expedition state (timed eased sailing, retarget keeps speed, skip, fast moves, revisit, no auto-sail while reading), ?sail=, route at sea, hash and map-link formats, screen wording 2026-10-17 (30 cards, stop list, 30 details: no weakness words or negative guidance, MCUI source lines, empty values)');

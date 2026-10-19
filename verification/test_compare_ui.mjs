// The '비교와 지표' tab (2026-10 deep-sea redesign), offline on dist/live-snapshot.json the way test_detail_render runs it:
// the basket holds up to 3 species without repeats and can drop one; the side-by-side view draws a bar only where the values
// share one scale (MFPI within one comparison group, MCUI within one assessment basis) and says "직접 비교 불가" otherwise;
// switching matrix ↔ table keeps the search, group, selected species and basket; the filter note counts what is shown.
// Design 3 (2026-10-13): plain verdicts only ever sit beside the formal type name; the profile chips drop no label; crowded
// points group by MCUI row and quadrant (the selected species never joins); '바다 탐험에서 보기' opens the species' route stop.
// 2026-10-17 (LKH): no evidence-level label on screen ('단일 논문', the replication label, '직접 비교 불가', the '근거 수준'
// chips of the data table); values on different scales say what they are ('비교집단별 값', '평가 기반별 값'); a species
// without a type shows '—'. The record keeps every label; the asserts below check the screen and the record.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const D=new URL('../dist/',import.meta.url), read=f=>fs.readFileSync(new URL(f,D),'utf8');
const app=read('app.js'), cut=app.indexOf('let startHash={};');
assert.ok(cut>0,'page bootstrap marker in app.js');
const nodes=new Map();
const el=()=>({innerHTML:'',textContent:'',value:'',hidden:false,style:{},dataset:{},classList:{toggle(){},add(){},remove(){},contains(){return false}},
  setAttribute(){},removeAttribute(){},toggleAttribute(){},addEventListener(){},querySelector(){return null},querySelectorAll(){return []},scrollIntoView(){},
  contains(){return false},focus(){},getBoundingClientRect(){return {height:0}}});
const $=id=>{if(!nodes.has(id))nodes.set(id,el());return nodes.get(id);};
const ctx={AbortSignal,structuredClone,console,document:{getElementById:$,querySelector:el,querySelectorAll(){return []},activeElement:null},
  window:{addEventListener(){}},location:{hash:'',pathname:'/'},history:{replaceState(){}},requestAnimationFrame(){},matchMedia:()=>({matches:false}),
  fetch:async u=>{u=String(u);if(u.startsWith('https://'))throw TypeError('offline');
    const f=new URL(u.split('?')[0],D), ok=fs.existsSync(f);return {ok,status:ok?200:404,json:async()=>JSON.parse(fs.readFileSync(f,'utf8'))};}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../dist/score-format.js',import.meta.url),'utf8'),ctx); // as on the page: app.js writes its numbers with it
vm.runInContext(read('live-data.js')+'\n'+app.slice(0,cut)+';globalThis.T={toggleBasket,setCompareMode,setCompareFilter,renderCompareTray,renderCompareDialog,renderCompareProfile,renderCompareDrawer,'+
  'get basket(){return cmpBasket},set basket(v){cmpBasket=v},get mode(){return cmpMode},get filter(){return {...cmpFilter}},get selected(){return selected},set selected(v){selected=v},cmpMatch,pilotScore,'+
  'plainWords,MATRIX_PLAIN,matrixTypePlain,matrixPlainNote,matrixType,matrixTypeLabel,cmpTag,cmpPieces,cmpChip,cmpUseRest,matrixClusters,cmpExpeditionLink,set stops(v){cmpStops=v},'+
  'renderComparison,cmpRowShown,cmpTypeOf,evidenceChipList,evidenceCoverage,weightPair,earlyMcui,stockMcui,set w(v){bbviWeight=v}};',ctx);
const T=ctx.T;
const data=await vm.runInContext(`(async()=>{const next=await loadPublishedProfiles();next.outdated??=[];await attachPilotAssessments(next);return data=next;})()`,ctx);
const S=data.species, total=S.length, by=id=>S.find(s=>s.aphiaID===id);
const OYSTER=836033, WAKAME=145721, ROCKFISH=274849;
assert.ok(total>=4&&by(OYSTER)&&by(WAKAME)&&by(ROCKFISH),'snapshot has 참굴, 미역, 조피볼락 and at least 4 species');
const tray=()=>$('cmp-tray').innerHTML, dialog=()=>$('cmp-dialog-body').innerHTML;
const strip=h=>h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
// 2026-10-15 final design: the profile face keeps the values; every other label moved, unchanged, into the '근거 자세히 보기'
// drawer. So 'stays on the profile' means the face plus the drawer for the same species.
const both=()=>{T.renderCompareProfile();T.renderCompareDrawer(T.selected);return strip($('cmp-profile').innerHTML)+' | '+strip($('cmp-drawer-axes').innerHTML);};

// Basket: a second press removes, at most 3, no repeats, removing frees a slot.
T.selected=by(OYSTER);T.basket=[];
assert.equal(T.toggleBasket(OYSTER),true);assert.deepEqual([...T.basket],[OYSTER]);
assert.equal(T.toggleBasket(OYSTER),true);assert.deepEqual([...T.basket],[],'pressing 담기 again takes the species out');
const ids=S.slice(0,4).map(s=>s.aphiaID);
ids.slice(0,3).forEach(T.toggleBasket);
assert.equal(T.toggleBasket(ids[3]),false,'a 4th species is refused');
assert.deepEqual([...T.basket],ids.slice(0,3));
T.toggleBasket(ids[0]);T.toggleBasket(ids[1]);T.toggleBasket(ids[1]);
assert.deepEqual([...T.basket],[ids[2],ids[1]],'re-adding goes to the end, never twice');
assert.equal(new Set(T.basket).size,T.basket.length);
T.renderCompareTray();
assert.ok(strip(tray()).includes('2 / 3')&&(tray().match(/data-basket-add/g)||[]).length===1&&(tray().match(/data-basket-remove=/g)||[]).length===2,'tray shows 2 of 3 and one free slot');
assert.match(tray(),/id="cmp-compare-go"[^>]*aria-disabled="false"/,'2 species can be compared');
T.basket=[ids[0]];T.renderCompareTray();
assert.match(tray(),/id="cmp-compare-go"[^>]*aria-disabled="true"/,'1 species cannot be compared');
assert.ok(strip(tray()).includes('2종 이상 담으면 비교할 수 있습니다'));

// Profile: the add button says when the basket is full; labels sit next to the values; no old wording.
T.basket=ids.slice(0,3);T.selected=by(ROCKFISH);T.renderCompareProfile();
let prof=$('cmp-profile').innerHTML;const face=strip(prof),all=both();
if(!ids.slice(0,3).includes(ROCKFISH))assert.match(prof,/id="cmp-add"[^>]*aria-disabled="true"/,'full basket disables 담기 for a new species');
assert.ok(!all.includes('최상위 근거 독립 재현 확인 중')&&!all.includes('근거 논문 1편')&&!all.includes('단일 논문')&&all.includes('보전 평가 범주 기반'),'조피볼락: no BBVI replication label on screen and a neutral MCUI basis (4.17: preliminary assessment)');
assert.equal(by(ROCKFISH).assessment.bbvi_label,'단일 논문','the record keeps the 조피볼락 label');
assert.ok(!/예비|역검증|Rapid LC|보전평가 미확인|IUCN 기반/.test(face)&&!/예비|역검증|Rapid LC|보전평가 미확인|IUCN 기반(?! MCUI와)/.test(all),'4.17 (prereg-4.17 5): the profile and its drawer never names the preliminary assessment, nor calls it IUCN');
T.basket=[];T.selected=by(OYSTER);prof=both();
assert.ok(prof.includes('72')&&!prof.includes('71.9')&&prof.includes('한국 국가 평가')&&!prof.includes('비교 불가'),'참굴 profile: BBVI value and its national MCUI basis');

// Side-by-side: mixed comparison groups and bases → no bars on those rows, "직접 비교 불가" instead; never a total or a pick.
const cohort=s=>s.assessment?.food_trace?.cohort_id, basis=s=>s.assessment?.mcui_basis||'iucn';
T.basket=[OYSTER,WAKAME,ROCKFISH];T.renderCompareDialog();let h=dialog(), t=strip(h);
assert.notEqual(cohort(by(OYSTER)),cohort(by(WAKAME)),'참굴 and 미역 sit in different MFPI comparison groups');
assert.ok(t.includes('비교집단별 값')&&t.includes('평가 기반별 값')&&!t.includes('직접 비교 불가'));
assert.equal((h.match(/cp-bar sand/g)||[]).length,0,'no MCUI bars across different bases');
assert.equal((h.match(/class="cd-val"/g)||[]).length,4*3,'BBVI, MFPI, MBPI, MCUI for each of the 3 species');
assert.ok(!/합산|종합 점수|추천 종|순위:|1위/.test(t),'no composite, rank or pick');
assert.ok(!/단일 논문|검증 미통과/.test(t),'neutral label wording');
for(const id of T.basket)for(const ax of ['MFPI','MBPI','BBVI','MCUI','OCC'])assert.ok(h.includes(`data-dlg-aphia="${id}" data-dlg-axis="${ax}"`),`근거 보기 ${id} ${ax}`);
// Same group and same basis → bars and no "직접 비교 불가".
let pair=null;
for(const a of S)for(const b of S)if(!pair&&a!==b&&['MFPI','MCUI'].every(k=>T.pilotScore(a,k)!==null&&T.pilotScore(b,k)!==null)&&cohort(a)===cohort(b)&&basis(a)===basis(b))pair=[a.aphiaID,b.aphiaID];
assert.ok(pair,'two species share a comparison group and an MCUI basis');
T.basket=pair;T.renderCompareDialog();h=dialog();
assert.ok(!/비교집단이 달라|평가 기반이 달라|비교집단별 값|평가 기반별 값/.test(strip(h)),'one scale: no per-scale note between them');
assert.equal((h.match(/cp-bar sand/g)||[]).length,2,'MCUI bars drawn on one basis');
assert.ok((h.match(/class="cp-bar /g)||[]).length>=2*3,'MFPI and the BBVI/MBPI bars drawn');

// Filter and mode: the group/search narrows the matches, the mode switch keeps filter, selection and basket.
T.basket=[OYSTER,WAKAME];T.selected=by(ROCKFISH);
T.setCompareFilter({group:'해조류',q:''});
const n=S.filter(T.cmpMatch).length;
assert.equal(n,S.filter(s=>s.group==='해조류').length);assert.ok(n>0&&n<total);
assert.ok(strip($('cmp-filter-note').innerHTML).includes(`${total}종 중 ${n}종 표시`),'note counts the shown species');
T.setCompareMode('table');T.setCompareMode('matrix');
assert.equal(T.mode,'matrix');assert.deepEqual({...T.filter},{q:'',group:'해조류',type:null});assert.deepEqual([...T.basket],[OYSTER,WAKAME]);assert.equal(T.selected.aphiaID,ROCKFISH);
T.setCompareFilter({group:'all',q:'없는생물이름'});
assert.equal(S.filter(T.cmpMatch).length,0);assert.ok(strip($('cmp-filter-note').innerHTML).includes('검색 결과 없음'),'an empty result says so, not an error');
T.setCompareFilter({group:'all',q:''});assert.equal($('cmp-filter-note').innerHTML,'','no note without a filter');

// Design 3, 4.14 (prereg-4.14 7): the plain words are the report's position words for the four type ids ('—' otherwise,
// 2026-10-17), and the note says what the type is (a class for choosing the research order) and names the line '탐색용 기준선'.
assert.deepEqual(['alternative_production','baseline_survey','conservation_priority','sustainable_use'].map(id=>T.MATRIX_PLAIN[id]),
  ['두 지표 모두 높음','두 지표 모두 낮음','보전 지표 높음','활용 지표 높음']);
assert.equal(T.matrixTypePlain('sustainable_use'),'활용 지표 높음');assert.equal(T.matrixTypePlain(null),'—');assert.equal(T.matrixTypePlain('other'),'—');
assert.ok(T.matrixPlainNote().startsWith('연구 순서를 고르기 위한 분류 · 탐색용 기준선: ')&&T.matrixPlainNote().includes('이상이면 활용 지표 높음')&&!/판정이 아님|탐색적 구분선|검증된 기준 아님/.test(T.matrixPlainNote()));
assert.ok(data.assessmentInfo.method.matrix.type_note.includes('판정이 아님')&&data.assessmentInfo.method.matrix.threshold_label==='탐색적 구분선','the report keeps its own wording');
assert.ok(!/써도 됨|키워서 써야 함|지켜야 함|더 알아봐야 함|지속가능 활용 후보/.test(read('app.js')+read('index.html')+read('chatbot.js')),'4.14: no use or harvest verdict words left on the page');
T.basket=[];T.selected=by(OYSTER);T.renderCompareProfile();prof=$('cmp-profile').innerHTML;
const oysterType=T.matrixType(by(OYSTER));
assert.ok(new RegExp(`<b>${T.matrixTypePlain(oysterType)}</b><span class="sr-only"> \\(${T.matrixTypeLabel(oysterType)}\\)</span>`).test(prof),'the profile type line: plain verdict, then the formal type name (read aloud, on hover and in the drawer)');
T.renderCompareDrawer(by(OYSTER));assert.ok(strip($('cmp-drawer-axes').innerHTML).includes(`${T.matrixTypePlain(oysterType)} ${T.matrixTypeLabel(oysterType)}`),'the drawer names both');
// Chips: one short label beside a value, never the shared '정식 산출' or '단일 논문'; every other label piece stays on the profile.
for(const s of S)for(const k of ['BBVI','MFPI','MBPI','MCUI']){const c=T.cmpChip(s,k);assert.ok(c!=='정식 산출'&&!T.plainWords(c).includes('단일 논문'),`${s.label} ${k} chip "${c}"`);}
for(const s of S){
  T.selected=s;const text=both();
  for(const k of ['BBVI','MFPI','MBPI','MCUI'])for(const piece of T.cmpPieces(s,k)){
    const shown=T.plainWords(piece).replace(/^(.+) 비교집단$/,'식량 비교집단: $1');  // the screen's own wording (esc)
    assert.ok(text.includes(shown)||(k==='MCUI'&&text.includes(T.plainWords(T.cmpChip(s,k)))),`${s.label}: '${shown}' (${k}) stays on the profile`);
  }
}
T.selected=by(OYSTER);prof=both();
assert.ok(['비교집단','한국 국가 평가'].every(x=>prof.includes(x))&&!['최상위 근거 독립 재현 확인 중','직접 비교 불가','단일 논문'].some(x=>prof.includes(x)),'참굴 keeps its comparison group and basis, no replication label or 비교 불가 note');
assert.equal(by(OYSTER).assessment.bbvi_label,'단일 논문','the record keeps the 참굴 label');
// 4.19: 멍게 is placed now, so the unplaced wording is checked on a copy without its MCUI
T.selected=(s=>({...s,assessment:{...s.assessment,scores:{...s.assessment.scores,MCUI:null}}}))(by(250680));prof=both();
assert.ok(/<b>—<\/b>/.test($('cmp-profile').innerHTML)&&!prof.includes('유형 미산출')&&!prof.includes('매트릭스 미배치')&&!prof.includes('한 쌍'),'an unplaced species shows — as its type, with no reason line');
// Crowded points: same MCUI, same side of the BBVI threshold, neighbours under 4 apart, 4 or more; the selected one never joins.
const P=(aphia,b,m,type,selected=false)=>({aphia,b,m,type,selected});
assert.deepEqual([...T.matrixClusters([P(1,10,10,'a'),P(2,13,10,'a'),P(3,16,10,'a'),P(4,19.9,10,'a')])].map(g=>[...g.ids]),[[1,2,3,4]]);
assert.equal(T.matrixClusters([P(1,10,10,'a'),P(2,13,10,'a'),P(3,16,10,'a'),P(4,20,10,'a')]).length,0,'a gap of exactly 4 breaks the run; 3 are too few');
assert.equal(T.matrixClusters([P(1,46,10,'a'),P(2,47.5,10,'a'),P(3,50,10,'b'),P(4,51.5,10,'b')]).length,0,'never across the BBVI threshold');
assert.equal(T.matrixClusters([P(1,10,10,'a'),P(2,11,10,'a'),P(3,12,20,'a'),P(4,13,10,'a')]).length,0,'never across MCUI rows');
assert.deepEqual([...T.matrixClusters([P(1,10,10,'a'),P(2,11.5,10,'a'),P(3,13,10,'a',true),P(4,14.5,10,'a'),P(5,16,10,'a')])].map(g=>[...g.ids]),[[1,2,4,5]],'the selected point stays out');
const pts=sel=>S.filter(s=>T.matrixType(s)).map(s=>P(s.aphiaID,T.pilotScore(s,'BBVI'),T.pilotScore(s,'MCUI'),T.matrixType(s),s.aphiaID===sel));
let G=[...T.matrixClusters(pts(OYSTER))];
// 4.14: the 13 species without an IUCN or Korean national category left the matrix, so no MCUI row keeps 4 neighbours under 4 apart
// 4.17: they return as preliminary assessments (29 points), so the 4.13 runs return (BBVI from the unrounded inputs)
assert.deepEqual(G.map(g=>[g.m,g.ids.length,g.min.toFixed(1),g.max.toFixed(1)]),[[10,7,'29.3','41.6'],[10,4,'46.2','49.1'],[10,7,'51.3','59.6']],'참굴 picked: two runs below the threshold, one above it (4.19: 멍게 33.1 joins 방어 29.3 to the left run)');
G=[...T.matrixClusters(pts(ROCKFISH))];
assert.deepEqual(G.map(g=>g.ids.length),[4,4,7,4],'조피볼락 picked: it splits the left run and 참굴 joins its neighbours (4.19: 멍게 lengthens the left run, so both halves keep 4)');
assert.ok(G.every(g=>!g.ids.includes(ROCKFISH)));
assert.equal(T.matrixType(by(ROCKFISH)),'baseline_survey','조피볼락 (Rapid LC as a preliminary assessment) is a point again');
// '바다 탐험에서 보기': #stop=N over the route stops (1-based); an off-route stop opens the page; no stop, no link.
const stops=JSON.parse(read('expedition-stops.json')).stops, route=stops.filter(st=>st.on_route!==false&&st.cell);
const OCTOPUS=stops.find(st=>!route.includes(st))?.aphia_id;
assert.deepEqual({...T.cmpExpeditionLink(stops,OYSTER)},{href:`expedition.html#stop=${route.findIndex(st=>st.aphia_id===OYSTER)+1}`,text:'바다 탐험에서 보기'});
assert.deepEqual({...T.cmpExpeditionLink(stops,OCTOPUS)},{href:'expedition.html',text:'바다 탐험 열기(항로 밖 지점)'});
assert.equal(T.cmpExpeditionLink(stops,1),null);assert.equal(T.cmpExpeditionLink(null,OYSTER),null);
T.stops=stops;T.selected=by(OYSTER);T.renderCompareProfile();
assert.match($('cmp-profile').innerHTML,new RegExp(`<a id="cmp-expedition" class="cmp-link" href="expedition.html#stop=${route.findIndex(st=>st.aphia_id===OYSTER)+1}">바다 탐험에서 보기</a>`));

// 2026-10-13 dark data table: 8 columns (종·유형·5 values·⌄). The expanded row holds BBVI as the sum it is at the current weight,
// the MCUI basis sentence, the public cells with the map button, the evidence-level chips (plus '보전 평가 없음 확인' where the
// coverage column said so) and the old full labels, folded. A type card keeps only its type in the table, never on the matrix.
const moreOf=(h,id)=>h.split(`id="cmp-more-${id}"`)[1].split('</tr>')[0];
for(const k of [0,10,20]){
  T.w=k/20;T.renderComparison();const h=$('comparison').innerHTML,[wb,wf]=T.weightPair().match(/\d\.\d\d/g);
  assert.equal((h.match(/<th scope="col"/g)||[]).length,8);assert.equal(Math.round(Number(wb)*100)+Math.round(Number(wf)*100),100);
  for(const s of S){
    const part=moreOf(h,s.aphiaID), v=T.pilotScore(s,'BBVI'), cov=T.evidenceCoverage(s).checks.find(c=>c.name==='보전');
    // 4.14: '≈' with its reason where the unrounded inputs give another last digit than the shown one-decimal ones
    if(v!==null)assert.ok(part.includes(`${wf} × MFPI ${T.pilotScore(s,'MFPI').toFixed(1)} + ${wb} × MBPI ${T.pilotScore(s,'MBPI').toFixed(1)} = <b>${v.toFixed(1)}</b>`)||
      part.includes(`${wf} × MFPI ${T.pilotScore(s,'MFPI').toFixed(1)} + ${wb} × MBPI ${T.pilotScore(s,'MBPI').toFixed(1)} ≈ <b>${v.toFixed(1)}</b>`)&&part.includes('반올림 전 MFPI·MBPI로 계산해 마지막 자리가 다름'),`${s.label} BBVI at w ${k/20}`);
    assert.ok(part.includes(`data-score-aphia="${s.aphiaID}" data-score-axis="OCC"`)&&part.includes('<h4>MCUI 기반</h4>')&&
      // 4.17 (prereg-4.17 5): a preliminary assessment is named in the species detail, so the table row says it neutrally
      (T.earlyMcui(s)?!/예비 평가\(공식 평가 전\)|IUCN 기반(?! MCUI와)/.test(part)&&(T.stockMcui(s)||part.includes('보전 평가 범주를 확인해')):part.includes(cov.detail.slice(0,20))),s.label+' occurrence button and MCUI basis');
    // 2026-10-17 (LKH): the '근거 수준' chip row left the expanded row; evidenceChipList still reads the labels from the record
    assert.ok(!part.includes('class="dt-x-ev"')&&!part.includes('class="ev-chip')&&!part.includes('보전 평가 없음'),s.label+' no evidence-level chips');
    for(const c of T.evidenceChipList(s))if(/단일 논문|재현|역검증|예비/.test(c))assert.ok(!part.includes(T.plainWords(c)),`${s.label} chip ${c} off the row`);
    assert.ok(part.includes('<details class="dt-x-all"')&&part.includes('<h4>학명·식별자</h4>'),s.label+' full labels folded');
  }
}
T.w=.5;T.renderComparison();
assert.ok(!$('comparison').innerHTML.includes('coverage-bar')&&!$('comparison').innerHTML.includes('자료 연결 현황'),'the coverage column left the table');
T.setCompareFilter({group:'all',q:'',type:null});T.setCompareMode('table');
const types=[...new Set(S.map(T.cmpTypeOf))];assert.ok(types.length>=2);
for(const t of types){T.setCompareFilter({type:t});const shown=S.filter(T.cmpRowShown);
  assert.ok(shown.length>0&&shown.every(s=>T.cmpTypeOf(s)===t)&&strip($('cmp-filter-note').innerHTML).includes(`${total}종 중 ${shown.length}종 표시`),'type card '+t);}
T.setCompareFilter({group:'해조류',type:types[0]});
assert.deepEqual(S.filter(T.cmpRowShown).map(s=>s.aphiaID),S.filter(s=>s.group==='해조류'&&T.cmpTypeOf(s)===types[0]).map(s=>s.aphiaID),'group × type');
T.setCompareMode('matrix');assert.ok(strip($('cmp-filter-note').innerHTML).includes(`${total}종 중 ${S.filter(T.cmpMatch).length}종 표시`),'the matrix ignores the type card');
T.setCompareFilter({group:'all',q:'',type:null});assert.equal($('cmp-filter-note').innerHTML,'');

console.log(`PASS: 데이터 표 8열·펼친 행(BBVI 계산·MCUI 기반·출현 기록, 근거 수준 칩 없음)·유형 카드 필터 · 비교 담기 최대 3종·중복 없음·빼기 · 같은 척도만 막대(${pair.map(id=>by(id).label).join('·')}) · 다른 비교집단·평가 기반은 비교집단별·평가 기반별 값 · 보기 전환 상태 유지 · ${total}종 중 ${n}종 표시 · 쉬운 이름 옆 공식 이름 · 칩이 지운 라벨 없음 · 밀집 ${G.map(g=>g.ids.length).join('·')}종(조피볼락 선택) · 바다 탐험 링크`);

// The '비교와 지표' tab (2026-10 deep-sea redesign), offline on dist/live-snapshot.json the way test_detail_render runs it:
// the basket holds up to 3 species without repeats and can drop one; the side-by-side view draws a bar only where the values
// share one scale (MFPI within one comparison group, MCUI within one assessment basis) and says "직접 비교 불가" otherwise;
// switching matrix ↔ table keeps the search, group, selected species and basket; the filter note counts what is shown.
// Design 3 (2026-10-13): plain verdicts only ever sit beside the formal type name; the profile chips drop no label; crowded
// points group by MCUI row and quadrant (the selected species never joins); '바다 탐험에서 보기' opens the species' route stop.
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
vm.runInContext(read('live-data.js')+'\n'+app.slice(0,cut)+';globalThis.T={toggleBasket,setCompareMode,setCompareFilter,renderCompareTray,renderCompareDialog,renderCompareProfile,'+
  'get basket(){return cmpBasket},set basket(v){cmpBasket=v},get mode(){return cmpMode},get filter(){return {...cmpFilter}},get selected(){return selected},set selected(v){selected=v},cmpMatch,pilotScore,'+
  'plainWords,MATRIX_PLAIN,matrixTypePlain,matrixPlainNote,matrixType,matrixTypeLabel,cmpTag,cmpPieces,cmpChip,cmpUseRest,matrixClusters,cmpExpeditionLink,set stops(v){cmpStops=v}};',ctx);
const T=ctx.T;
const data=await vm.runInContext(`(async()=>{const next=await loadPublishedProfiles();next.outdated??=[];await attachPilotAssessments(next);return data=next;})()`,ctx);
const S=data.species, total=S.length, by=id=>S.find(s=>s.aphiaID===id);
const OYSTER=836033, WAKAME=145721, ROCKFISH=274849;
assert.ok(total>=4&&by(OYSTER)&&by(WAKAME)&&by(ROCKFISH),'snapshot has 참굴, 미역, 조피볼락 and at least 4 species');
const tray=()=>$('cmp-tray').innerHTML, dialog=()=>$('cmp-dialog-body').innerHTML;
const strip=h=>h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');

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
let prof=$('cmp-profile').innerHTML;
if(!ids.slice(0,3).includes(ROCKFISH))assert.match(prof,/id="cmp-add"[^>]*aria-disabled="true"/,'full basket disables 담기 for a new species');
assert.ok(strip(prof).includes('근거 논문 1편')&&strip(prof).includes('자체 예비평가'),'조피볼락 keeps its BBVI paper-count and MCUI basis labels');
T.basket=[];T.selected=by(OYSTER);T.renderCompareProfile();prof=strip($('cmp-profile').innerHTML);
assert.ok(prof.includes('71.9')&&prof.includes('한국 국가 평가')&&prof.includes('IUCN 기반 MCUI와 직접 비교 불가'),'참굴 profile: BBVI value and its national MCUI basis');

// Side-by-side: mixed comparison groups and bases → no bars on those rows, "직접 비교 불가" instead; never a total or a pick.
const cohort=s=>s.assessment?.food_trace?.cohort_id, basis=s=>s.assessment?.mcui_basis||'iucn';
T.basket=[OYSTER,WAKAME,ROCKFISH];T.renderCompareDialog();let h=dialog(), t=strip(h);
assert.notEqual(cohort(by(OYSTER)),cohort(by(WAKAME)),'참굴 and 미역 sit in different MFPI comparison groups');
assert.ok(t.includes('비교집단이 달라 직접 비교 불가')&&t.includes('평가 기반이 달라 직접 비교 불가'));
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
assert.ok(!/비교집단이 달라|평가 기반이 달라/.test(strip(h)),'one scale: no 직접 비교 불가 between them');
assert.equal((h.match(/cp-bar sand/g)||[]).length,2,'MCUI bars drawn on one basis');
assert.ok((h.match(/class="cp-bar /g)||[]).length>=2*3,'MFPI and the BBVI/MBPI bars drawn');

// Filter and mode: the group/search narrows the matches, the mode switch keeps filter, selection and basket.
T.basket=[OYSTER,WAKAME];T.selected=by(ROCKFISH);
T.setCompareFilter({group:'해조류',q:''});
const n=S.filter(T.cmpMatch).length;
assert.equal(n,S.filter(s=>s.group==='해조류').length);assert.ok(n>0&&n<total);
assert.ok(strip($('cmp-filter-note').innerHTML).includes(`${total}종 중 ${n}종 표시`),'note counts the shown species');
T.setCompareMode('table');T.setCompareMode('matrix');
assert.equal(T.mode,'matrix');assert.deepEqual({...T.filter},{q:'',group:'해조류'});assert.deepEqual([...T.basket],[OYSTER,WAKAME]);assert.equal(T.selected.aphiaID,ROCKFISH);
T.setCompareFilter({group:'all',q:'없는생물이름'});
assert.equal(S.filter(T.cmpMatch).length,0);assert.ok(strip($('cmp-filter-note').innerHTML).includes('검색 결과 없음'),'an empty result says so, not an error');
T.setCompareFilter({group:'all',q:''});assert.equal($('cmp-filter-note').innerHTML,'','no note without a filter');

// Design 3: the plain verdict is a display alias of the four type ids ('유형 없음' otherwise) and says it is no permission.
assert.deepEqual(Object.keys(T.MATRIX_PLAIN).sort(),['alternative_production','baseline_survey','conservation_priority','sustainable_use']);
assert.equal(T.matrixTypePlain('sustainable_use'),'써도 됨');assert.equal(T.matrixTypePlain(null),'유형 없음');assert.equal(T.matrixTypePlain('other'),'유형 없음');
assert.ok(T.matrixPlainNote().startsWith('연구용 유형 요약 · 채집·이용 권고 아님')&&T.matrixPlainNote().includes('이상이면 활용 높음'));
T.basket=[];T.selected=by(OYSTER);T.renderCompareProfile();prof=$('cmp-profile').innerHTML;
const oysterType=T.matrixType(by(OYSTER));
assert.ok(new RegExp(`<b>${T.matrixTypePlain(oysterType)}</b><span>${T.matrixTypeLabel(oysterType)}</span>`).test(prof),'the profile type line: plain verdict, then the formal type name');
// Chips: one short label beside a value, never the shared '정식 산출' or '단일 논문'; every other label piece stays on the profile.
for(const s of S)for(const k of ['BBVI','MFPI','MBPI','MCUI']){const c=T.cmpChip(s,k);assert.ok(c!=='정식 산출'&&!T.plainWords(c).includes('단일 논문'),`${s.label} ${k} chip "${c}"`);}
for(const s of S){
  T.selected=s;T.renderCompareProfile();const text=strip($('cmp-profile').innerHTML);
  for(const k of ['BBVI','MFPI','MBPI','MCUI'])for(const piece of T.cmpPieces(s,k)){
    const shown=T.plainWords(piece).replace(/^(.+) 비교집단$/,'식량 비교집단: $1');  // the screen's own wording (esc)
    assert.ok(text.includes(shown)||(k==='MCUI'&&text.includes(T.plainWords(T.cmpChip(s,k)))),`${s.label}: '${shown}' (${k}) stays on the profile`);
  }
}
T.selected=by(OYSTER);T.renderCompareProfile();prof=strip($('cmp-profile').innerHTML);
assert.ok(['비교집단','근거 논문 1편','IUCN 기반 MCUI와 직접 비교 불가','한국 국가 평가'].every(x=>prof.includes(x)),'참굴 keeps its comparison group, paper count and basis note');
T.selected=by(250680);T.renderCompareProfile();prof=strip($('cmp-profile').innerHTML);
assert.ok(prof.includes('유형 없음')&&prof.includes('매트릭스 미배치'),'an unplaced species says 유형 없음 and why');
// Crowded points: same MCUI, same side of the BBVI threshold, neighbours under 4 apart, 4 or more; the selected one never joins.
const P=(aphia,b,m,type,selected=false)=>({aphia,b,m,type,selected});
assert.deepEqual([...T.matrixClusters([P(1,10,10,'a'),P(2,13,10,'a'),P(3,16,10,'a'),P(4,19.9,10,'a')])].map(g=>[...g.ids]),[[1,2,3,4]]);
assert.equal(T.matrixClusters([P(1,10,10,'a'),P(2,13,10,'a'),P(3,16,10,'a'),P(4,20,10,'a')]).length,0,'a gap of exactly 4 breaks the run; 3 are too few');
assert.equal(T.matrixClusters([P(1,46,10,'a'),P(2,47.5,10,'a'),P(3,50,10,'b'),P(4,51.5,10,'b')]).length,0,'never across the BBVI threshold');
assert.equal(T.matrixClusters([P(1,10,10,'a'),P(2,11,10,'a'),P(3,12,20,'a'),P(4,13,10,'a')]).length,0,'never across MCUI rows');
assert.deepEqual([...T.matrixClusters([P(1,10,10,'a'),P(2,11.5,10,'a'),P(3,13,10,'a',true),P(4,14.5,10,'a'),P(5,16,10,'a')])].map(g=>[...g.ids]),[[1,2,4,5]],'the selected point stays out');
const pts=sel=>S.filter(s=>T.matrixType(s)).map(s=>P(s.aphiaID,T.pilotScore(s,'BBVI'),T.pilotScore(s,'MCUI'),T.matrixType(s),s.aphiaID===sel));
let G=[...T.matrixClusters(pts(OYSTER))];
assert.deepEqual(G.map(g=>[g.m,g.ids.length,g.min.toFixed(1),g.max.toFixed(1)]),[[10,11,'35.5','49.1'],[10,7,'51.5','59.7']],'참굴 picked: 11 below the threshold, 7 above it');
G=[...T.matrixClusters(pts(ROCKFISH))];
assert.deepEqual(G.map(g=>g.ids.length),[8,7,4],'조피볼락 picked: it splits the left run and 참굴 joins its neighbours');
assert.ok(G.every(g=>!g.ids.includes(ROCKFISH)));
// '바다 탐험에서 보기': #stop=N over the route stops (1-based); an off-route stop opens the page; no stop, no link.
const stops=JSON.parse(read('expedition-stops.json')).stops, route=stops.filter(st=>st.on_route!==false&&st.cell);
const OCTOPUS=stops.find(st=>!route.includes(st))?.aphia_id;
assert.deepEqual({...T.cmpExpeditionLink(stops,OYSTER)},{href:`expedition.html#stop=${route.findIndex(st=>st.aphia_id===OYSTER)+1}`,text:'바다 탐험에서 보기'});
assert.deepEqual({...T.cmpExpeditionLink(stops,OCTOPUS)},{href:'expedition.html',text:'바다 탐험 열기(항로 밖 지점)'});
assert.equal(T.cmpExpeditionLink(stops,1),null);assert.equal(T.cmpExpeditionLink(null,OYSTER),null);
T.stops=stops;T.selected=by(OYSTER);T.renderCompareProfile();
assert.match($('cmp-profile').innerHTML,new RegExp(`<a id="cmp-expedition" class="cmp-link" href="expedition.html#stop=${route.findIndex(st=>st.aphia_id===OYSTER)+1}">바다 탐험에서 보기</a>`));

console.log(`PASS: 비교 담기 최대 3종·중복 없음·빼기 · 같은 척도만 막대(${pair.map(id=>by(id).label).join('·')}) · 다른 비교집단·평가 기반은 직접 비교 불가 · 보기 전환 상태 유지 · ${total}종 중 ${n}종 표시 · 쉬운 이름 옆 공식 이름 · 칩이 지운 라벨 없음 · 밀집 ${G.map(g=>g.ids.length).join('·')}종(조피볼락 선택) · 바다 탐험 링크`);

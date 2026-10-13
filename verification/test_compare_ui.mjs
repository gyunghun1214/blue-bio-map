// The '비교와 지표' tab (2026-10 deep-sea redesign), offline on dist/live-snapshot.json the way test_detail_render runs it:
// the basket holds up to 3 species without repeats and can drop one; the side-by-side view draws a bar only where the values
// share one scale (MFPI within one comparison group, MCUI within one assessment basis) and says "직접 비교 불가" otherwise;
// switching matrix ↔ table keeps the search, group, selected species and basket; the filter note counts what is shown.
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
  'get basket(){return cmpBasket},set basket(v){cmpBasket=v},get mode(){return cmpMode},get filter(){return {...cmpFilter}},get selected(){return selected},set selected(v){selected=v},cmpMatch,pilotScore};',ctx);
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

console.log(`PASS: 비교 담기 최대 3종·중복 없음·빼기 · 같은 척도만 막대(${pair.map(id=>by(id).label).join('·')}) · 다른 비교집단·평가 기반은 직접 비교 불가 · 보기 전환 상태 유지 · ${total}종 중 ${n}종 표시`);

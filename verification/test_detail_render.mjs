// Renders every species offline (dist/live-snapshot.json) the way the page does and checks the visible HTML of the
// detail panel, the comparison panel (showDecision), the cell table and the cell popups.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const D=new URL('../dist/',import.meta.url), read=f=>fs.readFileSync(new URL(f,D),'utf8');
const app=read('app.js'), cut=app.indexOf('let startHash={};');
assert.ok(cut>0,'page bootstrap marker in app.js');
const nodes=new Map(), popups=[];
const el=()=>({innerHTML:'',textContent:'',value:'',hidden:false,style:{},dataset:{},classList:{toggle(){},add(){},remove(){},contains(){return false}},
  setAttribute(){},removeAttribute(){},addEventListener(){},querySelector(){return null},querySelectorAll(){return []},scrollIntoView(){},
  contains(){return false},focus(){},getBoundingClientRect(){return {height:0}}});
const $=id=>{if(!nodes.has(id))nodes.set(id,el());return nodes.get(id);};
const ctx={AbortSignal,structuredClone,console,document:{getElementById:$,querySelector:el,querySelectorAll(){return []},activeElement:null},
  window:{addEventListener(){}},location:{hash:'',pathname:'/'},history:{replaceState(){}},requestAnimationFrame(){},matchMedia:()=>({matches:false}),
  L:{rectangle:()=>({addTo(){return this},bindPopup(h){popups.push(h);return this}}),circleMarker:()=>({addTo(){return this}})},
  // The live API (https) fails, so the page falls back to the dated dist/live-snapshot.json: deterministic.
  fetch:async u=>{u=String(u);if(u.startsWith('https://'))throw TypeError('offline');
    const f=new URL(u.split('?')[0],D), ok=fs.existsSync(f);return {ok,status:ok?200:404,json:async()=>JSON.parse(fs.readFileSync(f,'utf8'))};}};
vm.createContext(ctx);
vm.runInContext(read('live-data.js')+'\n'+app.slice(0,cut)+';map={fitBounds(){},getZoom(){return 7}};overlay={};'+
  'globalThis.T={esc,renderCandidateDetail,renderLiveDetail,showDecision,renderCellTable,renderCellMap};',ctx);
const T=ctx.T;
// The loading steps of loadCollection.
const next=await vm.runInContext(`(async()=>{
  const [next,readiness]=await Promise.all([loadPublishedProfiles(),fetch('matrix-readiness.json').then(r=>r.ok?r.json():null)]);
  next.outdated??=[];matrixReadiness=readinessRows(readiness,next.outdated);
  next.readinessAssessmentDate=readiness?.assessments_snapshot||null;next.readinessCandidateDate=readiness?.candidate_snapshot||null;
  await attachPilotAssessments(next);return data=next;})()`,ctx);

// Expected values come from the published report: the MBPI items the page must list (species with a computed MBPI).
const report=JSON.parse(read('assessments.json'));
const traces=new Map([...report.species,...report.candidate_species||[]].map(r=>[r.aphia_id,r.scores?.MBPI==null?[]:r.bioactivity_trace||[]]));
const ECKLONIA=371986, CAPTION='감태 유래 분리 화합물';
const N=(traces.get(ECKLONIA)||[]).filter(t=>!t.stratum_kind).reduce((a,t)=>a+(t.measurements||[]).length,0);
assert.ok(N>0,'감태 has reviewed compound measurements');
const BAD=/undefined|NaN|\[object Object\]/g, SEA_EN=/Sea of Japan|East China Sea|Kuroshio Current|Yellow Sea(?! Fisheries)/g; // 해삼's institute name is not a sea label
// A template that puts its own period after a source sentence that already ends in one prints '..' ('cod..'); '...' stays.
const DOTS=/[^.]\.\.(?!\.)/g;
const findings=[], count={detail:0,decision:0,cells:0,popup:0};
let cellSpecies=0, popupSpecies=0;
for(const s of next.species){
  const places=[['detail',()=>s.catalog?T.renderCandidateDetail(s):T.renderLiveDetail(s),'detail'],['decision',()=>T.showDecision(s),'decision-detail']];
  if(s.cells?.length){cellSpecies++;places.push(['cells',()=>T.renderCellTable(s),'cell-table'],['popup',()=>T.renderCellMap(s,'#000')]);}
  for(const [place,render,id] of places){
    const p=[];popups.length=0;if(id)$(id).innerHTML='';
    try{render();}catch(e){p.push('render error: '+e.message);}
    const h=id?$(id).innerHTML:popups.join('\n');
    if(place==='popup'&&popups.length)popupSpecies++;
    if(!h)p.push('empty');
    const bad=h.match(BAD), sea=h.match(SEA_EN)||[];
    if(bad)p.push(`${bad.length}× ${[...new Set(bad)].join('/')}`);
    if(sea.length)p.push(`${sea.length}× English sea name (${[...new Set(sea)].join(', ')})`);
    const dots=[...h.matchAll(DOTS)].map(m=>h.slice(Math.max(0,m.index-20),m.index+3));
    if(dots.length)p.push(`${dots.length}× double period (${dots.join(' | ')})`);
    const own=place==='detail'&&s.aphiaID===ECKLONIA, at=h.indexOf(CAPTION);
    if((at>=0)!==own)p.push(own?'감태 caption missing':'감태 caption');
    else if(own){const rows=(h.slice(at,h.indexOf('</table>',at)).match(/<tr>\s*<td/g)||[]).length;if(rows!==N)p.push(`감태 table ${rows} rows, expected ${N}`);}
    if(h.includes('github.com/gyunghun1214'))p.push('private repo link');
    if(place==='decision'){
      // Every MBPI item is named, with its stratum and, when it has measurements, a number. A field the shared helper
      // misses prints '' rather than 'undefined', so a stratum without its own branch shows up only here.
      const items=h.split('<li>').map(li=>[li.split(' · 비교 코호트 ')[0],li]);
      for(const b of traces.get(s.aphiaID)||[]){
        const key=T.esc(b.peptide_sequence??b.compound_id), li=items.find(([name,li])=>name.includes(key)&&li.includes(T.esc(b.stratum_id)))?.[1];
        if(!li)p.push(`MBPI item ${key} (${b.stratum_id}) not named`);
        else if(b.measurements?.length&&!/(MIC|IC50|원값) (=|&lt;|&gt;|≤|≥)? ?\d/.test(li))p.push(`MBPI item ${key} (${b.stratum_id}) without its value`);
      }
    }
    if(p.length){count[place]++;findings.push(`${s.label} ${place}: ${p.join(' · ')}`);}
  }
}
console.log(`findings ${findings.length} (detail ${count.detail} · decision ${count.decision} · cells ${count.cells} · popup ${count.popup})`);
findings.forEach(x=>console.log('  '+x));
assert.equal(next.species.length,30,'8 operating + 22 candidate species rendered');
assert.ok(cellSpecies>0&&popupSpecies===cellSpecies,'popups collected for every species with cells');
assert.equal(findings.length,0,'rendered species HTML has the problems listed above');
console.log(`PASS: ${next.species.length} species detail·comparison·${cellSpecies} cell tables/popups: no undefined, Korean sea names, 감태 table (${N} rows) only for 감태, no private link, every MBPI item named with its value, no double period`);

// One display rule for the index numbers (2026-10-19, LKH 9/10). dist/score-format.js scoreNumber writes every index number
// on screen: BBVI and MBPI (and MBPI-Rx, on the MBPI scale) whole, MFPI and MCUI one decimal, for every species (until 10-19 a
// replicated top MBPI item, 미역's alone, kept one decimal, and a big MCUI number dropped its '.0'). app.js (scoreValue,
// scoreText), the sea expedition and the chatbot all go through it. (1) the rule and its two guards; (2) the 30 species at the
// official weight and at every slider step: the rule's digits, and a shown number never on the other side of the matrix line
// from the species' type, which is still judged before rounding; (3) both pages load it, hashed, before the code that uses
// it; (4) no other formatting of an index number is left in the page code, and the one CSV export holds no index value.
// Run: node verification/test_score_format.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const D=new URL('../dist/',import.meta.url), read=f=>fs.readFileSync(new URL(f,D),'utf8');
const fmt=read('score-format.js'), app=read('app.js'), cut=app.indexOf('let startHash={};');
assert.ok(cut>0,'page bootstrap marker in app.js');

// (1) the rule alone
{const c={};vm.createContext(c);vm.runInContext(fmt,c);const f=c.scoreNumber;
  assert.deepEqual([['BBVI',67.9],['MBPI',89.2],['MBPI',13.5],['BBVI',59.5],['MBPI',0.6],['MFPI',70],['MFPI',46.7],['MCUI',10],['MCUI',80,50]].map(a=>f(...a)),
    ['68','89','14','60','1','70.0','46.7','10.0','80.0'],'BBVI and MBPI whole (half up from the published value), MFPI and MCUI one decimal');
  assert.deepEqual([f('MBPI',0.4),f('MBPI',0),f('BBVI',49.6,50),f('BBVI',50.4,50)],['0.4','0','49.6','50'],'a non-zero value never reads 0; no number crosses its line');
  assert.deepEqual([f('BBVI',50,50,49.97),f('BBVI',50,50,50.02),f('MCUI',49.96,50)],['49.97','50','49.96'],'the line is judged on the value the type uses');
  for(const v of [null,undefined,NaN,'72'])assert.equal(f('BBVI',v),'–');}

// (2) the 30 species, offline on dist/live-snapshot.json the way test_weight_slider runs them
const el=()=>({innerHTML:'',textContent:'',value:'',hidden:false,disabled:false,style:{setProperty(){}},dataset:{},classList:{toggle(){},add(){},remove(){},contains(){return false}},
  setAttribute(){},getAttribute(){return null},removeAttribute(){},toggleAttribute(){},addEventListener(){},querySelector(){return null},querySelectorAll(){return []},
  scrollIntoView(){},contains(){return false},focus(){},getBoundingClientRect(){return {height:0}}});
const nodes=new Map(), $=id=>{if(!nodes.has(id))nodes.set(id,el());return nodes.get(id);};
const ctx={AbortSignal,structuredClone,console,URLSearchParams,document:{getElementById:$,querySelector:el,querySelectorAll(){return []},activeElement:null},
  window:{addEventListener(){}},location:{hash:'',pathname:'/'},history:{replaceState(){}},requestAnimationFrame(){},matchMedia:()=>({matches:false}),
  fetch:async u=>{u=String(u);if(u.startsWith('https://'))throw TypeError('offline');
    const f=new URL(u.split('?')[0],D), ok=fs.existsSync(f);return {ok,status:ok?200:404,json:async()=>JSON.parse(fs.readFileSync(f,'utf8'))};}};
vm.createContext(ctx);
vm.runInContext(fmt,ctx);
vm.runInContext(read('live-data.js')+'\n'+app.slice(0,cut)+';globalThis.T={axisState,scoreValue,scoreText,matrixType,matrixRule,bbviRawAt,officialNote,officialBbvi,'+
  'mbpiRxOf,weightSensitivityLine,cellCsv,set w(v){bbviWeight=v}};',ctx);
const T=ctx.T;
const data=await vm.runInContext(`(async()=>{const next=await loadPublishedProfiles();next.outdated??=[];await attachPilotAssessments(next);return data=next;})()`,ctx);
const S=data.species, rule=T.matrixRule(), HIGH_BBVI=new Set(['sustainable_use','alternative_production']), HIGH_MCUI=new Set(['alternative_production','conservation_priority']);
assert.equal(S.length,30);
const shown=s=>Object.fromEntries(['MFPI','MBPI','BBVI','MCUI'].map(k=>[k,T.scoreValue(s,k,T.axisState(s,k).value)]));
let guarded=0;
for(let k=0;k<=20;k++){T.w=k/20;
  for(const s of S){const n=shown(s), t=T.matrixType(s);
    assert.ok(t,`${s.label}: typed`);
    for(const key of ['MFPI','MCUI'])assert.match(n[key],/^\d+\.\d$/,`${s.label} ${key} at w ${k/20}`);
    for(const key of ['MBPI','BBVI']){
      if(/^\d+$/.test(n[key]))continue;
      // a decimal only where the whole number would read 0 or sit on the other side of the BBVI line
      const v=T.axisState(s,key).value, r=Math.round(v);
      assert.ok(r===0&&v!==0||key==='BBVI'&&(r>=rule.bbvi_threshold)!==(T.bbviRawAt(s,k/20)>=rule.bbvi_threshold),`${s.label} ${key} ${n[key]} at w ${k/20}`);
      guarded++;
    }
    assert.equal(Number(n.BBVI)>=rule.bbvi_threshold,HIGH_BBVI.has(t),`${s.label}: BBVI ${n.BBVI} and its type at w ${k/20}`);
    assert.equal(Number(n.MCUI)>=rule.mcui_threshold,HIGH_MCUI.has(t),`${s.label}: MCUI ${n.MCUI} and its type`);
    // the type itself is judged on the BBVI before rounding
    assert.equal(HIGH_BBVI.has(t),T.bbviRawAt(s,k/20)>=rule.bbvi_threshold,`${s.label}: type before rounding`);
  }
}
T.w=.5;
// at the official weight every BBVI and MBPI of the 30 is a whole number (no guard needed), 미역 like the rest
for(const s of S){const n=shown(s);assert.match(n.BBVI+' '+n.MBPI,/^\d+ \d+$/,s.label);}
const by=l=>S.find(s=>s.label===l);
assert.deepEqual(shown(by('미역')),{MFPI:'46.7',MBPI:'89',BBVI:'68',MCUI:'10.0'});
assert.deepEqual(shown(by('참굴')),{MFPI:'71.6',MBPI:'72',BBVI:'72',MCUI:'10.0'});
assert.deepEqual(shown(by('청각')),{MFPI:'36.7',MBPI:'1',BBVI:'19',MCUI:'10.0'});
assert.equal(T.scoreText(by('살오징어'),'MCUI',60),'60.0 (LC + 자원 감소)','the MCUI keeps its category beside the number');
// MBPI-Rx reads as MBPI does
for(const s of S){const r=T.mbpiRxOf(s);if(r?.value!=null)assert.match(T.scoreValue(s,'MBPI',r.value),/^\d+$/,`${s.label} MBPI-Rx`);}
// the slider steps where a BBVI keeps its decimal next to the line (해삼 0.75 → 49.8 and the like); none at the official weight
assert.ok(guarded>0,'some slider steps keep a decimal by the line');
// the sensitivity line and the official value beside a re-mixed one, each on its own unrounded value
T.w=.8;
for(const s of S){const o=T.officialBbvi(s);if(T.officialNote(s))assert.equal(T.officialNote(s),`공식 ${T.scoreValue(s,'BBVI',o,T.bbviRawAt(s,.5))}`,s.label);}
T.w=.5;
assert.match(T.weightSensitivityLine(by('미역')),/0\.2 81 활용 지표 높음 · 0\.5\(기본\) 68 활용 지표 높음 · 0\.8 55 활용 지표 높음/);

// (3) both pages load it, with its hash, before the code that uses it
const v=crypto.createHash('sha256').update(fmt.replace(/\r\n/g,'\n')).digest('hex').slice(0,10);
const html=read('index.html'), exp=read('expedition.html');
for(const [name,page,user] of [['index.html',html,'app.js'],['expedition.html',exp,'expedition.js']]){
  const tags=[...page.matchAll(/<script\b[^>]*src="([\w.-]+\.js)(?:\?v=([0-9a-f]+))?"/g)].map(m=>[m[1],m[2]]);
  const at=tags.findIndex(([f])=>f==='score-format.js');
  assert.ok(at>=0&&at<tags.findIndex(([f])=>f===user),`${name}: score-format.js before ${user}`);
  assert.equal(tags[at][1],v,`${name}: score-format.js?v= is its hash`);
}
assert.match(read('_headers'),/\/score-format\.js\n {2}Cache-Control: public, max-age=31536000, immutable/);

// (4) nothing else formats an index number; the cell CSV (the only export) holds no index value
for(const re of [/\bmcuiFace\b|\bnoCross\b|\bfmt1\b|\bunreplicated\b/,/pilotScore\([^()]*\)\.toFixed\(/,/\br\.value\.toFixed\(|\bref\.toFixed\(/,/scores\.(?:MFPI|MBPI|BBVI|MCUI)\)?\.toFixed\(/,
  /extinctionMcui\([^()]*\)\.toFixed\(|ext\.toFixed\(|d\.score\.toFixed\(|mcui_base\.toFixed\(/])
  assert.doesNotMatch(app,re,`app.js: ${re}`);
const ex=read('expedition.js');
assert.doesNotMatch(ex,/fmtScore|Math\.round\(v\)|scores\.[A-Z]+\)?\.toFixed|extinction_risk\)\}/,'expedition.js: its numbers come from fmtAxis');
assert.match(ex,/const fmtAxis=\(stop,k\)=>\{[^\n]*globalThis\.scoreNumber\(k,Number\(v\),LINES\[k\]\)/);
assert.doesNotMatch(read('chatbot.js'),/\.toFixed\(/,'chatbot.js: its numbers come from scoreText and scoreValue');
const head=T.cellCsv({label:'미역',name:'Undaria pinnatifida',aphiaID:145721,cells:[]}).slice(1).split('\r\n')[0];
assert.doesNotMatch(head,/MFPI|MBPI|BBVI|MCUI/,'the cell CSV carries no index value, so it keeps its values as they are');
console.log(`PASS: one number rule (BBVI·MBPI whole, MFPI·MCUI one decimal) for 30 species × 21 weights, ${guarded} line guards off the official weight, types judged before rounding; both pages load score-format.js first; no other formatting left`);

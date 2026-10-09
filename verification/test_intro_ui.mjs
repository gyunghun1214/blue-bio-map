// Loading and entry screen of the main map (dist/intro.js), run on its pure part (no browser), plus static checks of
// the markup in index.html and the progress events in app.js. The browser flow is in uicheck.mjs (G-1…G-5).
// Run: node verification/test_intro_ui.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const intro=read('intro.js'),html=read('index.html'),app=read('app.js');
const ctx={URLSearchParams};vm.createContext(ctx);
vm.runInContext(intro.split('// ---- browser ----')[0]+';Object.assign(globalThis,{GATE_KEY,GATE_MIN_MS,GATE_MAX_MS,GATE_STEPS,hasAppHash,shouldShowGate,makeGate,gateProgress,gateFraction,gateStep,gateTick,gateNote,countsLine,keyAction,perspective,geographyRings});',ctx);
const storage=v=>({getItem:k=>k===ctx.GATE_KEY?v:null});

// (1) skip rules: a shared link (any key app.js reads from the hash) and a tab that already entered open the map directly
for(const h of ['#s=241776','#s=241776&v=explore','#v=compare','#t=value','#b=depth','#m=7/35/128','#p=2000','#u=virus','s=145721&v=explore&m=8/34.5/126.5'])
  assert.equal(ctx.shouldShowGate(h,storage(null)),false,h);
for(const h of ['','#','#top','#x=1','#s=']) assert.equal(ctx.shouldShowGate(h,storage(null)),true,JSON.stringify(h));
assert.equal(ctx.shouldShowGate('',storage('1')),false,'already entered in this tab');
assert.equal(ctx.shouldShowGate('',{getItem(){throw Error('blocked');}}),true,'storage blocked: still shown (only not remembered)');
assert.equal(ctx.shouldShowGate('',null),true);

// (2) loader steps follow the app's real steps; no fake percent
let g=ctx.makeGate(0);
assert.equal(ctx.gateFraction(g),0);
assert.equal(ctx.gateStep(g),'페이지 준비 중');
ctx.gateProgress(g,'page');assert.equal(ctx.gateStep(g),'지도를 불러오는 중');
ctx.gateProgress(g,'map');assert.equal(ctx.gateStep(g),'해양생물 자료를 불러오는 중');
for(const [,label] of ctx.GATE_STEPS)assert.doesNotMatch(label,/\d/,'no step counter beside 종 자료 (it read as a species count)');
assert.equal(Math.round(ctx.gateFraction(g)*3),2);
ctx.gateProgress(g,'bogus');assert.equal(Math.round(ctx.gateFraction(g)*3),2,'unknown steps are ignored');

// (3) the entry button opens only when the data is in (after the minimum) or after the maximum wait
assert.equal(ctx.gateTick(g,ctx.GATE_MAX_MS-1),'loading','no data yet: still loading just before the maximum');
assert.equal(ctx.gateNote(g),'');
assert.equal(ctx.gateTick(g,ctx.GATE_MAX_MS),'ready','maximum wait: open anyway');
assert.match(ctx.gateNote(g),/계속 불러오는 중입니다. 먼저 들어가도 됩니다/);
g=ctx.makeGate(1000);
ctx.gateProgress(g,'done',{state:'live',published:8,candidates:22});
assert.equal(ctx.gateFraction(g),1,"'done' completes every step");
assert.equal(ctx.gateTick(g,1000+ctx.GATE_MIN_MS-1),'loading','fast data still keeps the loader for the minimum (no flash)');
assert.equal(ctx.gateTick(g,1000+ctx.GATE_MIN_MS),'ready');
assert.equal(ctx.gateTick(g,0),'ready','ready stays ready');
assert.equal(ctx.gateNote(g),'');
assert.equal(ctx.gateStep(g),'해양생물 30종 자료를 불러왔어요','species total = published + candidates from the loaded data');
assert.equal(ctx.countsLine(g.done),'지금 해양생물 30종을 볼 수 있습니다(운영 발행 8종 · 조사 후보 22종).');
const failed=ctx.makeGate(0);ctx.gateProgress(failed,'done',{state:'error'});
assert.equal(ctx.gateStep(failed),'준비됐어요','no total typed in when the app has none');
assert.equal(ctx.countsLine({state:'error'}),'','no counts typed in when the app has none');
assert.equal(ctx.countsLine(null),'');

// (4) every load outcome can enter; the note says the same thing as the app's connection state
const note=d=>{const x=ctx.makeGate(0);ctx.gateProgress(x,'done',d);ctx.gateTick(x,ctx.GATE_MIN_MS);return [x.phase,ctx.gateNote(x)];};
assert.deepEqual(note({state:'snapshot',snapshotAt:'2026-09-24'}),['ready','운영 DB에 연결하지 못해 2026-09-24 기준 공개 자료 사본으로 엽니다.']);
assert.deepEqual(note({state:'empty',published:0,candidates:22}),['ready','운영 발행 자료가 0종입니다. 들어가면 조사 후보만 보입니다.']);
assert.deepEqual(note({state:'error'}),['ready','자료를 불러오지 못했습니다. 들어가서 다시 불러오기를 눌러 주세요.']);

// (5) Enter: only once ready, and not when another control (share, motion, link) has focus
assert.equal(ctx.keyAction('Enter',{ready:true,onOtherControl:false}),'enter');
assert.equal(ctx.keyAction('Enter',{ready:false,onOtherControl:false}),null,'not while loading');
assert.equal(ctx.keyAction('Enter',{ready:true,onOtherControl:true}),null,'the focused control keeps its own Enter');
assert.equal(ctx.keyAction(' ',{ready:true,onOtherControl:false}),null,'Space only through the focused button');

// (6) the sea lens projection: centre at the origin, horizon at r=1, far side hidden; coastline simplified, not invented
const P=1/Math.cos(24*Math.PI/180);
const c=ctx.perspective(127.6,35.4,127.6,35.4,P);assert.ok(Math.abs(c.x)<1e-12&&Math.abs(c.y)<1e-12);
const east=ctx.perspective(140,35.4,127.6,35.4,P),north=ctx.perspective(127.6,45,127.6,35.4,P);
assert.ok(east.x>0&&Math.abs(east.y)<.1&&north.y>0&&Math.abs(north.x)<1e-12,'east is right, north is up');
const edge=ctx.perspective(127.6,35.4+24*.999,127.6,35.4,P);assert.ok(edge&&Math.hypot(edge.x,edge.y)<=1&&Math.hypot(edge.x,edge.y)>.97,'horizon at r≈1');
assert.equal(ctx.perspective(127.6,35.4+25,127.6,35.4,P),null,'beyond the horizon is not drawn');
const geo=JSON.parse(read('countries.json'));
const rings=ctx.geographyRings(geo),raw=geo.features.flatMap(f=>(f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates]).map(p=>p[0]));
const flat=new Set(raw.flat().map(p=>p.join()));
assert.ok(rings.length>0&&rings.flat().length<raw.flat().length/2,'coastline thinned for the screen');
assert.ok(rings.flat().every(p=>flat.has(p.join())),'every drawn vertex is an original Natural Earth vertex');

// (7) markup: hidden by default (no JS → map as before), intro.js before the deferred app scripts, ?v= hashes
const gate=html.match(/<div id="site-gate"[^>]*>/)?.[0]||'';
assert.match(gate,/\bhidden\b/,'gate markup is hidden unless intro.js shows it');
assert.match(gate,/role="dialog"/);assert.match(gate,/aria-modal="true"/);
assert.ok(html.indexOf('<div id="site-gate"')<html.indexOf('<header'),'gate is the first thing in <body>');
const tag=html.match(/<script[^>]*intro\.js[^>]*>/)?.[0]||'';
assert.ok(tag&&!/defer|async/.test(tag),'intro.js runs before the first paint');
assert.ok(html.indexOf(tag)<html.indexOf('app.js?v='),'intro.js listens before app.js starts');
for(const f of ['intro.js','intro.css']){
  const expected=crypto.createHash('sha256').update(read(f).replace(/\r\n/g,'\n')).digest('hex').slice(0,10);
  assert.deepEqual([...html.matchAll(new RegExp(`["/]${f.replace('.','\\.')}\\?v=([^"]+)"`,'g'))].map(m=>m[1]),[expected],`${f}?v= must be ${expected}`);
}
const css=read('intro.css');
assert.match(css,/html\.gate-on \.gate\{display:block\}/,'shown only with the class intro.js sets');
assert.match(css,/prefers-reduced-motion:reduce/);

// (8) copy: records are not presence, no reference-site name, the named sources are ones the site really cites
const gateHtml=html.slice(html.indexOf('<div id="site-gate"'),html.indexOf('<header'));
const text=gateHtml.replace(/<[^>]+>/g,' ')+intro.match(/'[^']*[가-힣][^']*'|`[^`]*[가-힣][^`]*`/g).join(' ');
for(const w of ['서식','살고 있','분포한','최초','완벽','모든 해양생물','OceanX','oceanx'])assert.ok(!text.includes(w),`no "${w}" in the entry screen`);
const readme=fs.readFileSync(new URL('../README.md',import.meta.url),'utf8');
const sources=[...gateHtml.matchAll(/<li>([^<]+)<\/li>/g)].map(m=>m[1]);
assert.ok(sources.length>=4);
for(const s of sources){const key=s.replace(' 적색목록','');assert.ok(readme.includes(key)&&app.includes(key),`source "${s}" is cited in README and app.js`);}

// (9) app.js reports its steps: the coastline once (with or without the file), and 'done' on every loadCollection outcome
assert.equal((app.match(/loadProgress\('map'/g)||[]).length,2,"'map' on success and on a missing coastline");
assert.match(app,/loadDone\('empty'\);return;/,'0 species published at all');
assert.match(app,/loadDone\(data\.snapshotAt\?'snapshot':data\.publishedCount\?'live':'empty'\)/,'live, snapshot, 0 published');
assert.match(app,/loadDone\('error'\);\}/,'load failure');

console.log('PASS: entry screen skip rules, real loading steps, min/max wait, every outcome can enter, Enter key, projection, markup, copy, app.js events');

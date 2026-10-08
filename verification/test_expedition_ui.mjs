import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

// State transitions of the expedition page, run on the pure part of dist/expedition.js (no browser).
const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const code=read('expedition.js').split('// ---- browser ----')[0];
const ctx={};vm.createContext(ctx);
vm.runInContext(code+';Object.assign(globalThis,{sampleRoute,routeAt,makeState,go,next,prev,step,advanceReveal,openDetail,closeDetail,placeAt,hashFor,stopFromHash,headlineAxes,fmtScore,project,routePoints});',ctx);
const data=JSON.parse(read('expedition-stops.json'));
const route=ctx.sampleRoute(data.stops);
const run=(s,seconds,opts)=>{let arrived=0;for(let i=0;i<seconds*60;i++)arrived+=ctx.step(s,1/60,opts);return arrived;};

// route: stops in sailing order, each stop exactly on its cell centre
assert.ok(route.stopT.every((t,i)=>i===0||t>route.stopT[i-1]),'stop positions increase along the route');
data.stops.forEach((st,i)=>{const p=ctx.routeAt(route,route.stopT[i]),c=ctx.project(...st.cell.center);assert.ok(Math.hypot(p.x-c.x,p.z-c.z)<1e-6,`stop ${i+1} sits on its cell centre`);});

// the presentation route stays at sea (same outer rings and ray test as the build script)
const geo=JSON.parse(read('countries.json'));
const rings=geo.features.flatMap(f=>(f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates]).map(p=>p[0]));
const inside=(lon,lat,r)=>{let hit=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [x1,y1]=r[j],[x2,y2]=r[i];if((y1>lat)!==(y2>lat)&&lon<x1+(lat-y1)*(x2-x1)/(y2-y1))hit=!hit;}return hit;};
const onLand=route.samples.filter(q=>rings.some(r=>inside(q.lon,q.lat,r)));
assert.equal(onLand.length,0,'the presentation route never crosses the coastline in countries.json: '+JSON.stringify(onLand.slice(0,3)));

// start → stop 1: sails, arrives once, discovery step 1
let s=ctx.makeState(data.stops.length,route.stopT);
assert.equal(s.phase,'intro');
ctx.go(s,0);assert.equal(s.phase,'sailing');
assert.equal(run(s,30),1,'arrives exactly once');
assert.equal(s.arrived,0);assert.equal(s.t,route.stopT[0]);assert.equal(s.reveal[0],1);

// discovery steps stop at 3; the detail sets 4
assert.ok(ctx.advanceReveal(s));assert.ok(ctx.advanceReveal(s));assert.equal(s.reveal[0],3);
assert.equal(ctx.advanceReveal(s),false,'no step past 3 without the detail');
assert.ok(ctx.openDetail(s));assert.equal(s.reveal[0],4);

// detail open: nothing moves on its own
const t0=s.t;run(s,20);assert.equal(s.t,t0,'no automatic sailing while reading');assert.equal(s.detailOpen,true);

// fast double move: target ends at stop 3, the ship arrives there only; stop 2 was passed, not discovered
ctx.go(s,1);assert.equal(s.detailOpen,false,'moving closes the detail');run(s,.3);ctx.go(s,2);
assert.equal(run(s,60),1);assert.equal(s.arrived,2);assert.equal(s.t,route.stopT[2]);assert.equal(s.reveal[1],0);
assert.equal(ctx.hashFor(s),'#stop=3');

// back to stop 1: discovery state kept (4 = detail read), not replayed
ctx.prev(s);ctx.prev(s);assert.equal(s.stop,0);run(s,60);
assert.equal(s.arrived,0);assert.equal(s.reveal[0],4);
// clamped at both ends, a repeated go to the current stop keeps the arrival
ctx.prev(s);assert.equal(s.phase,'arrived');assert.equal(s.stop,0);
ctx.go(s,99);assert.equal(s.stop,data.stops.length-1);
// reduced motion jumps in one frame
s=ctx.makeState(data.stops.length,route.stopT);ctx.go(s,2);assert.equal(ctx.step(s,1/60,{instant:true}),true);assert.equal(s.arrived,2);
// deep link placement never lowers a reached step
s.reveal[1]=4;ctx.placeAt(s,1);assert.equal(s.reveal[1],4);assert.equal(s.phase,'arrived');

// URL hash: 1-based, invalid values ignored
assert.equal(ctx.stopFromHash('#stop=2',3),1);assert.equal(ctx.stopFromHash('#stop=2&view=cards',3),1);assert.equal(ctx.stopFromHash('#view=cards&stop=3',3),2);
for(const h of ['','#stop=0','#stop=4','#stop=x','#nostop=1','#stop=1.5'])assert.equal(ctx.stopFromHash(h,3),-1,h);

// headline axes: the two largest of MFPI/MBPI/MCUI, a missing value never ranks as 0
assert.deepEqual([...ctx.headlineAxes({scores:{MFPI:71.6,MBPI:96.3,MCUI:10,BBVI:83.9}})],['MBPI','MFPI']);
assert.deepEqual([...ctx.headlineAxes({scores:{MFPI:null,MBPI:8.7,MCUI:80,BBVI:null}})],['MCUI','MBPI']);
assert.equal(ctx.fmtScore(null),null);assert.equal(ctx.fmtScore(80),'80.0');

// map link: the keys index.html's applyHash reads (s, v, m) with the format writeHash writes
const app=read('app.js');
assert.match(app,/function applyHash\(h\)\{[\s\S]*?h\.s[\s\S]*?h\.m[\s\S]*?h\.v/);
for(const st of data.stops){
  const p=new URLSearchParams(st.map_link.split('#')[1]);
  assert.equal(Number(p.get('s')),st.aphia_id);assert.equal(p.get('v'),'explore');
  assert.match(p.get('m'),/^\d+\/-?\d+\.\d\d\/-?\d+\.\d\d$/);
}

// page text: disclaimer present, no wording that turns records into presence, ?v= busts the immutable cache
const html=read('expedition.html'),js=read('expedition.js');
assert.ok(html.includes('연출용 항로 · 실제 조사 항로나 선박 위치가 아님'));
assert.doesNotMatch(html+js,/살고 있|서식한다|서식 중/);
for(const f of ['expedition.js','expedition.css']){
  const expected=crypto.createHash('sha256').update(read(f).replace(/\r\n/g,'\n')).digest('hex').slice(0,10);
  assert.deepEqual([...html.matchAll(new RegExp(`${f.replace('.','\\.')}\\?v=([^"]+)"`,'g'))].map(m=>m[1]),[expected],`${f}?v= must be ${expected}`);
}
assert.match(read('index.html'),/<a class="expedition-link" href="expedition\.html">바다 탐험<\/a>/);
console.log('PASS: expedition state (fast moves, revisit, no auto-sail while reading), route at sea, hash and map-link formats');

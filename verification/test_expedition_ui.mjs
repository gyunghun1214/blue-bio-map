import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

// State transitions of the expedition page, run on the pure part of dist/expedition.js (no browser).
const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const code=read('expedition.js').split('// ---- browser ----')[0];
const ctx={};vm.createContext(ctx);
vm.runInContext(code+';Object.assign(globalThis,{SAIL,sailFromQuery,tripSeconds,tripAt,tripSpeed,skip,sampleRoute,routeAt,makeState,go,next,prev,step,advanceReveal,openDetail,closeDetail,placeAt,hashFor,stopFromHash,headlineAxes,fmtScore,project,routePoints});',ctx);
const data=JSON.parse(read('expedition-stops.json'));
const route=ctx.sampleRoute(data.stops);
const run=(s,seconds,opts)=>{let arrived=0;for(let i=0;i<seconds*60;i++)arrived+=ctx.step(s,1/60,opts);return arrived;};
// no trip is longer than this, so every wait below is derived from SAIL instead of a fixed number of seconds
const LONGEST=ctx.SAIL.avgLegSeconds*ctx.SAIL.longest;
// frames until arrival, with the per-frame moves
const sail=s=>{const moves=[];let f=0,t=s.t;while(!ctx.step(s,1/60)){moves.push(s.t-t);t=s.t;if(++f>LONGEST*60+5)throw Error('never arrived');}moves.push(s.t-t);return {seconds:(f+1)/60,moves};};

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
ctx.go(s,99);assert.equal(s.stop,data.stops.length-1);
// reduced motion jumps in one frame
s=ctx.makeState(data.stops.length,route.stopT);ctx.go(s,2);assert.equal(ctx.step(s,1/60,{instant:true}),true);assert.equal(s.arrived,2);
// deep link placement never lowers a reached step
s.reveal[1]=4;ctx.placeAt(s,1);assert.equal(s.reveal[1],4);assert.equal(s.phase,'arrived');

// sailing speed: one knob (SAIL.avgLegSeconds), trip time follows the distance within shortest..longest × that value
{
  const a=ctx.SAIL.avgLegSeconds, lo=a*ctx.SAIL.shortest, hi=a*ctx.SAIL.longest, n=data.stops.length;
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
  const n=data.stops.length;s=ctx.makeState(n,route.stopT);ctx.go(s,0);run(s,LONGEST+1);
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
{const n=data.stops.length,a=ctx.makeState(n,route.stopT,ctx.sailFromQuery('?sail=12'));ctx.go(a,0);const sec=sail(a).seconds;assert.ok(Math.abs(sec-ctx.tripSeconds(route.stopT[0],n,ctx.sailFromQuery('?sail=12')))<2/60);}

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
console.log('PASS: expedition state (timed eased sailing, retarget keeps speed, skip, fast moves, revisit, no auto-sail while reading), ?sail=, route at sea, hash and map-link formats');

// Loading and entry screen of the main map (dist/intro.js), run on its pure part (no browser), plus static checks of
// the markup in index.html, the progress events in app.js and the globe files in dist/vendor/globe-v1. The browser flow
// is in uicheck.mjs (G-1…G-11: G-7 the logo going home, G-8 no example cards, G-9 a 375px phone, G-11 a reload),
// verification/2026-10-landing-globe/landing_check.mjs and verification/2026-10-18-reload-shows-intro/check.mjs.
// Run: node verification/test_intro_ui.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const intro=read('intro.js'),html=read('index.html'),app=read('app.js');
const ctx={URLSearchParams};vm.createContext(ctx);
vm.runInContext(intro.split('// ---- browser ----')[0]+';Object.assign(globalThis,{GATE_KEY,HOME_KEY,APP_RELOAD_KEY,navigationType,visitorNav,withoutTab,homeClick,INTRO_TIMELINE,GATE_STEPS,GLOBE_WAIT,GLOBE_FAIL,hasAppHash,shouldShowGate,makeGate,gateProgress,gateStep,RIPPLE_CENTER,rippleCenter,rippleReach,WAVE,ripplesAt,dropAt,revealAt,crossfadeAt,introEnd,introDone,introStatus,gateNote,countsLine,EVIDENCE_USES,evidenceSourceCount,exampleLinks,keyAction,arrival,motionPref,perspective,inversePerspective,project,simplifyRing,geographyRings,decodeRings,cutEdge,cellOf,globeFrame,cardPlace,globeFile,GLOBE_PAD,borderVertices,nearKorea,NEAR,CAMERA,FRAME,KOREA,ANCHOR,STUDY,COUNTRIES_CUT,leadLine,TEXTURES,textureSet,SHADE,MOTION,ambientAt,cameraAt,clampDrag,dragDegrees,GLOBE_LONLAT,globeShader,SOFTWARE_GL});',ctx);
const storage=v=>({getItem:k=>k===ctx.GATE_KEY?v:null});

// (1) skip rules: a shared link (any key app.js reads from the hash) and a tab that already entered open the map directly
for(const h of ['#s=241776','#s=241776&v=explore','#v=compare','#t=value','#b=depth','#m=7/35/128','#p=2000','#u=virus','s=145721&v=explore&m=8/34.5/126.5'])
  assert.equal(ctx.shouldShowGate(h,storage(null)),false,h);
for(const h of ['','#','#top','#x=1','#s=']) assert.equal(ctx.shouldShowGate(h,storage(null)),true,JSON.stringify(h));
assert.equal(ctx.shouldShowGate('',storage('1')),false,'already entered in this tab');
assert.equal(ctx.shouldShowGate('',{getItem(){throw Error('blocked');}}),true,'storage blocked: still shown (only not remembered)');
assert.equal(ctx.shouldShowGate('',null),true);
// the site logo goes home: its one-time signal shows the screen again in a tab that entered; a shared link still wins
const both=(entered,home)=>({getItem:k=>k===ctx.GATE_KEY?entered:k===ctx.HOME_KEY?home:null});
assert.equal(ctx.HOME_KEY,'bbvm-intro-home');
assert.equal(ctx.shouldShowGate('',both('1','1')),true,'logo clicked in a tab that entered: entry screen again');
assert.equal(ctx.shouldShowGate('',both('1',null)),false,'signal used up: the address opened again opens the map as before (a reload shows the screen: 1b)');
assert.equal(ctx.shouldShowGate('#s=241776',both('1','1')),false,'a shared link still opens the map');
const click=(o={})=>({button:0,metaKey:false,ctrlKey:false,shiftKey:false,altKey:false,defaultPrevented:false,...o});
assert.equal(ctx.homeClick(click()),true,'a plain click (or Enter on the link) goes home in this tab');
for(const o of [{button:1},{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{defaultPrevented:true}])
  assert.equal(ctx.homeClick(click(o)),false,'new tab/window or cancelled: this tab stays as it is '+JSON.stringify(o));
// (1b) 2026-10-18 (LKH): a reload (F5, pull to refresh) shows the screen from the loader whatever the address and the tab
// hold; every other way in keeps the rules above (no navType: as before)
const entered=()=>storage('1');
assert.equal(ctx.shouldShowGate('#m=5/36/128',entered(),'reload'),true,'reload after entering, map moved: entry screen');
assert.equal(ctx.shouldShowGate('#s=836033&v=compare',storage(null),'reload'),true,'reload of a shared link: entry screen');
assert.equal(ctx.shouldShowGate('#s=836033&v=compare&b=basic&t=occurrence&m=7/34.60/127.90&',entered(),'reload'),true,'reload on 비교와 지표: entry screen');
assert.equal(ctx.shouldShowGate('&v=compare',storage(null),'reload'),true,'reload of a query link: entry screen');
assert.equal(ctx.shouldShowGate('',{getItem(){throw Error('blocked');}},'reload'),true,'reload, storage blocked: entry screen');
assert.equal(ctx.shouldShowGate('#s=836033',storage(null),'navigate'),false,'a shared link opened afresh: the map');
assert.equal(ctx.shouldShowGate('',entered(),'navigate'),false,'the address opened again in a tab that entered: the map');
assert.equal(ctx.shouldShowGate('#m=5/36/128',entered(),'back_forward'),false,'Back or Forward: the map');
assert.equal(ctx.shouldShowGate('',both('1','1'),'navigate'),true,'the logo: entry screen');
for(const [h,st] of [['#s=241776',()=>storage(null)],['',entered],['',()=>storage(null)],['',()=>both('1','1')],['#s=241776',()=>both('1','1')],['',()=>null],['&offline=1',entered]])
  for(const t of [undefined,'navigate','back_forward','prerender','bogus'])
    assert.equal(ctx.shouldShowGate(h,st(),t),ctx.shouldShowGate(h,st()),`not a reload (${t}): the rules as before for ${JSON.stringify(h)}`);
// how the page was opened: Navigation Timing first, the old interface (1 = reload) where it is missing, else navigate
const perf=(entries,legacy)=>({getEntriesByType:k=>k==='navigation'?entries:[],...(legacy===undefined?{}:{navigation:{type:legacy}})});
assert.equal(ctx.navigationType(perf([{type:'reload'}])),'reload');
assert.equal(ctx.navigationType(perf([{type:'navigate'}],1)),'navigate','the new interface wins');
assert.equal(ctx.navigationType(perf([{type:'back_forward'}])),'back_forward');
assert.equal(ctx.navigationType(perf([{type:'reload'}],0)),'reload','Chromium: the same address (with its hash) opened again is a reload in the new interface, 0 in the old');
assert.equal(ctx.navigationType(perf([],1)),'reload','no entry: the old interface, type 1 = reload');
assert.equal(ctx.navigationType({navigation:{type:1}}),'reload','no getEntriesByType at all: the old interface');
for(const p of [perf([],0),perf([],2),perf([]),{},null,undefined])assert.equal(ctx.navigationType(p),'navigate','nothing that says reload: navigate '+JSON.stringify(p));
assert.equal(ctx.navigationType({getEntriesByType(){throw Error('no');}}),'navigate','an error: navigate (the rules as before)');
// the app's own reload (app.js reloadOnceForNewData, a data file newer than its code) is not the visitor's: its mark makes it
// count as the load before it, and is used once
const marks=v=>{const m=new Map(v===undefined?[]:[[ctx.APP_RELOAD_KEY,v]]);return {m,getItem:k=>m.get(k)??null,removeItem:k=>m.delete(k)};};
assert.equal(ctx.APP_RELOAD_KEY,'bbvm-app-reload');
let mk=marks('1');assert.equal(ctx.visitorNav('reload',mk),'navigate','the app\'s own reload: the rules of the load before');assert.equal(mk.m.size,0,'the mark is used once');
mk=marks();assert.equal(ctx.visitorNav('reload',mk),'reload','the visitor\'s F5');
mk=marks('1');assert.equal(ctx.visitorNav('back_forward',mk),'back_forward');assert.equal(mk.m.size,0,'a mark left behind goes on the next load too');
assert.equal(ctx.visitorNav('reload',{getItem(){throw Error('blocked');}}),'reload','storage blocked: the visitor\'s reload');
assert.equal(ctx.visitorNav('reload',null),'reload');
assert.ok(/try\{const c=document\.documentElement\.classList;if\(!c\.contains\('gate-on'\)\|\|c\.contains\('gate-leaving'\)\)sessionStorage\.setItem\('bbvm-app-reload','1'\);\}catch\{\}\s*location\.reload\(\);/.test(app),
  'app.js marks its own reload right before it, with the same key, unless the entry screen is up (then it shows again)');
// a reload's address keeps everything but the tab (v), in the query and the hash; without a tab it is left as it was
assert.equal(ctx.withoutTab('','#s=241776&v=compare&b=basic&t=occurrence&m=7%2F34.60%2F127.90'),'#s=241776&b=basic&t=occurrence&m=7%2F34.60%2F127.90');
assert.equal(ctx.withoutTab('?v=compare&s=241776',''),'?s=241776','a query link');
assert.equal(ctx.withoutTab('?offline=1&v=method','#v=compare&s=1'),'?offline=1#s=1','both, other query keys stay');
assert.equal(ctx.withoutTab('','#v=compare'),'','the tab alone: no hash left');
assert.equal(ctx.withoutTab('?offline=1','#s=241776&m=7/35.50/128.00'),'?offline=1#s=241776&m=7/35.50/128.00','no tab: as it was, not re-encoded');
for(const h of ['','#top','#x=1'])assert.equal(ctx.withoutTab('',h),h);

// (2) loader steps follow the app's real steps, in words only; no percent, no step counter, no progress drawing
let g=ctx.makeGate(0);
assert.equal(ctx.gateStep(g),'페이지를 준비하는 중');
ctx.gateProgress(g,'page');assert.equal(ctx.gateStep(g),'지도를 불러오는 중');
ctx.gateProgress(g,'map');assert.equal(ctx.gateStep(g),'해양생물 자료를 불러오는 중','map and species data load at once: the first step not in yet');
for(const [,label] of ctx.GATE_STEPS)assert.doesNotMatch(label,/\d/,'no step counter beside 종 자료 (it read as a species count)');
ctx.gateProgress(g,'bogus');assert.equal(ctx.gateStep(g),'해양생물 자료를 불러오는 중','unknown steps are ignored');
assert.ok(!/loadProgress\('species'/.test(app)&&!/step:'species'/.test(intro),"no made-up 'species' event: 'done' stands for it");

// (3) the first visit (2026-10-18): one 8 s piece from the first paint. Its times live in INTRO_TIMELINE alone; it ends
// at total once the globe is in, never sooner for the data and never total after the load
const TL=ctx.INTRO_TIMELINE,spanTL=([a,b])=>b-a;
assert.deepEqual(JSON.parse(JSON.stringify(TL)),{total:8000,drop:[1000,1800],ripple:[1800,4200],reveal:[4200,6800],settle:[6800,8000],late:1800,timeout:20000});
assert.ok(TL.drop[1]===TL.ripple[0]&&TL.ripple[1]===TL.reveal[0]&&TL.reveal[1]===TL.settle[0]&&TL.settle[1]===TL.total,'the pieces follow one another to the end');
const timesIn=src=>[...src.replace(/\/\/[^\n]*/g,'').matchAll(/\b(1800|4200|6800|20000)\b/g)].length; // (1000 and 8000 are also pixel sizes and the fps step)
assert.equal(timesIn(intro.slice(intro.indexOf('const INTRO_TIMELINE'))) ,timesIn(intro.slice(intro.indexOf('const INTRO_TIMELINE'),intro.indexOf('\n',intro.indexOf('const INTRO_TIMELINE')))),'no timeline time typed in anywhere else');
assert.ok(!/GATE_MIN_MS|GATE_MAX_MS|GATE_FADE_MS|gateTick|gateFade/.test(intro),'the old loader timing (data done + 0.6 s, 7 s maximum) is gone');
for(const ready of [0,1200,4200])for(const t of [0,4000,7999])assert.equal(ctx.introDone(t,ready),false,`globe at ${ready} ms: not usable at ${t} ms`);
for(const ready of [0,1200,4200])assert.equal(ctx.introDone(8000,ready),true,`globe at ${ready} ms: usable at 8 s`);
assert.equal(ctx.introDone(60000,null),false,'no globe: never usable by the clock alone (the wait, then the error)');
// a late globe opens from its moment, over at least late, and never before total (no short reveal then a still wait)
for(const [ready,end] of [[4300,8000],[5000,8000],[6500,8300],[9000,10800],[15000,16800]]){
  assert.equal(ctx.introDone(end-1,ready),false);assert.equal(ctx.introDone(end,ready),true,`globe at ${ready}: usable at ${end}`);}
// the line: nothing while the piece runs, the wait past total, the error past the timeout or once every picture failed
assert.equal(ctx.introStatus(7999,null,false,TL.timeout),'');assert.equal(ctx.introStatus(8000,null,false,TL.timeout),'wait');
assert.equal(ctx.introStatus(19999,null,false,TL.timeout),'wait');assert.equal(ctx.introStatus(20000,null,false,TL.timeout),'fail');
assert.equal(ctx.introStatus(3000,null,true,TL.timeout),'','failed pictures: the piece still runs to total first');
assert.equal(ctx.introStatus(8000,null,true,TL.timeout),'fail');assert.equal(ctx.introStatus(30000,null,false,45000),'wait','a retry starts the timeout over');
assert.equal(ctx.introStatus(30000,9000,true,TL.timeout),'','the globe is in: nothing to say');
assert.equal(ctx.GLOBE_WAIT,'지구 화면을 준비하는 중');assert.ok(html.includes(`<p>${ctx.GLOBE_FAIL}</p>`),'the error line in the markup is GLOBE_FAIL');
assert.match(html,/<div class="gate-fail" hidden><p>지구 화면을 불러오지 못했어요\.<\/p><p class="gate-fail-do"><button class="gate-retry" type="button">다시 시도<\/button><button class="gate-skip" type="button">지도 바로 열기<\/button><\/p><\/div>/);
// the drop's place: 52% · 61% side by side; stacked, under the loader's words
assert.deepEqual(JSON.parse(JSON.stringify(ctx.RIPPLE_CENTER)),{wide:[.52,.61],stacked:[.5,.66]});
assert.deepEqual(JSON.parse(JSON.stringify(ctx.rippleCenter(1440,900,false,300))),{x:1440*.52,y:900*.61});
assert.ok(ctx.rippleCenter(390,844,true,520).y>=520+.12*844,'stacked: under the words');
// the rings: none before the drop lands, then 6-12 fine close rings that open up as they spread, weaker as they widen,
// none at total; every quantity moves smoothly from frame to frame (no jump where one piece hands over)
for(const [w,h,st] of [[1440,900,false],[1280,720,false],[390,844,true]]){
  const c=ctx.rippleCenter(w,h,st,h*.45),D=ctx.rippleReach(c,w,h);
  assert.equal(ctx.ripplesAt(TL.ripple[0],D).length,0);assert.equal(ctx.ripplesAt(TL.total,D).length,0,'calm at total');
  const at=t=>ctx.ripplesAt(t,D);
  assert.ok(at(TL.ripple[1]).length>=6&&at(TL.ripple[1]).length<=12,`${w}×${h}: ${at(TL.ripple[1]).length} rings`);
  const gap=t=>{const r=at(t);return r[0].r-r[1].r;};
  assert.ok(gap(2300)<gap(4200)&&gap(4200)<gap(6800),'the rings open up as they spread');assert.ok(gap(2300)<=Math.max(18,w*.016),`fine at first: ${gap(2300)} px`);
  assert.ok(at(3000)[0].k>at(6000)[0].k,'weaker as they widen');
  for(let t=TL.ripple[0];t<TL.total;t+=16.7){const a=at(t),b=at(t+16.7);
    a.forEach((g,i)=>{const q=b[i];assert.ok(q?q.r>=g.r&&q.r-g.r<D*.02&&Math.abs(q.k-g.k)<.08:g.k<.01,`${w}×${h} ring ${i} at ${t.toFixed(0)} ms`);});
    for(const g of a)assert.ok(g.k>=0&&g.k<=1&&g.w>0);}
  // the opening: closed before reveal[0] and with no globe; from nothing at reveal[0], inside the rings' front, growing,
  // clear to the farthest corner by total; the loader's words gone in the first third of the reveal
  assert.equal(ctx.revealAt(5000,D,null).r,0,'no globe: the loader stays whole');
  assert.equal(ctx.revealAt(TL.reveal[0]-1,D,0).r,0);
  let prev=0;for(let t=TL.reveal[0];t<=TL.total;t+=16.7){const v=ctx.revealAt(t,D,0),rings=at(t);
    assert.ok(v.r>=prev&&v.r-prev<D*.03,`opening grows smoothly at ${t.toFixed(0)}`);prev=v.r;
    if(rings.length)assert.ok(v.r<=rings[0].r+1,'the opening never runs ahead of the rings');}
  const end=ctx.revealAt(TL.total,D,0);assert.ok(end.r-end.F>=D,'clear to the farthest corner at total');assert.ok(end.F>=D*.3,'a wide soft edge, not a hard hole');
  assert.ok(ctx.revealAt(TL.reveal[0]+spanTL(TL.reveal)*.36,D,0).words<.01,'the words gone early in the reveal');
  assert.ok(ctx.revealAt(TL.settle[0],D,0).over===0&&ctx.revealAt(TL.total,D,0).over===1,'what is drawn over the globe comes in over settle');
  // late: opens from the globe's moment, clear by its end
  const L=ctx.revealAt(9000+1800,D,9000);assert.ok(L.r-L.F>=D&&ctx.revealAt(9000,D,9000).r===0);
  // the drop: falls in drop[], lands on the centre, then only a small light that fades as the rings start
  assert.equal(ctx.dropAt(TL.drop[0]-1,c,h),null);const d1=ctx.dropAt(TL.drop[0]+400,c,h),d2=ctx.dropAt(TL.drop[1]-1,c,h);
  assert.ok(d1.y<d2.y&&Math.abs(d2.y-c.y)<1&&d1.x===c.x,'falls straight onto the centre');assert.ok(d2.r<6&&d2.splash===0,'a small drop');
  assert.ok(ctx.dropAt(TL.ripple[0]+100,c,h).splash>0&&ctx.dropAt(TL.ripple[0]+400,c,h)===null);
}
// still: a cross-fade over the same window, 1 → 0
assert.equal(ctx.crossfadeAt(4000,0),1);assert.equal(ctx.crossfadeAt(8000,0),0);assert.ok(ctx.crossfadeAt(6000,0)>0&&ctx.crossfadeAt(6000,0)<1);assert.equal(ctx.crossfadeAt(9000,null),1);
assert.equal(ctx.gateNote(g),'');
g.phase='ready';
assert.equal(ctx.gateStep(g),'해양생물 자료를 불러오는 중','the wait is up, not the loading: the step says so, never 불러왔어요');
assert.match(ctx.gateNote(g),/계속 불러오는 중입니다. 먼저 들어가도 됩니다/);
g=ctx.makeGate(1000);
ctx.gateProgress(g,'done',{state:'live',published:8,candidates:22});
assert.equal(ctx.gateNote(g),'');
assert.equal(ctx.gateStep(g),'해양생물 30종 자료를 불러왔어요','species total = published + candidates from the loaded data');
// the design's line: one species count (2026-10-17, LKH: no published/candidate split on screen; was 30종의 해양생물(운영 발행 8 · 조사 후보 22) …)
assert.equal(ctx.countsLine(g.done),'30종의 해양생물 · 공개 데이터 기반');
assert.equal(ctx.countsLine({state:'empty',published:0,candidates:22}),'22종의 해양생물 · 공개 데이터 기반','0 published: the total only');
assert.ok(!/운영 발행|조사 후보/.test(ctx.countsLine(g.done)),'no published/candidate split');
const failed=ctx.makeGate(0);ctx.gateProgress(failed,'done',{state:'error'});
assert.equal(ctx.gateStep(failed),'첫 화면을 여는 중','a failed load is not called done (and no total typed in)');
const failed2=ctx.makeGate(0);ctx.gateProgress(failed2,'done',{state:'error',published:8,candidates:22});
assert.equal(ctx.gateStep(failed2),'첫 화면을 여는 중','an error with counts still is not 불러왔어요');
for(const st of ['snapshot','offline','empty']){const x=ctx.makeGate(0);ctx.gateProgress(x,'done',{state:st,published:0,candidates:22});
  assert.equal(ctx.gateStep(x),'해양생물 22종 자료를 불러왔어요',`${st}: the copy that did load`);}
assert.equal(ctx.countsLine({state:'error'}),'','no counts typed in when the app has none');
assert.equal(ctx.countsLine(null),'');

// (4) every load outcome can enter; the note says the same thing as the app's connection state
const note=d=>{const x=ctx.makeGate(0);ctx.gateProgress(x,'done',d);x.phase='ready';return [x.phase,ctx.gateNote(x)];};
assert.deepEqual(note({state:'snapshot',snapshotAt:'2026-09-24'}),['ready','운영 DB에 연결하지 못해 2026-09-24 기준 공개 자료 사본으로 엽니다.']);
// Offline demo (?offline=1): the saved copy is the plan, so the note says so instead of 연결하지 못해.
assert.deepEqual(note({state:'offline',snapshotAt:'2026-10-01'}),['ready','오프라인 시연 · 2026-10-01 기준 공개 자료 사본으로 엽니다.']);
assert.deepEqual(note({state:'empty',published:0,candidates:22}),['ready','공개 데이터 기준으로 엽니다.']);
assert.deepEqual(note({state:'error'}),['ready','자료를 불러오지 못했어요. 들어가서 ↻ 다시 시도를 눌러 주세요.']);

// (5) Enter: only once ready, and not when another control (share, motion, link) has focus
assert.equal(ctx.keyAction('Enter',{ready:true,onOtherControl:false}),'enter');
assert.equal(ctx.keyAction('Enter',{ready:false,onOtherControl:false}),null,'not while loading');
assert.equal(ctx.keyAction('Enter',{ready:true,onOtherControl:true}),null,'the focused control keeps its own Enter');
assert.equal(ctx.keyAction(' ',{ready:true,onOtherControl:false}),null,'Space only through the focused button');
// the ways in: each one opens its tab; a phone gets <main> instead of a search box; the source list is scrolled to and
// keeps focus everywhere; anything else falls back to the map
const way=(t,touch)=>JSON.stringify(ctx.arrival(t,touch));
assert.equal(way('explore',false),JSON.stringify({view:'explore',focus:'#search',scroll:null}));
assert.equal(way('explore',true),JSON.stringify({view:'explore',focus:'main',scroll:null}));
assert.equal(way('compare',false),JSON.stringify({view:'compare',focus:'#cmp-search',scroll:null}));
assert.equal(way('compare',true),JSON.stringify({view:'compare',focus:'main',scroll:null}));
for(const touch of [false,true])assert.equal(way('method',touch),JSON.stringify({view:'method',focus:'#all-sources',scroll:'.source-section'}));
for(const t of [undefined,'','toString','expedition'])assert.equal(ctx.arrival(t,false).view,'explore',String(t));
for(const sel of ['id="search"','id="cmp-search"','id="all-sources"','class="source-section"'])assert.ok(html.includes(sel),`${sel} is in index.html`);
assert.match(app,/^function setView\(view,toTop=true\)/m,'setView is a global function the entry screen can call');
// the motion switch: the system setting until flipped here, then the remembered choice ('1' still, '0' moving)
assert.equal(ctx.motionPref(null,true),true);assert.equal(ctx.motionPref(null,false),false);assert.equal(ctx.motionPref(undefined,true),true);
assert.equal(ctx.motionPref('1',false),true,'kept still although the system allows motion');
assert.equal(ctx.motionPref('0',true),false,'moving although the system asks for less (the person chose it here)');
assert.equal(ctx.motionPref('junk',true),true,'anything else falls back to the system');

// (6) the globe projection (a vertical perspective fitted to the design since 2026-10-13 v2; before it, orthographic):
// centre at the origin, east right, north up, horizon at r=1 (acos(1/P) from the centre), far side hidden (or pushed
// onto the rim for filling), the inverse its exact undo; coastline simplified, not invented
const {lon0:L0,lat0:F0,P}=ctx.CAMERA,ortho=(lon,lat,rim)=>ctx.project(lon,lat,rim),r1=p=>Math.hypot(p.x,p.y);
const cam=JSON.parse(read('vendor/globe-v2/camera.json'));
assert.deepEqual([cam.lon0,cam.lat0,cam.P],[L0,F0,P],'intro.js CAMERA = vendor/globe-v2/camera.json (the picture was baked with it)');
assert.deepEqual(cam.frame,JSON.parse(JSON.stringify(ctx.FRAME)),'intro.js FRAME = camera.json frame');
const c=ortho(L0,F0);assert.ok(Math.abs(c.x)<1e-12&&Math.abs(c.y)<1e-12);
const east=ctx.perspective(150,0,140,0,P),north=ctx.perspective(140,10,140,0,P);
assert.ok(east.x>0&&Math.abs(east.y)<1e-12&&north.y>0&&Math.abs(north.x)<1e-12,'east is right, north is up');
const hz=Math.acos(1/P)*180/Math.PI;
const edge=ctx.perspective(140+hz-.01,0,140,0,P);assert.ok(edge&&r1(edge)<=1&&r1(edge)>.999,'horizon at r≈1');
assert.equal(ctx.perspective(140+hz+.5,0,140,0,P),null,'beyond the horizon is not drawn');
assert.equal(ortho(L0+180,-F0),null,'the far side is not drawn');
const rim=ctx.perspective(140+100,20,140,0,P,true);assert.ok(rim.back&&Math.abs(r1(rim)-1)<1e-12,'with toRim a hidden point sits on the rim');
assert.ok(!ctx.perspective(150,20,140,0,P,true).back,'a visible point is not moved');
let worst=0;
for(let lon=L0-hz+1;lon<L0+hz;lon+=3.7)for(let lat=-60;lat<=88;lat+=3.1){const q=ortho(lon,lat);if(!q)continue;
  const g=ctx.inversePerspective(q.x,q.y,L0,F0,P);worst=Math.max(worst,Math.abs(g.lon-lon),Math.abs(g.lat-lat));}
assert.ok(worst<1e-9,`perspective → inverse round trip within 1e-9° (worst ${worst})`);
assert.equal(JSON.stringify(ctx.inversePerspective(0,0,L0,F0,P)),JSON.stringify({lon:L0,lat:F0}),'the centre maps back to the camera');
assert.equal(ctx.inversePerspective(.8,.7,L0,F0,P),null,'off the disc is nowhere');
// orientation of the real view: China west of Korea, Japan east of it, the Russian far east north of it (no mirror)
const kr=ortho(...ctx.KOREA),beijing=ortho(116.4,39.9),tokyo=ortho(139.7,35.7),vlad=ortho(131.9,43.1),manila=ortho(121,14.6);
assert.ok(beijing.x<kr.x&&tokyo.x>kr.x&&vlad.y>kr.y&&manila.y<kr.y,'east is right and north is up on the globe');
const geo=JSON.parse(read('countries.json'));
const rings=ctx.geographyRings(geo),raw=geo.features.flatMap(f=>(f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates]).map(p=>p[0]));
const flat=new Set(raw.flat().map(p=>p.join()));
assert.ok(rings.length>0&&rings.flat().length<raw.flat().length/2,'coastline thinned for the screen');
assert.ok(rings.flat().every(p=>flat.has(p.join())),'every drawn vertex is an original Natural Earth vertex');
// countries.json is clipped to a box: those sides are filled but never stroked. Thinning keeps the vertices on the box,
// so no long edge along a side (105°E, 150°E, 20°N, 53°N) is drawn as a coast (it showed as a stray line across Mongolia)
const cut=ctx.COUNTRIES_CUT,cutRings=ctx.geographyRings(geo,.08,cut);
assert.ok(cutRings.flat().every(p=>flat.has(p.join())),'still only original vertices');
const hug=(a,b)=>cut.lon.some(v=>Math.abs(a[0]-v)<.1&&Math.abs(b[0]-v)<.1&&Math.abs(a[1]-b[1])>.3)||cut.lat.some(v=>Math.abs(a[1]-v)<.1&&Math.abs(b[1]-v)<.1&&Math.abs(a[0]-b[0])>.3);
const edges=cutRings.flatMap(r=>r.slice(1).map((p,i)=>[r[i],p]));
assert.ok(edges.some(([a,b])=>ctx.cutEdge(a,b,cut)),'the box sides are there');
assert.deepEqual(edges.filter(([a,b])=>hug(a,b)&&!ctx.cutEdge(a,b,cut)).map(e=>e.join(' ')),[],'every long edge along a box side is a cut edge');
assert.ok(!ctx.cutEdge([105,30],[105.2,31],cut)&&!ctx.cutEdge([126,33],[127,33],cut),'a coast is never a cut edge');
// the 50m coast gives way to countries.json only in the 1° cells its outline passes through: Korea's south and east
// coasts are there; northern Viet Nam's coast and the Laos–Viet Nam border (inside its box, not in the file) are not
const krCells=new Set(cutRings.flat().map(ctx.cellOf));
for(const p of [[126.4,34.6],[129.4,35.6],[129.4,36.5],[126.5,33.3],[139.7,35.6]])assert.ok(krCells.has(ctx.cellOf(p)),`countries.json draws the coast at ${p}`);
for(const p of [[106.7,20.8],[106.1,20.3],[105.4,20.2],[100,21]])assert.ok(!krCells.has(ctx.cellOf(p)),`the 50m line stays at ${p}`);
assert.notEqual(ctx.cellOf([128.5,34.5]),ctx.cellOf([128.5,35.5]));assert.notEqual(ctx.cellOf([128.5,-0.5]),ctx.cellOf([128.5,0.5]));

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
assert.match(css,/html\.gate-on \.gate,html\.gate-on \.gate\[hidden\]\{display:block!important\}/,'shown only with the class intro.js sets, from the first paint (outranks style.css [hidden]{display:none!important})');
// 2026-10-15 load speed: the copy is not hidden until the data is in (it was the page's largest text, seconds late)
assert.ok(!/<div class="gate-hero"[^>]*hidden/.test(html),'entry copy is in the first paint');
assert.match(intro,/matchMedia\('\(prefers-reduced-motion: reduce\)'\)/,'the system setting starts the motion switch');
// the ways in are real buttons; the motion control is a switch; the globe picture is hidden from assistive tech
const gateMarkup=html.slice(html.indexOf('<div id="site-gate"'),html.indexOf('<header'));
assert.deepEqual([...gateMarkup.matchAll(/<button[^>]*data-go="(\w+)"/g)].map(m=>m[1]).sort(),['compare','compare','explore','explore','method']);
assert.match(gateMarkup,/<button class="gate-motion" type="button" role="switch" aria-checked="false">/);
assert.match(gateMarkup,/<canvas class="gate-sea" aria-hidden="true">/);
assert.match(gateMarkup,/<button class="gate-enter" id="gate-enter" type="button">바다 탐색하기/);
assert.match(css,/\.gate\.is-still \.gate-sea/,'the switch stops the globe fading and zooming');

// (7b) the loader (2026-10-17, the 8 s piece 2026-10-18): the whole screen, logo + line + step in the markup (first
// paint), the drop and its rings drawn by the one frame loop, no spinner or progress drawing
const loader=gateMarkup.slice(gateMarkup.indexOf('<div class="gate-loader"'),gateMarkup.indexOf('<div class="gate-hero"'));
assert.match(loader,/^<div class="gate-loader" role="status" tabindex="-1"><div class="gate-loader-body">/,'the step line is a status');
assert.ok(gateMarkup.includes('</div></div><canvas class="gate-ripple" aria-hidden="true"></canvas><div class="gate-hero">'),'the rings are decoration, over the loader but outside it (its opening does not hide them)');
const logoPath=gateMarkup.match(/<p class="gate-brand"><svg[^>]*>([\s\S]*?)<\/svg>/)[1];
assert.ok(loader.includes(logoPath),'the loader shows the site logo itself (the bar\'s mark)');
assert.match(loader,/<span>Blue-bio <strong>Value<\/strong> Map<\/span>/);
assert.match(loader,/<p class="gate-motto"><span>바다의 가능성,<\/span> <span>근거에서부터\.<\/span><\/p>/);
assert.ok(loader.includes(`<p class="gate-step">${ctx.GATE_STEPS[0][1]}</p>`),'the first step is in the first paint');
for(const old of ['gate-orbit','gate-ring','gate-arc','gate-spin','gate-spark','gateFraction','rippleArc','rippleLives','rippleReveal','--gf'])
  assert.ok(![html,css,intro].some(t=>t.includes(old)),`the old loaders are gone: ${old}`);
assert.ok(!/@keyframes/.test(css),'no CSS loop animation on the entry screen (the piece runs in the frame loop)');
assert.ok(!/%|\/\s*3\b/.test(ctx.gateStep(ctx.makeGate(0))),'no percent or step count');
const ib=intro.split('// ---- browser ----')[1];
assert.deepEqual([...ib.matchAll(/requestAnimationFrame\((\w+)\)/g)].map(m=>m[1]).filter(f=>f!=='frameLoop'),[],'one frame loop (frameLoop) for the piece and the globe');
assert.match(ib,/if\(!opened\)tick\(now\);/,'the piece runs in the frame loop');
assert.match(ib,/if\(introDone\(t,readyAt\)\)return showHero\(\);/,'usable at the end of the piece once the globe is in (introDone), nothing else');
assert.ok(!/addEventListener\('bbvm:progress'[\s\S]{0,900}(reveal|showHero)\(/.test(ib.slice(ib.indexOf("addEventListener('bbvm:progress'"),ib.indexOf("addEventListener('bbvm:progress'")+900)),'the data never reveals or opens the screen');
assert.match(ib,/for\(const at of \[INTRO_TIMELINE\.total,INTRO_TIMELINE\.timeout\]\)setTimeout\(\(\)=>\{if\(!opened&&!left\)tick\(performance\.now\(\)\);\},at\+40\);/,'the end and the timeout come without frames too (hidden tab)');
assert.match(ib,/new PerformanceObserver\(l=>\{const p=l\.getEntries\(\)\.map\(e=>e\.startTime\);if\(p\.length\)startAt\(Math\.min\(\.\.\.p\),true\);\}\)\.observe\(\{type:'paint',buffered:true\}\)/,'t0 is the first paint the browser records (the first frame only stands in)');
assert.match(ib,/performance\.mark\('intro:start',\{startTime:t0\}\)/);assert.match(ib,/performance\.mark\?\.\('intro:done'\)/);
assert.match(ib,/const parsed=\(\)=>document\.readyState!=='loading'\|\|!!document\.getElementById\('site-gate'\)\?\.nextElementSibling;/,'set up as soon as the screen\'s markup is in, not at DOMContentLoaded');
assert.match(ib,/rip\.hidden=true;rip\.width=rip\.height=0/,'the ripple canvas is let go once the entry screen opens');
assert.match(ib,/el\.setAttribute\('aria-busy','true'\)/);assert.match(ib,/el\.removeAttribute\('aria-busy'\)/);
assert.ok(!/\.inert=true/.test(ib.replace(/node\.inert=true/,'')),'the entry screen is never inert while the piece runs (only the page behind the screen is)');
assert.match(ib,/el\.addEventListener\('focusin',e=>\{if\(!opened&&e\.target\.closest\?\.\('\.gate-hero'\)&&!e\.target\.closest\('\.gate-motion'\)\)skipIntro\(\);\}\);/,'the keyboard reaching the entry screen ends the piece');
assert.match(css,/\.gate-loader\{position:absolute;inset:0;z-index:1;overflow:hidden\}/,'the loader takes the pointer while the piece runs');
assert.match(css,/\.gate-ripple\{position:absolute;inset:0;z-index:1;width:100%;height:100%;pointer-events:none\}/);
assert.match(css,/\.gate-motion\{position:relative;z-index:2\}/,'the one motion switch stays over the loader (no second switch)');
assert.equal((gateMarkup.match(/class="gate-motion"/g)||[]).length,1);
assert.ok(!/opacity:0;transform:scale\(\.96\)/.test(css),'the globe does not fade in a second time after the reveal');
// the refraction: the shader pushes along each ring's radius (u_ring: radius, push, half width; WAVE.rings of them); the
// still picture is drawn again in thin rings by the same push
assert.match(ctx.globeShader(),/uniform vec3 u_ring\[12\];/);assert.equal(ctx.WAVE.rings,12);
assert.match(ctx.globeShader(),/for\(int i=0;i<12;i\+\+\)\{vec3 g=u_ring\[i\];float x=\(rr-g\.x\)\/g\.z;push\+=g\.y\*x\*exp\(-\.5\*x\*x\);\}\s*p-=dd\/max\(rr,1\.\)\*push\*1\.6487;/);
assert.match(ib,/try\{const s=R\*\(1\+2\*photo\.pad\);ctx\.globalAlpha=t;bent\(photo\.img,cx-s,cy-s,2\*s,2\*s\);\}/);
assert.ok(!/three/i.test(intro)&&!/three/i.test(gateMarkup)&&!/<script[^>]+three/i.test(html),'no Three.js on the main page');
assert.ok(!/https?:\/\//.test(intro.replace(/\/\/[^\n]*/g,'')),'intro.js loads nothing from another site');

// the header logo: one link (icon and words) to this page without a hash, its name says where it goes; intro.js marks
// a plain click on it, before the early return a tab that entered takes; expedition.html's logo leaves the same signal
const brand=html.match(/<a class="brand"[^>]*>[\s\S]*?<\/a>/)[0];
assert.match(brand,/^<a class="brand" href="\.\/" aria-label="Blue-bio Value Map 첫 화면으로">/);
assert.match(brand,/class="brand-mark"[\s\S]*<svg[\s\S]*Blue-bio <strong>Value Map<\/strong><\/span><\/a>$/,'icon and words inside the one link');
const introBrowser=intro.split('// ---- browser ----')[1];
assert.ok(introBrowser.indexOf("closest?.('a.brand')")>0&&introBrowser.indexOf("closest?.('a.brand')")<introBrowser.indexOf('if(!show)return;'),'the logo is marked on every load, not only when the screen shows');
assert.ok(introBrowser.indexOf('removeItem(HOME_KEY)')<introBrowser.indexOf('if(!show)return;'),'the signal is used once');
// 2026-10-18: the page gives the rule the visitor's type; a reload forgets 'entered' (enter() remembers it again), drops the
// tab from the address before app.js reads it and holds the scroll at the top until the screen goes. app.js writes its hash
// with replaceState only (no hashchange), so the link listener stays as it was and the screen is not closed by the app.
assert.ok(introBrowser.includes('nav=visitorNav(navigationType(performance),store)'),'the visitor\'s navigation type');
assert.ok(introBrowser.includes("shouldShowGate(location.hash+'&'+location.search.slice(1),store,nav)"),'the rule gets it');
const reloadBlock=introBrowser.slice(introBrowser.indexOf("if(show&&nav==='reload')"),introBrowser.indexOf('if(!show)return;'));
assert.ok(reloadBlock.length>0&&reloadBlock.includes('removeItem(GATE_KEY)')&&reloadBlock.includes("history.replaceState(history.state,'',location.pathname+rest)")&&reloadBlock.includes('withoutTab(location.search,location.hash)')&&reloadBlock.includes("history.scrollRestoration='manual'"),'a reload: not entered yet, no tab in the address, the scroll held');
assert.equal((introBrowser.match(/removeItem\(GATE_KEY\)/g)||[]).length,1,'only a reload forgets that the tab entered');
assert.ok(/function release\(\)\{[^\n]*\n\s*if\(heldScroll\)\{heldScroll=false;try\{history\.scrollRestoration='auto';\}catch\{\}\}\}/.test(introBrowser),'the scroll is given back when the screen goes (enter, skip, a link)');
const code=t=>t.replace(/\/\/[^\n]*/g,'');
assert.ok(!/location\.hash\s*=[^=]/.test(code(app))&&!/location\.hash\s*=[^=]/.test(code(intro))&&/history\.replaceState\(null,'',location\.pathname\+\(rest\?'\?'\+rest:''\)\+'#'\+p\.toString\(\)\)/.test(app),'app.js and intro.js never assign location.hash: no hashchange closes the screen after a reload');
const xhtml=read('expedition.html'),xjs=read('expedition.js');
assert.match(xhtml,/<a class="x-brand" href="index\.html" aria-label="Blue-bio Value Map 첫 화면으로">/);
assert.match(xjs,/closest\?\.\('a\.x-brand'\)[\s\S]{0,140}sessionStorage\.setItem\('bbvm-intro-home','1'\)/,'expedition logo: same signal as intro.js HOME_KEY');

// (8) copy: records are not presence, no reference-site name, the named sources are ones the site really cites
const gateHtml=html.slice(html.indexOf('<div id="site-gate"'),html.indexOf('<header'));
const text=gateHtml.replace(/<[^>]+>/g,' ')+intro.match(/'[^']*[가-힣][^']*'|`[^`]*[가-힣][^`]*`/g).join(' ');
for(const w of ['서식','살고 있','분포한','최초','완벽','모든 해양생물','OceanX','oceanx'])assert.ok(!text.includes(w),`no "${w}" in the entry screen`);
const readme=fs.readFileSync(new URL('../README.md',import.meta.url),'utf8');
// 2026-10-13: names may be links, and a name may come from the method tab (국가표준식품성분 DB is named there and in
// assessments.json, not in README/app.js); still only sources the site really cites, still at least four
const method=html.slice(html.indexOf('<section id="method"'),html.indexOf('</section>',html.indexOf('<section id="method"')));
// 2026-10-17 (#1): the list under '함께 읽는 공개 자료' only (the problem lines under the slogan are list items too)
const sourceList=gateHtml.slice(gateHtml.indexOf('<div class="gate-sources">'));
const sources=[...sourceList.slice(0,sourceList.indexOf('</ul>')).matchAll(/<li>(.*?)<\/li>/g)].map(m=>m[1].replace(/<[^>]+>/g,'').trim());
assert.ok(sources.length>=4);
for(const s of sources){const key=s.replace(' 적색목록','');assert.ok([readme,app,method].some(t=>t.includes(key)),`source "${s}" is cited in README, app.js or the method tab`);}
// links go only to addresses the site already uses (none made up); OBIS and GBIF have no site-level address here
const assessments=read('assessments.json');
const links=[...gateHtml.matchAll(/<a [^>]*href="([^"]+)"[^>]*>/g)].map(m=>[m[1],m[0]]);
for(const [href,tag] of links.filter(([h])=>/^https?:/.test(h))){
  assert.ok(app.includes(href)||assessments.includes(href),`${href} is an address the site already cites`);
  assert.match(tag,/target="_blank" rel="noopener"/,`${href} opens in a new tab without opener`);
}
// 2026-10-17 (#3): the citizen card under the first screen links to the expedition too; still the only page of our own
assert.deepEqual([...new Set(links.map(([h])=>h).filter(h=>!/^https?:/.test(h)))],['expedition.html']);
assert.ok(!/<li><a[^>]*>(OBIS|GBIF)</.test(gateHtml),'OBIS and GBIF are names only');

// (9) app.js reports its steps: the coastline once (with or without the file), and 'done' on every loadCollection outcome
assert.equal((app.match(/loadProgress\('map'/g)||[]).length,2,"'map' on success and on a missing coastline");
assert.match(app,/loadDone\('empty'\);return;/,'0 species published at all');
assert.match(app,/loadDone\(data\.offline\?'offline':data\.snapshotAt\?'snapshot':data\.publishedCount\?'live':'empty'\)/,'offline demo, live, snapshot, 0 published');
assert.match(app,/loadDone\('error'\);\}/,'load failure');

// (10) the globe files: Natural Earth, inside the stated box, the hashes SOURCE.txt records, under a versioned folder
// (the /vendor/* cache is immutable for a year, so a changed file needs a new folder name)
const vendor=f=>fs.readFileSync(new URL('../dist/vendor/globe-v1/'+f,import.meta.url));
const sourceTxt=vendor('SOURCE.txt').toString();
for(const f of ['land-50m.json','bathymetry-10m.json']){
  const buf=vendor(f),sha=crypto.createHash('sha256').update(buf).digest('hex');
  assert.ok(sourceTxt.includes(`${f} ${sha} ${buf.length}`),`SOURCE.txt records ${f} as it is (${sha})`);
  assert.ok(buf.length<200_000,`${f} stays small (${buf.length} bytes)`);
}
assert.match(sourceTxt,/public domain/);assert.match(sourceTxt,/Natural Earth/);
const landFile=JSON.parse(vendor('land-50m.json')),depthFile=JSON.parse(vendor('bathymetry-10m.json'));
assert.ok(vendor('land-50m.json').length+vendor('bathymetry-10m.json').length<300_000,'both files together under 300 KB');
const [bw,bs,be,bn]=landFile.box,inBox=p=>p[0]>=bw&&p[0]<=be&&p[1]>=bs&&p[1]<=bn;
const landRings=ctx.decodeRings(landFile.land,landFile.scale),borderLines=ctx.decodeRings(landFile.borders,landFile.scale);
const depthRings=['200','2000'].map(k=>ctx.decodeRings(depthFile.depth[k],depthFile.scale));
for(const [name,set] of [['land',landRings],['borders',borderLines],['200 m',depthRings[0]],['2000 m',depthRings[1]]]){
  assert.ok(set.length>20&&set.every(r=>r.length>=2&&r.every(inBox)),`${name}: decoded inside the box`);
  // cut edges are densified to 1° so they bend with the sphere; real coasts were simplified at 0.04–0.05°
  assert.ok(set.every(r=>r.slice(1).every((p,i)=>Math.max(Math.abs(p[0]-r[i][0]),Math.abs(p[1]-r[i][1]))<=1.01)),`${name}: no edge longer than 1°`);
}
assert.equal(JSON.stringify(ctx.decodeRings([[12750,3600,5,-10,-5,10]],100)),'[[[127.5,36],[127.55,35.9],[127.5,36]]]','delta decoding');
assert.equal(landFile.box.join(),[28,-62,254,90].join());assert.deepEqual(landFile.cut,{lon:[28,180,254],lat:[-62,90]});
// the box holds everything within about 80° of the globe centre: what it leaves out sits on the darkened rim
for(const [lon,lat] of [[60,0],[100,60],[220,0],[141,-60],[200,60],[141,89]]){
  const dist=Math.acos(Math.sin(F0*Math.PI/180)*Math.sin(lat*Math.PI/180)+Math.cos(F0*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.cos((lon-L0)*Math.PI/180))*180/Math.PI;
  if(dist<78)assert.ok(inBox([lon,lat]),`${lon},${lat} (${dist.toFixed(0)}° from the centre) is inside the box`);
}
const nearKorea=landRings.filter(r=>r.some(p=>p[0]>124&&p[0]<130&&p[1]>34&&p[1]<39));
assert.ok(nearKorea.length>0,'the 50m land has the Korean peninsula');

// (11) where things sit: the design's globe and Korea, the card's point at sea, the card on screen
const design=ctx.globeFrame(1672,941,null),toPx=(f,p)=>({x:f.cx+p.x*f.R,y:f.cy-p.y*f.R});
assert.ok(Math.abs(design.cx/1672-.75)<1e-9&&Math.abs(design.cy/941-.7246)<1e-9&&Math.abs(design.R/941-.7786)<1e-9);
// the design's rim measured by fit_camera.py: centre 75.33% · 73.93%, radius 76.34% of the height; within 2% of each
assert.ok(Math.abs(design.cx/(.7533*1672)-1)<=.02&&Math.abs(design.cy/(.7393*941)-1)<=.02&&Math.abs(design.R/(.7634*941)-1)<=.02,'the globe within 2% of the design rim');
const k=toPx(design,kr);
assert.ok(Math.abs(k.x/1672-.676)<.02&&Math.abs(k.y/941-.43)<.02,`Korea within 2% of its spot in the design (${(k.x/1672*100).toFixed(1)}%, ${(k.y/941*100).toFixed(1)}%)`);
const inside=(pt,ring)=>{let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>pt[1])!==(yj>pt[1])&&pt[0]<(xj-xi)*(pt[1]-yi)/(yj-yi)+xi)c=!c;}return c;};
assert.ok(!raw.some(r=>inside(ctx.ANCHOR,r))&&!landRings.some(r=>inside(ctx.ANCHOR,r)),'the card points at sea, not land (1:10m and 1:50m)');
const [sa,sb]=ctx.STUDY;assert.ok(ctx.ANCHOR[0]>sa[0]&&ctx.ANCHOR[0]<sb[0]&&ctx.ANCHOR[1]>sa[1]&&ctx.ANCHOR[1]<sb[1],'inside the study frame');
const card={w:212,h:124},dot=toPx(design,ortho(...ctx.ANCHOR));
const placed=ctx.cardPlace(dot,k,card,{w:1672,top:75,bottom:848},1);
assert.ok(Math.abs(placed.x-1323)<6&&Math.abs(placed.y-455)<6,`design size: the card where the design has it (${placed.x.toFixed(0)}, ${placed.y.toFixed(0)})`);
assert.equal(JSON.stringify(placed.line[0]),JSON.stringify([dot.x,dot.y]));assert.equal(placed.line.at(-1)[0],placed.x,'the line ends on the card edge');
for(const [w,h] of [[1440,900],[1920,1080],[1280,800],[1024,768],[1100,700],[2560,1080]]){
  const f=ctx.globeFrame(w,h,null),s=Math.min(1.2,Math.max(.75,f.R/733)),p=ctx.cardPlace(toPx(f,ortho(...ctx.ANCHOR)),toPx(f,kr),card,{w,top:60,bottom:h*.9},s);
  assert.ok(p.x>=12&&p.x+card.w<=w-12&&p.y>0&&p.y+card.h<=h*.9,`${w}×${h}: the card stays on screen`);
  assert.ok(p.line.every(([x,y])=>x>=0&&x<=w&&y>=0&&y<=h),`${w}×${h}: the line stays on screen`);
}
// the copy keeps clear of the rim: a title line may reach 6% of the width over it (its end touches the globe in the
// design), every other line stays 2% away. At the design size the design's globe stays; on a 4:3 tablet the globe is
// smaller and pushed right, and the card goes under its point
const leftRim=(f,b)=>{const dy=Math.max(0,b.t-f.cy,f.cy-b.b);return f.cx-Math.sqrt(f.R**2-dy**2);};
const designCopy=[{r:650,t:232,b:352,title:true},{r:630,t:352,b:472,title:true},{r:430,t:497,b:552},{r:473,t:605,b:662},{r:430,t:715,b:740}];
assert.equal(JSON.stringify(ctx.globeFrame(1672,941,null,designCopy)),JSON.stringify(design),'the design size keeps the design globe');
const tabletCopy=[{r:391,t:196,b:269,title:true},{r:380,t:269,b:342,title:true},{r:335,t:375,b:423},{r:357,t:458,b:508},{r:365,t:555,b:575}];
const f43=ctx.globeFrame(1024,768,null,tabletCopy);
assert.ok(f43.R<=1024*.55+1e-9&&f43.R<768*.7786&&f43.cx>1024*.75,'4:3: a smaller globe, pushed right');
for(const b of tabletCopy)assert.ok(leftRim(f43,b)>=b.r+(b.title?-.06:.02)*1024-1e-6,`4:3: ${JSON.stringify(b)} clear of the rim`);
const p43=ctx.cardPlace(toPx(f43,ortho(...ctx.ANCHOR)),toPx(f43,kr),card,{w:1024,top:56,bottom:680},Math.min(1.2,Math.max(.75,f43.R/733)));
assert.ok(p43.x>=12&&p43.x+card.w<=1024-12&&p43.y+card.h<=680&&p43.x>Math.max(...tabletCopy.map(b=>b.r)),'4:3: the card on screen, right of the copy');
const band={top:420,bottom:640},phone=ctx.globeFrame(390,844,band),kp=toPx(phone,kr);
assert.ok(Math.abs(kp.x-195)<1e-9&&Math.abs(kp.y-530)<1e-9&&phone.R>195,'phone: Korea in the middle of the band, the globe a little wider than the screen');


// (12) the baked picture: which file for which globe, pixel ratio and connection (vendor/globe-v2, scripts/bake_globe.py)
assert.deepEqual(cam.bake.sizes,[900,1600,2400],'three sizes');
assert.equal(JSON.stringify(Object.fromEntries(cam.bake.sizes.map(n=>[n,cam.bake.pad[n]]))),JSON.stringify(ctx.GLOBE_PAD),'intro.js GLOBE_PAD = camera.json pad');
const dR=ctx.globeFrame(1672,941,null).R,pR=ctx.globeFrame(390,844,{top:420,bottom:640}).R;
assert.equal(ctx.globeFile(pR,2),900,`phone at 2x (${(2*pR*2).toFixed(0)} px across): 900`);
assert.equal(ctx.globeFile(pR,1),900,'phone at 1x: 900');
assert.equal(ctx.globeFile(dR,1),1600,`design size at 1x (${(2*dR).toFixed(0)} px): 1600`);
assert.equal(ctx.globeFile(dR,2),2400,'design size at 2x: 2400');
assert.equal(ctx.globeFile(dR,3),2400,'a 3x screen is drawn as 2x');
assert.equal(ctx.globeFile(dR,2,{saveData:true}),1600,'save-data: never the 2400 file');
for(const t of ['slow-2g','2g','3g'])assert.equal(ctx.globeFile(dR,2,{effectiveType:t}),1600,`${t}: never the 2400 file`);
assert.equal(ctx.globeFile(dR,2,{effectiveType:'4g',saveData:false}),2400,'4g: the 2400 file');
assert.equal(ctx.globeFile(500,1),900,'1000 px across: 900');assert.equal(ctx.globeFile(501,1),1600);
assert.equal(ctx.globeFile(950,1),1600,'1900 px across: 1600');assert.equal(ctx.globeFile(951,1),2400);
for(const n of cam.bake.sizes)assert.ok(fs.existsSync(new URL(`../dist/vendor/globe-v2/globe-${n}.webp`,import.meta.url)),`globe-${n}.webp is there`);
// fetched only once the screen is known to show (a shared link never asks for it), from this site
const browser=intro.split('// ---- browser ----')[1];
assert.ok(browser.indexOf('new Image()')>browser.indexOf('if(!show)return;'),'the picture is asked for after the skip rules');
assert.match(browser,/img\.src=`vendor\/globe-v2\/globe-\$\{file\}\.webp`/,'from vendor/globe-v2 on this site');
// over the picture only Korea's coast is drawn: vertices two countries share are land borders and are left out
const bv=ctx.borderVertices(geo);
assert.ok(bv.has('124.37,40.1')&&bv.has('124.53,40.215'),'the Yalu (North Korea–China) is a border');
const southKorea=geo.features.find(f=>f.properties.name==='South Korea');
const skPolys=southKorea.geometry.type==='MultiPolygon'?southKorea.geometry.coordinates:[southKorea.geometry.coordinates];
const skv=skPolys.flatMap(p=>p[0]);
assert.ok(skv.filter(v=>v[1]<37.5).every(v=>!bv.has(v.join())),'South Korea south of the DMZ is all coast');
assert.ok(skv.some(v=>v[1]>37.7&&bv.has(v.join())),'the DMZ line is a border');
assert.ok(bv.size>500&&bv.size<raw.flat().length/4,'borders are a small part of the outline');
assert.ok(ctx.nearKorea([129.4,35.6])&&ctx.nearKorea([124.4,40.1])&&!ctx.nearKorea([139.7,35.7])&&!ctx.nearKorea([116.4,39.9]),'near Korea: the study frame grown 4°');
assert.deepEqual(JSON.parse(JSON.stringify(ctx.NEAR)),[[sa[0]-4,sa[1]-4],[sb[0]+4,+(sb[1]+4).toFixed(1)]],'NEAR is STUDY grown 4°');
// the leader line drops at the design's angle (38°: from its point down to the card's line, then flat into the card)
const [l0,l1,l2]=placed.line,ang=Math.atan2(l1[1]-l0[1],l1[0]-l0[0])*180/Math.PI;
assert.ok(Math.abs(ang-38.4)<2&&l1[1]===l2[1]&&l2[0]-l1[0]>=12,`the leader line drops at ${ang.toFixed(1)}° (design 38°), then runs flat`);
// the focus ring: none until the keyboard is used (the button has focus on arrival, a mouse visitor should not see it)
assert.match(css,/\.gate :focus-visible\{outline:none\}/,'no ring before the keyboard is used');
assert.match(css,/html\.kb \.gate :focus-visible\{outline:2px solid var\(--g-teal\);outline-offset:4px\}/,'the teal ring once it is');
assert.match(browser,/e\.key==='Tab'\|\|e\.key\.startsWith\('Arrow'\)\)root\.classList\.add\('kb'\)/,'Tab or an arrow key turns it on');

// (13) the turning globe (2026-10-14): textures as baked, the shader's own inverse = inversePerspective, the motion keeps
// Korea on the near side and (while it sways) within 6% of the screen width of its place, the overlays follow the camera
const v3=f=>fs.readFileSync(new URL('../dist/vendor/globe-v3/'+f,import.meta.url));
const texJson=JSON.parse(v3('textures.json'));
assert.deepEqual(JSON.parse(JSON.stringify(ctx.TEXTURES)),{feather:texJson.feather,sets:texJson.sets},'intro.js TEXTURES = vendor/globe-v3/textures.json');
const src3=v3('SOURCE.txt').toString(),P2=JSON.parse(src3.match(/^PARAMS: (.*)$/m)[1]);
assert.deepEqual(JSON.parse(JSON.stringify(ctx.SHADE)),{light:P2.light_dir,lo:P2.shade_lo,hi:P2.shade_hi,min:P2.shade_min,limbR:P2.limb_r,limbMin:P2.limb_min,
  air:P2.air_color,airMax:P2.air_amax,airExp:P2.air_exp,airBack:P2.air_back,airR0:P2.air_r0},'SHADE = the screen steps of the recipe the textures were baked with');
assert.equal(P2.exposure,1,'exposure is baked into the textures (the shader does not apply it)');
for(const [k,set] of Object.entries(texJson.sets))for(const t of Object.values(set)){
  assert.ok(src3.includes(`  ${t.file}  `),`${t.file} listed in SOURCE.txt`);assert.ok(fs.existsSync(new URL(`../dist/vendor/globe-v3/${t.file}`,import.meta.url)),`${k}: ${t.file} is there`);}
// the GLSL text of lonlat(), run as JavaScript (scalars only: float → let, vec2(a,b) → [a,b]), against inversePerspective
const glslToJs=src=>src.replace(/^vec2 lonlat\(float x,float y\)\{/,'').replace(/\}\s*$/,'').replace(/\bfloat\b/g,'let').replace(/return vec2\((\w+),(\w+)\);/,'return [$1,$2];');
const lonlatJs=(u_lon0,u_lat0,u_P)=>new Function('x','y','u_lon0','u_lat0','u_P','const {sqrt,max,cos,sin}=Math,atan=Math.atan2,asin=Math.asin,clamp=(v,a,b)=>Math.min(b,Math.max(a,v));'+glslToJs(ctx.GLOBE_LONLAT));
const shaderLL=lonlatJs();
assert.ok(ctx.globeShader().includes(ctx.GLOBE_LONLAT),'the shader carries lonlat() as tested');
let worstGL=0;
for(const off of [{lon:0,lat:0},{lon:18,lat:0},{lon:-30,lat:-15},{lon:30,lat:15},{lon:4.5,lat:-1.1}]){const c=ctx.cameraAt(off);
  for(let x=-.99;x<1;x+=.0917)for(let y=-.99;y<1;y+=.0853){if(Math.hypot(x,y)>1)continue;
    const a=ctx.inversePerspective(x,y,c.lon0,c.lat0,c.P),b=shaderLL(x,y,c.lon0,c.lat0,c.P);worstGL=Math.max(worstGL,Math.abs(a.lon-b[0]),Math.abs(a.lat-b[1]));}}
assert.ok(worstGL<1e-9,`the shader's lonlat() = inversePerspective at 5 poses × ~370 points (worst ${worstGL}°)`);
// which set: phones and slow connections the small one, everything else the full one
assert.equal(ctx.textureSet(pR,2),'small',`phone at 2x (${(4*pR).toFixed(0)} px across): small`);
assert.equal(ctx.textureSet(dR,1),'full','design size at 1x: full');assert.equal(ctx.textureSet(dR,2),'full');
assert.equal(ctx.textureSet(dR,2,{saveData:true}),'small');assert.equal(ctx.textureSet(dR,2,{effectiveType:'3g'}),'small');
assert.equal(ctx.textureSet(ctx.globeFrame(820,1180,{top:300,bottom:800}).R,2),'full','upright tablet at 2x: full');
// the motion: entry from 18° east into the pose by 2.4 s; then a sway of ±4.5° · ±1.1° that never turns round
const M=ctx.MOTION,A=(t,e=true)=>ctx.ambientAt(t,e);
assert.equal(A(0).lon,18);assert.equal(A(0).lat,0);
assert.ok(Math.abs(A(M.entry.ms).lon)<.5,'entry over by 2.4 s');
let maxStep=0,maxKink=0,maxLon=0,maxLat=0;
for(let t=0;t<200000;t+=16){const a=A(t),b=A(t+16),c=A(t+32);maxStep=Math.max(maxStep,Math.abs(b.lon-a.lon),Math.abs(b.lat-a.lat));
  maxKink=Math.max(maxKink,Math.abs(c.lon-2*b.lon+a.lon),Math.abs(c.lat-2*b.lat+a.lat));if(t>M.entry.ms){maxLon=Math.max(maxLon,Math.abs(a.lon));maxLat=Math.max(maxLat,Math.abs(a.lat));}}
assert.ok(maxStep<=3*M.entry.lon/M.entry.ms*16+1e-9,`never faster than the entry's first frame (${maxStep.toFixed(3)}° per frame)`);
assert.ok(maxKink<=6*M.entry.lon/M.entry.ms**2*16**2*1.05,`no jolt: the speed never changes faster than the entry's own easing (largest change ${maxKink.toFixed(4)}° per frame²)`);
assert.ok(maxLon<=M.sway.lon+1e-9&&maxLat<=M.sway.lat+1e-9&&maxLon>M.sway.lon*.95,`after the entry: |lon| ≤ ${M.sway.lon}°, |lat| ≤ ${M.sway.lat}° (seen ${maxLon.toFixed(2)}, ${maxLat.toFixed(2)})`);
assert.equal(JSON.stringify(A(0,false)),JSON.stringify({lon:0,lat:0}),'coming in late: starts in the pose (no jump from the still picture)');
// Korea on screen for every pose the sway reaches, on every screen size: near side, within 6% of the width of its place
const shift=(f,w,off)=>{const k0=ctx.project(...ctx.KOREA),k=ctx.project(...ctx.KOREA,false,ctx.cameraAt(off));return k&&Math.hypot(k.x-k0.x,k.y-k0.y)*f.R/w;};
const screens=[[1672,941,null],[1440,900,null],[1920,1080,null],[2560,1080,null],[1280,800,null],[1024,768,null],[820,1180,{top:300,bottom:800}],[390,844,{top:420,bottom:640}],[360,640,{top:300,bottom:470}]];
let worstShift=0;
for(const [w,h,band] of screens){const f=ctx.globeFrame(w,h,band);
  for(let t=M.entry.ms;t<120000;t+=250){const s=shift(f,w,A(t));assert.ok(s!==null,'Korea on the near side');worstShift=Math.max(worstShift,s);}
  for(const [lo,la] of [[1,1],[1,-1],[-1,1],[-1,-1]]){const s=shift(f,w,{lon:lo*M.sway.lon,lat:la*M.sway.lat});worstShift=Math.max(worstShift,s);}}
assert.ok(worstShift<.06,`swaying, Korea stays within 6% of the screen width of its place (worst ${(worstShift*100).toFixed(2)}%)`);
for(const off of [{lon:M.entry.lon,lat:0},...[[1,1],[1,-1],[-1,1],[-1,-1]].map(([a,b])=>({lon:a*M.drag.lon,lat:b*M.drag.lat}))]){
  const c=ctx.cameraAt(off),r=Math.PI/180,k=ctx.KOREA,cosc=Math.sin(c.lat0*r)*Math.sin(k[1]*r)+Math.cos(c.lat0*r)*Math.cos(k[1]*r)*Math.cos((k[0]-c.lon0)*r);
  assert.ok(cosc>1/c.P+.2,`Korea well inside the near side at ${JSON.stringify(off)}`);}
assert.equal(JSON.stringify(ctx.clampDrag({lon:99,lat:-99})),JSON.stringify({lon:M.drag.lon,lat:-M.drag.lat}),'drag limits');
// dragging: the surface under the pointer follows it (right → Korea moves right by about the same px)
const fD=ctx.globeFrame(1672,941,null),dd=ctx.dragDegrees(40,-25,fD.R,ctx.CAMERA.lat0);
assert.ok(dd.lon<0&&dd.lat<0,'drag right turns the camera west, drag up turns it south');
const kA=ctx.project(...ctx.KOREA),kB=ctx.project(...ctx.KOREA,false,ctx.cameraAt(dd));
const moved={x:(kB.x-kA.x)*fD.R,y:-(kB.y-kA.y)*fD.R};
assert.ok(Math.abs(moved.x/40-1)<.3&&Math.abs(moved.y/-25-1)<.3,`Korea follows the pointer (${moved.x.toFixed(1)}, ${moved.y.toFixed(1)} px for 40, -25)`);
// the overlays use the frame's camera; the start pose is the old projection
assert.equal(JSON.stringify(ctx.project(128,34,false,ctx.cameraAt({lon:0,lat:0}))),JSON.stringify(ctx.project(128,34)));
assert.notEqual(JSON.stringify(ctx.project(128,34,false,ctx.cameraAt({lon:3,lat:0}))),JSON.stringify(ctx.project(128,34)));
// the leader line: the card stays put; from wherever the point is, it starts on the point and ends on the card
const cardBox={x:placed.x,y:placed.y,w:card.w,h:card.h};
assert.equal(JSON.stringify(ctx.leadLine(dot,cardBox,1)),JSON.stringify(placed.line),'the start pose: the design line');
for(const d of [{x:dot.x-120,y:dot.y+20},{x:dot.x+60,y:dot.y-30},{x:placed.x+40,y:placed.y-80},{x:placed.x+60,y:placed.y+card.h+50}]){
  const l=ctx.leadLine(d,cardBox,1),[ex,ey]=l.at(-1);
  assert.equal(JSON.stringify(l[0]),JSON.stringify([d.x,d.y]));assert.ok((ex===cardBox.x&&ey>=cardBox.y&&ey<=cardBox.y+cardBox.h)||((ey===cardBox.y||ey===cardBox.y+cardBox.h)&&ex>=cardBox.x&&ex<=cardBox.x+cardBox.w),`ends on the card edge from ${JSON.stringify(d)}`);
  if(d.x>cardBox.x)assert.equal(l.length,2,'over or under the card: a straight line to its nearer edge');}
// the browser part: WebGL first, the still picture on every failure, frames only while moving, everything let go on leaving
assert.match(browser,/im\.src=`vendor\/globe-v3\/\$\{set\[k\]\.file\}`/,'textures from vendor/globe-v3 on this site');
assert.ok(browser.indexOf("c.getContext('webgl2'")>browser.indexOf('if(!show)return;'),'WebGL only once the screen is known to show');
for(const [what,re] of [['no context or shader',/try\{initGL\(\);\}catch\{G\.failed=true;freeGL\(\);loadStill\(\);\}/],['a texture',/im\.onerror=glFail/],['a lost context',/addEventListener\('webglcontextlost',glFail\)/],
  ['a draw error',/try\{glDraw\(cam,t\);\}catch\{glFail\(\);return draw\(\);\}/]])assert.match(browser,re,`${what} → the still picture`);
assert.match(browser,/function glFail\(\)\{[^}]*loadStill\(\)/);
assert.match(browser,/getExtension\('WEBGL_lose_context'\)\?\.loseContext\(\)/,'leaving gives the WebGL context back');
assert.match(browser,/canvas\.width=canvas\.height=0;if\(bg\)bg\.width=bg\.height=0;bg=null;photo=img=null;freeGL\(\);/);
assert.match(browser,/visibilitychange',\(\)=>\{if\(document\.hidden\)\{cancelAnimationFrame\(raf\)/,'a hidden tab stops the frames');
assert.match(browser,/const still=reduce\|\|document\.hidden;/,'still or hidden: the clock stands');
assert.match(browser,/return !still&&shown;/,'the sway asks for frames only when allowed to move');
assert.match(browser,/if\(v\)\{back=null;offset=\{lon:0,lat:0\};\}/,'the switch puts the globe in its pose at once');
assert.match(browser,/back=reduce\?null:/,'still: a released drag goes straight back, no glide');
assert.match(css,/\.gate-hero\{touch-action:pan-y pinch-zoom\}/,'a finger turns it sideways only; upward swipes and zoom stay the page\'s');
assert.ok(!/three/i.test(ctx.globeShader()),'one hand-written shader, no Three.js');
for(const r of ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)','llvmpipe (LLVM 15.0.7, 256 bits)','ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)'])
  assert.ok(ctx.SOFTWARE_GL.test(r),`software renderer kept on the still picture: ${r}`);
for(const r of ['ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)','Apple GPU','ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)','Adreno (TM) 740','Mali-G78'])
  assert.ok(!ctx.SOFTWARE_GL.test(r),`a GPU turns the globe: ${r}`);
assert.match(browser,/SOFTWARE_GL\.test\(String\(gl\.getParameter\(dbg\.UNMASKED_RENDERER_WEBGL\)\)\)\)throw/,'initGL gives up on a software renderer');
assert.match(browser,/failIfMajorPerformanceCaveat:true/,'no turning globe where WebGL would run on the CPU (software renderer): the still picture there');

// (14) 2026-10-17 (#1) why the map: three problem lines → the solution → the buttons, then three example cards (taken off again later on 2026-10-17). '출처 N건' is
// counted from license-matrix.json on every load (rows whose uses feed an indicator or the map's cells), never typed in;
// the cards hold what app.js gateExamples reads from the loaded data and open their species in 비교와 지표
const lic=JSON.parse(read('license-matrix.json'));
const evidenceRows=lic.rows.filter(r=>r.uses.some(u=>['MFPI','MBPI','MCUI','출현 지도 셀'].includes(u))).length;
assert.equal(JSON.stringify([...ctx.EVIDENCE_USES]),JSON.stringify(['MFPI','MBPI','MCUI','출현 지도 셀']));
assert.equal(ctx.evidenceSourceCount(lic),evidenceRows,`출처 ${evidenceRows}건 from the file`);
assert.ok(evidenceRows>0&&evidenceRows<lic.rows.length,'only the rows behind an indicator or the cells count');
assert.equal(ctx.evidenceSourceCount({rows:[{uses:['MBPI','MCUI']},{uses:['출현 지도 셀']},{uses:['식품 비교']},{uses:null},null]}),2,'a row counts once');
for(const m of [null,undefined,{},{rows:'x'},{rows:[]},{rows:[{uses:['식품 비교']}]}])assert.equal(ctx.evidenceSourceCount(m),null,`no number from ${JSON.stringify(m)}: the line stays out`);
// 2026-10-17: the three example cards under the buttons (.gate-ex) are gone from the entry screen; nothing in intro.js draws
// or looks them up any more (app.js still hands the examples over: the #3 policy card below names the conservation species)
for(const s of ['renderExamples','gate-ex','data-ex'])assert.ok(!intro.includes(s),`intro.js: no ${s}`);
// exampleLinks stays: the policy card under the first screen (#3) names the conservation example's species with it
assert.equal(JSON.stringify(ctx.exampleLinks({kind:'conservation',species:[{id:241776,name:'해삼'},{id:397082,name:'전복'}],value:'IUCN EN'})),
  JSON.stringify([{href:'#s=241776&v=compare',name:'해삼'},{href:'#s=397082&v=compare',name:'전복'}]),'the app\'s own link form, one per species');
assert.equal(JSON.stringify(ctx.exampleLinks({species:[{id:0,name:'a'},{id:'5',name:'b'},{id:7,name:''},{id:8},null]})),'[]','no link without a real id and a name');
for(const ex of [null,{},{species:'x'}])assert.equal(JSON.stringify(ctx.exampleLinks(ex)),'[]');
assert.ok(!read('intro.css').includes('gate-ex'),'intro.css: no .gate-ex rule');
// the markup: the lines as written, the number left empty for intro.js, the order slogan → problems → solution → buttons
const why=gateHtml.slice(gateHtml.indexOf('<div class="gate-why">'),gateHtml.indexOf('<div class="gate-actions">'));
assert.deepEqual([...why.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map(m=>m[1].replace(/<[^>]+>/g,'')),['바다 생물의 식량·약 재료 정보와 보전 정보가 여러 기관에 흩어져 있습니다.',
  '그래서 어떤 생물을 먼저 연구하고, 어떤 생물을 먼저 살펴야 하는지 한눈에 보기 어렵습니다.','이 지도에 쓰인 근거만 해도 출처 건에 나뉘어 있습니다.']);
assert.match(why,/<li class="gate-src is-wait">[^<]*<b class="gate-src-n"><\/b>/,'출처 N: no number in the HTML, the line waits for it');
assert.match(why,/<p class="gate-lead">우리 바다 생물 <b class="gate-total">\d+<\/b>종의 ‘쓸모’와 ‘지켜야 할 정도’를 근거와 함께 한 지도에 모았습니다\.<\/p>/);
const at=s=>gateHtml.indexOf(s);
assert.ok(at('class="gate-title"')<at('class="gate-problems"')&&at('class="gate-problems"')<at('class="gate-lead"')&&at('class="gate-lead"')<at('id="gate-enter"'),'slogan → problems → solution → buttons');
assert.ok(!gateHtml.includes('gate-ex')&&!/data-ex[=\s>]/.test(gateHtml),'no example card list, not even an empty one (nothing left for a screen reader)');
const firstHtml=gateHtml.slice(0,at('<section class="gate-uses"')>0?at('<section class="gate-uses"'):undefined);
for(const t of ['활용 지표 1위','보전 지표 높음','어획량 감소 신호'])assert.ok(!firstHtml.includes(t),`first screen: no '${t}'`);
// app.js hands both over: the matrix it reads anyway, and the examples with 'done' (kept in the data; the entry screen no longer draws them)
assert.match(app,/licReq\.then\(m=>loadProgress\('sources',\{license:m\}\)\)/);
assert.match(app,/examples:\(\(\)=>\{try\{return data\?gateExamples\(\):\[\];\}catch\{return \[\];\}\}\)\(\)/);
assert.match(browser,/if\(d\.step==='sources'\)gate\.sources=evidenceSourceCount\(d\.license\);/);
// 2026-10-17 (#3): enter() takes {hash} (a species link) or {table} (a use card under the first screen)
assert.match(browser,/if\(how\.hash&&typeof applyHash==='function'\)applyHash\(Object\.fromEntries\(new URLSearchParams\(how\.hash\.slice\(1\)\)\)\);/,'a species link opens its species the way a shared link does (app.js applyHash), before the tab is set');
assert.ok(browser.indexOf('applyHash(Object.fromEntries')<browser.indexOf('setView(a.view,!a.scroll)'),'the species first, then the tab');
// no weak-point or overclaiming words in what the block says (2026-10-17, LKH)
const whyText=why.replace(/<[^>]+>/g,' ');
for(const w of ['공백','예비','미평가','평가 없음','검증','신약','조사 필요','재현','부족','최초'])assert.ok(!whyText.includes(w),`no "${w}" in the problem → solution block`);

// (15) 2026-10-17 (#3) '이렇게 쓸 수 있습니다' under the first screen: three cards, each who → what they look at → what they
// choose, with a way in (the type's own data table in 비교와 지표, or the expedition), then one line. The species on the
// policy card come from the conservation example app.js gateExamples reads from the data (none typed in).
const usesHtml=gateHtml.slice(at('<section class="gate-uses"'),gateHtml.indexOf('</section>',at('<section class="gate-uses"')));
assert.ok(at('class="gate-foot"')>0&&at('class="gate-foot"')<at('<section class="gate-uses"'),'the uses come after the first screen (its source strip)');
assert.match(usesHtml,/^<section class="gate-uses" aria-labelledby="gate-uses-h">/);
assert.match(usesHtml,/<h2 class="gate-uses-h" id="gate-uses-h" tabindex="-1">이렇게 쓸 수 있습니다<\/h2>/);
const useCards=[...usesHtml.matchAll(/<li data-use="(\w+)">([\s\S]*?)<\/li>/g)].map(([,use,li])=>({use,lines:[...li.matchAll(/<p class="gate-use-(\w+)">([\s\S]*?)<\/p>/g)].map(m=>[m[1],m[2].replace(/<[^>]+>/g,'')]),
  go:(li.match(/<(?:button|a) class="gate-use-go"[^>]*?(?:data-go-table="(\w+)"|href="([^"]+)")/)||[]).slice(1).find(Boolean)}));
assert.deepEqual(useCards,[
  {use:'policy',lines:[['who','정책 담당자'],['see','‘보전 지표 높음’ 종'],['pick','보전 연구를 먼저 살필 종 고르기']],go:'conservation_priority'},
  {use:'research',lines:[['who','연구자·기업'],['see','활용 지표가 높은 종'],['pick','다음 실험 대상 고르기']],go:'sustainable_use'},
  {use:'public',lines:[['who','시민·교육'],['see','바다 탐험'],['pick','우리 바다 생물의 쓸모와 보전 필요성 배우기']],go:'expedition.html'}]);
assert.match(usesHtml,/<span class="gate-use-sp"><\/span>/,'the policy card\'s species: filled from the data, none typed in');
assert.match(usesHtml,/<p class="gate-uses-note">무엇을 먼저 조사할지 순서를 제안합니다\.<\/p>/);
for(const t of ['conservation_priority','sustainable_use'])assert.ok(app.includes(`'${t}'`)&&/data-mt-table="\$\{/.test(app),`${t} is a type the app's data table shows`);
assert.match(app,/\$\('matrix-types'\)\.addEventListener\('click'[\s\S]{0,600}if\(b\.dataset\.mtTable\)\{setCompareMode\('table'\);setCompareFilter\(\{type:b\.dataset\.mtTable\}\);/,'the type card\'s own button in 비교와 지표 (data table, that type), reused');
assert.match(browser,/for\(const b of el\.querySelectorAll\('\[data-go-table\]'\)\)b\.addEventListener\('click',\(\)=>enter\('compare',\{table:b\.dataset\.goTable\}\)\);/);
assert.match(browser,/if\(how\.table\)document\.querySelector\(`#matrix-types \[data-mt-table="\$\{how\.table\}"\]`\)\?\.click\(\);/,'the table opens the way its type card\'s button opens it');
assert.ok(browser.indexOf('setView(a.view,!a.scroll)')<browser.indexOf('if(how.table)'),'the tab first, then the table');
assert.match(browser,/const red=exampleLinks\(all\.find\(x=>x\?\.kind==='conservation'\)\);if\(red\.length\)sp\.textContent=`\(\$\{red\.map\(l=>l\.name\)\.join\('·'\)\}\)`;/);
// 2026-10-18: no way in acts until the entry screen is usable (the loader takes the pointer; the keyboard ends the piece first)
assert.match(browser,/if\(left\|\|!opened\)return;left=true;/,'no way in before the entry screen opens (not during the reveal either)');
// nothing that reads as a sample, a claim that some body uses the map, or a weak point; 우뭇가사리 is not the example
const usesText=usesHtml.replace(/<[^>]+>/g,' ');
for(const w of ['예시','사례','기관','부처','해양수산부','해수부','환경부','국립','자원관','공단','지자체','활용 중','사용 중','쓰고 있','도입','우뭇가사리','공백','예비','미평가','검증','조사 필요','재현','부족','최초'])
  assert.ok(!usesText.includes(w),`no "${w}" in 이렇게 쓸 수 있습니다`);

// (16) 2026-10-17 (#4) '다음 단계' after the uses, under the first screen: where the map stands now, then three planned steps.
// No number but the species total (filled from the data like the solution line) and, since 2026-10-19 (LKH, prompt 4/10),
// each step's target ('목표 2027 상반기' · '목표 2027 하반기' · '목표 2028') in its tag in place of '계획'; no licence or
// commercial-layer wording, nothing that names a body or an agreement.
assert.ok(at('class="gate-foot"')<at('<div class="gate-below">')&&at('<div class="gate-below">')<at('<section class="gate-uses"')&&at('<section class="gate-uses"')<at('<section class="gate-next"'),'under the first screen: the uses, then the next steps');
const nextHtml=gateHtml.slice(at('<section class="gate-next"'),gateHtml.indexOf('</section>',at('<section class="gate-next"')));
assert.match(nextHtml,/^<section class="gate-next" aria-labelledby="gate-next-h">/);
assert.match(nextHtml,/<h2 class="gate-next-h" id="gate-next-h">다음 단계<\/h2>/);
const steps=[...nextHtml.matchAll(/<li( class="is-now")?>([\s\S]*?)<\/li>/g)].map(([,now,li])=>({now:!!now,
  ...Object.fromEntries([...li.matchAll(/<p class="gate-next-(\w+)">([\s\S]*?)<\/p>/g)].map(m=>[m[1],m[2].replace(/<b class="gate-total">\d+<\/b>/,'N').replace(/<[^>]+>/g,'')]))}));
assert.deepEqual(steps,[
  {now:true,k:'지금',t:'한반도 주변 N종 공개'},
  {now:false,k:'종·해역 확대',t:'같은 속 후보 종으로 확대 · 동아시아 연해로 해역 확대',tag:'목표 2027 상반기'},
  {now:false,k:'기관 연계',t:'국가 조사·평가 자료와 연결해 갱신 · 해양보호구역 논의 자료',tag:'목표 2027 하반기'},
  {now:false,k:'서비스',t:'기관·기업 맞춤 분석과 자료 연계(표준화) 서비스 · 흩어진 자료를 잇는 연결이 핵심',tag:'목표 2028'}],'지금 as it is, each planned step tagged with its target');
assert.match(browser,/if\(total\)for\(const b of el\.querySelectorAll\('\.gate-total'\)\)b\.textContent=String\(total\);/,'the species total fills the solution line and 지금 alike');
const nextText=nextHtml.replace(/<b class="gate-total">\d+<\/b>/,'').replace(/<p class="gate-next-tag">목표 20\d\d(?: [상하]반기)?<\/p>/g,'').replace(/<[^>]+>/g,' ');
assert.ok(!/\d/.test(nextText),'no number typed into the steps but the targets in the tags');
for(const w of ['비상업','상업 레이어','레이어','CC0','CC BY','라이선스','이용 조건','예비값','교체','지표 산출','셀','협약','MOU','해양수산부','해수부','환경부','국립','자원관','공단',
  '공백','예비','미평가','검증','조사 필요','확인 필요','재현','부족','최초','실패','미충족','미확인','미산출','점수 없음'])
  assert.ok(!nextText.includes(w),`no "${w}" in 다음 단계`);
// the pill still lands on the uses (inside .gate-below now: measured, not offsetTop); the globe is not dragged from under the first screen
assert.match(browser,/h\.scrollTo\(\{top:h\.scrollTop\+q\('\.gate-uses'\)\.getBoundingClientRect\(\)\.top-h\.getBoundingClientRect\(\)\.top,/);
assert.match(browser,/const NO_DRAG='[^']*\.gate-below';/);

console.log('PASS: entry screen skip rules, a reload from the loader (the app\'s own reload, the tab and the scroll), logo goes home, real loading steps, the 8 s first-visit piece, every outcome can enter, Enter key, ways in, motion switch, projection, markup, copy, app.js events, globe files, layout, baked picture choice, Korea coast, leader angle, focus ring, turning globe (textures, shader inverse, motion range, drag, overlays, fallbacks), problem → solution, no example cards, uses and next steps under the first screen');


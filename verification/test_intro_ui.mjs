// Loading and entry screen of the main map (dist/intro.js), run on its pure part (no browser), plus static checks of
// the markup in index.html, the progress events in app.js and the globe files in dist/vendor/globe-v1. The browser flow
// is in uicheck.mjs (G-1…G-7, G-7 the logo going home) and verification/2026-10-landing-globe/landing_check.mjs.
// Run: node verification/test_intro_ui.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const intro=read('intro.js'),html=read('index.html'),app=read('app.js');
const ctx={URLSearchParams};vm.createContext(ctx);
vm.runInContext(intro.split('// ---- browser ----')[0]+';Object.assign(globalThis,{GATE_KEY,HOME_KEY,homeClick,GATE_MIN_MS,GATE_MAX_MS,GATE_STEPS,hasAppHash,shouldShowGate,makeGate,gateProgress,gateFraction,gateStep,gateTick,gateNote,countsLine,keyAction,arrival,motionPref,perspective,inversePerspective,project,simplifyRing,geographyRings,decodeRings,cutEdge,cellOf,globeFrame,cardPlace,globeFile,GLOBE_PAD,borderVertices,nearKorea,NEAR,CAMERA,FRAME,KOREA,ANCHOR,STUDY,COUNTRIES_CUT,leadLine,TEXTURES,textureSet,SHADE,MOTION,ambientAt,cameraAt,clampDrag,dragDegrees,GLOBE_LONLAT,globeShader,SOFTWARE_GL});',ctx);
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
assert.equal(ctx.shouldShowGate('',both('1',null)),false,'signal used up: a reload opens the map as before');
assert.equal(ctx.shouldShowGate('#s=241776',both('1','1')),false,'a shared link still opens the map');
const click=(o={})=>({button:0,metaKey:false,ctrlKey:false,shiftKey:false,altKey:false,defaultPrevented:false,...o});
assert.equal(ctx.homeClick(click()),true,'a plain click (or Enter on the link) goes home in this tab');
for(const o of [{button:1},{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{defaultPrevented:true}])
  assert.equal(ctx.homeClick(click(o)),false,'new tab/window or cancelled: this tab stays as it is '+JSON.stringify(o));

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
// the design's line, with the published/candidate split kept in view (2026-10-13; was 지금 해양생물 N종을 볼 수 있습니다(…))
assert.equal(ctx.countsLine(g.done),'30종의 해양생물(운영 발행 8 · 조사 후보 22) · 공개 데이터 기반');
assert.equal(ctx.countsLine({state:'empty',published:0,candidates:22}),'22종의 해양생물(운영 발행 0 · 조사 후보 22) · 공개 데이터 기반','0 published is said as it is');
const failed=ctx.makeGate(0);ctx.gateProgress(failed,'done',{state:'error'});
assert.equal(ctx.gateStep(failed),'준비됐어요','no total typed in when the app has none');
assert.equal(ctx.countsLine({state:'error'}),'','no counts typed in when the app has none');
assert.equal(ctx.countsLine(null),'');

// (4) every load outcome can enter; the note says the same thing as the app's connection state
const note=d=>{const x=ctx.makeGate(0);ctx.gateProgress(x,'done',d);ctx.gateTick(x,ctx.GATE_MIN_MS);return [x.phase,ctx.gateNote(x)];};
assert.deepEqual(note({state:'snapshot',snapshotAt:'2026-09-24'}),['ready','운영 DB에 연결하지 못해 2026-09-24 기준 공개 자료 사본으로 엽니다.']);
// Offline demo (?offline=1): the saved copy is the plan, so the note says so instead of 연결하지 못해.
assert.deepEqual(note({state:'offline',snapshotAt:'2026-10-01'}),['ready','오프라인 시연 · 2026-10-01 기준 공개 자료 사본으로 엽니다.']);
assert.deepEqual(note({state:'empty',published:0,candidates:22}),['ready','운영 발행 자료가 0종입니다. 들어가면 조사 후보만 보입니다.']);
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
assert.match(css,/prefers-reduced-motion:reduce/);
// the ways in are real buttons; the motion control is a switch; the globe picture is hidden from assistive tech
const gateMarkup=html.slice(html.indexOf('<div id="site-gate"'),html.indexOf('<header'));
assert.deepEqual([...gateMarkup.matchAll(/<button[^>]*data-go="(\w+)"/g)].map(m=>m[1]).sort(),['compare','compare','explore','explore','method']);
assert.match(gateMarkup,/<button class="gate-motion" type="button" role="switch" aria-checked="false">/);
assert.match(gateMarkup,/<canvas class="gate-sea" aria-hidden="true">/);
assert.match(gateMarkup,/<button class="gate-enter" id="gate-enter" type="button">바다 탐색하기/);
assert.match(css,/\.gate\.is-still \.gate-sea/,'the switch stops the globe fading and zooming');
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
const sources=[...gateHtml.matchAll(/<li>(.*?)<\/li>/g)].map(m=>m[1].replace(/<[^>]+>/g,'').trim());
assert.ok(sources.length>=4);
for(const s of sources){const key=s.replace(' 적색목록','');assert.ok([readme,app,method].some(t=>t.includes(key)),`source "${s}" is cited in README, app.js or the method tab`);}
// links go only to addresses the site already uses (none made up); OBIS and GBIF have no site-level address here
const assessments=read('assessments.json');
const links=[...gateHtml.matchAll(/<a [^>]*href="([^"]+)"[^>]*>/g)].map(m=>[m[1],m[0]]);
for(const [href,tag] of links.filter(([h])=>/^https?:/.test(h))){
  assert.ok(app.includes(href)||assessments.includes(href),`${href} is an address the site already cites`);
  assert.match(tag,/target="_blank" rel="noopener"/,`${href} opens in a new tab without opener`);
}
assert.deepEqual(links.map(([h])=>h).filter(h=>!/^https?:/.test(h)),['expedition.html']);
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

console.log('PASS: entry screen skip rules, logo goes home, real loading steps, min/max wait, every outcome can enter, Enter key, ways in, motion switch, projection, markup, copy, app.js events, globe files, layout, baked picture choice, Korea coast, leader angle, focus ring, turning globe (textures, shader inverse, motion range, drag, overlays, fallbacks)');


// Loading and entry screen of the main map (dist/intro.js), run on its pure part (no browser), plus static checks of
// the markup in index.html, the progress events in app.js and the globe files in dist/vendor/globe-v1. The browser flow
// is in uicheck.mjs (G-1…G-6) and verification/2026-10-landing-globe/landing_check.mjs.
// Run: node verification/test_intro_ui.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const intro=read('intro.js'),html=read('index.html'),app=read('app.js');
const ctx={URLSearchParams};vm.createContext(ctx);
vm.runInContext(intro.split('// ---- browser ----')[0]+';Object.assign(globalThis,{GATE_KEY,GATE_MIN_MS,GATE_MAX_MS,GATE_STEPS,hasAppHash,shouldShowGate,makeGate,gateProgress,gateFraction,gateStep,gateTick,gateNote,countsLine,keyAction,arrival,motionPref,orthographic,simplifyRing,geographyRings,decodeRings,cutEdge,cellOf,globeFrame,cardPlace,GLOBE_CENTER,KOREA,ANCHOR,STUDY,COUNTRIES_CUT});',ctx);
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
assert.deepEqual(note({state:'empty',published:0,candidates:22}),['ready','운영 발행 자료가 0종입니다. 들어가면 조사 후보만 보입니다.']);
assert.deepEqual(note({state:'error'}),['ready','자료를 불러오지 못했습니다. 들어가서 다시 불러오기를 눌러 주세요.']);

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

// (6) the globe projection (orthographic since 2026-10-13; it was a 24° vertical perspective): centre at the origin, east
// right, north up, horizon at r=1, far side hidden (or pushed onto the rim for filling); coastline simplified, not invented
const [L0,F0]=ctx.GLOBE_CENTER,ortho=(lon,lat,rim)=>ctx.orthographic(lon,lat,L0,F0,rim),r1=p=>Math.hypot(p.x,p.y);
const c=ortho(L0,F0);assert.ok(Math.abs(c.x)<1e-12&&Math.abs(c.y)<1e-12);
const east=ctx.orthographic(150,0,140,0),north=ctx.orthographic(140,10,140,0);
assert.ok(east.x>0&&Math.abs(east.y)<1e-12&&north.y>0&&Math.abs(north.x)<1e-12,'east is right, north is up');
const edge=ctx.orthographic(140+89.9,0,140,0);assert.ok(edge&&r1(edge)<=1&&r1(edge)>.9999,'horizon at r≈1');
assert.equal(ctx.orthographic(140+90.5,0,140,0),null,'beyond the horizon is not drawn');
assert.equal(ortho(L0+180,-F0),null,'the far side is not drawn');
const rim=ctx.orthographic(140+100,20,140,0,true);assert.ok(rim.back&&Math.abs(r1(rim)-1)<1e-12,'with toRim a hidden point sits on the rim');
assert.ok(!ctx.orthographic(150,20,140,0,true).back,'a visible point is not moved');
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
assert.match(css,/html\.gate-on \.gate\{display:block\}/,'shown only with the class intro.js sets');
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
assert.match(app,/loadDone\(data\.snapshotAt\?'snapshot':data\.publishedCount\?'live':'empty'\)/,'live, snapshot, 0 published');
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
assert.ok(Math.abs(design.cx/1672-.759)<1e-9&&Math.abs(design.cy/941-.726)<1e-9&&Math.abs(design.R/941-.774)<1e-9);
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
  const f=ctx.globeFrame(w,h,null),s=Math.min(1.2,Math.max(.75,f.R/728)),p=ctx.cardPlace(toPx(f,ortho(...ctx.ANCHOR)),toPx(f,kr),card,{w,top:60,bottom:h*.9},s);
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
assert.ok(f43.R<=1024*.55+1e-9&&f43.R<768*.774&&f43.cx>1024*.759,'4:3: a smaller globe, pushed right');
for(const b of tabletCopy)assert.ok(leftRim(f43,b)>=b.r+(b.title?-.06:.02)*1024-1e-6,`4:3: ${JSON.stringify(b)} clear of the rim`);
const p43=ctx.cardPlace(toPx(f43,ortho(...ctx.ANCHOR)),toPx(f43,kr),card,{w:1024,top:56,bottom:680},Math.min(1.2,Math.max(.75,f43.R/728)));
assert.ok(p43.x>=12&&p43.x+card.w<=1024-12&&p43.y+card.h<=680&&p43.x>Math.max(...tabletCopy.map(b=>b.r)),'4:3: the card on screen, right of the copy');
const band={top:420,bottom:640},phone=ctx.globeFrame(390,844,band),kp=toPx(phone,kr);
assert.ok(Math.abs(kp.x-195)<1e-9&&Math.abs(kp.y-530)<1e-9&&phone.R>195,'phone: Korea in the middle of the band, the globe a little wider than the screen');

console.log('PASS: entry screen skip rules, real loading steps, min/max wait, every outcome can enter, Enter key, ways in, motion switch, projection, markup, copy, app.js events, globe files, layout');

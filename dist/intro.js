// Loading and entry screen of the main map (index.html): a full-screen sea whose wide ripples spread while the line under
// the logo names the app's real loading step, then an entry screen (copy on the left, a large globe on the right) that opens the map, the comparison or the sources. Loaded
// without defer in <head> so the screen is up before the first paint. It shows on a tab's first visit, after the site
// logo and on every reload (F5, pull to refresh) from the loader on; a shared link, Back and Forward open the map
// directly (shouldShowGate). The part above the browser marker below is pure and tested in node (verification/test_intro_ui.mjs).
const GATE_KEY='bbvm-intro-entered', MOTION_KEY='bbvm-reduce-motion';
// The site logo (here and on expedition.html) goes home, as on most sites: a plain click on it leaves this one-time
// signal and follows its link, and the next load shows the entry screen again although the tab already entered.
const HOME_KEY='bbvm-intro-home';
// app.js reloads the page by itself once when a data file is newer than its code (reloadOnceForNewData) and leaves this
// one-time mark just before: that reload is the app's, not the visitor's, so it opens the way the load before it did.
const APP_RELOAD_KEY='bbvm-app-reload';
const APP_HASH_KEYS=['s','v','t','b','m','p','u']; // what app.js readHash/applyHash use: a shared link opens the map directly
// (after '#' or, from 2026-10-15, as a query such as ?v=compare: the caller passes both)
// The first visit (2026-10-18, LKH): one 8 s piece from the loader's first paint. The words stand still, one drop falls,
// its rings spread, the entry screen opens inside them with the globe refracted only where a ring passes, then all
// calms and the screen is usable at total. Every time of it is here (WAVE's times are shares of the ripple span).
// late: a globe that comes after reveal[0] opens from that moment over max(late, total - then); timeout: no globe by
// then (from the first paint or the last retry), the loader says so and offers a retry.
const INTRO_TIMELINE={total:8000,drop:[1000,1800],ripple:[1800,4200],reveal:[4200,6800],settle:[6800,8000],late:1800,timeout:20000};
const GATE_STEPS=[['page','페이지를 준비하는 중'],['map','지도를 불러오는 중'],['species','해양생물 자료를 불러오는 중']];
// the loader's line once the time is up and the globe is not in yet, and what it says when the globe did not come
const GLOBE_WAIT='지구 화면을 준비하는 중', GLOBE_FAIL='지구 화면을 불러오지 못했어요.'; // GLOBE_FAIL: index.html .gate-fail

const hasAppHash=hash=>{try{const q=new URLSearchParams(String(hash||'').replace(/^#/,''));return APP_HASH_KEYS.some(k=>q.get(k));}catch{return false;}};
// navType: how this page was opened (navigationType). A reload (2026-10-18, LKH) shows the screen from the loader on,
// whatever the address and the tab hold. Otherwise a shared link opens the map directly, and so does a tab that already
// entered, unless the logo was clicked. No storage (private mode, blocked) only means the screen can't be remembered:
// it still shows once per load.
const shouldShowGate=(hash,storage,navType)=>{if(navType==='reload')return true;if(hasAppHash(hash))return false;
  try{return storage?.getItem(HOME_KEY)==='1'||storage?.getItem(GATE_KEY)!=='1';}catch{return true;}};
// Navigation Timing's type ('navigate', 'reload', 'back_forward', …); where it is missing the old interface's type 1 is a
// reload; with neither, or on an error, 'navigate', which keeps the rules as they were.
const navigationType=perf=>{try{const t=perf?.getEntriesByType?.('navigation')?.[0]?.type;if(t)return String(t);
  return perf?.navigation?.type===1?'reload':'navigate';}catch{return 'navigate';}};
// The visitor's type: the app's own reload (APP_RELOAD_KEY) counts as the load before it. The mark is read once.
const visitorNav=(navType,storage)=>{let mark=null;try{mark=storage?.getItem(APP_RELOAD_KEY)??null;if(mark!==null)storage.removeItem(APP_RELOAD_KEY);}catch{}
  return navType==='reload'&&mark==='1'?'navigate':navType;};
// A reload's address without its tab (v, in the query and the hash alike; the rest as it was): app.js applies the species,
// the map view and the rest under the screen, and the way in picks the tab as on a first visit (enter() leaves the app's
// tab as it is for 바다 탐색하기, so a v=compare kept here would stay on 비교와 지표).
const withoutTab=(search,hash)=>{const drop=(s,lead)=>{s=String(s||'');const q=new URLSearchParams(s.slice(1));if(!q.has('v'))return s;
  q.delete('v');const t=q.toString();return t?lead+t:'';};return drop(search,'?')+drop(hash,'#');};
// A plain click only: a middle or modified click opens a new tab or window and leaves this one as it is.
const homeClick=e=>e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey&&!e.defaultPrevented;

const makeGate=start=>({start,steps:new Set(),done:null,phase:'loading'});
// 'done' arrives from app.js after loadCollection on every outcome (live, snapshot, offline, empty, error); it implies every step.
function gateProgress(g,step,detail){
  if(step==='done'){g.done=detail||{};for(const [k] of GATE_STEPS)g.steps.add(k);}
  else if(GATE_STEPS.some(([k])=>k===step))g.steps.add(step);
  return g;
}
// No "n / 3" counter: next to 종 자료 it read as a species count. The total comes from the loaded data, once it is there.
const speciesTotal=d=>Number.isInteger(d?.published)&&Number.isInteger(d?.candidates)?d.published+d.candidates:null;
// The first step not yet in; once all are in, the species total from the loaded data. A load that failed (or came without
// a total) is not said to be done: the line only says the screen opens, and the entry screen's note says the rest.
const gateStep=g=>{const i=GATE_STEPS.findIndex(([k])=>!g.steps.has(k));if(i>=0)return GATE_STEPS[i][1];
  const t=g.done?.state==='error'?null:speciesTotal(g.done);return t?`해양생물 ${t}종 자료를 불러왔어요`:'첫 화면을 여는 중';};
// The timeline's pieces. smoother: 0 → 1 with no speed at either end, so one piece hands over to the next without a jolt.
const clamp01=x=>Math.min(1,Math.max(0,x));
const smoother=x=>{x=clamp01(x);return x*x*x*(x*(x*6-15)+10);};
const spanOf=([a,b])=>b-a;
// Where the drop lands, as shares of the screen: 52% · 61% as in the design (side by side); stacked (phones, upright
// tablets) a little lower and never closer than 12% of the height under the loader's words (wordsBottom, px).
const RIPPLE_CENTER={wide:[.52,.61],stacked:[.5,.66]};
function rippleCenter(w,h,stacked,wordsBottom=0){const [x,y]=RIPPLE_CENTER[stacked?'stacked':'wide'];return {x:w*x,y:Math.max(h*y,wordsBottom+.12*h)};}
// D: from the centre to the farthest corner, the distance the rings and the opening have to cover
const rippleReach=(c,w,h)=>Math.hypot(Math.max(c.x,w-c.x),Math.max(c.y,h-c.y));
// The rings of the one drop. s counts ripple spans since it lands; the front is at D·(a·s + b·s²), a little quicker as it
// goes, and ring i follows i gaps behind it, so the rings start fine and close (about 20 px apart on a laptop) and open up
// as they spread. A ring fades in as it is born, weakens as it widens (1/√ of its radius) and further back in the train,
// and the whole train calms to nothing over settle. refract: a ring's push on the globe under it, px at full strength on
// a 1440 px screen; width: a crest's half width as a share of its gap; lag: the opening follows the front this many
// spans behind, opening over the first open share of reveal; feather: the opening's soft edge, a share of D; drop: how
// far the drop falls, a share of the height.
const WAVE={rings:12,gap:1/15,a:.2806,b:.1994,born:3,far:.15,tail:.5,splash:.125,refract:10,width:.28,lag:.1,open:.85,feather:.35,drop:.06};
const rippleFront=(s,D)=>s>0?D*(WAVE.a*s+WAVE.b*s*s):0;
// the rings at t ms: radius (px), strength 0..1, crest half width (px); the youngest last
function ripplesAt(t,D){
  const T=INTRO_TIMELINE,s=(t-T.ripple[0])/spanOf(T.ripple),calm=1-smoother((t-T.settle[0])/spanOf(T.settle)),out=[];
  if(calm<=0)return out;
  for(let i=0;i<WAVE.rings;i++){
    const si=s-i*WAVE.gap;if(si<=0)break;
    const r=rippleFront(si,D);
    out.push({r,k:smoother(si/(WAVE.gap*WAVE.born))/Math.sqrt(1+r/(WAVE.far*D))*(1-WAVE.tail*i/WAVE.rings)*calm,
      w:Math.max(1.5,D*(WAVE.a+2*WAVE.b*si)*WAVE.gap*WAVE.width)});
  }
  return out;
}
// The drop over drop[]: falling the last WAVE.drop of the height onto the centre, quicker as it falls, a little smaller
// as it nears the water (seen from above); then, as the first ring is born, a small light where it went in that fades.
function dropAt(t,c,h){
  const T=INTRO_TIMELINE,p=(t-T.drop[0])/spanOf(T.drop);
  if(p>=0&&p<1)return {x:c.x,y:c.y-WAVE.drop*h*(1-p*p),r:4.2-1.6*p*p,a:smoother(p/.3),splash:0};
  const q=(t-T.ripple[0])/(spanOf(T.ripple)*WAVE.splash);
  return q>=0&&q<1?{x:c.x,y:c.y,r:2.6+3*q,a:0,splash:1-smoother(q)}:null;
}
// The opening of the loader (the entry screen showing through it): r the edge of the clear disc round the centre, F its
// soft edge (the loader is clear inside r−F, whole outside r), words the loader's words, over what is drawn over the
// globe (coast, cells, frame, the card's point), which takes no refraction and so comes in as the rings calm. On time
// (the globe in by reveal[0]) it follows the rings from nothing at reveal[0]; a late globe (readyAt, ms) opens from then
// over lateSpan; null: no globe yet, the loader stays whole.
const lateSpan=readyAt=>Math.max(INTRO_TIMELINE.late,INTRO_TIMELINE.total-readyAt);
function revealAt(t,D,readyAt){
  const T=INTRO_TIMELINE,F=WAVE.feather*D;
  if(readyAt===null||readyAt===undefined||t<Math.max(T.reveal[0],readyAt))return {r:0,F,words:1,over:0};
  if(readyAt<=T.reveal[0]){const k=smoother((t-T.reveal[0])/(spanOf(T.reveal)*WAVE.open)),s=(t-T.ripple[0])/spanOf(T.ripple);
    return {r:k*rippleFront(s-WAVE.lag,D),F,words:1-smoother((t-T.reveal[0])/(spanOf(T.reveal)*.35)),over:smoother((t-T.settle[0])/spanOf(T.settle))};}
  const L=lateSpan(readyAt),k=smoother((t-readyAt)/L);
  return {r:k*(D+F)*1.02,F,words:1-smoother((t-readyAt)/(L*.35)),over:smoother((t-readyAt-L/2)/(L/2))};
}
// Still (the switch, or the system's reduce motion): no drop, rings or refraction; the loader cross-fades away over the
// same window instead (its opacity, 1 → 0).
function crossfadeAt(t,readyAt){
  if(readyAt===null||readyAt===undefined)return 1;
  const a=Math.max(INTRO_TIMELINE.reveal[0],readyAt);return 1-smoother((t-a)/(introEnd(readyAt)-a));
}
// The entry screen is usable once the time is up and the globe is there; the data never shortens or ends the piece.
const introEnd=readyAt=>readyAt<=INTRO_TIMELINE.reveal[0]?INTRO_TIMELINE.total:readyAt+lateSpan(readyAt);
const introDone=(t,readyAt)=>readyAt!==null&&readyAt!==undefined&&t>=introEnd(readyAt);
// What the loader's line says for the globe: '' while the piece runs, wait past total without it, fail once it failed
// (every picture failed, shown from total on) or the timeout passed without it (failAt: ms, from the first paint or a retry).
const introStatus=(t,readyAt,failed,failAt)=>readyAt!==null&&readyAt!==undefined?'':(failed&&t>=INTRO_TIMELINE.total)||t>=failAt?'fail':t>=INTRO_TIMELINE.total?'wait':'';
// One line under the buttons; the same meaning as the app's own connection state, never a softer one.
function gateNote(g){
  const d=g.done;
  if(!d)return g.phase==='ready'?'자료를 계속 불러오는 중입니다. 먼저 들어가도 됩니다.':'';
  if(d.state==='offline')return `오프라인 시연 · ${d.snapshotAt||'저장된'} 기준 공개 자료 사본으로 엽니다.`;
  if(d.state==='snapshot')return `운영 DB에 연결하지 못해 ${d.snapshotAt||'저장된'} 기준 공개 자료 사본으로 엽니다.`;
  if(d.state==='empty')return '공개 데이터 기준으로 엽니다.';
  if(d.state==='error')return '자료를 불러오지 못했어요. 들어가서 ↻ 다시 시도를 눌러 주세요.';
  return '';
}
// The design's "N종의 해양생물 · 공개 데이터 기반" (2026-10-17, LKH: one count, no published/candidate split). Empty until known.
const countsLine=d=>speciesTotal(d)===null?'':`${speciesTotal(d)}종의 해양생물 · 공개 데이터 기반`;
// 2026-10-17 (#1) problem → solution under the slogan. The third problem line's '출처 N건' is the rows of license-matrix.json
// (app.js reads the file anyway and passes it on) that feed an indicator or the map's cells: counted on every load, never
// typed in; null keeps the line out (no file, no rows).
const EVIDENCE_USES=['MFPI','MBPI','MCUI','출현 지도 셀'];
const evidenceSourceCount=m=>{if(!Array.isArray(m?.rows))return null;
  const n=m.rows.filter(r=>Array.isArray(r?.uses)&&r.uses.some(u=>EVIDENCE_USES.includes(u))).length;return n>0?n:null;};
// The species of an example app.js gateExamples read from the loaded data, in the app's own link form (the #3 policy card
// under the first screen names the conservation example's species)
const exampleLinks=ex=>(Array.isArray(ex?.species)?ex.species:[]).filter(s=>Number.isInteger(s?.id)&&s.id>0&&typeof s.name==='string'&&s.name)
  .map(s=>({href:`#s=${s.id}&v=compare`,name:s.name}));
// Enter opens the map from anywhere on the entry screen, except when another control has focus (its own action wins).
const keyAction=(key,{ready,onOtherControl})=>key==='Enter'&&ready&&!onOtherControl?'enter':null;
// The ways in: the app tab each one opens and what gets focus there. A phone gets <main> rather than a search box (no
// keyboard popping up); the source list is not a text field, so it keeps focus everywhere and is scrolled to like the
// app's own 출처 link (setView('method',false) then its section).
const GATE_VIEWS={explore:'#search',compare:'#cmp-search',method:'#all-sources'};
const arrival=(target,touch)=>{const view=target==='compare'||target==='method'?target:'explore';
  return {view,focus:view==='method'||!touch?GATE_VIEWS[view]:'main',scroll:view==='method'?'.source-section':null};};
// The motion switch starts from the system setting; once flipped here it is remembered ('1' still, '0' moving).
const motionPref=(stored,system)=>stored==='1'||(stored!=='0'&&!!system);

// Vertical perspective (the globe seen from P radii off its centre). Unit-disc coordinates, x right, y up, r=1 on the
// horizon (acos(1/P) from the centre); null behind it, or with toRim the point pushed out onto the rim: an area running
// behind the globe is then closed along the rim instead of being dropped whole. scripts/bake_globe.py bakes the picture
// with the same formula.
function perspective(lon,lat,lon0,lat0,P,toRim){
  const r=Math.PI/180,f=lat*r,f0=lat0*r,dl=(lon-lon0)*r,cf=Math.cos(f);
  const x=cf*Math.sin(dl),y=Math.cos(f0)*Math.sin(f)-Math.sin(f0)*cf*Math.cos(dl);
  const cosc=Math.sin(f0)*Math.sin(f)+Math.cos(f0)*cf*Math.cos(dl);
  if(cosc>=1/P){const k=(P-1)/(P-cosc)/Math.sqrt((P-1)/(P+1));return {x:x*k,y:y*k};}
  if(!toRim)return null;const k=1/(Math.hypot(x,y)||1);return {x:x*k,y:y*k,back:true};
}
// Its inverse (Snyder 1987, p. 175): the place under a unit-disc point, null off the disc.
function inversePerspective(x,y,lon0,lat0,P){
  if(Math.hypot(x,y)>1)return null;
  const r=Math.PI/180,f0=lat0*r,s=Math.sqrt((P-1)/(P+1)),X=x*s,Y=y*s,rho=Math.hypot(X,Y);
  if(rho<1e-15)return {lon:lon0,lat:lat0};
  const sinc=(P-Math.sqrt(Math.max(0,1-rho*rho*(P+1)/(P-1))))/((P-1)/rho+rho/(P-1)),cosc=Math.sqrt(1-sinc*sinc);
  return {lon:lon0+Math.atan2(X*sinc,rho*Math.cos(f0)*cosc-Y*Math.sin(f0)*sinc)/r,lat:Math.asin(cosc*Math.sin(f0)+Y*sinc*Math.cos(f0)/rho)/r};
}
// Drop vertices closer than minDeg to the last kept one: the 1:10m coastline is far finer than the screen. Vertices on
// the file's own cut lines always stay, so the cut edges keep both ends on the line (cutEdge) and are never stroked.
function simplifyRing(ring,minDeg,cut){
  const out=[],onCut=p=>!!cut&&(cut.lon.includes(p[0])||cut.lat.includes(p[1]));
  for(const p of ring){const q=out[out.length-1];if(!q||onCut(p)||Math.abs(p[0]-q[0])+Math.abs(p[1]-q[1])>=minDeg)out.push(p);}
  if(out.length>2&&out[out.length-1]!==ring[ring.length-1])out.push(ring[ring.length-1]);
  return out.length>=3?out:[];
}
const geographyRings=(geo,minDeg=.08,cut)=>(geo?.features||[]).flatMap(f=>{
  const g=f.geometry;const polys=g?.type==='MultiPolygon'?g.coordinates:g?.type==='Polygon'?[g.coordinates]:[];
  return polys.map(p=>simplifyRing(p[0],minDeg,cut)).filter(r=>r.length);
});
// vendor/globe-v1 rings (scripts/prepare_globe.py): integers in 1/scale degree, the first point absolute, then steps.
const decodeRings=(rings,scale)=>rings.map(r=>{const out=[];for(let i=0,x=0,y=0;i<r.length;i+=2){x+=r[i];y+=r[i+1];out.push([x/scale,y/scale]);}return out;});
// An edge a clipped file made itself (a box side, the 180° split) is filled like the rest but never stroked as a coast.
const cutEdge=(a,b,cut)=>cut.lon.some(v=>a[0]===v&&b[0]===v)||cut.lat.some(v=>a[1]===v&&b[1]===v);
// Around Korea the finer countries.json draws the coasts and borders: the 50m lines are left out in the 1° cells its
// outline passes through (not its whole box, which also holds northern Viet Nam and Laos that it does not have).
const cellOf=p=>Math.floor(p[0])*200+Math.floor(p[1])+100;

// The camera, fitted to the design image (verification/2026-10-landing-globe-texture/fit_camera.py): it looks at
// 136.8°E 20.3°N from 2.71 radii off the centre (horizon 68°), the same numbers as vendor/globe-v2/camera.json, which
// the baked picture was made with (test_intro_ui.mjs keeps the two equal). Side by side with the copy: centre 75% ·
// 72.5% of the screen, radius 77.9% of its height (the design's rim, within 2%) but at most 55% of its width (4:3
// tablets). The copy then keeps clear of the rim as in the design: a title line may reach over it by 6% of the width,
// every other line stays 2% away, so a relatively wide copy pushes the centre right. copy: text boxes {r,t,b,title}
// in px. Stacked (phone, upright tablet): a little wider than the screen, Korea in the middle of the free band under
// the buttons.
// ANCHOR is the card's point: open sea inside the map's study frame (STUDY), not a record. countries.json is clipped to
// COUNTRIES_CUT (scripts/prepare_basemap.py).
const CAMERA={lon0:136.823,lat0:20.345,P:2.7122}, FRAME={cx:.75,cy:.7246,R:.7786};
const KOREA=[127.5,36], ANCHOR=[128,34], STUDY=[[124,33],[132,38.7]], COUNTRIES_CUT={lon:[105,150],lat:[20,53]};
// cam: the camera of this frame (the turning globe below); the start pose by default
const project=(lon,lat,toRim,cam=CAMERA)=>perspective(lon,lat,cam.lon0,cam.lat0,cam.P,toRim);
function globeFrame(w,h,band,copy=[]){
  if(band){const R=Math.min(w*.6,h*.5),k=project(...KOREA);
    return {cx:w/2-k.x*R,cy:(band.top+band.bottom)/2+k.y*R,R};}
  const R=Math.min(h*FRAME.R,w*.55),cy=h*FRAME.cy;let cx=w*FRAME.cx;
  for(const b of copy){const dy=Math.max(0,b.t-cy,cy-b.b);if(dy<R)cx=Math.max(cx,b.r+(b.title?-.06:.02)*w+Math.sqrt(R*R-dy*dy));}
  return {cx,cy,R};
}
// The baked picture (vendor/globe-v2, scripts/bake_globe.py) for a globe drawn R css px in radius: the smallest file
// that is not much enlarged at this pixel ratio (at most 2), the largest only on a connection that is not saving data
// or slow. pad: the 2400 file has 12 transparent px round the disc (its glow edge meets the screen's own glow there).
const GLOBE_PAD={900:0,1600:0,2400:12};
function globeFile(R,dpr,conn){
  const d=2*R*Math.min(2,dpr||1),slow=!!conn&&(!!conn.saveData||/2g|3g/.test(conn.effectiveType||''));
  return d<=1000?900:d<=1900||slow?1600:2400;
}
// Vertices that two countries of countries.json share lie on a land border; the coast line drawn over the picture
// around Korea (NEAR: the study frame grown 4°) leaves them out.
function borderVertices(geo){
  const seen=new Map();
  (geo?.features||[]).forEach((f,i)=>{const g=f.geometry;const polys=g?.type==='MultiPolygon'?g.coordinates:g?.type==='Polygon'?[g.coordinates]:[];
    for(const poly of polys)for(const v of poly[0]){const k=v[0]+','+v[1],o=seen.get(k);seen.set(k,o===undefined||o===i?i:-1);}});
  return new Set([...seen].filter(([,i])=>i===-1).map(([k])=>k));
}
const NEAR=[[120,29],[136,42.7]];
const nearKorea=p=>p[0]>=NEAR[0][0]&&p[0]<=NEAR[1][0]&&p[1]>=NEAR[0][1]&&p[1]<=NEAR[1][1];

// The info card: right of Korea as in the design (offsets from the 1672×941 image, scaled with the globe; pulled in to
// the screen edge while its leader line still runs right), with a bent line from its point that drops at the design's
// 38° (run 1.26 × fall) before running flat into the card; under the point instead
// when it does not fit. Top-left and line, in px.
function cardPlace(dot,korea,card,view,s){
  const m=12;let x=Math.min(korea.x+207*s,view.w-m-card.w),y=korea.y+60*s;
  if(x>=dot.x+60*s&&y+card.h<=view.bottom-m)return {x,y,line:leadLine(dot,{x,y,w:card.w,h:card.h},s)};
  x=Math.min(Math.max(m,dot.x-card.w*.3),view.w-m-card.w);y=dot.y+64*s;
  return {x,y,under:true,line:leadLine(dot,{x,y,w:card.w,h:card.h,under:true},s)};
}
// The leader line from the card's point (wherever the turning globe has carried it) to the card, which stays put: the
// bent line while the point is left of the card, else straight to the card's nearer edge (top or bottom).
function leadLine(dot,card,s){
  if(!card.under&&dot.x<=card.x-24*s){const ly=card.y+27*s,bend=Math.min(card.x-12*s,Math.max(dot.x+12*s,dot.x+(ly-dot.y)*1.26));
    return [[dot.x,dot.y],[bend,ly],[card.x,ly]];}
  return [[dot.x,dot.y],[Math.min(Math.max(dot.x,card.x+16),card.x+card.w-16),dot.y>card.y+card.h/2?card.y+card.h:card.y]];
}

// The turning globe (2026-10-14). The picture above never turns, so with WebGL the screen draws the globe itself every
// frame from position-free textures (vendor/globe-v3, scripts/bake_globe.py --equirect; textures.json keeps the same
// numbers): one shader looks up the place under each pixel with inversePerspective's formula, then adds what belongs to
// the screen (light from the upper left, the limb, the air band: globe-v2's PARAMS, SHADE below). Without WebGL the
// still picture stays and nothing turns.
const TEXTURES={feather:3,sets:{
  full:{detail:{file:'detail-2048.webp',lon:[95,180],lat:[-5,62],size:[2048,1608]},world:{file:'world-2048.webp',lon:[-180,180],lat:[-90,90],size:[2048,1024]}},
  small:{detail:{file:'detail-1024.webp',lon:[95,180],lat:[-5,62],size:[1024,804]},world:{file:'world-1024.webp',lon:[-180,180],lat:[-90,90],size:[1024,512]}}}};
// small for a globe drawn under 1100 device px across (phones) or a connection that saves data or is slow
// WebGL drawn by the CPU (the GPU's renderer string names a software rasteriser): the globe keeps the still picture
// there, as a full-screen shader at 30 fps would load the whole page (also headless test browsers without a GPU)
const SOFTWARE_GL=/swiftshader|llvmpipe|softpipe|software|basic render driver/i;
function textureSet(R,dpr,conn){
  const d=2*R*Math.min(2,dpr||1),slow=!!conn&&(!!conn.saveData||/2g|3g/.test(conn.effectiveType||''));
  return d<=1100||slow?'small':'full';
}
const SHADE={light:[-.45,.55,.7],lo:-.35,hi:.8,min:.3,limbR:.86,limbMin:.5,air:[.275,.578,.807],airMax:1,airExp:2.5,airBack:.08,airR0:.82};
// How it moves, as offsets in degrees from the start pose (CAMERA). Korea (KOREA) never leaves the near side and, while
// the globe sways, stays within 6% of the screen width of its place (test_intro_ui.mjs checks every screen size):
// entry: from 18° further east, easing into the start pose over 2.4 s (the globe turns Korea into place);
// sway: ±4.5° of longitude and ±1.1° of latitude, sine waves of 52 s and 37 s, fading in over 4 s, never a full turn;
// drag: up to ±30° and ±15° under the pointer, then a short glide and 1.5 s back to the sway; leave: 0.3 s to the pose.
const MOTION={entry:{lon:18,ms:2400},sway:{lon:4.5,lat:1.1,lonMs:52000,latMs:37000,rampMs:4000},drag:{lon:30,lat:15},glideMs:400,backMs:1500,leaveMs:300,fps:30};
const easeOut=t=>1-Math.pow(1-Math.min(1,Math.max(0,t)),3);
const easeInOut=t=>{t=Math.min(1,Math.max(0,t));return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};
// t: ms since the turning globe first showed; withEntry: false when it came late (the still pose was already up)
function ambientAt(t,withEntry){
  const {entry:e,sway:w}=MOTION,from=withEntry?e.ms*.5:0,ramp=easeInOut((t-from)/w.rampMs),tau=2*Math.PI;
  return {lon:(withEntry?e.lon*(1-easeOut(t/e.ms)):0)+ramp*w.lon*Math.sin(tau*Math.max(0,t-from)/w.lonMs),lat:ramp*w.lat*Math.sin(tau*Math.max(0,t-from)/w.latMs)};
}
const cameraAt=off=>({lon0:CAMERA.lon0+off.lon,lat0:CAMERA.lat0+off.lat,P:CAMERA.P});
const clampDrag=off=>({lon:Math.min(MOTION.drag.lon,Math.max(-MOTION.drag.lon,off.lon)),lat:Math.min(MOTION.drag.lat,Math.max(-MOTION.drag.lat,off.lat))});
// px of pointer travel on a globe of radius R as degrees: the surface under the pointer follows it (drag right, the
// globe turns east-side forward; drag down, the north comes forward)
function dragDegrees(dx,dy,R,lat0){
  const k=R/Math.sqrt((CAMERA.P-1)/(CAMERA.P+1))*Math.PI/180;
  return {lon:-dx/k/Math.max(.2,Math.cos(lat0*Math.PI/180)),lat:dy/k};
}
// The shader. lonlat() is inversePerspective written with scalars only, so test_intro_ui.mjs runs the same text in node.
const GLOBE_VS='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const GLOBE_LONLAT=`vec2 lonlat(float x,float y){
  float r=0.017453292519943295;
  float f0=u_lat0*r;
  float s=sqrt((u_P-1.0)/(u_P+1.0));
  float X=x*s;
  float Y=y*s;
  float rho=max(sqrt(X*X+Y*Y),1e-7);
  float sinc=(u_P-sqrt(max(0.0,1.0-rho*rho*(u_P+1.0)/(u_P-1.0))))/((u_P-1.0)/rho+rho/(u_P-1.0));
  float cosc=sqrt(max(0.0,1.0-sinc*sinc));
  float lon=u_lon0+atan(X*sinc,rho*cos(f0)*cosc-Y*sin(f0)*sinc)/r;
  float lat=asin(clamp(cosc*sin(f0)+Y*sinc*cos(f0)/rho,-1.0,1.0))/r;
  return vec2(lon,lat);
}`;
const glf=v=>{const t=String(+v);return /[.e]/.test(t)?t:t+'.0';},glv=a=>`vec3(${a.map(glf).join(',')})`;
function globeShader(){
  const S=SHADE,n=Math.hypot(...S.light),l=S.light.map(v=>v/n),m=Math.hypot(l[0],l[1]);
  return `precision highp float;
uniform vec2 u_org,u_rc;uniform float u_scale,u_h,u_lon0,u_lat0,u_P,u_feather,u_alpha;uniform vec3 u_disc;uniform vec4 u_box;
uniform vec3 u_ring[${WAVE.rings}];
uniform sampler2D u_detail,u_world;
${GLOBE_LONLAT}
vec3 lin(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}
vec3 srgb(vec3 c){c=clamp(c,0.,1.);return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}
void main(){
  vec2 p=u_org+vec2(gl_FragCoord.x,u_h-gl_FragCoord.y)/u_scale;
  // the first visit's rings (u_ring: radius, push, half width in px round u_rc): each pushes the picture under it along
  // its radius, one way on its outer flank and the other on its inner, so the globe bends only where a ring passes
  vec2 dd=p-u_rc;float rr=length(dd),push=0.;
  for(int i=0;i<${WAVE.rings};i++){vec3 g=u_ring[i];float x=(rr-g.x)/g.z;push+=g.y*x*exp(-.5*x*x);}
  p-=dd/max(rr,1.)*push*1.6487;
  float u=(p.x-u_disc.x)/u_disc.z,v=(u_disc.y-p.y)/u_disc.z,r=sqrt(u*u+v*v);
  float cov=clamp((1.-r)*u_disc.z*u_scale+.5,0.,1.);
  vec2 q=r>1.?vec2(u,v)/r:vec2(u,v);
  vec2 ll=lonlat(q.x,q.y);
  vec3 c=lin(texture2D(u_world,vec2((ll.x+180.)/360.,(90.-ll.y)/180.)).rgb);
  vec3 d=lin(texture2D(u_detail,vec2((ll.x-u_box.x)/(u_box.y-u_box.x),(u_box.w-ll.y)/(u_box.w-u_box.z))).rgb);
  float e=min(min(ll.x-u_box.x,u_box.y-ll.x),min(ll.y-u_box.z,u_box.w-ll.y));
  c=mix(c,d,smoothstep(0.,u_feather,e));
  float s=sqrt((u_P-1.)/(u_P+1.)),X=q.x*s,Y=q.y*s,rho=max(sqrt(X*X+Y*Y),1e-7);
  float sinc=(u_P-sqrt(max(0.,1.-rho*rho*(u_P+1.)/(u_P-1.))))/((u_P-1.)/rho+rho/(u_P-1.)),z=sqrt(max(0.,1.-sinc*sinc));
  vec3 n=vec3(X*sinc/rho,Y*sinc/rho,z);
  float shade=${glf(S.min)}+${glf(1-S.min)}*smoothstep(${glf(S.lo)},${glf(S.hi)},dot(n,${glv(l)}));
  shade*=1.-${glf(1-S.limbMin)}*smoothstep(${glf(S.limbR)},1.,r);
  float ndv=(u_P*n.z-1.)/sqrt(n.x*n.x+n.y*n.y+(u_P-n.z)*(u_P-n.z));
  float side=(u*${glf(l[0]/m)}+v*${glf(l[1]/m)})/max(r,1e-9);
  float air=pow(clamp(1.-ndv,0.,1.),${glf(S.airExp)})*smoothstep(${glf(S.airR0)},1.,r)*(${glf(S.airBack)}+${glf(1-S.airBack)}*(side+1.)/2.);
  vec3 o=srgb(c*shade+${glv(S.air)}*air*${glf(S.airMax)});
  float a=cov*u_alpha;
  gl_FragColor=vec4(o*a,a);
}`;
}

// ---- browser ----
(()=>{
  if(typeof document==='undefined')return;
  const root=document.documentElement;
  let store=null,local=null;try{store=window.sessionStorage;}catch{}try{local=window.localStorage;}catch{}
  let nav='navigate';try{nav=visitorNav(navigationType(performance),store);}catch{}
  let show=false;try{show=shouldShowGate(location.hash+'&'+location.search.slice(1),store,nav);}catch{}
  try{store?.removeItem(HOME_KEY);}catch{} // used once: Back or the address opened again afterwards opens the map as before
  // A reload starts over: not entered in this tab yet (enter() remembers it again), and the address loses its tab before
  // app.js reads it (withoutTab). replaceState fires no hashchange, so the screen stays up. The browser would also scroll
  // the page behind back to where it was (a phone's explore list): held at the top while the screen is up (release()).
  let heldScroll=false;
  if(show&&nav==='reload'){try{store?.removeItem(GATE_KEY);}catch{}
    try{const rest=withoutTab(location.search,location.hash);if(rest!==location.search+location.hash)history.replaceState(history.state,'',location.pathname+rest);}catch{}
    try{if(history.scrollRestoration==='auto'){history.scrollRestoration='manual';heldScroll=true;}}catch{}}
  // The header logo links to this page without a hash ('./'), so the app also starts over (no species, tab or dialog).
  document.addEventListener('click',e=>{if(e.target.closest?.('a.brand')&&homeClick(e))try{store?.setItem(HOME_KEY,'1');}catch{}});
  if(!show)return;
  root.classList.add('gate-on');
  const stacked0=()=>matchMedia('(max-width:760px),(max-width:1100px) and (orientation:portrait)').matches;
  // The turning globe (TEXTURES): a WebGL context and the shader are made now, before the page is parsed, and its two
  // textures asked for, so they arrive while the first visit's words and drop are on (a shared link, no screen, never asks).
  // If any of it fails (no WebGL, the shader, a texture, a lost context) the still picture below is fetched instead.
  // shown: the globe is drawn (from the reveal on); opened: the entry screen is usable (the loader gone)
  let el=null,raf=0,canvas=null,ctx=null,shown=false,opened=false,left=false,dirty=true,fading=false,drawnPhoto=false,bg=null;
  // the first visit (INTRO_TIMELINE): t0 its first paint (performance.now() ms), readyAt when the globe was there (ms
  // from t0), failAt when the wait gives up, status the loader's globe line ('' | wait | fail); refr the rings that
  // bend the globe this frame (px round rc), over what is drawn over the globe (0..1)
  let t0=null,painted=false,marked=false,readyAt=null,failAt=INTRO_TIMELINE.timeout,status='',stillFailed=false,retries=0,refr=[],rc={x:0,y:0},over=1;
  // the motion (MOTION): offset is this frame's degrees from the start pose; clock the ms of motion so far
  let offset={lon:0,lat:0},clock=0,last=0,lastDraw=0,prevFrame=0,withEntry=true,started=false,drag=null,back=null,leave=null,slow=0,shownAt=0,glScale=1;
  const G={c:null,gl:null,prog:null,buf:null,tex:{},u:{},img:{},left:2,ready:false,failed:false,at:0,box:null};
  // The still picture (vendor/globe-v2, scripts/bake_globe.py) for screens without WebGL: its size comes from the globe
  // this window will draw (the stacked query is intro.css's). Until it is there, or if it fails, the vector globe below.
  let photo=null,photoAt=0,img=null;
  function loadStill(again){
    if(photo||left||(img&&!again))return;
    if(img){img.onload=img.onerror=null;img=null;}
    stillFailed=false;
    try{
      const file=globeFile(globeFrame(innerWidth,innerHeight,stacked0()?{top:0,bottom:0}:null).R,devicePixelRatio,navigator.connection);
      img=new Image();img.decoding='async';img.fetchPriority='high';
      img.onload=()=>img.decode().then(()=>{if(left||!img)return;photo={img,pad:GLOBE_PAD[file]/file};photoAt=shown?performance.now():0;
        performance.mark?.('bbvm-globe-decoded');kick();},()=>{img=null;stillFailed=true;kick();});
      img.onerror=()=>{img=null;stillFailed=true;kick();};
      img.src=`vendor/globe-v2/globe-${file}.webp`+(again?`?retry=${retries}`:''); // a retry asks past a failed answer
    }catch{img=null;stillFailed=true;}
  }
  function glFail(){
    if(G.failed||left)return;G.failed=true;G.ready=false;freeGL();drag=back=leave=null;
    performance.mark?.('bbvm-globe-gl-failed');loadStill();kick();
  }
  function freeGL(){
    const gl=G.gl;G.gl=null;
    G.c?.removeEventListener('webglcontextlost',glFail); // letting go on purpose below is not a failure
    if(gl){try{for(const t of Object.values(G.tex))gl.deleteTexture(t);gl.deleteBuffer(G.buf);gl.deleteProgram(G.prog);gl.getExtension('WEBGL_lose_context')?.loseContext();}catch{}}
    if(G.c){G.c.width=G.c.height=0;G.c=null;}
    for(const i of Object.values(G.img)){i.onload=i.onerror=null;}G.img={};G.tex={};
  }
  function initGL(){
    // failIfMajorPerformanceCaveat: no context where WebGL would run on the CPU (a software renderer, a blocked GPU);
    // there a full-screen shader at 30 fps would load the whole page, so those screens keep the still picture
    const c=document.createElement('canvas'),o={alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,failIfMajorPerformanceCaveat:true};
    const gl=c.getContext('webgl2',o)||c.getContext('webgl',o);
    if(!gl)throw Error('no WebGL');
    if(!gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT)?.precision)throw Error('no highp');
    const dbg=gl.getExtension('WEBGL_debug_renderer_info');
    if(dbg&&SOFTWARE_GL.test(String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))))throw Error('software renderer');
    const sh=(type,src)=>{const x=gl.createShader(type);gl.shaderSource(x,src);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(x));return x;};
    const prog=gl.createProgram(),vs=sh(gl.VERTEX_SHADER,GLOBE_VS),fs=sh(gl.FRAGMENT_SHADER,globeShader());
    gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.bindAttribLocation(prog,0,'a');gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));
    gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(prog);
    G.buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,G.buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    for(const k of ['u_org','u_scale','u_h','u_lon0','u_lat0','u_P','u_feather','u_alpha','u_disc','u_box','u_detail','u_world','u_rc','u_ring'])G.u[k]=gl.getUniformLocation(prog,k);
    gl.uniform1i(G.u.u_detail,0);gl.uniform1i(G.u.u_world,1);
    c.addEventListener('webglcontextlost',glFail);
    Object.assign(G,{c,gl,prog});
    const set=TEXTURES.sets[textureSet(globeFrame(innerWidth,innerHeight,stacked0()?{top:0,bottom:0}:null).R,devicePixelRatio,navigator.connection)];
    const d=set.detail;G.box=[d.lon[0],d.lon[1],d.lat[0],d.lat[1]];
    ['detail','world'].forEach((k,unit)=>{
      const im=new Image();im.decoding='async';im.fetchPriority='high';G.img[k]=im;
      im.onload=()=>im.decode().then(()=>{
        if(left||!G.gl)return;
        const t=gl.createTexture(),pot=n=>(n&(n-1))===0,gl2=typeof WebGL2RenderingContext!=='undefined'&&gl instanceof WebGL2RenderingContext;
        const mip=gl2||(pot(im.width)&&pot(im.height));
        gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,im);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,k==='world'&&pot(im.width)?gl.REPEAT:gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        if(mip)gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,mip?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);
        G.tex[k]=t;im.onload=null;
        if(--G.left===0){G.ready=true;G.at=shown?performance.now():0;performance.mark?.('bbvm-globe-gl-ready');kick();}
      },glFail);
      im.onerror=glFail;
      im.src=`vendor/globe-v3/${set[k].file}`;
    });
  }
  try{initGL();}catch{G.failed=true;freeGL();loadStill();}
  const gate=makeGate(performance.now());
  let reduce=false;try{reduce=motionPref(local?.getItem(MOTION_KEY),matchMedia('(prefers-reduced-motion: reduce)').matches);}catch{}
  const inerted=[];let observer=null;
  const touch=()=>matchMedia('(pointer:coarse)').matches; // a phone: no focus ring on the button, no keyboard popping up in search

  // The vector globe (until a picture is in, or if both fail): projected once in the start pose. What is drawn over the
  // globe (Korea's coast, the cells, the study frame, the card's point) keeps its longitude and latitude and is projected
  // with each frame's camera, so it turns with the globe.
  const prep=(rings,cut)=>rings.map(r=>r.map((p,i)=>({...project(p[0],p[1],true),cut:i>0&&cutEdge(r[i-1],p,cut),cell:cellOf(p)})));
  let land=null,borders=[],depth=[],kr=[],krCells=new Set(),krCoast=[],cells=[],failed=false,frame=null,card=null,size={w:0,h:0,dpr:1};
  const box=(()=>{const [a,b]=STUDY,o=[];
    for(let x=a[0];x<=b[0];x+=.5)o.push([x,a[1]]);for(let y=a[1];y<=b[1];y+=.3)o.push([b[0],y]);
    for(let x=b[0];x>=a[0];x-=.5)o.push([x,b[1]]);for(let y=b[1];y>=a[1];y-=.3)o.push([a[0],y]);return o;})();
  // The files load only now that the screen shows (a shared link never fetches them); each may fail on its own. Without
  // land the globe stays a plain sphere; the copy, the card and every way in work the same.
  const getJSON=u=>fetch(u).then(r=>{if(!r.ok)throw Error(u);return r.json();});
  Promise.allSettled(['vendor/globe-v1/land-50m.json','vendor/globe-v1/bathymetry-10m.json'].map(getJSON)).then(([l,b])=>{
    try{
      if(l.status!=='fulfilled')throw l.reason;
      land=prep(decodeRings(l.value.land,l.value.scale),l.value.cut);borders=prep(decodeRings(l.value.borders,l.value.scale),l.value.cut);
      if(b.status==='fulfilled')depth=['200','2000'].map(k=>prep(decodeRings(b.value.depth[k],b.value.scale),b.value.cut));
    }catch{failed=true;}
    kick();
  });

  const fail=()=>{left=true;cancelAnimationFrame(raf);root.classList.remove('gate-on','gate-leaving');if(el)el.hidden=true;release();freeGL();};
  // A shared link opened in this tab while the screen is up changes only the hash (no reload): it skips the screen, as the
  // same link does on a fresh load, and app.js applies its tab and species underneath (its own hashchange listener).
  addEventListener('hashchange',()=>{if(!left&&hasAppHash(location.hash))fail();});
  addEventListener('bbvm:progress',e=>{try{
    const d=e.detail||{};
    if(d.step==='map'&&d.geography){const r=geographyRings(d.geography,.08,COUNTRIES_CUT),bv=borderVertices(d.geography);kr=prep(r,COUNTRIES_CUT);krCells=new Set(r.flat().map(cellOf));
      // Korea's coast over the picture: segments with both ends near Korea, not both on a land border
      krCoast=r.flatMap(ring=>ring.slice(1).map((p,i)=>[ring[i],p]).filter(([a,b])=>nearKorea(a)&&nearKorea(b)&&!(bv.has(a.join())&&bv.has(b.join()))));}
    if(d.step==='done'&&Array.isArray(d.cells))cells=d.cells.map(c=>[[c.lon,c.lat],[c.lon+c.size,c.lat],[c.lon+c.size,c.lat+c.size],[c.lon,c.lat+c.size]]);
    if(d.step==='sources')gate.sources=evidenceSourceCount(d.license);
    gateProgress(gate,d.step,d.step==='done'?d:null);
    if(el){render();kick();}
  }catch{fail();}});

  function hold(node){if(node===el||node.tagName==='SCRIPT'||node.tagName==='LINK'||node.inert)return;node.inert=true;node.setAttribute('aria-hidden','true');inerted.push(node);}
  function release(){observer?.disconnect();for(const n of inerted.splice(0)){n.inert=false;n.removeAttribute('aria-hidden');}
    if(heldScroll){heldScroll=false;try{history.scrollRestoration='auto';}catch{}}} // Back to this page restores as before
  const q=s=>el.querySelector(s);

  function render(){
    // the step line: the data's step, or past total the wait for the globe; on failure the line gives way to the retry
    const step=q('.gate-step');step.textContent=status==='wait'?GLOBE_WAIT:gateStep(gate);step.hidden=status==='fail';q('.gate-fail').hidden=status!=='fail';
    const note=gateNote(gate);q('.gate-note').textContent=note;q('.gate-note').hidden=!note;
    q('.gate-counts').textContent=countsLine(gate.done);
    const total=speciesTotal(gate.done);if(total)for(const b of el.querySelectorAll('.gate-total'))b.textContent=String(total); // the solution line and '다음 단계' (#4)
    if(gate.sources!==undefined){const li=q('.gate-src');li.classList.remove('is-wait');li.hidden=gate.sources===null;
      if(gate.sources)q('.gate-src-n').textContent=String(gate.sources);}
    renderUseSpecies();
  }
  // 2026-10-17 (#3): the policy card under the first screen names the species of the conservation example (app.js gateExamples)
  function renderUseSpecies(){
    const sp=q('.gate-use-sp');if(!gate.done||!sp||sp.dataset.filled)return;sp.dataset.filled='1';
    const all=Array.isArray(gate.done.examples)?gate.done.examples:[];
    const red=exampleLinks(all.find(x=>x?.kind==='conservation'));if(red.length)sp.textContent=`(${red.map(l=>l.name).join('·')})`;
  }
  // The globe is there and the opening starts (reveal[0], or later with a late globe): it is drawn under the loader from
  // now on, the loader opens round the drop (drawIntro), and the entry screen is usable at introEnd (showHero). One
  // reveal: the globe does not fade in again after it.
  function reveal(now){
    shown=true;shownAt=now;dirty=true;render();
    el.classList.add('is-revealing');q('.gate-loader').setAttribute('aria-hidden','true');
  }
  // keep: the visitor moved the focus into the entry screen themselves (the piece is skipped), so it stays where it went
  function showHero(keep){
    if(opened||left)return;opened=true;gate.phase='ready';refr=[];over=1;dirty=true;
    el.classList.remove('is-revealing');el.classList.add('is-ready');el.removeAttribute('aria-busy');
    const loader=q('.gate-loader');loader.hidden=true;loader.style.opacity='';loader.style.webkitMaskImage=loader.style.maskImage='';
    rip.hidden=true;rip.width=rip.height=0;render();
    performance.mark?.('intro:done');
    const hero=q('.gate-hero');hero.removeAttribute('aria-hidden');
    if(keep)return kick();
    // keyboard and mouse: focus the button (Enter/Space act on it), its ring shown only once the keyboard is used (html.kb);
    // touch: the screen itself, so no focus ring on a tap device
    if(!touch())q('#gate-enter').focus({preventScroll:true});else{hero.tabIndex=-1;hero.focus({preventScroll:true});}
    kick();
  }
  // The keyboard reached the entry screen during the piece (it is never kept from it): the piece ends at once.
  function skipIntro(){if(opened||left)return;if(!shown)reveal(performance.now());showHero(true);}
  // One way in, whichever button: 'explore' (default), 'compare' or 'method'. The app keeps its own state (species,
  // chips, map view); only the tab changes, through app.js setView (deferred, so it is there once the screen is ready).
  // how.hash: an example card's species link (#1); how.table: a use card's type in the data table (#3)
  function enter(target,how={}){
    if(left||!opened)return;left=true;
    try{store?.setItem(GATE_KEY,'1');}catch{}
    const finish=()=>{
      cancelAnimationFrame(raf);raf=0;leave=null;root.classList.remove('gate-on','gate-leaving');el.hidden=true;release();scrollTo(0,0);
      canvas.width=canvas.height=0;if(bg)bg.width=bg.height=0;bg=null;photo=img=null;freeGL(); // not needed again: give the memory back
      dispatchEvent(new Event('resize')); // Leaflet re-measures its box in case the layout moved underneath
      const a=arrival(target,touch());
      // a species link (#s=…): the app's own link handling (applyHash) picks its species and tab, at once; a hash set here would be
      // written over by setView before its hashchange arrived
      if(how.hash&&typeof applyHash==='function')applyHash(Object.fromEntries(new URLSearchParams(how.hash.slice(1))));
      if(a.view!=='explore'&&typeof setView==='function')setView(a.view,!a.scroll);
      // a use card: the type card's own '더 보기' in 비교와 지표 (data table, that type, scrolled to it)
      if(how.table)document.querySelector(`#matrix-types [data-mt-table="${how.table}"]`)?.click();
      if(a.scroll)document.querySelector(a.scroll)?.scrollIntoView({block:'start',behavior:reduce?'auto':'smooth'});
      const t=document.querySelector(a.focus)||document.querySelector('main');if(!t)return;
      t.closest('details')?.setAttribute('open',''); // the source list sits in a fold (2026-10-17 #9): the way in opens it
      if(t.tagName==='MAIN'){t.tabIndex=-1;t.addEventListener('blur',()=>t.removeAttribute('tabindex'),{once:true});}
      t.focus({preventScroll:true});
    };
    drag=back=null;
    if(reduce)return finish();
    // the globe gathers to its start pose in 0.3 s while the screen leans in toward Korea
    if(turning()){leave={at:performance.now(),from:offset};raf||(raf=requestAnimationFrame(frameLoop));}
    root.classList.add('gate-leaving');setTimeout(finish,820);
  }

  // Where the globe, the card and its leader line go for this screen (the start pose). Side by side the card is placed
  // here; stacked, CSS puts it under the globe band. The line is drawn each frame from wherever the point is.
  // the copy lines as drawn (the text, not the full-width block boxes) for the globe to keep clear of
  const textBox=n=>{const r=document.createRange();r.selectNodeContents(n);const b=r.getBoundingClientRect();return {r:b.right,t:b.top,b:b.bottom};};
  const copyBoxes=(sy=0)=>[...q('.gate-title').children].map(s=>({...textBox(s),title:true}))
    .concat([...el.querySelectorAll('.gate-why-k,.gate-problems li,.gate-lead,.gate-more,.gate-note,.gate-counts')].filter(n=>n.getClientRects().length).map(textBox))
    .map(b=>({...b,t:b.t+sy,b:b.b+sy}));
  // 2026-10-17 (#3): side by side the screen scrolls on to the uses below; the globe (the canvas, outside the scrolling hero)
  // rides up with the first screen. Frame and card stay in first-screen coordinates; the canvas is lifted by the scroll.
  let stackedNow=false,lift=0;
  function ride(){lift=stackedNow?0:q('.gate-hero').scrollTop;canvas.style.translate=lift?`0 ${-lift}px`:'';}
  function layout(){
    const w=innerWidth,h=innerHeight,band=q('.gate-globe'),call=q('.gate-callout'),bar=q('.gate-bar').getBoundingClientRect();
    const stacked=getComputedStyle(band).display!=='none',b=band.getBoundingClientRect(),sy=stacked?0:q('.gate-hero').scrollTop;
    stackedNow=stacked;ride();
    frame=globeFrame(w,h,stacked?{top:b.top,bottom:b.bottom}:null,stacked?[]:copyBoxes(sy));
    const {cx,cy,R}=frame,at=(lon,lat)=>{const p=project(lon,lat);return {x:cx+p.x*R,y:cy-p.y*R};};
    const dot=at(...ANCHOR),k=at(...KOREA),c=call.getBoundingClientRect(),s=Math.min(1.2,Math.max(.75,R/733));
    if(!call.getClientRects().length)card=null; // a short screen hides the card
    else if(stacked){const r=q('.gate-card').getBoundingClientRect();card={x:r.left,y:r.top,w:r.width,h:r.height,under:true,s};}
    else{const p=cardPlace(dot,k,{w:c.width,h:c.height},{w,top:bar.bottom+sy,bottom:q('.gate-foot').getBoundingClientRect().top+sy},s);
      call.style.left=p.x+'px';call.style.top=p.y+'px';card={x:p.x,y:p.y,w:c.width,h:c.height,under:!!p.under,s};}
    el.style.setProperty('--kx',k.x+'px');el.style.setProperty('--ky',k.y+'px'); // the leave zoom heads for Korea
  }
  function resize(){
    const dpr=Math.min(2,devicePixelRatio||1),w=innerWidth,h=innerHeight;
    if(w===size.w&&h===size.h&&dpr===size.dpr)return;
    size={w,h,dpr};canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  }
  // The vector globe, drawn until the picture is in or if it fails: sea by depth (shelf under 200 m, slope to 2000 m,
  // deep), land a shade above the deep sea, coasts and borders, light from the upper left.
  const SEA={shelf:'#2a6c76',slope:'#154364',deep:'#0c2846',land:'#1c2a35'};
  function vectorGlobe(X,Y,cx,cy,R,geo){
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.fillStyle=geo&&depth.length?SEA.shelf:SEA.deep;ctx.fill();ctx.clip();
    const fill=(rings,color)=>{ctx.beginPath();for(const r of rings){r.forEach((p,i)=>i?ctx.lineTo(X(p),Y(p)):ctx.moveTo(X(p),Y(p)));ctx.closePath();}ctx.fillStyle=color;ctx.fill('evenodd');};
    // coasts and borders stop at the horizon and never trace a file's own cut; around Korea the finer countries.json draws them
    const stroke=(rings,color,lw,skipKR)=>{ctx.beginPath();for(const r of rings){let on=false,prev=null;for(const p of r){
      if(p.back){on=false;continue;}if(on&&!p.cut&&!(skipKR&&krCells.has(p.cell)&&krCells.has(prev.cell)))ctx.lineTo(X(p),Y(p));else ctx.moveTo(X(p),Y(p));on=true;prev=p;}}
      ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.stroke();};
    if(geo){
      if(depth.length){fill(depth[0],SEA.slope);fill(depth[1],SEA.deep);}
      fill(land,SEA.land);fill(kr,SEA.land);
      stroke(borders,'rgba(255,255,255,.1)',.6,true);stroke(land,'rgba(255,255,255,.18)',.6,true);stroke(kr,'rgba(255,255,255,.18)',.7,false);
    }
    const shade=ctx.createRadialGradient(cx-R*.32,cy-R*.4,R*.05,cx,cy,R);
    shade.addColorStop(0,'rgba(150,220,215,.12)');shade.addColorStop(.6,'rgba(3,12,21,0)');shade.addColorStop(.88,'rgba(3,12,21,.3)');shade.addColorStop(1,'rgba(3,12,21,.72)');
    ctx.fillStyle=shade;ctx.fillRect(cx-R,cy-R,R*2,R*2);ctx.restore();
    const rim=ctx.createLinearGradient(cx-R*.75,cy-R*.75,cx+R*.6,cy+R*.6);
    rim.addColorStop(0,'rgba(175,228,242,.6)');rim.addColorStop(1,'rgba(175,228,242,.06)');
    ctx.beginPath();ctx.arc(cx,cy,R-.75,0,Math.PI*2);ctx.strokeStyle=rim;ctx.lineWidth=1.5;ctx.stroke();
  }
  // the air outside the rim: a soft blue glow out to 6% of the radius (faint past 2.4%, where the copy may come),
  // brightest on the lit upper left, faded on the far side (no stars, no space), and the dark disc under the globe. The
  // same every frame, so it is drawn once per layout onto its own canvas.
  function background(){
    const {w,h,dpr}=size,{cx,cy,R}=frame;
    if(!bg)bg=document.createElement('canvas');
    if(bg.width!==canvas.width||bg.height!==canvas.height){bg.width=canvas.width;bg.height=canvas.height;}
    const b=bg.getContext('2d');b.setTransform(dpr,0,0,dpr,0,0);b.clearRect(0,0,w,h);
    const glow=b.createRadialGradient(cx,cy,R*.97,cx,cy,R*1.06),side=b.createLinearGradient(cx-R*.75,cy-R*.75,cx+R*.6,cy+R*.6);
    glow.addColorStop(0,'rgba(143,200,232,.75)');glow.addColorStop(.35,'rgba(143,200,232,.3)');glow.addColorStop(.6,'rgba(143,200,232,.1)');glow.addColorStop(1,'rgba(143,200,232,0)');
    side.addColorStop(0,'#000');side.addColorStop(1,'rgba(0,0,0,.12)');
    b.fillStyle=glow;b.fillRect(cx-R*1.06,cy-R*1.06,R*2.12,R*2.12);
    b.save();b.shadowColor='rgba(143,200,232,.5)';b.shadowBlur=R*.03*dpr; // shadowBlur is in device pixels
    b.beginPath();b.arc(cx,cy,R*.995,0,Math.PI*2);b.fillStyle='#0a2032';b.fill();b.restore();
    b.globalCompositeOperation='destination-in';b.fillStyle=side;b.fillRect(0,0,w,h);b.globalCompositeOperation='source-over';
  }
  // The turning globe for this frame's camera: only the part of the disc on screen, at most 2400 device px across
  // (lower if frames run slow), drawn into the screen's canvas like the picture is.
  function glDraw(cam,alpha){
    const gl=G.gl,{w,h,dpr}=size,{cx,cy,R}=frame,sc=Math.min(dpr,2400/(2*R))*glScale;
    const x0=Math.max(0,Math.floor(cx-R-1)),y0=Math.max(0,Math.floor(cy-R-1)),x1=Math.min(w,Math.ceil(cx+R+1)),y1=Math.min(h,Math.ceil(cy+R+1));
    if(x1<=x0||y1<=y0)return;
    const W=Math.ceil((x1-x0)*sc),H=Math.ceil((y1-y0)*sc);
    if(G.c.width!==W||G.c.height!==H){G.c.width=W;G.c.height=H;}
    gl.viewport(0,0,W,H);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    const u=G.u;gl.uniform2f(u.u_org,x0,y0);gl.uniform1f(u.u_scale,W/(x1-x0));gl.uniform1f(u.u_h,H);
    gl.uniform3f(u.u_disc,cx,cy,R);gl.uniform1f(u.u_lon0,cam.lon0);gl.uniform1f(u.u_lat0,cam.lat0);gl.uniform1f(u.u_P,cam.P);
    gl.uniform4f(u.u_box,...G.box);gl.uniform1f(u.u_feather,TEXTURES.feather);gl.uniform1f(u.u_alpha,1);
    // the first visit's rings (none once it is over: every push 0)
    const rings=new Float32Array(3*WAVE.rings);for(let i=0;i<WAVE.rings;i++){const g=refr[i];rings.set(g?[g.r,g.push,g.w]:[0,0,1],3*i);}
    gl.uniform2f(u.u_rc,rc.x,rc.y);gl.uniform3fv(u.u_ring,rings);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,G.tex.detail);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,G.tex.world);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    ctx.globalAlpha=alpha;ctx.drawImage(G.c,x0,y0,x1-x0,y1-y0);ctx.globalAlpha=1;
  }
  const turning=()=>G.ready&&!G.failed&&!!G.gl;
  // The still picture under the first visit's rings: drawn whole, then again in thin rings round rc, each scaled about rc
  // by the push at its radius (what the shader does per pixel), only over the band where some ring pushes.
  function bent(src,x,y,w,h){
    ctx.drawImage(src,x,y,w,h);
    if(!refr.length)return;
    const lo=Math.min(...refr.map(g=>g.r-3*g.w)),hi=Math.max(...refr.map(g=>g.r+3*g.w));
    const near=Math.hypot(Math.max(x-rc.x,0,rc.x-x-w),Math.max(y-rc.y,0,rc.y-y-h));
    const far=Math.hypot(Math.max(Math.abs(x-rc.x),Math.abs(x+w-rc.x)),Math.max(Math.abs(y-rc.y),Math.abs(y+h-rc.y)));
    const a0=Math.max(1,lo,near),a1=Math.min(hi,far),step=Math.max(2,(a1-a0)/160);
    for(let a=a0;a<a1;a+=step){
      const m=a+step/2;let push=0;for(const g of refr){const q=(m-g.r)/g.w;push+=g.push*q*Math.exp(-.5*q*q);}push*=1.6487;
      if(Math.abs(push)<.15)continue;
      const k=m/Math.max(1,m-push);
      ctx.save();ctx.beginPath();ctx.arc(rc.x,rc.y,a+step+.5,0,2*Math.PI);ctx.arc(rc.x,rc.y,Math.max(0,a-.5),0,2*Math.PI,true);ctx.clip();
      ctx.translate(rc.x,rc.y);ctx.scale(k,k);ctx.translate(-rc.x,-rc.y);ctx.drawImage(src,x,y,w,h);ctx.restore();
    }
  }
  function draw(){
    const {w,h,dpr}=size,{cx,cy,R}=frame,X=p=>cx+p.x*R,Y=p=>cy-p.y*R,geo=land&&!failed,gl=turning();
    const cam=gl?cameraAt(offset):CAMERA,at=(lon,lat,rim)=>project(lon,lat,rim,cam);
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.globalAlpha=1;
    if(!bg)background();
    ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(bg,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);
    // the globe: the turning one or the picture (faded in over 0.6 s if it comes after the screen is up), the vector
    // globe until then
    const t=gl?(reduce||!G.at?1:Math.min(1,(performance.now()-G.at)/600)):photo?(reduce?1:Math.min(1,(performance.now()-photoAt)/600)):0;
    if(t<1)vectorGlobe(X,Y,cx,cy,R,geo);
    if(gl){
      try{glDraw(cam,t);}catch{glFail();return draw();}
      if(t>=1&&!drawnPhoto){drawnPhoto=true;performance.mark?.('bbvm-globe-drawn');}
    }else if(photo){
      try{const s=R*(1+2*photo.pad);ctx.globalAlpha=t;bent(photo.img,cx-s,cy-s,2*s,2*s);}
      catch{photo=img=null;return draw();} // a picture that does not draw: the vector globe
      finally{ctx.globalAlpha=1;}
      if(t>=1&&!drawnPhoto){drawnPhoto=true;performance.mark?.('bbvm-globe-drawn');}
    }
    fading=t<1&&(gl||!!photo);
    // what is drawn over the globe takes no refraction: during the first visit it comes in as the rings calm (over)
    ctx.globalAlpha=over;
    if(gl||photo){
      // over the picture, only Korea's coast, a hairline (the land borders and the wider coasts are left to the picture)
      ctx.beginPath();for(const [p,o] of krCoast){const a=at(p[0],p[1]),b=at(o[0],o[1]);if(a&&b){ctx.moveTo(X(a),Y(a));ctx.lineTo(X(b),Y(b));}}
      ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=.7;ctx.stroke();
    }
    if(!geo&&!photo&&!gl)return;
    // the public cells the app loaded, every one alike (never shaded by record counts): a faint fill, a glow inside the
    // cells, a fine outline; overlapping 1° and 4° sides are one path, so drawn once
    const boxes=cells.map(b=>b.map(p=>at(p[0],p[1]))).filter(b=>b.every(Boolean));
    if(boxes.length){
      ctx.beginPath();for(const b of boxes){b.forEach((p,i)=>i?ctx.lineTo(X(p),Y(p)):ctx.moveTo(X(p),Y(p)));ctx.closePath();}
      ctx.fillStyle='rgba(140,215,208,.08)';ctx.fill();
      ctx.save();ctx.clip();ctx.shadowColor='rgba(140,215,208,.7)';ctx.shadowBlur=8*dpr;ctx.strokeStyle='rgba(140,215,208,.22)';ctx.lineWidth=2;ctx.stroke();ctx.restore();
      ctx.strokeStyle='rgba(140,215,208,.55)';ctx.lineWidth=.9;ctx.stroke();
    }
    // the map's study frame
    ctx.beginPath();box.map(p=>at(p[0],p[1],true)).forEach((p,i)=>i?ctx.lineTo(X(p),Y(p)):ctx.moveTo(X(p),Y(p)));ctx.closePath();
    ctx.setLineDash([3,5]);ctx.strokeStyle='rgba(140,215,208,.4)';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
    // the card's point, carried by the globe, and its line to the card, which stays put
    const d=at(...ANCHOR);
    if(!card||!d)return;
    const lead=leadLine({x:X(d),y:Y(d)},card,card.s);
    ctx.beginPath();lead.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.strokeStyle='rgba(255,255,255,.42)';ctx.lineWidth=1;ctx.stroke();
    const [dx,dy]=lead[0];
    ctx.beginPath();ctx.arc(dx,dy,10,0,Math.PI*2);ctx.fillStyle='rgba(223,160,100,.2)';ctx.fill();
    ctx.beginPath();ctx.arc(dx,dy,4,0,Math.PI*2);ctx.fillStyle='#dfa064';ctx.fill();
  }
  function paint(){
    try{draw();}catch{failed=true;try{draw();}catch{}} // a drawing error leaves the plain sphere, never the screen
  }

  // The motion (MOTION). offset: degrees from the start pose this frame. clock: ms of motion, which stands still while
  // the tab is hidden or the switch says still. Frames run while something moves: at 30 fps for the sway, at the
  // screen's rate while dragged, gliding back or leaving; never once the screen is gone.
  function advance(now){
    const dt=last?Math.min(100,now-last):0;last=now;
    if(!turning())return offset={lon:0,lat:0},false;
    // came in with the screen: the entry turn; came later (the still pose was up): straight into the sway
    if(!started){started=true;withEntry=!reduce&&now-shownAt<300;clock=0;}
    const still=reduce||document.hidden;
    if(!still&&shown)clock+=dt;
    const amb=reduce?{lon:0,lat:0}:ambientAt(clock,withEntry);
    if(leave){const k=easeOut((now-leave.at)/MOTION.leaveMs);offset={lon:leave.from.lon*(1-k),lat:leave.from.lat*(1-k)};return k<1;}
    if(drag)return offset=drag.off,true;
    if(back){
      const t=now-back.at,g=MOTION.glideMs,tau=g/3,f=tau*(1-Math.exp(-Math.min(t,g)/tau));
      const glide=clampDrag({lon:back.from.lon+back.v.lon*f,lat:back.from.lat+back.v.lat*f});
      const k=easeInOut((t-g)/MOTION.backMs);
      offset={lon:glide.lon+(amb.lon-glide.lon)*k,lat:glide.lat+(amb.lat-glide.lat)*k};
      if(k>=1)back=null;
      return true;
    }
    offset=amb;
    return !still&&shown;
  }
  const kick=()=>{dirty=true;if(el&&!raf&&!left)raf=requestAnimationFrame(frameLoop);};
  // Runs every frame while the loader shows (the first visit's piece) and while the globe moves; otherwise only when
  // kicked by a resize, new data or the motion switch.
  function frameLoop(now){
    raf=0;if(left&&!leave)return;
    if(!opened)tick(now);
    const moving=shown&&advance(now),fast=!!(drag||back||leave);
    // a slow GPU shows as frames coming late while the globe moves: then it is drawn at a lower resolution
    if(moving&&prevFrame){slow=now-prevFrame>45?slow+1:Math.max(0,slow-1);if(slow>10&&glScale>.5){glScale=Math.max(.5,glScale-.15);slow=0;}}
    prevFrame=moving?now:0;
    // during the first visit the globe is drawn every frame (the rings bend it); afterwards only while something changes
    if(shown&&(dirty||fast||fading||!opened||(moving&&now-lastDraw>=1000/MOTION.fps-4))){
      if(dirty){dirty=false;resize();layout();bg=null;}
      paint();lastDraw=now;
    }
    if(!opened||moving||dirty||fading)raf=requestAnimationFrame(frameLoop);
  }

  // The first visit (INTRO_TIMELINE), once a frame (and by timers in a hidden tab, which draws no frames): the time since
  // the first paint, the globe's readiness, the opening, the end; then the drop and the rings on their canvas over the
  // loader, the loader's opening and words. The data's progress events change only the words of the step line.
  const globeReady=()=>turning()||!!photo, globeFailed=()=>G.failed&&stillFailed;
  function tick(now){
    if(t0===null)startAt(now);
    const t=now-t0;
    if(!marked&&(painted||t>=INTRO_TIMELINE.drop[0])){marked=true;try{performance.mark('intro:start',{startTime:t0});}catch{performance.mark?.('intro:start');}}
    if(readyAt===null&&globeReady())readyAt=t;
    if(!shown&&readyAt!==null&&t>=Math.max(INTRO_TIMELINE.reveal[0],readyAt))reveal(now);
    if(introDone(t,readyAt))return showHero();
    const st=introStatus(t,readyAt,globeFailed(),failAt);
    if(st!==status){status=st;render();}
    try{drawIntro(t);}catch{} // a drawing error leaves the loader without its rings, never the loader
  }
  // t0: the loader's first paint. Frames can run before anything is painted (the first ones here came half a second
  // early), so the first frame only stands in until the browser's paint record arrives, which then sets t0 while the
  // words still stand (before drop[0]); marked intro:start once known.
  function startAt(at,paint){
    if(painted||(t0!==null&&!paint)||(t0!==null&&performance.now()-t0>=INTRO_TIMELINE.drop[0]))return;
    t0=at;painted=!!paint;
  }
  let rip=null,rctx=null,ripKey='',lastMask='';
  function drawIntro(t){
    const dpr=Math.min(2,devicePixelRatio||1),w=innerWidth,h=innerHeight,W=Math.round(w*dpr),H=Math.round(h*dpr),loader=q('.gate-loader'),body=q('.gate-loader-body');
    if(rip.width!==W||rip.height!==H){rip.width=W;rip.height=H;}
    // the drop's place: for this screen size, settled once the drop starts falling (a late web font moves the words)
    const key=w+'x'+h;if(key!==ripKey||t<INTRO_TIMELINE.drop[0]){ripKey=key;rc=rippleCenter(w,h,stacked0(),body.getBoundingClientRect().bottom);}
    const D=rippleReach(rc,w,h);
    rctx.setTransform(dpr,0,0,dpr,0,0);rctx.clearRect(0,0,w,h);
    if(reduce){refr=[];const o=crossfadeAt(t,readyAt);over=1-o;return setLoader(loader,body,o,null,1);}
    const amp=Math.max(.6,Math.min(1,w/1440)),rings=ripplesAt(t,D),v=revealAt(t,D,readyAt);
    refr=rings.map(g=>({r:g.r,push:g.k*WAVE.refract*amp,w:g.w}));over=v.over;
    setLoader(loader,body,1,v,v.words);
    const d=dropAt(t,rc,h);if(d)drawDrop(d);
    for(const g of rings)drawRing(g,t,amp);
  }
  // The loader's opening: a wide soft-edged disc round the drop (clear inside r−F, whole from r, smootherstep between), its
  // opacity when still, its words; written only when they change.
  function setLoader(loader,body,o,v,words){
    let m='';
    if(v&&v.r>0){const {r,F}=v,st=(f,a)=>`rgba(0,0,0,${a}) ${(r-F*f).toFixed(1)}px`;
      m=`radial-gradient(circle at ${rc.x.toFixed(1)}px ${rc.y.toFixed(1)}px,${st(1,0)},${st(.75,.1)},${st(.5,.5)},${st(.25,.9)},${st(0,1)})`;}
    const key=m+'|'+o.toFixed(3)+'|'+words.toFixed(3);if(key===lastMask)return;lastMask=key;
    loader.style.webkitMaskImage=loader.style.maskImage=m;
    loader.style.opacity=o<1?o.toFixed(3):'';body.style.opacity=words<1?words.toFixed(3):'';
  }
  // The drop: a small soft light, a little longer than wide while it falls; where it went in, a small light that fades.
  function drawDrop(d){
    const glow=(x,y,r,a,sy)=>{const g=rctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,`rgba(214,244,240,${(.85*a).toFixed(3)})`);g.addColorStop(.35,`rgba(160,222,216,${(.3*a).toFixed(3)})`);g.addColorStop(1,'rgba(140,215,208,0)');
      rctx.fillStyle=g;rctx.beginPath();rctx.ellipse(x,y,r,r*sy,0,0,2*Math.PI);rctx.fill();};
    if(d.a>0)glow(d.x,d.y,d.r*2.6,d.a,1.35);
    if(d.splash>0)glow(d.x,d.y,d.r*2,d.splash*.7,1);
  }
  // One ring: a soft dark trough just inside a fine light crest that is brighter on the side the light comes from (upper
  // left), a faint wide glow, and an edge that wavers by under a pixel (never a bent shape).
  function drawRing(g,t,amp){
    if(g.r<2||g.k<.004)return;
    const n=Math.max(64,Math.min(512,Math.round(g.r*.5))),wob=Math.min(.9,.004*g.r)*g.k*amp,ph=g.r*.013;
    const path=r0=>{rctx.beginPath();for(let j=0;j<=n;j++){const th=2*Math.PI*j/n,rr=Math.max(0,r0+wob*(.6*Math.sin(5*th+ph+t/900)+.4*Math.sin(9*th-ph-t/1300)));
      const x=rc.x+rr*Math.cos(th),y=rc.y+rr*Math.sin(th);j?rctx.lineTo(x,y):rctx.moveTo(x,y);}};
    path(g.r-g.w*1.6);rctx.strokeStyle=`rgba(1,8,15,${(.3*g.k).toFixed(3)})`;rctx.lineWidth=g.w*1.6;rctx.stroke();
    path(g.r);rctx.strokeStyle=`rgba(140,215,208,${(.07*g.k).toFixed(3)})`;rctx.lineWidth=Math.max(4,g.w*1.4);rctx.stroke();
    const lit=rctx.createLinearGradient(rc.x-g.r*.7,rc.y-g.r*.7,rc.x+g.r*.7,rc.y+g.r*.7);
    lit.addColorStop(0,`rgba(196,238,234,${(.66*g.k).toFixed(3)})`);lit.addColorStop(1,`rgba(140,215,208,${(.3*g.k).toFixed(3)})`);
    rctx.strokeStyle=lit;rctx.lineWidth=1.2;rctx.stroke();
  }

  // Drag to turn: on the globe itself, not on the copy, a button, the card or the source strip. A mouse turns it both
  // ways; a finger only sideways (an upward swipe stays the page's, touch-action in intro.css).
  // never from the controls, the bars or the card; over the copy only off its words (on a phone the copy sits on the globe)
  const NO_DRAG='button,a,input,.gate-bar,.gate-foot,.gate-callout,.gate-loader,.gate-below';
  const onWords=e=>{
    const t=e.target.closest?.('.gate-kicker,.gate-title,.gate-why-k,.gate-problems li,.gate-lead');if(!t)return false;
    const r=document.createRange();r.selectNodeContents(t);
    for(const b of r.getClientRects())if(e.clientX>=b.left-8&&e.clientX<=b.right+8&&e.clientY>=b.top-4&&e.clientY<=b.bottom+4)return true;
    return false;
  };
  const onGlobe=e=>{if(!frame||!turning()||!opened||left||e.target.closest?.(NO_DRAG)||onWords(e))return false;return Math.hypot(e.clientX-frame.cx,e.clientY+lift-frame.cy)<=frame.R;};
  function setupDrag(){
    el.addEventListener('pointerdown',e=>{
      if(drag||(e.pointerType==='mouse'&&e.button!==0)||!onGlobe(e))return;
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,from:{...offset},off:{...offset},touch:e.pointerType!=='mouse',trail:[[performance.now(),{...offset}]]};
      back=null;try{el.setPointerCapture(e.pointerId);}catch{}el.classList.add('is-dragging');kick();
    });
    el.addEventListener('pointermove',e=>{
      if(!drag){el.classList.toggle('is-grab',e.pointerType==='mouse'&&onGlobe(e));return;}
      if(e.pointerId!==drag.id)return;
      const d=dragDegrees(e.clientX-drag.x,drag.touch?0:e.clientY-drag.y,frame.R,CAMERA.lat0+drag.from.lat);
      drag.off=clampDrag({lon:drag.from.lon+d.lon,lat:drag.from.lat+d.lat});
      const now=performance.now();drag.trail.push([now,{...drag.off}]);while(drag.trail.length>2&&now-drag.trail[0][0]>90)drag.trail.shift();
    });
    const up=e=>{
      if(!drag||e.pointerId!==drag.id)return;
      const [t0,o0]=drag.trail[0],now=performance.now(),dt=Math.max(16,now-t0),o=drag.off;
      back=reduce?null:{at:now,from:o,v:{lon:(o.lon-o0.lon)/dt,lat:(o.lat-o0.lat)/dt}};
      if(reduce)offset={lon:0,lat:0};
      drag=null;el.classList.remove('is-dragging');kick();
    };
    el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
  }

  function setup(){
    el=document.getElementById('site-gate');
    if(!el)return fail();
    el.hidden=false;
    for(const n of document.body.children)hold(n);
    observer=new MutationObserver(list=>{for(const m of list)for(const n of m.addedNodes)if(n.nodeType===1&&n.parentNode===document.body)hold(n);});
    observer.observe(document.body,{childList:true});
    canvas=q('.gate-sea');ctx=canvas.getContext('2d');rip=q('.gate-ripple');rctx=rip.getContext('2d');
    // t0: the loader is in the first paint (intro.css), so the browser's paint record is when the piece began (it may
    // come after the first frames, startAt); a hidden tab, which paints none, starts now
    try{new PerformanceObserver(l=>{const p=l.getEntries().map(e=>e.startTime);if(p.length)startAt(Math.min(...p),true);}).observe({type:'paint',buffered:true});}catch{}
    if(document.hidden)startAt(performance.now());
    // While the piece runs the entry screen is busy, not shut: assistive tech can read it and the keyboard can reach it;
    // the loader takes the pointer (all but the motion switch over it), and a focus moved into the entry screen (not by
    // the switch) ends the piece at once, so the focus is never on something hidden.
    el.setAttribute('aria-busy','true');
    el.addEventListener('focusin',e=>{if(!opened&&e.target.closest?.('.gate-hero')&&!e.target.closest('.gate-motion'))skipIntro();});
    gateProgress(gate,'page');render();
    q('.gate-loader').focus({preventScroll:true});
    // no globe in time: ask for the picture again (the timeout starts over), or open the map without the entry screen
    q('.gate-retry').addEventListener('click',()=>{
      retries++;failAt=(t0===null?0:performance.now()-t0)+INTRO_TIMELINE.timeout;status='';stillFailed=false;
      if(G.failed||!G.gl)loadStill(true);else loadStill(); // the turning globe may still come; the picture is asked for beside it
      render();kick();setTimeout(()=>{if(!opened&&!left)tick(performance.now());},INTRO_TIMELINE.timeout+40);
    });
    q('.gate-skip').addEventListener('click',()=>{try{store?.setItem(GATE_KEY,'1');}catch{}fail();scrollTo(0,0);dispatchEvent(new Event('resize'));
      const m=document.querySelector('main');if(m){m.tabIndex=-1;m.focus({preventScroll:true});}});
    // the switch: still stops the turning at once (the start pose, no frames); moving again picks up the sway, no entry
    const motion=q('.gate-motion'),setMotion=(v,keep)=>{
      reduce=v;motion.setAttribute('aria-checked',String(v));el.classList.toggle('is-still',v);
      if(keep)try{local?.setItem(MOTION_KEY,v?'1':'0');}catch{}
      if(v){back=null;offset={lon:0,lat:0};}else if(started){withEntry=false;clock=0;}
      lastMask='';kick();
    };
    setMotion(reduce);
    motion.addEventListener('click',()=>setMotion(!reduce,true));
    q('#gate-enter').addEventListener('click',()=>enter('explore'));
    for(const b of el.querySelectorAll('[data-go]'))b.addEventListener('click',()=>enter(b.dataset.go));
    for(const b of el.querySelectorAll('[data-go-table]'))b.addEventListener('click',()=>enter('compare',{table:b.dataset.goTable}));
    // the pill on the source strip's line: down to the uses, focus on their heading
    q('.gate-down').addEventListener('click',()=>{const h=q('.gate-hero');h.scrollTo({top:h.scrollTop+q('.gate-uses').getBoundingClientRect().top-h.getBoundingClientRect().top,behavior:reduce?'auto':'smooth'});q('.gate-uses-h').focus({preventScroll:true});});
    document.addEventListener('keydown',e=>{
      if(e.key==='Tab'||e.key.startsWith('Arrow'))root.classList.add('kb'); // from now on the focus ring shows (intro.css)
      if(left||e.defaultPrevented)return;
      const t=e.target,other=t!==q('#gate-enter')&&!!t.closest?.('button,a,input,select,textarea,summary');
      if(keyAction(e.key,{ready:opened,onOtherControl:other})==='enter'){e.preventDefault();enter('explore');}
    });
    const status=q('.gate-share-status');
    q('.gate-share').addEventListener('click',async()=>{
      const url=location.origin+location.pathname;
      try{if(navigator.share){await navigator.share({title:document.title,url});return;}}catch(e){if(e?.name==='AbortError')return;}
      try{await navigator.clipboard.writeText(url);status.textContent='링크를 복사했어요.';}
      catch{status.textContent='주소: '+url;}
      setTimeout(()=>{status.textContent='';},4000);
    });
    setupDrag();
    // stacked and taller than the window, the globe rides its band (a new frame); side by side it rides up with the first screen
    q('.gate-hero').addEventListener('scroll',()=>{ride();if(stackedNow)kick();},{passive:true});
    addEventListener('resize',kick);document.fonts?.ready.then(kick); // the web font moves the stacked layout once it is in
    // a hidden tab draws nothing; back in view the motion carries on from where it stood
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;}else kick();});
    raf=requestAnimationFrame(frameLoop);
    // the end and the timeout without frames (a hidden tab draws none): the entry screen still opens at total, or says
    // the globe did not come
    for(const at of [INTRO_TIMELINE.total,INTRO_TIMELINE.timeout])setTimeout(()=>{if(!opened&&!left)tick(performance.now());},at+40);
  }
  // As soon as the screen's markup is all in (the element after it exists), not at DOMContentLoaded: that waits for the
  // deferred app scripts (seconds on a slow network) while the loader already shows, and the piece runs from its paint.
  let begun=false,watch=null;
  const start=()=>{if(begun)return;begun=true;watch?.disconnect();try{setup();}catch{fail();}};
  const parsed=()=>document.readyState!=='loading'||!!document.getElementById('site-gate')?.nextElementSibling;
  if(parsed())start();
  else{watch=new MutationObserver(()=>{if(parsed())start();});watch.observe(document.documentElement,{childList:true,subtree:true});
    document.addEventListener('DOMContentLoaded',start,{once:true});}
})();

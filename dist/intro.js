// Loading and entry screen of the main map (index.html): a loader that fills with the app's real loading steps, then an
// entry screen (copy on the left, a large globe on the right) that opens the map, the comparison or the sources. Loaded
// without defer in <head> so the screen is up before the first paint. The part above the browser marker below is pure
// and tested in node (verification/test_intro_ui.mjs).
const GATE_KEY='bbvm-intro-entered', MOTION_KEY='bbvm-reduce-motion';
// The site logo (here and on expedition.html) goes home, as on most sites: a plain click on it leaves this one-time
// signal and follows its link, and the next load shows the entry screen again although the tab already entered.
const HOME_KEY='bbvm-intro-home';
const APP_HASH_KEYS=['s','v','t','b','m','p','u']; // what app.js readHash/applyHash use: a shared link opens the map directly
// (after '#' or, from 2026-10-15, as a query such as ?v=compare: the caller passes both)
const GATE_MIN_MS=600, GATE_MAX_MS=7000;
const GATE_STEPS=[['page','페이지 준비 중'],['map','지도를 불러오는 중'],['species','해양생물 자료를 불러오는 중']];

const hasAppHash=hash=>{try{const q=new URLSearchParams(String(hash||'').replace(/^#/,''));return APP_HASH_KEYS.some(k=>q.get(k));}catch{return false;}};
// No storage (private mode, blocked) only means the screen can't be remembered: it still shows once per load.
const shouldShowGate=(hash,storage)=>{if(hasAppHash(hash))return false;try{return storage?.getItem(HOME_KEY)==='1'||storage?.getItem(GATE_KEY)!=='1';}catch{return true;}};
// A plain click only: a middle or modified click opens a new tab or window and leaves this one as it is.
const homeClick=e=>e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey&&!e.defaultPrevented;

const makeGate=start=>({start,steps:new Set(),done:null,phase:'loading'});
// 'done' arrives from app.js after loadCollection on every outcome (live, snapshot, offline, empty, error); it implies every step.
function gateProgress(g,step,detail){
  if(step==='done'){g.done=detail||{};for(const [k] of GATE_STEPS)g.steps.add(k);}
  else if(GATE_STEPS.some(([k])=>k===step))g.steps.add(step);
  return g;
}
const gateFraction=g=>GATE_STEPS.filter(([k])=>g.steps.has(k)).length/GATE_STEPS.length;
// No "n / 3" counter: next to 종 자료 it read as a species count. The total comes from the loaded data, once it is there.
const speciesTotal=d=>Number.isInteger(d?.published)&&Number.isInteger(d?.candidates)?d.published+d.candidates:null;
const gateStep=g=>{const i=GATE_STEPS.findIndex(([k])=>!g.steps.has(k));if(i>=0)return GATE_STEPS[i][1];const t=speciesTotal(g.done);return t?`해양생물 ${t}종 자료를 불러왔어요`:'준비됐어요';};
// Ready once the data is in (after a short minimum so the loader never flashes), or after the maximum wait regardless.
function gateTick(g,now){
  if(g.phase==='loading'){const t=now-g.start;if((g.done&&t>=GATE_MIN_MS)||t>=GATE_MAX_MS)g.phase='ready';}
  return g.phase;
}
// One line under the buttons; the same meaning as the app's own connection state, never a softer one.
function gateNote(g){
  const d=g.done;
  if(!d)return g.phase==='ready'?'자료를 계속 불러오는 중입니다. 먼저 들어가도 됩니다.':'';
  if(d.state==='offline')return `오프라인 시연 · ${d.snapshotAt||'저장된'} 기준 공개 자료 사본으로 엽니다.`;
  if(d.state==='snapshot')return `운영 DB에 연결하지 못해 ${d.snapshotAt||'저장된'} 기준 공개 자료 사본으로 엽니다.`;
  if(d.state==='empty')return '운영 발행 자료가 0종입니다. 들어가면 조사 후보만 보입니다.';
  if(d.state==='error')return '자료를 불러오지 못했어요. 들어가서 ↻ 다시 시도를 눌러 주세요.';
  return '';
}
// The design's "N종의 해양생물 · 공개 데이터 기반", with the published/candidate split kept in view. Empty until known.
const countsLine=d=>speciesTotal(d)===null?'':`${speciesTotal(d)}종의 해양생물(운영 발행 ${d.published} · 조사 후보 ${d.candidates}) · 공개 데이터 기반`;
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
uniform vec2 u_org;uniform float u_scale,u_h,u_lon0,u_lat0,u_P,u_feather,u_alpha;uniform vec3 u_disc;uniform vec4 u_box;
uniform sampler2D u_detail,u_world;
${GLOBE_LONLAT}
vec3 lin(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}
vec3 srgb(vec3 c){c=clamp(c,0.,1.);return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}
void main(){
  vec2 p=u_org+vec2(gl_FragCoord.x,u_h-gl_FragCoord.y)/u_scale;
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
  let show=false;try{show=shouldShowGate(location.hash+'&'+location.search.slice(1),store);}catch{}
  try{store?.removeItem(HOME_KEY);}catch{} // used once: a reload or Back after it opens the map as before
  // The header logo links to this page without a hash ('./'), so the app also starts over (no species, tab or dialog).
  document.addEventListener('click',e=>{if(e.target.closest?.('a.brand')&&homeClick(e))try{store?.setItem(HOME_KEY,'1');}catch{}});
  if(!show)return;
  root.classList.add('gate-on');
  const stacked0=()=>matchMedia('(max-width:760px),(max-width:1100px) and (orientation:portrait)').matches;
  // The turning globe (TEXTURES): a WebGL context and the shader are made now, before the page is parsed, and its two
  // textures asked for, so they mostly arrive during the loader's 0.6 s minimum (a shared link, no screen, never asks).
  // If any of it fails (no WebGL, the shader, a texture, a lost context) the still picture below is fetched instead.
  let el=null,raf=0,canvas=null,ctx=null,shown=false,left=false,dirty=true,fading=false,drawnPhoto=false,bg=null;
  // the motion (MOTION): offset is this frame's degrees from the start pose; clock the ms of motion so far
  let offset={lon:0,lat:0},clock=0,last=0,lastDraw=0,prevFrame=0,withEntry=true,started=false,drag=null,back=null,leave=null,slow=0,shownAt=0,glScale=1;
  const G={c:null,gl:null,prog:null,buf:null,tex:{},u:{},img:{},left:2,ready:false,failed:false,at:0,box:null};
  // The still picture (vendor/globe-v2, scripts/bake_globe.py) for screens without WebGL: its size comes from the globe
  // this window will draw (the stacked query is intro.css's). Until it is there, or if it fails, the vector globe below.
  let photo=null,photoAt=0,img=null;
  function loadStill(){
    if(img||photo||left)return;
    try{
      const file=globeFile(globeFrame(innerWidth,innerHeight,stacked0()?{top:0,bottom:0}:null).R,devicePixelRatio,navigator.connection);
      img=new Image();img.decoding='async';img.fetchPriority='high';
      img.onload=()=>img.decode().then(()=>{if(left||!img)return;photo={img,pad:GLOBE_PAD[file]/file};photoAt=shown?performance.now():0;
        performance.mark?.('bbvm-globe-decoded');kick();},()=>{img=null;});
      img.onerror=()=>{img=null;};
      img.src=`vendor/globe-v2/globe-${file}.webp`;
    }catch{img=null;}
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
    for(const k of ['u_org','u_scale','u_h','u_lon0','u_lat0','u_P','u_feather','u_alpha','u_disc','u_box','u_detail','u_world'])G.u[k]=gl.getUniformLocation(prog,k);
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
  addEventListener('bbvm:progress',e=>{try{
    const d=e.detail||{};
    if(d.step==='map'&&d.geography){const r=geographyRings(d.geography,.08,COUNTRIES_CUT),bv=borderVertices(d.geography);kr=prep(r,COUNTRIES_CUT);krCells=new Set(r.flat().map(cellOf));
      // Korea's coast over the picture: segments with both ends near Korea, not both on a land border
      krCoast=r.flatMap(ring=>ring.slice(1).map((p,i)=>[ring[i],p]).filter(([a,b])=>nearKorea(a)&&nearKorea(b)&&!(bv.has(a.join())&&bv.has(b.join()))));}
    if(d.step==='done'&&Array.isArray(d.cells))cells=d.cells.map(c=>[[c.lon,c.lat],[c.lon+c.size,c.lat],[c.lon+c.size,c.lat+c.size],[c.lon,c.lat+c.size]]);
    gateProgress(gate,d.step,d.step==='done'?d:null);
    if(el){render();kick();}
  }catch{fail();}});

  function hold(node){if(node===el||node.tagName==='SCRIPT'||node.tagName==='LINK'||node.inert)return;node.inert=true;node.setAttribute('aria-hidden','true');inerted.push(node);}
  function release(){observer?.disconnect();for(const n of inerted.splice(0)){n.inert=false;n.removeAttribute('aria-hidden');}}
  const q=s=>el.querySelector(s);

  function render(){
    const f=gateFraction(gate);
    q('.gate-arc').style.strokeDashoffset=String(100-f*100);
    q('.gate-step').textContent=gateStep(gate);
    const note=gateNote(gate);q('.gate-note').textContent=note;q('.gate-note').hidden=!note;
    q('.gate-counts').textContent=countsLine(gate.done);
  }
  function showHero(){
    if(shown)return;shown=true;
    el.classList.add('is-ready');
    q('.gate-loader').setAttribute('aria-hidden','true');
    for(const b of el.querySelectorAll('#gate-enter,[data-go]'))b.removeAttribute('aria-disabled');
    const hero=q('.gate-hero');hero.hidden=false;hero.removeAttribute('aria-hidden');
    layout();
    // keyboard and mouse: focus the button (Enter/Space act on it), its ring shown only once the keyboard is used (html.kb);
    // touch: the screen itself, so no focus ring on a tap device
    if(!touch())q('#gate-enter').focus({preventScroll:true});else{hero.tabIndex=-1;hero.focus({preventScroll:true});}
  }
  // One way in, whichever button: 'explore' (default), 'compare' or 'method'. The app keeps its own state (species,
  // chips, map view); only the tab changes, through app.js setView (deferred, so it is there once the screen is ready).
  function enter(target){
    if(left||gate.phase!=='ready')return;left=true;
    try{store?.setItem(GATE_KEY,'1');}catch{}
    const finish=()=>{
      cancelAnimationFrame(raf);raf=0;leave=null;root.classList.remove('gate-on','gate-leaving');el.hidden=true;release();scrollTo(0,0);
      canvas.width=canvas.height=0;if(bg)bg.width=bg.height=0;bg=null;photo=img=null;freeGL(); // not needed again: give the memory back
      dispatchEvent(new Event('resize')); // Leaflet re-measures its box in case the layout moved underneath
      const a=arrival(target,touch());
      if(a.view!=='explore'&&typeof setView==='function')setView(a.view,!a.scroll);
      if(a.scroll)document.querySelector(a.scroll)?.scrollIntoView({block:'start',behavior:reduce?'auto':'smooth'});
      const t=document.querySelector(a.focus)||document.querySelector('main');if(!t)return;
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
  const copyBoxes=()=>[...q('.gate-title').children].map(s=>({...textBox(s),title:true}))
    .concat(['.gate-lead','.gate-more','.gate-note','.gate-counts'].map(q).filter(n=>n.getClientRects().length).map(textBox));
  function layout(){
    const w=innerWidth,h=innerHeight,band=q('.gate-globe'),call=q('.gate-callout'),bar=q('.gate-bar').getBoundingClientRect();
    const stacked=getComputedStyle(band).display!=='none',b=band.getBoundingClientRect();
    frame=globeFrame(w,h,stacked?{top:b.top,bottom:b.bottom}:null,stacked?[]:copyBoxes());
    const {cx,cy,R}=frame,at=(lon,lat)=>{const p=project(lon,lat);return {x:cx+p.x*R,y:cy-p.y*R};};
    const dot=at(...ANCHOR),k=at(...KOREA),c=call.getBoundingClientRect(),s=Math.min(1.2,Math.max(.75,R/733));
    if(!call.getClientRects().length)card=null; // a short screen hides the card
    else if(stacked){const r=q('.gate-card').getBoundingClientRect();card={x:r.left,y:r.top,w:r.width,h:r.height,under:true,s};}
    else{const p=cardPlace(dot,k,{w:c.width,h:c.height},{w,top:bar.bottom,bottom:q('.gate-foot').getBoundingClientRect().top},s);
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
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,G.tex.detail);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,G.tex.world);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    ctx.globalAlpha=alpha;ctx.drawImage(G.c,x0,y0,x1-x0,y1-y0);ctx.globalAlpha=1;
  }
  const turning=()=>G.ready&&!G.failed&&!!G.gl;
  function draw(){
    const {w,h,dpr}=size,{cx,cy,R}=frame,X=p=>cx+p.x*R,Y=p=>cy-p.y*R,geo=land&&!failed,gl=turning();
    const cam=gl?cameraAt(offset):CAMERA,at=(lon,lat,rim)=>project(lon,lat,rim,cam);
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
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
      try{const s=R*(1+2*photo.pad);ctx.globalAlpha=t;ctx.drawImage(photo.img,cx-s,cy-s,2*s,2*s);}
      catch{photo=img=null;return draw();} // a picture that does not draw: the vector globe
      finally{ctx.globalAlpha=1;}
      if(t>=1&&!drawnPhoto){drawnPhoto=true;performance.mark?.('bbvm-globe-drawn');}
    }
    fading=t<1&&(gl||!!photo);
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
  // Runs every frame while loading (the ready check) and while the globe moves; otherwise only when kicked by a resize,
  // new data or the motion switch.
  function frameLoop(now){
    raf=0;if(left&&!leave)return;
    if(gateTick(gate,now)==='ready'&&!shown){render();showHero();shownAt=now;}
    const moving=shown&&advance(now),fast=!!(drag||back||leave);
    // a slow GPU shows as frames coming late while the globe moves: then it is drawn at a lower resolution
    if(moving&&prevFrame){slow=now-prevFrame>45?slow+1:Math.max(0,slow-1);if(slow>10&&glScale>.5){glScale=Math.max(.5,glScale-.15);slow=0;}}
    prevFrame=moving?now:0;
    if(shown&&(dirty||fast||fading||(moving&&now-lastDraw>=1000/MOTION.fps-4))){
      if(dirty){dirty=false;resize();layout();bg=null;}
      paint();lastDraw=now;
    }
    if(!shown||moving||dirty||fading)raf=requestAnimationFrame(frameLoop);
  }

  // Drag to turn: on the globe itself, not on the copy, a button, the card or the source strip. A mouse turns it both
  // ways; a finger only sideways (an upward swipe stays the page's, touch-action in intro.css).
  // never from the controls, the bars or the card; over the copy only off its words (on a phone the copy sits on the globe)
  const NO_DRAG='button,a,input,.gate-bar,.gate-foot,.gate-callout,.gate-loader';
  const onWords=e=>{
    const t=e.target.closest?.('.gate-kicker,.gate-title,.gate-lead');if(!t)return false;
    const r=document.createRange();r.selectNodeContents(t);
    for(const b of r.getClientRects())if(e.clientX>=b.left-8&&e.clientX<=b.right+8&&e.clientY>=b.top-4&&e.clientY<=b.bottom+4)return true;
    return false;
  };
  const onGlobe=e=>{if(!frame||!turning()||!shown||left||e.target.closest?.(NO_DRAG)||onWords(e))return false;return Math.hypot(e.clientX-frame.cx,e.clientY-frame.cy)<=frame.R;};
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
    canvas=q('.gate-sea');ctx=canvas.getContext('2d');
    gateProgress(gate,'page');render();
    q('.gate-loader').focus({preventScroll:true});
    // the switch: still stops the turning at once (the start pose, no frames); moving again picks up the sway, no entry
    const motion=q('.gate-motion'),setMotion=(v,keep)=>{
      reduce=v;motion.setAttribute('aria-checked',String(v));el.classList.toggle('is-still',v);
      if(keep)try{local?.setItem(MOTION_KEY,v?'1':'0');}catch{}
      if(v){back=null;offset={lon:0,lat:0};}else if(started){withEntry=false;clock=0;}
      kick();
    };
    setMotion(reduce);
    motion.addEventListener('click',()=>setMotion(!reduce,true));
    // the copy shows from the first paint; the ways in say they wait until the screen is ready (intro.css dims them)
    for(const b of el.querySelectorAll('#gate-enter,[data-go]'))b.setAttribute('aria-disabled','true');
    q('#gate-enter').addEventListener('click',()=>enter('explore'));
    for(const b of el.querySelectorAll('[data-go]'))b.addEventListener('click',()=>enter(b.dataset.go));
    document.addEventListener('keydown',e=>{
      if(e.key==='Tab'||e.key.startsWith('Arrow'))root.classList.add('kb'); // from now on the focus ring shows (intro.css)
      if(left||e.defaultPrevented)return;
      const t=e.target,other=t!==q('#gate-enter')&&!!t.closest?.('button,a,input,select,textarea,summary');
      if(keyAction(e.key,{ready:gate.phase==='ready',onOtherControl:other})==='enter'){e.preventDefault();enter('explore');}
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
    addEventListener('resize',kick);document.fonts?.ready.then(kick); // the web font moves the stacked layout once it is in
    // a hidden tab draws nothing; back in view the motion carries on from where it stood
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;}else kick();});
    raf=requestAnimationFrame(frameLoop);
  }
  const start=()=>{try{setup();}catch{fail();}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

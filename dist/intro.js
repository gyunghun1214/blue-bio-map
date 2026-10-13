// Loading and entry screen of the main map (index.html): a loader that fills with the app's real loading steps, then an
// entry screen (copy on the left, a large globe on the right) that opens the map, the comparison or the sources. Loaded
// without defer in <head> so the screen is up before the first paint. The part above the browser marker below is pure
// and tested in node (verification/test_intro_ui.mjs).
const GATE_KEY='bbvm-intro-entered', MOTION_KEY='bbvm-reduce-motion';
const APP_HASH_KEYS=['s','v','t','b','m','p','u']; // what app.js readHash/applyHash use: a shared link opens the map directly
const GATE_MIN_MS=600, GATE_MAX_MS=7000;
const GATE_STEPS=[['page','페이지 준비 중'],['map','지도를 불러오는 중'],['species','해양생물 자료를 불러오는 중']];

const hasAppHash=hash=>{try{const q=new URLSearchParams(String(hash||'').replace(/^#/,''));return APP_HASH_KEYS.some(k=>q.get(k));}catch{return false;}};
// No storage (private mode, blocked) only means the screen can't be remembered: it still shows once per load.
const shouldShowGate=(hash,storage)=>{if(hasAppHash(hash))return false;try{return storage?.getItem(GATE_KEY)!=='1';}catch{return true;}};

const makeGate=start=>({start,steps:new Set(),done:null,phase:'loading'});
// 'done' arrives from app.js after loadCollection on every outcome (live, snapshot, empty, error); it implies every step.
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
  if(d.state==='snapshot')return `운영 DB에 연결하지 못해 ${d.snapshotAt||'저장된'} 기준 공개 자료 사본으로 엽니다.`;
  if(d.state==='empty')return '운영 발행 자료가 0종입니다. 들어가면 조사 후보만 보입니다.';
  if(d.state==='error')return '자료를 불러오지 못했습니다. 들어가서 다시 불러오기를 눌러 주세요.';
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
const project=(lon,lat,toRim)=>perspective(lon,lat,CAMERA.lon0,CAMERA.lat0,CAMERA.P,toRim);
function globeFrame(w,h,band,copy=[]){
  if(band){const R=Math.min(w*.6,h*.5),k=project(...KOREA);
    return {cx:w/2-k.x*R,cy:(band.top+band.bottom)/2+k.y*R,R};}
  const R=Math.min(h*FRAME.R,w*.55),cy=h*FRAME.cy;let cx=w*FRAME.cx;
  for(const b of copy){const dy=Math.max(0,b.t-cy,cy-b.b);if(dy<R)cx=Math.max(cx,b.r+(b.title?-.06:.02)*w+Math.sqrt(R*R-dy*dy));}
  return {cx,cy,R};
}
// The info card: right of Korea as in the design (offsets from the 1672×941 image, scaled with the globe; pulled in to
// the screen edge while its leader line still runs right), with a bent line from its point; under the point instead
// when it does not fit. Top-left and line, in px.
function cardPlace(dot,korea,card,view,s){
  const m=12;let x=Math.min(korea.x+207*s,view.w-m-card.w),y=korea.y+60*s;
  if(x>=dot.x+60*s&&y+card.h<=view.bottom-m){const ly=y+27*s;return {x,y,line:[[dot.x,dot.y],[Math.max(dot.x+12*s,x-75*s),ly],[x,ly]]};}
  x=Math.min(Math.max(m,dot.x-card.w*.3),view.w-m-card.w);y=dot.y+64*s;
  return {x,y,line:[[dot.x,dot.y],[Math.min(Math.max(dot.x,x+16),x+card.w-16),y]]};
}

// ---- browser ----
(()=>{
  if(typeof document==='undefined')return;
  const root=document.documentElement;
  let store=null,local=null;try{store=window.sessionStorage;}catch{}try{local=window.localStorage;}catch{}
  let show=false;try{show=shouldShowGate(location.hash,store);}catch{}
  if(!show)return;
  root.classList.add('gate-on');
  const gate=makeGate(performance.now());
  let reduce=false;try{reduce=motionPref(local?.getItem(MOTION_KEY),matchMedia('(prefers-reduced-motion: reduce)').matches);}catch{}
  let el=null,raf=0,canvas=null,ctx=null,shown=false,left=false,dirty=true;
  const inerted=[];let observer=null;
  const touch=()=>matchMedia('(pointer:coarse)').matches; // a phone: no focus ring on the button, no keyboard popping up in search

  // The globe: projected once (the view never turns), scaled per screen size, redrawn only when something changed.
  const prep=(rings,cut)=>rings.map(r=>r.map((p,i)=>({...project(p[0],p[1],true),cut:i>0&&cutEdge(r[i-1],p,cut),cell:cellOf(p)})));
  let land=null,borders=[],depth=[],kr=[],krCells=new Set(),cellBoxes=[],failed=false,frame=null,lead=null,size={w:0,h:0,dpr:1};
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

  const fail=()=>{left=true;cancelAnimationFrame(raf);root.classList.remove('gate-on','gate-leaving');if(el)el.hidden=true;release();};
  addEventListener('bbvm:progress',e=>{try{
    const d=e.detail||{};
    if(d.step==='map'&&d.geography){const r=geographyRings(d.geography,.08,COUNTRIES_CUT);kr=prep(r,COUNTRIES_CUT);krCells=new Set(r.flat().map(cellOf));}
    if(d.step==='done'&&Array.isArray(d.cells))cellBoxes=d.cells.map(c=>[[c.lon,c.lat],[c.lon+c.size,c.lat],[c.lon+c.size,c.lat+c.size],[c.lon,c.lat+c.size]]
      .map(p=>project(p[0],p[1]))).filter(b=>b.every(Boolean));
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
    const hero=q('.gate-hero');hero.hidden=false;hero.removeAttribute('aria-hidden');
    layout();
    // keyboard and mouse: focus the button (Enter/Space act on it); touch: the screen itself, so no focus ring on a tap device
    if(!touch())q('#gate-enter').focus({preventScroll:true});else{hero.tabIndex=-1;hero.focus({preventScroll:true});}
  }
  // One way in, whichever button: 'explore' (default), 'compare' or 'method'. The app keeps its own state (species,
  // chips, map view); only the tab changes, through app.js setView (deferred, so it is there once the screen is ready).
  function enter(target){
    if(left||gate.phase!=='ready')return;left=true;
    try{store?.setItem(GATE_KEY,'1');}catch{}
    const finish=()=>{
      cancelAnimationFrame(raf);root.classList.remove('gate-on','gate-leaving');el.hidden=true;release();scrollTo(0,0);
      canvas.width=canvas.height=0; // the picture is not needed again: give its memory back
      dispatchEvent(new Event('resize')); // Leaflet re-measures its box in case the layout moved underneath
      const a=arrival(target,touch());
      if(a.view!=='explore'&&typeof setView==='function')setView(a.view,!a.scroll);
      if(a.scroll)document.querySelector(a.scroll)?.scrollIntoView({block:'start',behavior:reduce?'auto':'smooth'});
      const t=document.querySelector(a.focus)||document.querySelector('main');if(!t)return;
      if(t.tagName==='MAIN'){t.tabIndex=-1;t.addEventListener('blur',()=>t.removeAttribute('tabindex'),{once:true});}
      t.focus({preventScroll:true});
    };
    if(reduce)return finish();
    root.classList.add('gate-leaving');setTimeout(finish,820);
  }

  // Where the globe, the card and its leader line go for this screen. Side by side the card is placed here; stacked,
  // CSS puts it under the globe band and only the line is drawn to it.
  // the copy lines as drawn (the text, not the full-width block boxes) for the globe to keep clear of
  const textBox=n=>{const r=document.createRange();r.selectNodeContents(n);const b=r.getBoundingClientRect();return {r:b.right,t:b.top,b:b.bottom};};
  const copyBoxes=()=>[...q('.gate-title').children].map(s=>({...textBox(s),title:true}))
    .concat(['.gate-lead','.gate-more','.gate-note','.gate-counts'].map(q).filter(n=>n.getClientRects().length).map(textBox));
  function layout(){
    const w=innerWidth,h=innerHeight,band=q('.gate-globe'),call=q('.gate-callout'),bar=q('.gate-bar').getBoundingClientRect();
    const stacked=getComputedStyle(band).display!=='none',b=band.getBoundingClientRect();
    frame=globeFrame(w,h,stacked?{top:b.top,bottom:b.bottom}:null,stacked?[]:copyBoxes());
    const {cx,cy,R}=frame,at=(lon,lat)=>{const p=project(lon,lat);return {x:cx+p.x*R,y:cy-p.y*R};};
    const dot=at(...ANCHOR),k=at(...KOREA),c=call.getBoundingClientRect();
    if(!call.getClientRects().length)lead=null; // a short screen hides the card
    else if(stacked){const r=q('.gate-card').getBoundingClientRect();lead=[[dot.x,dot.y],[Math.min(Math.max(dot.x,r.left+16),r.right-16),r.top]];}
    else{const p=cardPlace(dot,k,{w:c.width,h:c.height},{w,top:bar.bottom,bottom:q('.gate-foot').getBoundingClientRect().top},Math.min(1.2,Math.max(.75,R/733)));
      call.style.left=p.x+'px';call.style.top=p.y+'px';lead=p.line;}
    el.style.setProperty('--kx',k.x+'px');el.style.setProperty('--ky',k.y+'px'); // the leave zoom heads for Korea
  }
  function resize(){
    const dpr=Math.min(2,devicePixelRatio||1),w=innerWidth,h=innerHeight;
    if(w===size.w&&h===size.h&&dpr===size.dpr)return;
    size={w,h,dpr};canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  }
  // sea by depth (shelf under 200 m, slope to 2000 m, deep), land a shade above the deep sea
  const SEA={shelf:'#2a6c76',slope:'#154364',deep:'#0c2846',land:'#1c2a35'};
  function draw(){
    const {w,h,dpr}=size,{cx,cy,R}=frame,X=p=>cx+p.x*R,Y=p=>cy-p.y*R,geo=land&&!failed;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    // the air: a thin rim of light (1–3% of the radius), brightest on the lit upper left
    const glow=ctx.createRadialGradient(cx,cy,R*.985,cx,cy,R*1.03),side=ctx.createLinearGradient(cx-R*.75,cy-R*.75,cx+R*.6,cy+R*.6);
    glow.addColorStop(0,'rgba(165,220,240,.55)');glow.addColorStop(1,'rgba(165,220,240,0)');
    side.addColorStop(0,'#000');side.addColorStop(1,'rgba(0,0,0,.15)');
    ctx.fillStyle=glow;ctx.fillRect(cx-R*1.04,cy-R*1.04,R*2.08,R*2.08);
    ctx.globalCompositeOperation='destination-in';ctx.fillStyle=side;ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='source-over';
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
    // light from the upper left, the limb darkening toward the rim
    const shade=ctx.createRadialGradient(cx-R*.32,cy-R*.4,R*.05,cx,cy,R);
    shade.addColorStop(0,'rgba(150,220,215,.12)');shade.addColorStop(.6,'rgba(3,12,21,0)');shade.addColorStop(.88,'rgba(3,12,21,.3)');shade.addColorStop(1,'rgba(3,12,21,.72)');
    ctx.fillStyle=shade;ctx.fillRect(cx-R,cy-R,R*2,R*2);ctx.restore();
    const rim=ctx.createLinearGradient(cx-R*.75,cy-R*.75,cx+R*.6,cy+R*.6);
    rim.addColorStop(0,'rgba(175,228,242,.6)');rim.addColorStop(1,'rgba(175,228,242,.06)');
    ctx.beginPath();ctx.arc(cx,cy,R-.75,0,Math.PI*2);ctx.strokeStyle=rim;ctx.lineWidth=1.5;ctx.stroke();
    if(!geo)return;
    // the public cells the app loaded (outline only, never shaded by record counts) and the map's study frame
    ctx.beginPath();for(const b of cellBoxes){b.forEach((p,i)=>i?ctx.lineTo(X(p),Y(p)):ctx.moveTo(X(p),Y(p)));ctx.closePath();}
    ctx.strokeStyle='rgba(140,215,208,.34)';ctx.lineWidth=.8;ctx.stroke();
    const [a,b]=STUDY,box=[];
    for(let x=a[0];x<=b[0];x+=.5)box.push([x,a[1]]);for(let y=a[1];y<=b[1];y+=.3)box.push([b[0],y]);
    for(let x=b[0];x>=a[0];x-=.5)box.push([x,b[1]]);for(let y=b[1];y>=a[1];y-=.3)box.push([a[0],y]);
    ctx.beginPath();box.map(p=>project(p[0],p[1])).forEach((p,i)=>i?ctx.lineTo(X(p),Y(p)):ctx.moveTo(X(p),Y(p)));ctx.closePath();
    ctx.setLineDash([3,5]);ctx.strokeStyle='rgba(140,215,208,.4)';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
    // the card's point and leader line
    if(!lead)return;
    ctx.beginPath();lead.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.strokeStyle='rgba(255,255,255,.42)';ctx.lineWidth=1;ctx.stroke();
    const [dx,dy]=lead[0];
    ctx.beginPath();ctx.arc(dx,dy,10,0,Math.PI*2);ctx.fillStyle='rgba(223,160,100,.2)';ctx.fill();
    ctx.beginPath();ctx.arc(dx,dy,4,0,Math.PI*2);ctx.fillStyle='#dfa064';ctx.fill();
  }
  function paint(){
    resize();layout();
    try{draw();}catch{failed=true;try{draw();}catch{}} // a drawing error leaves the plain sphere, never the screen
  }
  const kick=()=>{dirty=true;if(el&&!raf&&!left)raf=requestAnimationFrame(frameLoop);};
  // Runs every frame only while loading (the ready check); after that only when kicked by a resize or new data.
  function frameLoop(now){
    raf=0;if(left)return;
    if(gateTick(gate,now)==='ready'&&!shown){render();showHero();}
    if(shown&&dirty){dirty=false;paint();}
    if(!shown)raf=requestAnimationFrame(frameLoop);
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
    const motion=q('.gate-motion'),setMotion=(v,keep)=>{
      reduce=v;motion.setAttribute('aria-checked',String(v));el.classList.toggle('is-still',v);
      if(keep)try{local?.setItem(MOTION_KEY,v?'1':'0');}catch{}
    };
    setMotion(reduce);
    motion.addEventListener('click',()=>setMotion(!reduce,true));
    q('#gate-enter').addEventListener('click',()=>enter('explore'));
    for(const b of el.querySelectorAll('[data-go]'))b.addEventListener('click',()=>enter(b.dataset.go));
    document.addEventListener('keydown',e=>{
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
    addEventListener('resize',kick);document.fonts?.ready.then(kick); // the web font moves the stacked layout once it is in
    raf=requestAnimationFrame(frameLoop);
  }
  const start=()=>{try{setup();}catch{fail();}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

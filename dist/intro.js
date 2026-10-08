// Loading and entry screen of the main map (index.html): a loader that fills with the app's real loading steps, then an
// entry screen that opens the map on the button or Enter. Loaded without defer in <head> so the screen is up before the
// first paint. The part above '// ---- browser ----' is pure and tested in node (verification/test_intro_ui.mjs).
const GATE_KEY='bbvm-intro-entered';
const APP_HASH_KEYS=['s','v','t','b','m','p','u']; // what app.js readHash/applyHash use: a shared link opens the map directly
const GATE_MIN_MS=600, GATE_MAX_MS=7000;
const GATE_STEPS=[['page','페이지 준비 중'],['map','지도를 불러오는 중'],['species','종 자료를 불러오는 중']];

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
const gateStep=g=>{const i=GATE_STEPS.findIndex(([k])=>!g.steps.has(k));return i<0?{n:GATE_STEPS.length,text:'준비됐어요'}:{n:i+1,text:GATE_STEPS[i][1]};};
// Ready once the data is in (after a short minimum so the loader never flashes), or after the maximum wait regardless.
function gateTick(g,now){
  if(g.phase==='loading'){const t=now-g.start;if((g.done&&t>=GATE_MIN_MS)||t>=GATE_MAX_MS)g.phase='ready';}
  return g.phase;
}
// One line under the button; the same meaning as the app's own connection state, never a softer one.
function gateNote(g){
  const d=g.done;
  if(!d)return g.phase==='ready'?'자료를 계속 불러오는 중입니다. 먼저 들어가도 됩니다.':'';
  if(d.state==='snapshot')return `운영 DB에 연결하지 못해 ${d.snapshotAt||'저장된'} 기준 공개 자료 사본으로 엽니다.`;
  if(d.state==='empty')return '운영 발행 자료가 0종입니다. 들어가면 조사 후보만 보입니다.';
  if(d.state==='error')return '자료를 불러오지 못했습니다. 들어가서 다시 불러오기를 눌러 주세요.';
  return '';
}
const countsLine=d=>Number.isInteger(d?.published)&&Number.isInteger(d?.candidates)?`지금 운영 발행 ${d.published}종과 조사 후보 ${d.candidates}종을 볼 수 있습니다.`:'';
// Enter opens the map from anywhere on the entry screen, except when another control has focus (its own action wins).
const keyAction=(key,{ready,onOtherControl})=>key==='Enter'&&ready&&!onOtherControl?'enter':null;

// Vertical perspective projection (a view of the sphere from height P-1 earth radii). Returns unit-disc coordinates:
// x right, y up, r=1 on the horizon; null when the point is behind the horizon.
function perspective(lon,lat,lon0,lat0,P){
  const r=Math.PI/180,f=lat*r,f0=lat0*r,dl=(lon-lon0)*r;
  const cosc=Math.sin(f0)*Math.sin(f)+Math.cos(f0)*Math.cos(f)*Math.cos(dl);
  if(cosc<1/P)return null;
  const k=(P-1)/(P-cosc)/Math.sqrt((P-1)/(P+1));
  return {x:k*Math.cos(f)*Math.sin(dl),y:k*(Math.cos(f0)*Math.sin(f)-Math.sin(f0)*Math.cos(f)*Math.cos(dl))};
}
// Drop vertices closer than minDeg to the last kept one: the 1:10m coastline is far finer than the screen.
function simplifyRing(ring,minDeg){
  const out=[];
  for(const p of ring){const q=out[out.length-1];if(!q||Math.abs(p[0]-q[0])+Math.abs(p[1]-q[1])>=minDeg)out.push(p);}
  if(out.length>2&&out[out.length-1]!==ring[ring.length-1])out.push(ring[ring.length-1]);
  return out.length>=3?out:[];
}
const geographyRings=(geo,minDeg=.08)=>(geo?.features||[]).flatMap(f=>{
  const g=f.geometry;const polys=g?.type==='MultiPolygon'?g.coordinates:g?.type==='Polygon'?[g.coordinates]:[];
  return polys.map(p=>simplifyRing(p[0],minDeg)).filter(r=>r.length);
});

// ---- browser ----
(()=>{
  if(typeof document==='undefined')return;
  const root=document.documentElement;
  let store=null;try{store=window.sessionStorage;}catch{}
  let show=false;try{show=shouldShowGate(location.hash,store);}catch{}
  if(!show)return;
  root.classList.add('gate-on');
  const gate=makeGate(performance.now());
  const reduceQuery=matchMedia('(prefers-reduced-motion: reduce)');
  let reduce=reduceQuery.matches,geoRings=[],cells=[],el=null,raf=0,canvas=null,ctx=null,shown=false,left=false;
  const inerted=[];let observer=null;

  const fail=()=>{left=true;cancelAnimationFrame(raf);root.classList.remove('gate-on','gate-leaving');if(el)el.hidden=true;release();};
  addEventListener('bbvm:progress',e=>{try{
    const d=e.detail||{};
    if(d.step==='map'&&d.geography)geoRings=geographyRings(d.geography);
    if(d.step==='done'&&Array.isArray(d.cells))cells=d.cells;
    gateProgress(gate,d.step,d.step==='done'?d:null);
    if(el)render();
  }catch{fail();}});

  function hold(node){if(node===el||node.tagName==='SCRIPT'||node.tagName==='LINK'||node.inert)return;node.inert=true;node.setAttribute('aria-hidden','true');inerted.push(node);}
  function release(){observer?.disconnect();for(const n of inerted.splice(0)){n.inert=false;n.removeAttribute('aria-hidden');}}
  const q=s=>el.querySelector(s);

  function render(){
    const f=gateFraction(gate),st=gateStep(gate);
    q('.gate-arc').style.strokeDashoffset=String(100-f*100);
    q('.gate-step-n').textContent=`${st.n} / ${GATE_STEPS.length}`;
    q('.gate-step-t').textContent=st.text;
    const note=gateNote(gate);q('.gate-note').textContent=note;q('.gate-note').hidden=!note;
    q('.gate-counts').textContent=countsLine(gate.done);
  }
  function showHero(){
    if(shown)return;shown=true;
    el.classList.add('is-ready');
    q('.gate-loader').setAttribute('aria-hidden','true');
    const hero=q('.gate-hero');hero.hidden=false;hero.removeAttribute('aria-hidden');
    // keyboard and mouse: focus the button (Enter/Space act on it); touch: the screen itself, so no focus ring on a tap device
    if(matchMedia('(pointer:fine)').matches)q('#gate-enter').focus({preventScroll:true});else{hero.tabIndex=-1;hero.focus({preventScroll:true});}
  }
  function enter(){
    if(left||gate.phase!=='ready')return;left=true;
    try{store?.setItem(GATE_KEY,'1');}catch{}
    const finish=()=>{
      cancelAnimationFrame(raf);root.classList.remove('gate-on','gate-leaving');el.hidden=true;release();scrollTo(0,0);
      dispatchEvent(new Event('resize')); // Leaflet re-measures its box in case the layout moved underneath
      const fine=matchMedia('(pointer:fine)').matches,search=document.getElementById('search'),main=document.querySelector('main');
      if(fine&&search)search.focus({preventScroll:true});
      else if(main){main.tabIndex=-1;main.focus({preventScroll:true});main.addEventListener('blur',()=>main.removeAttribute('tabindex'),{once:true});}
    };
    if(reduce)return finish();
    root.classList.add('gate-leaving');setTimeout(finish,820);
  }

  // The sea lens: a slow sway over the seas around Korea, the map's study frame and the public cells the app loaded.
  const P=1/Math.cos(24*Math.PI/180),STUDY=[[124,33],[132,38.7]];
  let size={w:0,h:0,dpr:1};
  function resize(){
    const dpr=Math.min(2,devicePixelRatio||1),w=innerWidth,h=innerHeight;
    if(w===size.w&&h===size.h&&dpr===size.dpr)return;
    size={w,h,dpr};canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  }
  function draw(t){
    resize();
    const {w,h,dpr}=size,narrow=w<700;
    const R=narrow?Math.max(w*.62,h*.36):Math.min(h*.5,w*.36),cx=w/2,cy=narrow?h*.4:h*.53;
    const lon0=127.6+(reduce?0:3*Math.sin(t/9000)),lat0=35.4+(reduce?0:Math.sin(t/13000));
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const halo=ctx.createRadialGradient(cx,cy,R*.9,cx,cy,R*1.35);
    halo.addColorStop(0,'rgba(64,170,220,.22)');halo.addColorStop(1,'rgba(3,13,26,0)');
    ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
    const sea=ctx.createRadialGradient(cx-R*.25,cy-R*.3,R*.1,cx,cy,R);
    sea.addColorStop(0,'#0f4a6e');sea.addColorStop(.55,'#082c4a');sea.addColorStop(1,'#041a2e');
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.fillStyle=sea;ctx.fill();ctx.clip();
    const pt=(lon,lat)=>{const p=perspective(lon,lat,lon0,lat0,P);return p&&[cx+p.x*R,cy-p.y*R];};
    const line=(pts,close)=>{let on=false;for(const p of pts){if(!p){on=false;continue;}if(on)ctx.lineTo(p[0],p[1]);else{ctx.moveTo(p[0],p[1]);on=true;}}if(close)ctx.closePath();};
    // graticule: 2° faint, 10° a little brighter
    for(const step of [2,10]){
      ctx.beginPath();
      for(let lon=100;lon<=156;lon+=step){const pts=[];for(let lat=6;lat<=64;lat+=1)pts.push(pt(lon,lat));line(pts);}
      for(let lat=6;lat<=64;lat+=step){const pts=[];for(let lon=100;lon<=156;lon+=1)pts.push(pt(lon,lat));line(pts);}
      ctx.strokeStyle=step===10?'rgba(160,210,225,.16)':'rgba(160,210,225,.06)';ctx.lineWidth=1;ctx.stroke();
    }
    ctx.beginPath();
    for(const ring of geoRings){const pts=ring.map(p=>pt(p[0],p[1]));if(pts.every(Boolean))line(pts,true);}
    ctx.fillStyle='rgba(206,226,236,.13)';ctx.fill();ctx.strokeStyle='rgba(222,238,245,.42)';ctx.lineWidth=.8;ctx.stroke();
    for(const c of cells){
      const s=c.size,ps=[pt(c.lon,c.lat),pt(c.lon+s,c.lat),pt(c.lon+s,c.lat+s),pt(c.lon,c.lat+s)];
      if(!ps.every(Boolean))continue;
      ctx.beginPath();line(ps,true);ctx.fillStyle=s>1?'rgba(94,227,208,.05)':'rgba(94,227,208,.2)';ctx.fill();
      ctx.strokeStyle=s>1?'rgba(94,227,208,.28)':'rgba(94,227,208,.5)';ctx.lineWidth=.7;ctx.stroke();
    }
    const [a,b]=STUDY,box=[];
    for(let x=a[0];x<=b[0];x+=.5)box.push(pt(x,a[1]));for(let y=a[1];y<=b[1];y+=.3)box.push(pt(b[0],y));
    for(let x=b[0];x>=a[0];x-=.5)box.push(pt(x,b[1]));for(let y=b[1];y>=a[1];y-=.3)box.push(pt(a[0],y));
    ctx.beginPath();line(box,true);ctx.setLineDash([3,5]);ctx.strokeStyle='rgba(94,227,208,.7)';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
    // limb: darken toward the horizon (also hides where the clipped coastline file ends) and a thin lit rim
    const limb=ctx.createRadialGradient(cx,cy,R*.62,cx,cy,R);
    limb.addColorStop(0,'rgba(3,13,26,0)');limb.addColorStop(.75,'rgba(3,13,26,.55)');limb.addColorStop(1,'rgba(3,13,26,.92)');
    ctx.fillStyle=limb;ctx.fillRect(cx-R,cy-R,R*2,R*2);ctx.restore();
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.strokeStyle='rgba(120,205,240,.35)';ctx.lineWidth=1.2;ctx.stroke();
  }
  let lastDraw=-1;
  function frame(now){
    if(left)return;
    if(gateTick(gate,now)==='ready'&&!shown){render();showHero();}
    // drawn while moving, once more after each data change when still
    if(shown&&!document.hidden&&(!reduce||lastDraw<0||geoRings.length+cells.length!==lastDraw)){draw(now);lastDraw=reduce?geoRings.length+cells.length:0;}
    raf=requestAnimationFrame(frame);
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
    const motion=q('.gate-motion'),setMotion=v=>{reduce=v;lastDraw=-1;motion.setAttribute('aria-pressed',String(v));el.classList.toggle('is-still',v);};
    setMotion(reduce);
    motion.addEventListener('click',()=>setMotion(!reduce));
    q('#gate-enter').addEventListener('click',enter);
    document.addEventListener('keydown',e=>{
      if(left||e.defaultPrevented)return;
      const t=e.target,other=t!==q('#gate-enter')&&!!t.closest?.('button,a,input,select,textarea,summary');
      if(keyAction(e.key,{ready:gate.phase==='ready',onOtherControl:other})==='enter'){e.preventDefault();enter();}
    });
    const status=q('.gate-share-status');
    q('.gate-share').addEventListener('click',async()=>{
      const url=location.origin+location.pathname;
      try{if(navigator.share){await navigator.share({title:document.title,url});return;}}catch(e){if(e?.name==='AbortError')return;}
      try{await navigator.clipboard.writeText(url);status.textContent='링크를 복사했어요.';}
      catch{status.textContent='주소: '+url;}
      setTimeout(()=>{status.textContent='';},4000);
    });
    addEventListener('resize',()=>{lastDraw=-1;});
    raf=requestAnimationFrame(frame);
  }
  const start=()=>{try{setup();}catch{fail();}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

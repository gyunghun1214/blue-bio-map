// PC 화면이 한 픽셀도 바뀌지 않았는지: main(A, 기본 8766)과 이 브랜치(B, 기본 8765)를 같은 조건으로 찍어 픽셀 단위로 견준다.
// 조건: 1440×900·1280×720, 배율 1, 마우스(터치 아님), Supabase는 저장 사본(dist/live-snapshot.json), 위성 타일은 tmp/tile-cache
// (common.mjs). 화면: 탐색 지도·비교와 지표(매트릭스·데이터 표)·근거와 방법, 첫 화면과 전체 길이. '움직임 줄이기'(rm)와 보통
// 움직임(motion) 두 가지로 찍는다. EXTRA=1이면 시작 화면(지구본, WebGL 없이 정지 그림)과 바다 탐험(WebGL 없이 카드 목록)도 찍는다.
// 같은 코드끼리도 생기는 흔들림(지도 위 반투명 칸 모서리 ±1, 버튼 색 전환 중간값, 멍이의 눈·몸짓)을 가르려고 모든 화면을 두 번
// 찍는다(라운드 1·2). '고정된 차이' = A1==A2이고 B1==B2인데 A≠B인 픽셀. 이것이 모든 화면에서 0이어야 통과다.
// 멍이 버튼(48px)은 두 쪽 모두 같은 색으로 가리고, 지도 위 멍이 말풍선은 이미 본 것으로 두어 띄우지 않는다.
// 사용: OUT=<폴더> node verification/2026-10-25-mobile-ux/pc-diff.mjs   (A=http://127.0.0.1:8766/ B=http://127.0.0.1:8765/)
// 결과: <폴더>/diff.json(화면별 라운드마다 다른 픽셀 수·같은 쪽 흔들림·고정된 차이), 캡처 PNG.
import fs from 'node:fs'; import path from 'node:path';
import {launch,open,sleep,waitData} from './common.mjs';
const OUT=process.env.OUT||'tmp/pc-diff';
const SIDES={A:process.env.A||'http://127.0.0.1:8766/',B:process.env.B||'http://127.0.0.1:8765/'};
const SIZES=[[1440,900],[1280,720]];
// 시작 화면은 탭(브라우저 묶음)마다 처음 한 번만 뜨므로 맨 앞에 둔다.
const SCREENS=[...(process.env.EXTRA?[['gate','',null,'gate']]:[]),['explore','#v=explore&s=836033'],['compare','#v=compare&s=836033'],['compare-table','#v=compare&s=836033',"document.querySelector('[data-cmp-mode=table]').click()"],['method','#v=method&s=836033'],
  ...(process.env.EXTRA?[['expedition','expedition.html',null,'exp']]:[])];
fs.mkdirSync(OUT,{recursive:true});
const b=await launch();
const tags=new Set();
for(const round of [1,2])for(const mode of ['rm','motion'])for(const [w,h] of SIZES)for(const [side,base] of Object.entries(SIDES)){
  const {page,ctx}=await open(b,{w,h,dpr:1,phone:false,supa:'fixture',reducedMotion:mode==='rm'?'reduce':'no-preference'});
  await ctx.addInitScript(()=>{try{localStorage.setItem('bbChatHintSeen','1');}catch{}});
  for(const [name,hash,act,kind] of SCREENS){
    await page.goto('about:blank');await page.goto(base+hash);
    if(kind==='gate')await page.waitForFunction(()=>document.getElementById('site-gate')?.classList.contains('is-ready'),null,{timeout:40000});
    else if(kind==='exp')await page.waitForFunction(()=>document.readyState==='complete'&&!document.body.classList.contains('is-loading'),null,{timeout:40000});
    else await waitData(page);
    await page.waitForLoadState('networkidle').catch(()=>{});await sleep(5000);
    if(act){await page.evaluate(act);await sleep(1500);}
    await page.mouse.move(0,h-1);await sleep(300); // 마우스는 같은 곳(왼쪽 아래 구석)
    const tag=`${mode}-${w}x${h}-${name}`,opt={animations:'disabled',caret:'hide',mask:[page.locator('.bbc-fab')],maskColor:'#ff00ff'};
    await page.screenshot({path:path.join(OUT,`${tag}-${side}${round}.png`),...opt});
    await page.screenshot({path:path.join(OUT,`${tag}-full-${side}${round}.png`),fullPage:true,...opt});
    tags.add(tag);tags.add(tag+'-full');
  }
  await ctx.close();
}
// 픽셀 비교: PNG 네 장(A1·A2·B1·B2)을 canvas에 그려 RGBA를 견준다(추가 도구 없이)
const cmpPage=await (await b.newContext()).newPage();
const read=f=>'data:image/png;base64,'+fs.readFileSync(path.join(OUT,f)).toString('base64');
const result={};let fails=0;
for(const tag of tags){
  const r=await cmpPage.evaluate(async urls=>{const load=u=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=u;});
    const im=await Promise.all(urls.map(load));const size=im.map(i=>i.width+'x'+i.height);
    if(new Set(size).size>1)return {size,sameSize:false};
    const W=im[0].width,H=im[0].height,px=i=>{const cv=new OffscreenCanvas(W,H),x=cv.getContext('2d');x.drawImage(i,0,0);return new Uint32Array(x.getImageData(0,0,W,H).data.buffer);};
    const [a1,a2,b1,b2]=im.map(px);let raw1=0,raw2=0,noiseA=0,noiseB=0,fixed=0,box=null;
    for(let k=0;k<a1.length;k++){const d1=a1[k]!==b1[k],d2=a2[k]!==b2[k],nA=a1[k]!==a2[k],nB=b1[k]!==b2[k];
      if(d1)raw1++;if(d2)raw2++;if(nA)noiseA++;if(nB)noiseB++;
      if(d1&&!nA&&!nB){fixed++;const x=k%W,y=(k-x)/W;box=box?[Math.min(box[0],x),Math.min(box[1],y),Math.max(box[2],x),Math.max(box[3],y)]:[x,y,x,y];}}
    return {size:size[0],raw1,raw2,noiseA,noiseB,fixed,box};},[`${tag}-A1.png`,`${tag}-A2.png`,`${tag}-B1.png`,`${tag}-B2.png`].map(f=>read(f.replace(/-(A|B)(\d)\.png$/,(m,s,n)=>`-${s}${n}.png`))));
  result[tag]=r;if(r.sameSize===false||r.fixed>0)fails++;
}
await b.close();
fs.writeFileSync(path.join(OUT,'diff.json'),JSON.stringify(result,null,1));
for(const [k,v] of Object.entries(result))console.log((v.sameSize===false||v.fixed>0?'DIFF ':'SAME ')+k+' '+JSON.stringify(v));
console.log(fails?`PC 화면 고정된 차이 있음: ${fails}장`:`PC 화면 고정된 차이 0 (${tags.size}장 × 2라운드)`);
process.exitCode=fails?1:0;

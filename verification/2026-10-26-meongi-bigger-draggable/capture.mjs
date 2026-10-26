// 2026-10-26 멍이 전/후 캡처와 끄는 모습 GIF용 프레임.
//   SUPA=fixture TILES=off node verification/2026-10-26-meongi-bigger-draggable/capture.mjs <out> <base> [gif]
// gif를 주면 390 탐색 지도에서 손가락으로 멍이를 오른쪽 아래 → 왼쪽 위로 끄는 동안의 프레임을 <out>/gif-frames에 남긴다(ffmpeg로 GIF).
import fs from 'node:fs';import path from 'node:path';
import {launch,open,sleep,shot} from './common.mjs';
import {enter} from '../2026-10-25-mascot-mobile-overlap/common.mjs';
const [OUT,BASE,GIF]=[process.argv[2],process.argv[3]||'http://127.0.0.1:8765/',process.argv[4]];
fs.mkdirSync(OUT,{recursive:true});
const b=await launch();
const tab=async(page,v)=>{await page.evaluate(v=>{document.querySelector(`.tabs button[data-view="${v}"]`).click();scrollTo(0,0);},v);await sleep(800);};
for(const [w,h,phone] of [[390,844,true],[1440,900,false]]){
  const {page}=await open(b,{w,h,phone,supa:'fixture'});await enter(page,BASE);await sleep(500);
  await shot(page,OUT,`${w}-explore`);
  await tab(page,'compare');
  // 비교와 지표: 매트릭스가 보이는 높이까지(멍이가 x축 눈금 100 둘레에 오는지)
  await page.evaluate(()=>{const m=document.querySelector('#compare .matrix, #matrix, #compare [id*=matrix]');if(m)scrollTo(0,scrollY+m.getBoundingClientRect().bottom-innerHeight+90);});await sleep(600);
  await shot(page,OUT,`${w}-compare`);
  await page.context().close();
}
if(GIF){
  const dir=path.join(OUT,'gif-frames');fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
  const {page}=await open(b,{w:390,h:844,dpr:1,supa:'fixture'});await enter(page,BASE);await sleep(600);
  const cdp=await page.context().newCDPSession(page);
  const r=await page.evaluate(()=>{const f=document.querySelector('.bbc-fab').getBoundingClientRect();return {x:f.left+f.width/2,y:f.top+f.height/2};});
  let n=0;const frame=async()=>page.screenshot({path:path.join(dir,String(n++).padStart(3,'0')+'.png')});
  for(let i=0;i<6;i++)await frame();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[r]});
  const to={x:110,y:330};
  for(let i=1;i<=24;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+(to.x-r.x)*i/24,y:r.y+(to.y-r.y)*i/24}]});await sleep(20);await frame();}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  for(let i=0;i<10;i++){await sleep(30);await frame();}
  // 페이지 스크롤: 흐려졌다가 돌아옴
  for(let i=0;i<8;i++){await page.evaluate(()=>scrollBy(0,40));await sleep(40);await frame();}
  for(let i=0;i<12;i++){await sleep(60);await frame();}
  await page.context().close();
}
await b.close();

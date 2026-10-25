// 사용: BASE=http://127.0.0.1:8765/ node verification/2026-10-25-mobile-ux/matrix-taps.mjs (main은 BASE=…8766/)
// 매트릭스 점: 각 점의 보이는 가운데를 손가락으로 눌렀을 때 그 종이 골라지는지(+ 가운데에서 8px 비켜 눌렀을 때)
import {launch,open,sleep,waitData} from './common.mjs';
const b=await launch();
const base=process.env.BASE||'http://127.0.0.1:8765/';
for(const [w,h] of [[360,780],[390,844],[430,932]]){
  const {page,ctx}=await open(b,{w,h,supa:'fixture'});
  await page.addInitScript(()=>{try{localStorage.setItem('bbChatHintSeen','1');}catch{}});
  await page.goto(base+'#v=compare&s=836033');await waitData(page);await sleep(2000);
  const ids=await page.evaluate(()=>[...document.querySelectorAll('#matrix-points .matrix-point.pilot:not([data-clustered])')].map(b=>b.dataset.aphia));
  let ok=0,bad=[],offOk=0,offBad=[];
  for(const id of ids){
    for(const off of [0,8]){
      const c=await page.evaluate(([id,off])=>{const b=document.querySelector(`#matrix-points .matrix-point[data-aphia="${id}"]`);b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();
        // 비켜 누를 때는 가장 가까운 이웃에서 먼 쪽으로
        let dx=0,dy=0;if(off){let best=null,bd=1e9;for(const o of document.querySelectorAll('#matrix-points .matrix-point.pilot')){if(o===b)continue;const q=o.getBoundingClientRect();const d=Math.hypot(q.left+q.width/2-(r.left+r.width/2),q.top+q.height/2-(r.top+r.height/2));if(d<bd){bd=d;best=q;}}
          if(best){const vx=(r.left+r.width/2)-(best.left+best.width/2),vy=(r.top+r.height/2)-(best.top+best.height/2),n=Math.hypot(vx,vy)||1;dx=vx/n*off;dy=vy/n*off;}}
        return {x:r.left+r.width/2+dx,y:r.top+r.height/2+dy};},[id,off]);
      await sleep(150);
      await page.touchscreen.tap(c.x,c.y);await sleep(500);
      const sel=await page.evaluate(()=>String(selected?.aphiaID));
      if(off===0){if(sel===id)ok++;else bad.push(id+'→'+sel);}else{if(sel===id)offOk++;else offBad.push(id+'→'+sel);}
      // 다시 처음 화면 위치로(선택은 그대로 둔다: 사용자가 연달아 누르는 상황)
    }
  }
  console.log(w,'points',ids.length,'center ok',ok,'bad',JSON.stringify(bad),'| 8px-off ok',offOk,'bad',offBad.length);
  await ctx.close();
}
await b.close();

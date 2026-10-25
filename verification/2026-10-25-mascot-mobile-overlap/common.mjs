// 2026-10-25 휴대폰 멍이 가림 점검 도우미. 2026-10-25-mobile-ux/common.mjs(launch·open·waitGate)를 그대로 쓰고, 첫 화면을 지나
// 지도까지 들어가는 것과 '멍이 버튼 아래에 가려진 누를 것'을 재는 것만 더한다.
import {launch,open,sleep,waitGate,waitData,shot} from '../2026-10-25-mobile-ux/common.mjs';
export {launch,open,sleep,waitGate,waitData,shot};

// 첫 화면(지구본) → '바다 탐색하기' → 지도. seen=true면 첫 안내 말풍선을 이미 본 것으로 둔다.
export async function enter(page,base,{seen=true,fabPos=null}={}){
  await page.addInitScript(([seen,fabPos])=>{try{
    if(sessionStorage.getItem('bbOverlapInit'))return;sessionStorage.setItem('bbOverlapInit','1');
    if(seen)localStorage.setItem('bbChatHintSeen','1');else localStorage.removeItem('bbChatHintSeen');
    if(fabPos)localStorage.setItem('bbChatFabPos',JSON.stringify(fabPos));else localStorage.removeItem('bbChatFabPos');
  }catch{}},[seen,fabPos]);
  await page.goto(base);await waitGate(page);await sleep(600);
  await page.evaluate(()=>document.getElementById('gate-enter').click());
  await page.waitForFunction(()=>!document.documentElement.classList.contains('gate-on'),null,{timeout:20000});
  await waitData(page);await sleep(900);
}

// 멍이 버튼 사각형과 겹치는 보이는 누를 것(a, button, summary, [role=button], input). 멍이 자신과 아래 탭바는 뺀다.
// 겹친 칸 안의 점 몇 개를 elementsFromPoint로 찍어, 멍이를 뺀 맨 위가 그 요소(또는 그 안)일 때만 '가려짐'으로 센다:
// 넘침에 잘렸거나 시트에 덮여 원래 보이지 않는 것은 세지 않는다.
export const COVERED=`(()=>{
  const f=document.querySelector('.bbc-fab');if(!f||!f.getClientRects().length)return {fab:null,covered:[]};
  const fr=f.getBoundingClientRect(),out=[];
  for(const e of document.querySelectorAll('a,button,summary,[role=button],input')){
    if(e.closest('.bbc,.tabs'))continue;
    const s=getComputedStyle(e);if(s.visibility==='hidden'||+s.opacity===0)continue;
    for(const r of e.getClientRects()){
      const l=Math.max(r.left,fr.left),t=Math.max(r.top,fr.top),R=Math.min(r.right,fr.right),B=Math.min(r.bottom,fr.bottom);
      if(R-l<1||B-t<1)continue;
      let hit=false;
      for(const fx of [.2,.5,.8])for(const fy of [.2,.5,.8]){
        const x=l+(R-l)*fx,y=t+(B-t)*fy,top=document.elementsFromPoint(x,y).find(n=>!n.closest('.bbc'));
        if(top&&(e===top||e.contains(top)))hit=true;
      }
      if(hit){out.push({tag:e.tagName.toLowerCase(),id:e.id||'',cls:typeof e.className==='string'?e.className.split(' ')[0]:'',
        text:(e.getAttribute('aria-label')||e.innerText||e.value||'').replace(/\\s+/g,' ').trim().slice(0,40),
        box:[Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)]});break;}
    }
  }
  return {fab:[Math.round(fr.left),Math.round(fr.top),Math.round(fr.right),Math.round(fr.bottom)],covered:out};
})()`;

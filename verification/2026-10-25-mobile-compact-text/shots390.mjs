// README용 390px 전후 캡처(main = before 8766, 이 브랜치 = after 8765). 휴대폰(터치)·배율 2·움직임 줄이기·Supabase 저장 사본.
//   node verification/2026-10-25-mobile-compact-text/shots390.mjs
// 만드는 것(shots/): 390-explore-{before,after}(지도 첫 화면) · 390-explore-legend-{before,after}('범례' → 'ⓘ 범례'를 누른 뒤:
// before는 범례 칸 안에서 펼침, after는 시트) · 390-explore-value-{before,after}(활용 × 보전 '읽는 법 ⓘ') ·
// 390-compare-read-{before,after}('읽는 법' 팝업) · 390-method-02/03-{before,after}(근거와 방법 02·03 펼침)
import path from 'node:path';
import {launch,open,sleep,waitData} from '../2026-10-25-mobile-ux/common.mjs';
const SHOTS='verification/2026-10-25-mobile-compact-text/shots';
const SIDES={before:process.env.A||'http://127.0.0.1:8766/',after:process.env.B||'http://127.0.0.1:8765/'};
const b=await launch();
for(const [tag,base] of Object.entries(SIDES)){
  const {page:p,ctx}=await open(b,{w:390,h:844,dpr:2,phone:true,supa:'fixture',reducedMotion:'reduce'});
  await ctx.addInitScript(()=>{try{localStorage.setItem('bbChatHintSeen','1');}catch{}});
  const go=async v=>{await p.goto('about:blank');await p.goto(base+'#v='+v+'&s=836033');await waitData(p);await p.waitForLoadState('networkidle').catch(()=>{});await sleep(2500);};
  const snap=async(name,full=false)=>p.screenshot({path:path.join(SHOTS,`390-${name}-${tag}.png`),fullPage:full,animations:'disabled',caret:'hide'});
  await go('explore');await snap('explore');
  await p.click('#legend-toggle');await sleep(600);
  await p.click('.map-legend-more>summary');await sleep(800);await snap('explore-legend');
  await go('explore');await p.click('[data-map-mode=value]');await sleep(1500);await p.click('#value-info');await sleep(800);await snap('explore-value');
  await go('compare');await p.click('#cmp-read-toggle');await sleep(800);
  await p.locator('#cmp-read-pop').screenshot({path:path.join(SHOTS,`390-compare-read-${tag}.png`),animations:'disabled'});
  await go('method');
  for(const n of ['02','03']){await p.evaluate(n=>{const d=document.getElementById('mt-acc-'+n);d.open=true;},n);await sleep(500);
    await p.locator('#method-'+n).screenshot({path:path.join(SHOTS,`390-method-${n}-${tag}.png`),animations:'disabled'});}
  await ctx.close();
}
await b.close();console.log('390 shots done');

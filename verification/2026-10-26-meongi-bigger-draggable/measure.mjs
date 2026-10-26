// 멍이 버튼 자리·크기와 주변(헤더·탭줄·시트·트레이) 간격을 잰다. node verification/2026-10-26-meongi-bigger-draggable/measure.mjs [base]
import {launch,open,sleep} from './common.mjs';
import {enter} from '../2026-10-25-mascot-mobile-overlap/common.mjs';
const base=process.argv[2]||'http://127.0.0.1:8765/';
const browser=await launch();
const out={};
for(const [w,h,phone] of [[390,844,true],[1440,900,false]]){
  const {page,errors}=await open(browser,{w,h,phone,supa:'fixture'});
  await enter(page,base);
  for(const tab of ['explore','compare','method']){
    await page.evaluate(t=>{document.querySelector(`.tabs button[data-view="${t}"]`)?.click();scrollTo(0,0);},tab);await sleep(700);
    out[`${w}-${tab}`]=await page.evaluate(()=>{const R=e=>{if(!e||!e.getClientRects().length)return null;const r=e.getBoundingClientRect();return [r.left,r.top,r.width,r.height].map(Math.round);};
      const f=document.querySelector('.bbc-fab'),svg=f.querySelector('svg');
      return {fab:R(f),svg:R(svg),svgAttr:svg&&[svg.getAttribute('width'),svg.getAttribute('viewBox')],header:R(document.querySelector('header,.topbar,.site-header')),
        tabs:R(document.querySelector('.tabs')),tray:R(document.getElementById('cmp-tray')),sheet:R(document.querySelector('#explore .species-sheet,#explore .side,#explore aside')),
        cursor:getComputedStyle(f).cursor,vw:innerWidth,vh:innerHeight};});
  }
  out[`${w}-errors`]=errors;
}
console.log(JSON.stringify(out,null,1));
await browser.close();

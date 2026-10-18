// Overflow / tiny-target audit per tab at a given width
import {chromium,open,sleep} from './common.mjs';
const W=+(process.env.W||390),H=+(process.env.H||844);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const {page}=await open(b,{w:W,h:H});
await page.goto('http://127.0.0.1:8765/?fresh='+Math.random());
await page.waitForFunction(()=>/연결됨/.test(document.getElementById('connection-state')?.textContent||''),null,{timeout:60000});
await sleep(2500);await page.click('.gate-enter');await sleep(2500);
for(const v of ['explore','compare','method']){
  await page.evaluate(v=>{scrollTo(0,0);document.querySelector(`[data-view=${v}]`).click()},v);await sleep(1500);
  const r=await page.evaluate(()=>{const vw=innerWidth;const vis=e=>{const s=getComputedStyle(e);return e.offsetParent&&s.visibility!=='hidden'};
    const over=[...document.querySelectorAll('body *')].filter(e=>vis(e)&&e.getBoundingClientRect().right>vw+1&&!e.closest('[style*=overflow],.leaflet-container,.sp-list,#species-list,.table-wrap,.cmp-table-wrap')).slice(0,6).map(e=>(e.id||e.className||e.tagName)+':'+Math.round(e.getBoundingClientRect().right));
    const small=[...document.querySelectorAll('button,a,input,select,summary,[role=button]')].filter(e=>vis(e)).map(e=>{const b=e.getBoundingClientRect();return {t:(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,18),w:Math.round(b.width),h:Math.round(b.height)}}).filter(x=>x.h>0&&(x.h<32||x.w<32));
    const fonts={};[...document.querySelectorAll('body *')].filter(e=>vis(e)&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).forEach(e=>{const f=Math.round(parseFloat(getComputedStyle(e).fontSize));fonts[f]=(fonts[f]||0)+1});
    return {pageH:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,over,smallN:small.length,small:small.slice(0,15),fonts}});
  console.log(W,v,JSON.stringify(r));
}
await b.close();

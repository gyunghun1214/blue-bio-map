// Map '공개 집계 기간' chip (2026-10-26): the value text never runs under the caret. Playwright, Chromium and WebKit
// (WebKit stands in for iOS Safari, which this check cannot run). At 360·390·768·1440, for every period of a species with
// three periods ('전체', '2000–2015', '2000년 이전', '2016–2026'), picked through the chip's own menu:
//   - the value <b> ends at least 4px left of the caret, and is not cut (scrollWidth fits)
//   - one caret in the chip (one ::before/::after with content, no svg/img)
//   - the chip crosses neither '출현 기록 / 활용 × 보전', '위성 · 수심' nor the zoom buttons
//   - no sideways page scroll; the map's layers and the link change with the period; the font size is the same for every pick
//   - keyboard focus (Tab from '활용 × 보전') shows a focus ring on the chip; the open menu is not under another control
// Usage: node verification/period_chip_check.mjs <output-directory> [--serve]   (site served at URL0, default http://127.0.0.1:8765/)
//   --serve: serve dist/ on 127.0.0.1:8765 from this script (the CI Playwright container has no Python)
//   ENGINES=chromium,webkit (default both) · SIZES=360,390,768,1440 · Playwright from `import('playwright')`, else PW_REQUIRE
//   (a folder whose node_modules has it, e.g. /opt/node-tools/). The species list comes from dist/live-snapshot.json.
import fs from 'node:fs'; import path from 'node:path'; import {createRequire} from 'node:module'; import {fileURLToPath} from 'node:url';
const OUT=process.argv[2];
if(!OUT)throw Error('Usage: node verification/period_chip_check.mjs <output-directory>');
fs.mkdirSync(OUT,{recursive:true});
const pw=await import('playwright').catch(()=>createRequire(process.env.PW_REQUIRE||import.meta.url)('playwright'));
const HERE=path.dirname(fileURLToPath(import.meta.url));
const fx=JSON.parse(fs.readFileSync(path.join(HERE,'..','dist','live-snapshot.json'),'utf8'));
const URL0=process.env.URL0||'http://127.0.0.1:8765/';
if(process.argv.includes('--serve')){
  const http=await import('node:http'),DIST=path.join(HERE,'..','dist');
  const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp','.jpg':'image/jpeg'};
  const server=http.createServer((q,r)=>{let f=path.join(DIST,decodeURIComponent(new URL(q.url,URL0).pathname));
    if(!f.startsWith(DIST)){r.writeHead(403).end();return;}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');
    fs.readFile(f,(e,b)=>e?r.writeHead(404).end():r.writeHead(200,{'content-type':TYPES[path.extname(f)]||'application/octet-stream'}).end(b));});
  await new Promise(ok=>server.listen(8765,'127.0.0.1',ok));server.unref();
}
const ENGINES=(process.env.ENGINES||'chromium,webkit').split(',');
const SIZES=(process.env.SIZES||'360,390,768,1440').split(',').map(Number);
const SPECIES=377084; // three periods in the snapshot: 2000–2015, 2000년 이전, 2016–2026
const results=[];let fails=0;
const check=(name,ok,detail='')=>{results.push({name,ok,detail});if(!ok)fails++;console.log(`${ok?'PASS':'FAIL'} ${name}${ok?'':' '+JSON.stringify(detail).slice(0,500)}`);};

// Runs in the page: the chip, its caret (the ::after box turned by its transform) and the controls around it.
const measure=()=>{
  const t=document.querySelector('#period-filter .pf-toggle'),v=t.querySelector('b'),k=t.querySelector('.pf-k');
  const r=t.getBoundingClientRect(),a=getComputedStyle(t,'::after');
  const px=x=>parseFloat(x)||0;
  const bw=a.boxSizing==='border-box'?px(a.width):px(a.width)+px(a.borderLeftWidth)+px(a.borderRightWidth)+px(a.paddingLeft)+px(a.paddingRight);
  const bh=a.boxSizing==='border-box'?px(a.height):px(a.height)+px(a.borderTopWidth)+px(a.borderBottomWidth)+px(a.paddingTop)+px(a.paddingBottom);
  const m=a.transform&&a.transform!=='none'?new DOMMatrix(a.transform):new DOMMatrix();
  const cx=r.right-px(a.right)-bw/2, half=(Math.abs(m.a)*bw+Math.abs(m.c)*bh)/2;
  const pseudo=['::before','::after'].flatMap(p=>[t,...t.querySelectorAll('*')].filter(e=>{const s=getComputedStyle(e,p);return s.content&&s.content!=='none'&&s.content!=='normal'&&s.display!=='none';}));
  const box=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return b.width&&b.height&&getComputedStyle(e).visibility!=='hidden'?{l:b.left,t:b.top,r:b.right,b:b.bottom,s}:null;};
  const chip=t.parentElement.getBoundingClientRect();
  return {font:getComputedStyle(t).fontSize,value:v.textContent,vRight:v.getBoundingClientRect().right,vCut:v.scrollWidth>v.clientWidth+1,
    kCut:k.scrollWidth>k.clientWidth+1,caretLeft:cx-half,caretRight:cx+half,toggleRight:r.right,carets:pseudo.length+t.querySelectorAll('svg,img').length,
    chip:{l:chip.left,t:chip.top,r:chip.right,b:chip.bottom},others:['#explore .map-mode','#explore .basemap-switch','.leaflet-control-zoom'].map(box).filter(Boolean),
    sideways:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    layers:typeof overlay!=='undefined'?overlay.getLayers().length:-1,hash:location.hash};
};
const crosses=(a,b)=>a.l<b.r&&b.l<a.r&&a.t<b.b&&b.t<a.b;

for(const engine of ENGINES){
  const browser=await pw[engine].launch();
  for(const W of SIZES){
    const phone=W<700, tag=`${engine}-${W}`;
    const ctx=await browser.newContext({viewport:{width:W,height:phone?844:900},isMobile:phone&&engine!=='firefox',hasTouch:phone,deviceScaleFactor:2});
    const page=await ctx.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    // Outside requests cut off (map tiles do not matter here); the species API answers from the snapshot.
    await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/,r=>r.abort());
    await page.route(/\/rest\/v1\/species_profiles/,r=>r.fulfill({json:fx.profiles}));
    await page.route(/\/rest\/v1\/species_map_cells/,r=>r.fulfill({json:fx.cells}));
    await page.goto(`${URL0}#s=${SPECIES}&v=explore`);
    await page.waitForFunction(()=>/연결됨|불러오기 실패|연결 실패/.test(document.getElementById('connection-state')?.textContent||''),null,{timeout:30000});
    if(await page.evaluate(()=>document.documentElement.classList.contains('gate-on'))){
      await page.waitForFunction(()=>document.getElementById('site-gate').classList.contains('is-ready'),null,{timeout:30000});
      await page.click('#gate-enter');await page.waitForTimeout(1200);
    }
    await page.waitForSelector('#period-filter .pf-toggle',{timeout:30000});await page.waitForTimeout(600);
    const periods=await page.$$eval('#pf-menu [data-period]',b=>b.map(x=>x.dataset.period));
    check(`${tag}: species has the four choices`,periods.length===4,periods);
    const seen=[];
    for(const p of [...periods.slice(1),periods[0]]){
      await page.click('#period-filter .pf-toggle');
      await page.waitForSelector('#pf-menu:not([hidden])');
      const covered=await page.$$eval('#pf-menu [data-period]',b=>b.filter(x=>{const r=x.getBoundingClientRect();return !x.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));}).map(x=>x.dataset.period));
      check(`${tag}: open menu not under another control`,!covered.length,covered);
      await page.click(`#pf-menu [data-period="${p}"]`);await page.waitForTimeout(400);
      const m=await page.evaluate(measure);seen.push({p,m});
      const label=p==='all'?'전체':p;
      check(`${tag} ${label}: value shown`,m.value===label,m.value);
      check(`${tag} ${label}: value ends ≥4px left of the caret (gap ${(m.caretLeft-m.vRight).toFixed(1)}px, ${m.font})`,m.vRight<=m.caretLeft-4,{vRight:m.vRight,caretLeft:m.caretLeft});
      check(`${tag} ${label}: value not cut`,!m.vCut);
      check(`${tag} ${label}: caret inside the chip`,m.caretRight<=m.toggleRight);
      check(`${tag} ${label}: one caret`,m.carets===1,m.carets);
      const hit=m.others.filter(o=>crosses(m.chip,o));
      check(`${tag} ${label}: chip crosses no other map control`,!hit.length,hit.map(o=>o.s));
      check(`${tag} ${label}: no sideways scroll`,m.sideways<=0,m.sideways);
      check(`${tag} ${label}: link carries the period`,p==='all'?!/[#&]p=/.test(m.hash):new URLSearchParams(m.hash.slice(1)).get('p')===p,m.hash);
      await page.screenshot({path:path.join(OUT,`${tag}-${label.replace(/[^\w가-힣]+/g,'_')}.png`),clip:{x:Math.max(0,m.chip.l-8),y:Math.max(0,m.chip.t-8),width:Math.min(W-Math.max(0,m.chip.l-8),m.chip.r-m.chip.l+16),height:m.chip.b-m.chip.t+16}});
    }
    check(`${tag}: same font size for every pick`,new Set(seen.map(x=>x.m.font)).size===1,seen.map(x=>x.m.font));
    const all=seen.find(x=>x.p==='all').m.layers;
    check(`${tag}: the map redraws for a period`,seen.some(x=>x.p!=='all'&&x.m.layers!==all)&&all>0,seen.map(x=>[x.p,x.m.layers]));
    // keyboard: Tab from the last map-mode button reaches the chip with a visible ring
    await page.focus('#explore .map-mode button:last-child');await page.keyboard.press('Tab');
    const ring=await page.evaluate(()=>{const a=document.activeElement,s=getComputedStyle(a);return {on:a.classList.contains('pf-toggle'),outline:s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0,shadow:s.boxShadow!=='none'};});
    if(engine==='webkit'&&!ring.on)check(`${tag}: focus ring (WebKit Tab skips buttons by default; checked by focus())`,await page.evaluate(()=>{const t=document.querySelector('#period-filter .pf-toggle');t.focus({focusVisible:true});const s=getComputedStyle(t);return s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0||s.boxShadow!=='none';}));
    else check(`${tag}: Tab reaches the chip with a focus ring`,ring.on&&(ring.outline||ring.shadow),ring);
    check(`${tag}: no page errors`,!errors.length,errors);
    await ctx.close();
  }
  await browser.close();
}
fs.writeFileSync(path.join(OUT,'period-chip-results.json'),JSON.stringify(results,null,1));
console.log(`${results.length-fails} PASS / ${fails} FAIL`);
process.exit(fails?1:0);

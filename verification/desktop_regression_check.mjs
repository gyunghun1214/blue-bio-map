// Isolated browser regression, using the Playwright already installed by the WebKit CI job.
// Usage: node verification/desktop_regression_check.mjs <out> [--report]
// SOURCE_DIST selects the baseline dist; ENGINES defaults to chromium,webkit. Never contacts production APIs.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIST=path.resolve(process.env.SOURCE_DIST||path.join(ROOT,'dist'));
const OUT=process.argv[2],reportOnly=process.argv.includes('--report');
if(!OUT)throw Error('Pass an output directory');
fs.mkdirSync(OUT,{recursive:true});
const pw=await import('playwright').catch(()=>createRequire(process.env.PW_REQUIRE||import.meta.url)('playwright'));
const fixture=JSON.parse(fs.readFileSync(path.join(DIST,'live-snapshot.json'),'utf8'));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png'};
const server=http.createServer((q,r)=>{
  let file=path.resolve(DIST,'.'+decodeURIComponent(new URL(q.url,'http://localhost').pathname));
  if(file!==DIST&&!file.startsWith(DIST+path.sep)){r.writeHead(403).end();return;}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  fs.readFile(file,(err,b)=>err?r.writeHead(404).end():r.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'}).end(b));
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}/`;
const rows=[];let failed=0,harnessFailed=false;
const check=(name,ok,detail)=>{rows.push({name,ok,detail});if(!ok)failed++;console.log(`${ok?'PASS':'FAIL'} ${name}${ok?'':' '+JSON.stringify(detail??null).slice(0,1200)}`);};
const measure=rootSelector=>{
  const root=document.querySelector(rootSelector),broken=[];
  const visible=e=>{for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||p.inert||s.display==='none'||s.visibility==='hidden'||s.opacity==='0')return false;if(p.tagName==='DETAILS'&&!p.open&&!p.querySelector(':scope > summary')?.contains(e))return false;}return true;};
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  for(let n=walker.nextNode();n;n=walker.nextNode()){
    const e=n.parentElement;
    if(!visible(e)||e.closest('.sr-only,script,style,svg,.hidden-label'))continue;
    const box=e.getBoundingClientRect();if(box.width<2||box.height<2)continue;
    for(const word of n.nodeValue.matchAll(/[A-Za-z가-힣][A-Za-z가-힣0-9]+/g)){
      const range=document.createRange();range.setStart(n,word.index);range.setEnd(n,word.index+word[0].length);
      const rects=[...range.getClientRects()].filter(r=>r.width>1&&r.height>1);
      if(new Set(rects.map(r=>Math.round(r.top/4))).size>1)broken.push({word:word[0],selector:e.id?'#'+e.id:e.tagName+'.'+e.className});
    }
  }
  return {broken,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
};
const sizes=[[360,740],[390,844],[430,932],[844,390],[1280,720],[1366,768],[1440,900]];
async function context(browser,options={}){
  const ctx=await browser.newContext({reducedMotion:'reduce',...options});
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/,r=>r.abort());
  await ctx.route(/\/rest\/v1\/species_profiles/,r=>r.fulfill({json:fixture.profiles}));
  await ctx.route(/\/rest\/v1\/species_map_cells/,r=>r.fulfill({json:fixture.cells}));
  return ctx;
}
try{
  for(const engine of (process.env.ENGINES||'chromium,webkit').split(',')){
    const browser=await pw[engine].launch(engine==='chromium'?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{});
    try{
      for(const [width,height] of sizes)for(const lang of ['ko','en']){
        const tag=`${engine}-${lang}-${width}x${height}`;
        const ctx=await context(browser,{viewport:{width,height},hasTouch:width<900});
        const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
        try{
          await page.goto(`${base}?lang=${lang}#s=236157&v=explore`);
          await page.waitForFunction(()=>typeof data!=='undefined'&&data?.species?.length===30);
          await page.evaluate(()=>document.fonts.ready);
          await page.waitForFunction(()=>!document.documentElement.classList.contains('gate-on'));
          const capture=async(name,selector)=>{
            const m=await page.evaluate(measure,selector);
            check(`${tag} ${name}: intact words`,!m.broken.length,m.broken);
            check(`${tag} ${name}: no page horizontal scroll`,m.overflow<=1,m.overflow);
            if(engine==='chromium')await page.screenshot({path:path.join(OUT,`${tag}-${name}.png`),animations:'disabled'});
          };
          await capture('explore','#explore');
          await page.evaluate(()=>{setView('compare');cmpBasket=[];toggleBasket(236157);toggleBasket(241776);});
          await page.waitForTimeout(200);
          if(width>1100){
            const b=await page.locator('#cmp-compare-go').boundingBox();
            check(`${tag}: compare action visible after adding species`,b&&b.y>=0&&b.y+b.height<=height,b);
            const clear=await page.locator('#cmp-compare-go').evaluate(button=>{
              const b=button.getBoundingClientRect();
              return [...document.querySelectorAll('.bbc-fab,.bbc-hint:not([hidden])')].every(e=>{
                const r=e.getBoundingClientRect();return r.right<=b.left||r.left>=b.right||r.bottom<=b.top||r.top>=b.bottom;
              });
            });
            check(`${tag}: mascot and hint leave compare action clear`,clear);
          }
          await capture('compare','#compare');
          await page.evaluate(()=>openCompareDialog());
          await capture('side-by-side','#cmp-dialog');
          await page.evaluate(()=>document.querySelector('#cmp-dialog').close());
          await page.evaluate(()=>{setCompareMode('matrix');window.__hiddenWrites=0;window.__auditObserver=new MutationObserver(m=>window.__hiddenWrites+=m.length);window.__auditObserver.observe(document.querySelector('#species-list'),{childList:true,subtree:true});});
          for(const step of [0,5,10,15,20]){await page.evaluate(k=>setBbviStep(k),step);await page.waitForTimeout(50);}
          check(`${tag}: weight drag leaves hidden explore DOM alone`,await page.evaluate(()=>window.__hiddenWrites===0),await page.evaluate(()=>window.__hiddenWrites));
          await page.evaluate(()=>{window.__auditObserver.disconnect();setView('explore');});
          check(`${tag}: latest weight appears after returning to map`,await page.evaluate(()=>document.querySelector('.sp-bbvi .sp-num')?.textContent===scoreText(selected,'BBVI',pilotScore(selected,'BBVI'))));
          await page.goto(`${base}expedition.html?lang=${lang}#view=cards`);
          await page.waitForFunction(()=>!document.body.classList.contains('is-loading'));
          await page.evaluate(()=>document.fonts.ready);
          await page.locator('#cards-list [data-detail="0"]').click();
          await capture('expedition-detail','#detail');
          check(`${tag}: no page errors`,!errors.length,errors);
        }finally{await ctx.close();}
      }
      if(engine==='chromium'){
        const ctx=await context(browser,{viewport:{width:1440,height:900},reducedMotion:'no-preference'});
        await ctx.addInitScript(()=>{
          window.__seaDraws=0;
          for(const name of ['WebGLRenderingContext','WebGL2RenderingContext'])for(const method of ['drawArrays','drawElements']){
            const p=window[name]?.prototype;if(!p)continue;const original=p[method];
            p[method]=function(...args){window.__seaDraws++;return original.apply(this,args);};
          }
        });
        const page=await ctx.newPage();
        try{
          await page.goto(base+'expedition.html#stop=0');
          await page.waitForFunction(()=>!document.body.classList.contains('is-loading'));
          const available=await page.locator('#view-toggle').isEnabled();
          check('3D lifecycle: WebGL scene available',available);
          if(available){
            await page.waitForTimeout(300);const active0=await page.evaluate(()=>window.__seaDraws);
            await page.waitForTimeout(500);const active1=await page.evaluate(()=>window.__seaDraws);
            check('3D lifecycle: visible sea draws',active1>active0,{active0,active1});
            await page.locator('#view-toggle').click();const cards0=await page.evaluate(()=>window.__seaDraws);
            await page.waitForTimeout(1000);const cards1=await page.evaluate(()=>window.__seaDraws);
            check('3D lifecycle: zero draws in card mode',cards1===cards0,{cards0,cards1});
            for(let i=0;i<20;i++){await page.locator('#view-toggle').click();await page.waitForTimeout(20);await page.locator('#view-toggle').click();}
            const end0=await page.evaluate(()=>window.__seaDraws);await page.waitForTimeout(300);
            check('3D lifecycle: no leaked loop after 20 toggles',end0===await page.evaluate(()=>window.__seaDraws));
          }
        }finally{await ctx.close();}
      }
    }finally{await browser.close();}
  }
}catch(e){harnessFailed=true;check('Harness completed',false,e.stack);}
finally{
  server.close();fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({failed,reportOnly,rows},null,2));
}
if(harnessFailed||(failed&&!reportOnly))process.exitCode=1;

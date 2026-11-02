const {chromium}=require('playwright');
const base='http://127.0.0.1:8765/',out=process.argv[2];
(async()=>{
  const b=await chromium.launch();const res=[];
  async function run(vw,lang,motion,shots){
    const ctx=await b.newContext({viewport:vw===390?{width:390,height:844}:{width:1440,height:900},reducedMotion:motion,deviceScaleFactor:2});const p=await ctx.newPage();
    const errors=[];p.on('pageerror',e=>errors.push('pageerror '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await p.route('**/rest/v1/**',r=>r.abort());await p.route(/https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
    await p.route('**/api/ask',async r=>{const q=r.request();if(q.method()==='POST')await new Promise(s=>setTimeout(s,7000));
      await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(q.method()==='POST'?{answer:lang==='en'?'This is the wave test answer.':'파도 시험 답입니다.'}:{ai:true})});});
    await p.goto(base+(lang==='en'?'?lang=en':''));await p.waitForTimeout(2500);
    if(await p.locator('#gate-enter').isVisible().catch(()=>false))await p.click('#gate-enter');
    await p.waitForFunction(()=>!document.documentElement.classList.contains('gate-on'),null,{timeout:20000}).catch(()=>{});await p.waitForTimeout(1500);
    await p.click('.bbc-fab',{force:true});await p.waitForTimeout(900);
    await p.evaluate(()=>{const i=document.querySelector('.bbc-input');i.value='zqxj 파도 시험';document.querySelector('.bbc-form').requestSubmit();});
    await p.waitForSelector('.bbc-wave',{timeout:5000});await p.waitForTimeout(400);
    const tag=`${vw}-${lang}-${motion==='reduce'?'still':'motion'}`;
    const st=await p.evaluate(()=>{const m=document.querySelector('.bbc-wait'),w=m.querySelector('.bbc-wave'),a=m.getBoundingClientRect(),c=w.getBoundingClientRect(),cs=getComputedStyle(w.querySelector('.bbc-wave-wash'));
      return {text:m.childNodes[0].textContent,hidden:w.getAttribute('aria-hidden'),inside:c.left>=a.left-0.5&&c.right<=a.right+0.5&&c.bottom<=a.bottom+0.5,w:Math.round(c.width),h:Math.round(c.height),
        anim:cs.animationName,hscroll:document.scrollingElement.scrollWidth>innerWidth,logScroll:(l=>l.scrollWidth>l.clientWidth)(document.querySelector('.bbc-log'))};});
    const panel=p.locator('.bbc-panel');
    if(shots){await panel.screenshot({path:`${out}/after-${tag}.png`});}
    if(shots==='gif'){for(let i=0;i<12;i++){await p.locator('.bbc-wait').screenshot({path:`${out}/frames/f${String(i).padStart(2,'0')}.png`});await p.waitForTimeout(120);}}
    if(shots==='before'){await p.evaluate(()=>document.querySelector('.bbc-wave').remove());await panel.screenshot({path:`${out}/before-${tag}.png`});}
    await p.waitForFunction(()=>!document.querySelector('.bbc-wait'),null,{timeout:12000});await p.waitForTimeout(300);
    const end=await p.evaluate(()=>({left:document.querySelectorAll('.bbc-wait,.bbc-wave').length,last:[...document.querySelectorAll('.bbc-log .bbc-bot')].at(-1).childNodes[0].textContent}));
    if(shots)await panel.screenshot({path:`${out}/answered-${tag}.png`});
    res.push({tag,...st,...end,errors});await ctx.close();
  }
  for(const vw of [390,1440])for(const lang of ['ko','en'])for(const motion of ['no-preference','reduce'])
    await run(vw,lang,motion,lang==='ko'?(vw===1440&&motion==='no-preference'?'gif':'before'):(vw===390&&motion==='no-preference'?'shot':null));
  console.log(JSON.stringify(res,null,1));await b.close();
})();

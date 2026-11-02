const {chromium}=require('playwright');
const OUT=process.argv[2];
const MOCK=`window.__fetch0=window.fetch;window.fetch=(u,i)=>String(u).includes('api/ask')?Promise.resolve(new Response(JSON.stringify(i?.method==='POST'?{answer:'시험 답입니다.'}:{ai:true}),{status:200,headers:{'content-type':'application/json'}})):window.__fetch0(u,i);`;
(async()=>{
  const b=await chromium.launch();const report=[];
  for(const [tag,port] of [['before',8766],['after',8765]])for(const w of [390,1440])for(const lang of ['ko','en'])for(const ai of [false,true]){
    if(tag==='before'&&ai)continue;
    const ctx=await b.newContext({viewport:{width:w,height:w===390?844:900},deviceScaleFactor:1,isMobile:w===390,hasTouch:w===390});
    await ctx.addInitScript(()=>{try{sessionStorage.setItem('bbvm-intro-entered','1')}catch{}});
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
    const p=await ctx.newPage();const errs=[];
    p.on('pageerror',e=>errs.push('pageerror '+e.message));
    p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_FAILED|net::/.test(m.text()))errs.push(m.text());});
    await p.goto(`http://127.0.0.1:${port}/${lang==='en'?'?lang=en':''}`,{waitUntil:'load'});await p.waitForTimeout(2500);
    if(ai)await p.evaluate(MOCK);
    await p.click('.bbc-fab');await p.waitForTimeout(1200);
    let aiTag=null;
    if(ai){await p.fill('.bbc-input','zqxj 시험');await p.evaluate(()=>document.querySelector('.bbc-form').requestSubmit());await p.waitForTimeout(1500);
      aiTag=await p.evaluate(()=>[...document.querySelectorAll('.bbc-log .bbc-bot')].at(-1)?.querySelector('.bbc-ai-tag')?.textContent||'');}
    const info=await p.evaluate(()=>{const log=document.querySelector('.bbc-log').getBoundingClientRect(),f=document.querySelector('.bbc-form').getBoundingClientRect();
      return {note:document.querySelector('.bbc-note')?.textContent??null,welcome:document.querySelector('.bbc-log [data-welcome]')?.textContent||'',gap:Math.round(f.top-log.bottom),logH:Math.round(log.height)};});
    const name=`${tag}-${w}-${lang}${ai?'-ai':''}.png`;
    await p.locator('.bbc-panel').screenshot({path:`${OUT}/${name}`});
    report.push({name,...info,aiTag,errs});await ctx.close();
  }
  await b.close();console.log(JSON.stringify(report,null,1));
})();

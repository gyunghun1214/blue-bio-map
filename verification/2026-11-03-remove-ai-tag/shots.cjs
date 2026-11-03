// 멍이 AI 답 아래 'AI 답변' 표시 지우기 캡처(2026-11-03). before = 바꾸기 전 main(8766), after = 이 브랜치(8765).
// 390×844·1440×900, 한국어·?lang=en, 가짜 /api/ask로 AI를 켠 상태에서 FAQ에 없는 질문 "zqxj 시험"을 보낸다.
// Run: node verification/2026-11-03-remove-ai-tag/shots.cjs verification/2026-11-03-remove-ai-tag
const {chromium}=require('playwright');
const OUT=process.argv[2];
const MOCK=`window.__fetch0=window.fetch;window.fetch=(u,i)=>String(u).includes('api/ask')?Promise.resolve(new Response(JSON.stringify(i?.method==='POST'?{answer:'지도 위쪽의 ‘출현 기록’ 버튼을 눌러 보세요.'}:{ai:true}),{status:200,headers:{'content-type':'application/json'}})):window.__fetch0(u,i);`;
(async()=>{
  const b=await chromium.launch();const report=[];
  for(const [tag,port] of [['before',8766],['after',8765]])for(const w of [390,1440])for(const lang of ['ko','en']){
    const ctx=await b.newContext({viewport:{width:w,height:w===390?844:900},deviceScaleFactor:1,isMobile:w===390,hasTouch:w===390});
    await ctx.addInitScript(()=>{try{sessionStorage.setItem('bbvm-intro-entered','1')}catch{}});
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
    const p=await ctx.newPage();const errs=[];
    p.on('pageerror',e=>errs.push('pageerror '+e.message));
    p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_FAILED|net::/.test(m.text()))errs.push(m.text());});
    await p.goto(`http://127.0.0.1:${port}/${lang==='en'?'?lang=en':''}`,{waitUntil:'load'});await p.waitForTimeout(2500);
    await p.evaluate(MOCK);
    await p.click('.bbc-fab');await p.waitForTimeout(1200);
    // FAQ 답 하나(칩) 뒤에 AI 답을 받고, AI 답 말풍선 아래 여백(글 끝~말풍선 끝)을 첫 인사 말풍선과 비교한다
    await p.locator('.bbc-log button').first().click();await p.waitForTimeout(800);
    await p.fill('.bbc-input','zqxj 시험');await p.evaluate(()=>document.querySelector('.bbc-form').requestSubmit());await p.waitForTimeout(1500);
    const info=await p.evaluate(()=>{const bots=[...document.querySelectorAll('.bbc-log .bbc-bot')],ai=bots.at(-1),welcome=document.querySelector('.bbc-log [data-welcome]');
      const pad=e=>{if(!e)return null;const r=e.getBoundingClientRect();const rg=document.createRange();rg.selectNodeContents(e.firstChild);return Math.round(r.bottom-rg.getBoundingClientRect().bottom);};
      return {welcome:document.querySelector('.bbc-log [data-welcome]')?.textContent||'',aiClass:ai.classList.contains('bbc-ai'),aiText:ai.textContent.trim(),aiTag:ai.querySelector('.bbc-ai-tag')?.textContent||'',aiBottomPad:pad(ai),welcomeBottomPad:pad(welcome)};});
    const name=`${tag}-${w}-${lang}-ai.png`;
    await p.locator('.bbc-panel').screenshot({path:`${OUT}/${name}`});
    report.push({name,...info,errs});await ctx.close();
  }
  await b.close();console.log(JSON.stringify(report,null,1));
})();

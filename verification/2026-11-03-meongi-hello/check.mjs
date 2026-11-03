// 멍이 첫 인사 말풍선 검사 (2026-11-03, LKH: 첫 화면에서 지도로 넘어온 사람이 멍이를 한 번 눌러 보게).
// dist를 http://127.0.0.1:8765/에 띄운 뒤: node verification/2026-11-03-meongi-hello/check.mjs [사진 폴더]
// 보는 것: 첫 화면을 지나면 말풍선·빛 고리가 뜬다(예전 localStorage bbChatHintSeen이 있어도), 질문 단추를 누르면 대화창이 열려
// 그 답을 한다, 새로고침해 첫 화면을 다시 지나면 또 뜬다, 10초 뒤 스스로 접힌다, 첫 화면 없이 연 같은 탭에서는 다시 뜨지 않는다,
// 글자 12px 이상, 화면 밖으로 나가지 않는다(1440·1280·390·360, 한국어·영어).
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const URL0=process.env.URL0||'http://127.0.0.1:8765/',OUT=process.argv[2]||'';
let pass=0,fail=0;const check=(name,ok,info)=>{ok?pass++:fail++;console.log((ok?'PASS ':'FAIL ')+name+(ok?'':' '+JSON.stringify(info)));};
const b=await chromium.launch();
const gate=async p=>{await p.waitForFunction(()=>{const g=document.getElementById('site-gate');return g&&(g.classList.contains('is-ready')||!document.documentElement.classList.contains('gate-on'))},null,{timeout:40000});await p.keyboard.press('Enter');};
const st=p=>p.evaluate(()=>{const h=document.querySelector('.bbc-hint'),r=h.getBoundingClientRect();
  const sizes=[...h.querySelectorAll('*')].filter(e=>e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3&&n.nodeValue.trim())).map(e=>parseFloat(getComputedStyle(e).fontSize));
  return {hidden:h.hidden,call:document.querySelector('.bbc').classList.contains('bbc-call'),chips:[...h.querySelectorAll('.bbc-hint-chips button')].map(x=>x.dataset.faq),
    title:h.querySelector('.bbc-hint-title').textContent,inView:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,minFont:Math.min(...sizes)};});
for(const [name,vp,mob,lang] of [['1440',{width:1440,height:900},false,''],['1440-en',{width:1440,height:900},false,'?lang=en'],['1280',{width:1280,height:720},false,''],['390',{width:390,height:844},true,''],['390-en',{width:390,height:844},true,'?lang=en'],['360',{width:360,height:740},true,'']]){
  const ctx=await b.newContext({viewport:vp,isMobile:mob,hasTouch:mob,deviceScaleFactor:1,reducedMotion:'no-preference'});
  await ctx.addInitScript(()=>{try{if(!sessionStorage.getItem('chk'))localStorage.setItem('bbChatHintSeen','1');sessionStorage.setItem('chk','1');}catch{}});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL0+lang);await gate(p);await p.waitForTimeout(1800);
  const s=await st(p);
  check(`${name}: 첫 화면을 지나면 말풍선·빛 고리, 질문 단추 overview·indices`,!s.hidden&&s.call&&s.chips.join()==='overview,indices',s);
  check(`${name}: 제목 '${s.title}'`,lang?s.title==="Hi, I'm Meongi!":s.title==='안녕하세요, 멍이예요!',s.title);
  check(`${name}: 화면 안, 글자 12px 이상`,s.inView&&s.minFont>=12,s);
  if(OUT)await p.screenshot({path:`${OUT}/${name}.png`});
  if(name==='1440'||name==='390'){
    await p.click('.bbc-hint-chips button[data-faq="indices"]');await p.waitForTimeout(1200);
    const c=await p.evaluate(()=>({panel:!document.querySelector('.bbc-panel').hidden,hint:document.querySelector('.bbc-hint').hidden,call:document.querySelector('.bbc').classList.contains('bbc-call'),
      user:[...document.querySelectorAll('.bbc-user')].map(e=>e.textContent),bot:[...document.querySelectorAll('.bbc-bot')].length}));
    check(`${name}: 질문 단추 → 대화창이 열리고 그 질문에 답(말풍선·고리는 접힘)`,c.panel&&c.hint&&!c.call&&c.user.join()==='BBVI·MCUI가 뭔가요?'&&c.bot>=2,c);
    await p.mouse.move(5,5);  // 말풍선 위에 마우스가 머물면 접히기를 기다리므로(일부러) 비켜 둔다
    await p.reload();await gate(p);await p.waitForTimeout(1800);
    check(`${name}: 새로고침 → 첫 화면을 다시 지나면 또 뜬다`,!(await st(p)).hidden,null);
    await p.waitForTimeout(11000);  // 첫 화면이 닫히는 데 1초 남짓 걸리고 그때부터 10초
    const t=await st(p);check(`${name}: 10초 뒤 스스로 접힌다`,t.hidden&&!t.call,t);
    // 첫 화면 없이 같은 탭(app 주소 키 v=compare)
    await p.goto(URL0+'#v=explore');await p.waitForTimeout(3000);
    const g=await p.evaluate(()=>({gate:document.documentElement.classList.contains('gate-on'),hidden:document.querySelector('.bbc-hint').hidden}));
    check(`${name}: 첫 화면 없이 연 같은 탭에서는 다시 뜨지 않는다`,g.gate||g.hidden,g);
  }
  check(`${name}: 페이지 오류 0`,!errs.length,errs);
  await ctx.close();
}
await b.close();
console.log(`${pass} PASS / ${fail} FAIL`);process.exit(fail?1:0);

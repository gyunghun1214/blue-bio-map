// 2026-10-25 휴대폰에서 멍이 버튼·첫 안내 말풍선이 내용을 가리지 않게 — 점검과 전/후 캡처.
// 사용: dist를 8765에 띄운 뒤
//   OUT=verification/2026-10-25-mascot-mobile-overlap/after node verification/2026-10-25-mascot-mobile-overlap/check.mjs
//   BASE=http://127.0.0.1:8766/ (고치기 전 main을 띄운 곳) OUT=…/before MODE=shots 로 같은 캡처·가림 목록만 남긴다.
//   PC_BASE=http://127.0.0.1:8766/ 를 주면 1440px 버튼 자리를 그 판과 비교한다(없으면 기본 자리 bottom 16px만 본다).
// Supabase는 dist/live-snapshot.json(SUPA=fixture), 위성 타일은 막는다(TILES=off): 전후가 같은 그림을 보게.
// 결과: <OUT>/result.json(가림 목록·검사 결과), 캡처 png. 검사 하나라도 실패하면 종료 코드 1.
import fs from 'node:fs'; import path from 'node:path';
import {launch,open,enter,sleep,COVERED,shot} from './common.mjs';
process.env.TILES??='off';
const BASE=process.env.BASE||'http://127.0.0.1:8765/';
const PC_BASE=process.env.PC_BASE||'';
const OUT=process.env.OUT||'verification/2026-10-25-mascot-mobile-overlap/after';
const SHOTS_ONLY=process.env.MODE==='shots';
fs.mkdirSync(OUT,{recursive:true});
const res={base:BASE,covered:{},checks:[],overflow:{},errors:[]};
const check=(name,ok,detail)=>{res.checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(ok?'':' '+JSON.stringify(detail)));};
const fabBox=page=>page.evaluate(()=>{const f=document.querySelector('.bbc-fab'),r=f.getBoundingClientRect(),d=document.documentElement;
  return {l:Math.round(r.left),t:Math.round(r.top),r:Math.round(r.right),b:Math.round(r.bottom),w:Math.round(r.width),right:Math.round(d.clientWidth-r.right),bottom:Math.round(d.clientHeight-r.bottom),
    tucked:document.querySelector('.bbc').classList.contains('bbc-tucked'),left:document.querySelector('.bbc').classList.contains('bbc-left'),open:!document.querySelector('.bbc-panel').hidden,
    tx:new DOMMatrixReadOnly(getComputedStyle(f).transform).m41,opacity:+getComputedStyle(f).opacity,transition:getComputedStyle(f).transitionDuration,
    scrollW:d.scrollWidth,clientW:d.clientWidth,focusVisible:f.matches(':focus-visible')};});
const noErrors=errs=>errs.filter(e=>!/ERR_FAILED|ERR_INTERNET_DISCONNECTED|net::ERR_/.test(e));
const tabTo=async(page,v)=>{await page.evaluate(v=>document.querySelector(`.tabs [data-view=${v}]`).click(),v);await sleep(1500);};
const toBottom=async page=>{await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await sleep(1000);};
const b=await launch();
try{
  // ---------- 390: 네 화면 맨 아래 가림, 캡처 ----------
  {
    const {page,errors}=await open(b,{w:390,h:844,supa:'fixture'});
    await enter(page,BASE,{seen:false});
    await sleep(400);
    await shot(page,OUT,'390-explore-first-hint');
    const hint=await page.evaluate(()=>{const h=document.querySelector('.bbc-hint'),f=document.querySelector('.bbc-fab');if(h.hidden)return null;
      const a=h.getBoundingClientRect(),c=f.getBoundingClientRect();return {bottom:Math.round(a.bottom),right:Math.round(a.right),left:Math.round(a.left),top:Math.round(a.top),fabTop:Math.round(c.top),fabRight:Math.round(c.right),vw:innerWidth};});
    res.hint=hint;
    // 탐색 지도: 종 카드 줄(첫 화면) — 말풍선 접은 뒤 그대로, 그리고 카드 줄 끝까지 넘긴 뒤
    await page.evaluate(()=>document.querySelector('.bbc-hint-x').click());await sleep(300);
    res.covered.exploreFirst=await page.evaluate(COVERED);
    await page.evaluate(()=>{const l=document.getElementById('species-list');l.scrollLeft=l.scrollWidth;});await sleep(1000);
    res.covered.exploreCardsEnd=await page.evaluate(COVERED);
    res.cardsEnd=await page.evaluate(()=>{const l=document.getElementById('species-list'),c=[...l.querySelectorAll('.sc-wrap')].at(-1).getBoundingClientRect(),f=document.querySelector('.bbc-fab').getBoundingClientRect();
      return {lastCardRight:Math.round(c.right),fabLeft:Math.round(f.left),padRight:getComputedStyle(l).paddingRight};});
    await shot(page,OUT,'390-explore-cards-end');
    await page.evaluate(()=>{document.getElementById('species-list').scrollLeft=0;});await sleep(800);
    // 스크롤 중(접힘) 캡처
    await page.evaluate(()=>scrollBy(0,300));await sleep(250);
    await shot(page,OUT,'390-explore-scrolling');
    // 탐색 지도 맨 아래(둘째 종을 고른 뒤 상세까지)
    await page.evaluate(()=>{scrollTo(0,0);document.querySelector('#species-list .sc-wrap:nth-child(2) .species-card').click();});await sleep(1200);
    await toBottom(page);
    res.covered.exploreDetailBottom=await page.evaluate(COVERED);
    await shot(page,OUT,'390-explore-detail-bottom');
    for(const v of ['compare','method']){
      await tabTo(page,v);await toBottom(page);
      res.covered[v+'Bottom']=await page.evaluate(COVERED);
      await shot(page,OUT,`390-${v}-bottom`);
    }
    res.errors.push(...noErrors(errors));
    await page.context().close();
    if(!SHOTS_ONLY){
      for(const [k,v] of Object.entries(res.covered))if(/Bottom$/.test(k))check(`390 ${k}: 맨 아래에서 멍이 버튼 아래에 가려진 링크·버튼 없음`,v.fab&&v.covered.length===0,v);
      check('390 종 카드 줄 끝: 마지막 카드가 버튼 왼쪽에서 끝남',res.cardsEnd.lastCardRight<=res.cardsEnd.fabLeft,res.cardsEnd);
      check('390 첫 안내 말풍선: 버튼 바로 위, 오른쪽 끝 2px 안',hint&&hint.bottom<=hint.fabTop&&Math.abs(hint.right-hint.fabRight)<=2&&hint.left>=8,hint);
    }
  }
  // ---------- 1440 캡처(전후 같아야 함) ----------
  {
    const {page,errors}=await open(b,{w:1440,h:900,phone:false,supa:'fixture'});
    await enter(page,BASE);await sleep(500);
    await shot(page,OUT,'1440-explore');
    const before=await fabBox(page);
    await page.evaluate(()=>scrollBy(0,300));await sleep(100);const during=await fabBox(page);await sleep(900);
    await page.evaluate(()=>scrollTo(0,0));await sleep(300);
    res.pc={before,during};
    for(const v of ['compare','method']){await tabTo(page,v);await shot(page,OUT,`1440-${v}`);}
    res.errors.push(...noErrors(errors));
    await page.context().close();
    if(!SHOTS_ONLY){
      let ref=null;
      if(PC_BASE){const o=await open(b,{w:1440,h:900,phone:false,supa:'fixture'});await enter(o.page,PC_BASE);await sleep(500);ref=await fabBox(o.page);await o.ctx.close();}
      check('1440 PC: 스크롤해도 접히지 않고 버튼 자리 그대로',!during.tucked&&!before.tucked&&during.tx===0&&before.bottom===16&&(!ref||ref.right===before.right&&ref.bottom===before.bottom),{before,during,ref});
    }
  }
  if(!SHOTS_ONLY){
    // ---------- 390 동작 ----------
    const {page,errors}=await open(b,{w:390,h:844,supa:'fixture'});
    await enter(page,BASE);
    // 접기: 스크롤 직후 붙고, 크기 48 그대로, 1초 뒤 떨어짐
    await page.evaluate(()=>scrollBy(0,300));await sleep(60);
    const t1=await fabBox(page);await sleep(400);const t2=await fabBox(page);await sleep(1000);const t3=await fabBox(page);
    check('접기: 스크롤 직후 bbc-tucked, 폭 48 그대로, 밀어 넣기 55%·불투명도 .55, 1초 뒤 떨어짐',t1.tucked&&t1.w===48&&Math.abs(t2.tx-26.4)<1&&Math.abs(t2.opacity-.55)<.01&&t2.transition==='0.2s, 0.2s'&&!t3.tucked&&t3.tx===0,{t1,t2,t3});
    check('접힌 버튼이 가로 넘침을 만들지 않음(390)',t2.scrollW<=t2.clientW,t2);
    // 접힌 버튼 누르기: 펼치기만, 다시 누르면 열림
    await page.evaluate(()=>scrollBy(0,-120));await sleep(300);
    let f=await fabBox(page);
    await page.touchscreen.tap(f.l+f.w/2,f.t+f.w/2);await sleep(900);
    const tap1=await fabBox(page);
    await sleep(600);f=await fabBox(page);
    await page.touchscreen.tap(f.l+f.w/2,f.t+f.w/2);await sleep(1200);
    const tap2=await fabBox(page);
    check('접힌 버튼 탭: 대화창은 닫힌 채 펼치기만, 다시 탭하면 열림',f&&!tap1.open&&!tap1.tucked&&tap2.open,{tap1,tap2});
    await page.evaluate(()=>document.querySelector('.bbc-close').click());await sleep(400);
    // 포커스: 키보드 포커스가 있으면 접지 않음
    // 키보드로 옮긴 포커스처럼: 키를 한 번 누른 뒤(키보드 사용 중) 포커스를 주면 :focus-visible이 된다
    await page.keyboard.press('Shift');await page.evaluate(()=>document.querySelector('.bbc-fab').focus());const foc=await fabBox(page);
    await page.evaluate(()=>scrollBy(0,200));await sleep(120);const fk=await fabBox(page);
    check('포커스: 버튼에 키보드 포커스(:focus-visible)가 있으면 스크롤해도 접지 않음',foc.focusVisible&&!fk.tucked,fk);
    await page.evaluate(()=>{document.activeElement.blur();scrollTo(0,0);});await sleep(1000);
    // 종 카드 줄 가로 스크롤 → 접힘
    await page.evaluate(()=>{document.getElementById('species-list').scrollLeft+=200;});await sleep(120);const cr=await fabBox(page);
    check('종 카드 줄 가로 스크롤 중 접힘',cr.tucked,cr);
    await page.evaluate(()=>{document.getElementById('species-list').scrollLeft=0;});await sleep(1000);
    // 지도 끌기(손가락): 끄는 동안 접혀 있고 멈추면 돌아옴
    const mb=await page.evaluate(()=>{const r=document.getElementById('map').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:mb.x,y:mb.y}]});
    for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:mb.x-8*i,y:mb.y+4*i}]});await sleep(30);}
    await sleep(900);const md=await fabBox(page);  // 손가락을 아직 떼지 않음
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(1500);const me=await fabBox(page);
    check('지도 끌기 중 접힘(멈춘 채 손가락을 대고 있어도), 놓고 멈추면 돌아옴',md.tucked&&!me.tucked,{md,me});
    // 끌어 옮기기: 접힌 상태에서 시작해도 손가락이 움직인 만큼 옮겨짐
    await page.evaluate(()=>scrollBy(0,250));await sleep(250);f=await fabBox(page);
    const sx=f.l+f.w/2,sy=f.t+f.w/2,orig={x:f.l-Math.round(f.tx),y:f.t};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:sy}]});
    for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx+(120-sx)*i/8,y:sy+(320-sy)*i/8}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(700);
    const dragged=await fabBox(page);
    const want={x:orig.x+Math.round(120-sx),y:orig.y+Math.round(320-sy)};
    check('끌어 옮기기: 접힌 상태에서 시작해도 원래 자리 기준으로 옮겨지고 대화창은 안 열림',f.tucked&&!dragged.open&&!dragged.tucked&&Math.abs(dragged.l-want.x)<=1&&Math.abs(dragged.t-want.y)<=1,{f,dragged,want});
    await page.evaluate(()=>{localStorage.removeItem('bbChatFabPos');dispatchEvent(new Event('resize'));});await sleep(300);
    res.errors.push(...noErrors(errors));
    await page.context().close();
  }
  if(!SHOTS_ONLY){
    // 옮긴 버튼(왼쪽 위): 왼쪽으로 밀려 접힘, 옆 자리가 넉넉하니 말풍선은 옆
    const {page,errors}=await open(b,{w:390,h:844,supa:'fixture'});
    await enter(page,BASE,{seen:false,fabPos:{mobile:{h:'left',x:16,v:'top',y:140}}});await sleep(300);
    const h=await page.evaluate(()=>{const a=document.querySelector('.bbc-hint').getBoundingClientRect(),f=document.querySelector('.bbc-fab').getBoundingClientRect();return {hidden:document.querySelector('.bbc-hint').hidden,left:Math.round(a.left),fabRight:Math.round(f.right)};});
    await page.evaluate(()=>scrollBy(0,300));await sleep(300);const lt=await fabBox(page);
    check('옮긴 버튼(왼쪽 위): 스크롤 때 왼쪽으로 밀려 접힘, 말풍선은 지금처럼 옆',lt.tucked&&lt.left&&lt.tx<-20&&lt.scrollW<=lt.clientW&&!h.hidden&&h.left>=h.fabRight,{lt,h});
    res.errors.push(...noErrors(errors));
    await page.context().close();
  }
  if(!SHOTS_ONLY){
    // 말풍선: 카드 줄을 가로로 200px 넘기면 바로 접히고 다시 안 뜸
    const {page,errors}=await open(b,{w:390,h:844,supa:'fixture'});
    await enter(page,BASE,{seen:false});await sleep(300);
    const shown=await page.evaluate(()=>!document.querySelector('.bbc-hint').hidden);
    await page.evaluate(()=>{document.getElementById('species-list').scrollLeft+=200;});await sleep(200);
    const after=await page.evaluate(()=>({hidden:document.querySelector('.bbc-hint').hidden,seen:localStorage.getItem('bbChatHintSeen')}));
    check('말풍선: 종 카드 줄을 가로로 200px 넘기면 바로 접히고 bbChatHintSeen 저장',shown&&after.hidden&&after.seen==='1',{shown,after});
    // 옮긴 버튼 옆 자리가 120px보다 좁을 때: 오른쪽 아래 버튼 → 위로
    res.errors.push(...noErrors(errors));
    await page.context().close();
  }
  if(!SHOTS_ONLY){
    // 움직임 줄이기: 시스템 설정, 그리고 사이트의 '움직임 줄이기'(bbvm-reduce-motion=1) — 전환 없이 바로
    for(const [label,opt] of [['시스템 설정',{reducedMotion:'reduce'}],['사이트 스위치',{}]]){
      const {page,errors}=await open(b,{w:390,h:844,supa:'fixture',...opt});
      if(!opt.reducedMotion)await page.addInitScript(()=>{try{localStorage.setItem('bbvm-reduce-motion','1');}catch{}});
      await enter(page,BASE);
      await page.evaluate(()=>scrollBy(0,300));await sleep(80);const r=await fabBox(page);
      check(`움직임 줄이기(${label}): 전환 없이 바로 접힘`,r.tucked&&Math.abs(r.tx-26.4)<1&&/^0s/.test(r.transition),r);
      res.errors.push(...noErrors(errors));
      await page.context().close();
    }
  }
  // ---------- 가로 넘침: 360·390·768·1440, 스크롤 중(접힌 상태) ----------
  if(!SHOTS_ONLY)for(const [w,h,phone] of [[360,780,true],[390,844,true],[768,1024,true],[1440,900,false]]){
    const {page,errors}=await open(b,{w,h,phone,supa:'fixture'});
    await enter(page,BASE);
    const rows=[];
    for(const v of ['explore','compare','method']){
      await tabTo(page,v);await page.evaluate(()=>scrollBy(0,400));await sleep(250);
      const s=await fabBox(page);rows.push({v,scrollW:s.scrollW,clientW:s.clientW,tucked:s.tucked});
    }
    res.overflow[w]=rows;
    check(`${w}px 가로 넘침 없음(스크롤 중)${w<=740?' · 접힘':''}`,rows.every(r=>r.scrollW<=r.clientW&&(w>740?!r.tucked:r.tucked)),rows);
    res.errors.push(...noErrors(errors));
    await page.context().close();
  }
  if(!SHOTS_ONLY)check('콘솔 오류 없음',res.errors.length===0,res.errors);
}finally{await b.close();}
fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify(res,null,1)+'\n');
const failed=res.checks.filter(c=>!c.ok).length;
console.log(`${res.checks.length-failed}/${res.checks.length} passed`);
process.exit(failed?1:0);

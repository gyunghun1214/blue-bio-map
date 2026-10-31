// 2026-10-31 바다 탐험 생물 설명 화면 점검 (Playwright). 카드 목록(#view=cards)과 3D 항해에서 설명 줄이 이름과 점수 사이에 카드 폭 전체로
// 보이는지, 휴대폰 카드에서 '자세히 보기'·'지도에서 보기'까지 스크롤로 닿는지, 자세히 보기에 '어떤 생물인가요'와 출처가 있는지 본다.
//   node verification/2026-10-31-mobile-feedback/about_check.mjs <폴더>   (B=주소, GL=swiftshader면 3D도)
import fs from 'node:fs'; import path from 'node:path';
import {launch,open,sleep} from '../2026-10-25-mobile-ux/common.mjs';
const OUT=process.argv[2]||'tmp/about';fs.mkdirSync(OUT,{recursive:true});
const B=process.env.B||'http://127.0.0.1:8765/', about=JSON.parse(fs.readFileSync('dist/expedition-about.json','utf8')).species;
const browser=await launch(),res=[],bad=[];
const ok=(n,c,i)=>{res.push({n,ok:!!c,i});if(!c){bad.push(n);console.log('FAIL',n,JSON.stringify(i).slice(0,600));}else console.log('PASS',n);};
for(const [w,h,phone] of [[360,740,true],[390,844,true],[430,932,true],[1440,900,false]])for(const lang of ['ko','en'])for(const rm of [false,true]){
  const o=await open(browser,{w,h,phone,supa:'fixture',reducedMotion:rm?'reduce':undefined}),p=o.page;
  await p.goto(B+'expedition.html'+(lang==='en'?'?lang=en':'')+'#view=cards');await p.waitForSelector('#cards-list .x-card',{timeout:30000});await sleep(800);
  const r=await p.evaluate(({about,lang})=>{const cards=[...document.querySelectorAll('#cards-list .x-card')];
    return cards.map(c=>{const i=+c.dataset.stop,a=c.querySelector('.x-about'),sp=c.querySelector('.x-species'),nm=c.querySelector('.x-name'),sc=c.querySelector('.x-scores');
      const ra=a?.getBoundingClientRect(),rs=sp.getBoundingClientRect();
      return {i,has:!!a,text:a?.textContent||'',fs:a?parseFloat(getComputedStyle(a).fontSize):0,full:a?Math.abs(ra.width-rs.width)<1.5:false,
        order:a?(nm.getBoundingClientRect().bottom<=ra.top+0.5&&ra.bottom<=sc.getBoundingClientRect().top+0.5):false,r:a?.closest('[data-r]')?.dataset.r,visible:a?getComputedStyle(a.closest('[data-r]')).visibility!=='hidden'&&+getComputedStyle(a.closest('[data-r]')).opacity>0.5:false,hangul:/[가-힣]/.test(a?.textContent||'')};});},{about,lang});
  const tag=`${w} ${lang}${rm?' reduced-motion':''} cards`;
  ok(`${tag}: 30 cards each with a description`,r.length===30&&r.every(x=>x.has),r.filter(x=>!x.has).map(x=>x.i));
  ok(`${tag}: description full card width, under the name, above the scores, step 2, visible`,r.every(x=>x.full&&x.order&&x.r==='2'&&x.visible),r.filter(x=>!(x.full&&x.order&&x.r==='2'&&x.visible)).slice(0,3));
  ok(`${tag}: font ≥ 15px on phone (≥ 12 anywhere)`,r.every(x=>x.fs>=(phone?15:12)),r.map(x=>x.fs).slice(0,3));
  ok(`${tag}: ${lang==='en'?'English, no Hangul':'Korean text from the file'}`,lang==='en'?r.every(x=>!x.hangul):r.every(x=>Object.values(about).some(a=>a.ko===x.text)),r.slice(0,2));
  if(!rm&&lang==='ko'&&(w===390||w===1440))await p.locator('#cards-list .x-card').first().screenshot({path:path.join(OUT,`card-${w}-${lang}.png`)});
  // 자세히 보기
  await p.locator('#cards-list [data-detail="0"]').first().click();await sleep(700);
  const d=await p.evaluate(()=>{const s=document.querySelector('.x-about-sec'),h=s?.querySelector('h3'),a=s?.querySelector('a'),secs=[...document.querySelectorAll('.x-detail section h3')].map(x=>x.textContent.trim());
    return {has:!!s,h:h?.textContent.trim(),href:a?.getAttribute('href'),first:secs[0],second:secs[1],target:a?.target};});
  ok(`${tag}: detail starts with ${lang==='en'?'What is this species?':'어떤 생물인가요'} + source link, then observation`,d.has&&d.h===(lang==='en'?'What is this species?':'어떤 생물인가요')&&/^https:/.test(d.href||'')&&d.target==='_blank'&&d.first===d.h,d);
  if(!rm&&lang==='ko'&&w===390)await p.screenshot({path:path.join(OUT,`detail-${w}-${lang}.png`)});
  await o.ctx.close();
}
// 3D 항해(휴대폰): 첫 지점에 도착해 카드가 다 열린 뒤, 카드 안에서 스크롤해 '자세히 보기'·'지도에서 보기'까지 닿는지
if(process.env.GL==='swiftshader')for(const [w,h] of [[360,740],[390,844],[430,932]])for(const lang of ['ko','en']){
  const o=await open(browser,{w,h,phone:true,supa:'fixture'}),p=o.page;
  await p.goto(B+'expedition.html'+(lang==='en'?'?lang=en':'')+'#stop=1');await sleep(6000);
  // 카드 단계 끝까지 연다(다음 발견 = 탭/스페이스)
  for(let k=0;k<6;k++){await p.keyboard.press('Space');await sleep(500);}
  const r=await p.evaluate(()=>{const c=[...document.querySelectorAll('.x-card')].find(x=>x.getBoundingClientRect().width&&!x.closest('#cards-list'));if(!c)return {none:true,body:document.body.className};
    const sc=(e=>{for(;e;e=e.parentElement){const s=getComputedStyle(e);if(/(auto|scroll)/.test(s.overflowY)&&e.scrollHeight>e.clientHeight)return e;}return document.scrollingElement;})(c);
    sc.scrollTop=sc.scrollHeight;const a=c.querySelector('.x-actions'),ab=c.querySelector('.x-about');const ra=a.getBoundingClientRect();
    const hit=document.elementFromPoint(ra.left+10,ra.top+ra.height/2);
    return {level:c.dataset.level,about:!!ab,aboutVisible:ab?getComputedStyle(ab.closest('[data-r]')).visibility!=='hidden':false,actionsIn:ra.bottom<=innerHeight&&ra.top>=0,hit:!!hit&&a.contains(hit),body:document.body.className};});
  ok(`${w} ${lang} 3D: description shown on arrival; scrolling the card reaches 자세히 보기·지도에서 보기`,!r.none&&r.about&&r.aboutVisible&&r.actionsIn&&r.hit,r);
  if(lang==='ko')await p.screenshot({path:path.join(OUT,`sea-${w}-${lang}.png`)});
  await o.ctx.close();
}
fs.writeFileSync(path.join(OUT,'about_check.json'),JSON.stringify(res,null,1));
console.log(bad.length?`FAIL ${bad.length}`:'ALL PASS');await browser.close();process.exit(bad.length?1:0);

// 2026-10-25 휴대폰 점검 도우미 (Playwright).
// - dist/를 8765(이 브랜치)·8766(main 비교용)으로 띄운 상태에서 쓴다.
// - Supabase: 기본은 실제 운영 공개 API(SUPA=live, 이 세션에서는 접속됨). 막힌 곳에서는 SUPA=fixture로
//   dist/live-snapshot.json을 돌려준다(uicheck.mjs의 FIXTURE 방식). SUPA=block이면 막고(오류 상태), SUPA=empty면 200 [].
//   DELAY=<ms>면 응답을 그만큼 늦춘다(로딩 상태).
// - 위성(GIBS)·수심(GEBCO) 타일은 처음 한 번 받아 tmp/tile-cache(git 제외)에 두고 다음부터 그 파일로 준다.
//   전후·main/브랜치 캡처가 같은 그림을 보게 하려는 것이다. TILES=off면 타일을 막는다.
import {chromium} from 'playwright';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
export {chromium};
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const FX=JSON.parse(fs.readFileSync('dist/live-snapshot.json','utf8'));
const CACHE=process.env.TILE_CACHE||'tmp/tile-cache';
const PROXY=process.env.HTTPS_PROXY||process.env.https_proxy||'';
// 휴대폰은 Android Chrome(같은 Chromium 엔진)으로 둔다. Safari·삼성 인터넷은 여기서 확인하지 못한다.
export const UA_PHONE='Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36';
export async function launch(){
  return chromium.launch({executablePath:process.env.CHROME_PATH||undefined,
    args:['--no-sandbox','--hide-scrollbars',...(process.env.GL==='swiftshader'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:['--disable-gpu'])],
    ...(PROXY?{proxy:{server:PROXY,bypass:'127.0.0.1,localhost'}}:{})});
}
export async function open(browser,{w=390,h=844,dpr=2,phone=true,supa=process.env.SUPA||'live',reducedMotion}={}){
  const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr,isMobile:phone,hasTouch:phone,
    locale:'ko-KR',timezoneId:'Asia/Seoul',...(phone?{userAgent:UA_PHONE}:{}),...(reducedMotion?{reducedMotion}:{})});
  await ctx.route(/supabase\.co/,async r=>{
    if(supa==='block')return r.abort('connectionrefused');
    if(process.env.DELAY)await sleep(+process.env.DELAY);
    if(supa==='live')return r.continue();
    const u=r.request().url();
    const body=supa==='empty'?[]:u.includes('species_profiles')?FX.profiles:u.includes('species_map_cells')?FX.cells:[];
    return r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
  });
  await ctx.route(/gibs\.earthdata\.nasa\.gov|gebco\.net/,async r=>{
    if(process.env.TILES==='off')return r.abort();
    const u=r.request().url(),key=crypto.createHash('sha1').update(u).digest('hex'),f=path.join(CACHE,key);
    if(fs.existsSync(f)){const ct=fs.readFileSync(f+'.ct','utf8');return r.fulfill({status:200,contentType:ct,body:fs.readFileSync(f)});}
    try{const resp=await r.fetch({timeout:20000});const body=await resp.body();
      if(resp.ok()&&body.length){fs.mkdirSync(CACHE,{recursive:true});fs.writeFileSync(f,body);fs.writeFileSync(f+'.ct',resp.headers()['content-type']||'image/jpeg');}
      return r.fulfill({response:resp,body});}catch{return r.abort();}
  });
  // 그 밖의 바깥 요청(분석 비콘 등)은 막는다: 화면 확인에 필요 없고 결과를 흔든다.
  await ctx.route(/cloudflareinsights\.com/,r=>r.abort());
  const page=await ctx.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
  return {ctx,page,errors};
}
// 첫 방문: 시작 화면(로딩 → 입장)이 준비될 때까지
export async function waitGate(page,timeout=40000){
  await page.waitForFunction(()=>{const g=document.getElementById('site-gate');return g&&g.classList.contains('is-ready');},null,{timeout});
}
export async function waitData(page,timeout=60000){
  await page.waitForFunction(()=>/연결됨|connected|불러오기 실패|연결 실패|failed/i.test(document.getElementById('connection-state')?.textContent||''),null,{timeout});
}
export const shot=(page,dir,name,full=false)=>page.screenshot({path:path.join(dir,name+'.png'),fullPage:full,animations:'disabled'});

// Mobile capture helpers: local dist/ (same code as live main) with the snapshot standing in for Supabase
// and stand-in tiles (from the NASA globe texture) standing in for the blocked GIBS satellite tiles.
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
// playwright from the project (npm i -D playwright) or a global install (PLAYWRIGHT_DIR, e.g. /opt/node22/lib/node_modules/)
const req=createRequire(import.meta.url);let pw;try{pw=req('playwright');}catch{pw=createRequire(process.env.PLAYWRIGHT_DIR||'/opt/node22/lib/node_modules/')('playwright');}
export const {chromium}=pw;
const FX=JSON.parse(fs.readFileSync('dist/live-snapshot.json','utf8'));
const TILES=process.env.TILES||'';fs.mkdirSync(process.env.OUT||'verification/2026-10-18-mobile-polish/out',{recursive:true});
export const OUT=process.env.OUT||'verification/2026-10-18-mobile-polish/out';
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function open(browser,{w=390,h=844,dpr=2}={}){
  const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr,isMobile:true,hasTouch:true,locale:'ko-KR',
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'});
  await ctx.route(/supabase\.co/,async r=>{if(process.env.DELAY)await sleep(+process.env.DELAY);const u=r.request().url();const body=u.includes('species_profiles')?FX.profiles:u.includes('species_map_cells')?FX.cells:[];
    r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});});
  await ctx.route(/gibs\.earthdata\.nasa\.gov/,r=>{const m=r.request().url().match(/(\d+)\/(\d+)\/(\d+)\.jpeg/);const f=m&&path.join(TILES,m[1],m[2],m[3]+'.jpeg');
    if(f&&fs.existsSync(f))r.fulfill({status:200,contentType:'image/jpeg',body:fs.readFileSync(f)});else r.abort();});
  await ctx.route(/gebco\.net/,r=>r.abort());
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('PAGEERROR',e.message));
  return {ctx,page};
}
export const shot=(page,name,full=false)=>page.screenshot({path:path.join(OUT,name+'.png'),fullPage:full});

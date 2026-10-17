// Wheel-hint captures for README.md: serve dist/ on 127.0.0.1:8765, then `node capture.mjs <out-dir>` (Playwright; CHROME_PATH optional).
// Outside requests (map tiles, Supabase) are cut off so the shot does not depend on them.
import {chromium} from 'playwright';
const out=process.argv[2];
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
for(const [w,h,mac] of [[1560,900,false],[1560,900,true],[1024,768,false]]){
const p=await b.newPage({viewport:{width:w,height:h}});
await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith('http://127.0.0.1'))return r.continue();return r.abort();});
await p.addInitScript(m=>{try{sessionStorage.setItem('bbvm-intro-entered','1')}catch{};if(m){Object.defineProperty(navigator,'platform',{get:()=>'MacIntel'});Object.defineProperty(navigator,'userAgentData',{get:()=>({platform:'macOS'})});}},mac);
await p.goto('http://127.0.0.1:8765/');await p.waitForTimeout(5000);
const r=await p.evaluate(()=>{const r=document.getElementById('map').getBoundingClientRect();window.scrollTo(0,0);return {x:r.left+r.width/2,y:r.top+r.height/2+80}});
await p.mouse.move(r.x,Math.min(r.y,h-40));await p.mouse.wheel(0,60);await p.waitForTimeout(400);
await p.screenshot({path:`${out}/hint-${w}${mac?'-mac':''}.png`});
console.log(w,mac,await p.evaluate(()=>[document.querySelector('.map-wheel-hint').textContent,document.querySelector('.map-wheel-hint').classList.contains('on'),scrollY]));
await p.close();}
await b.close();

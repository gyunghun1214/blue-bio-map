// 말풍선 타이밍: 지도가 보인 직후 · 8초 뒤 · 새로고침 뒤
import {chromium,open,shot,sleep} from './common.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const {page}=await open(b);
await page.goto('http://127.0.0.1:8765/?fresh='+Math.random());
await page.waitForFunction(()=>/연결됨/.test(document.getElementById('connection-state')?.textContent||''),null,{timeout:60000});
await sleep(2000);
const beforeEnter=await page.evaluate(()=>document.querySelector('.bbc-hint').hidden);
await page.click('.gate-enter');await sleep(1500);
const t1=await page.evaluate(()=>({hidden:document.querySelector('.bbc-hint').hidden,text:document.querySelector('.bbc-hint').innerText.trim(),w:document.querySelector('.bbc-hint').getBoundingClientRect().width,fabBottom:innerHeight-document.querySelector('.bbc-fab').getBoundingClientRect().bottom}));
await shot(page,'hint-1-map');
await sleep(7000);
const t2=await page.evaluate(()=>({hidden:document.querySelector('.bbc-hint').hidden,stored:localStorage.getItem('bbChatHintSeen')}));
await shot(page,'hint-2-8s');
await page.reload();await page.waitForFunction(()=>/연결됨/.test(document.getElementById('connection-state')?.textContent||''),null,{timeout:60000});await sleep(1500);
const t3=await page.evaluate(()=>document.querySelector('.bbc-hint').hidden);
// scroll dismiss on a fresh profile
const ctx2=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
console.log(JSON.stringify({beforeEnter,t1,t2,afterReloadHidden:t3}));
await b.close();

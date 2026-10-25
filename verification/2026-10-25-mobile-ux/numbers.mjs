// 사용: dist를 8765(브랜치)·8766(main)에 띄운 뒤 node verification/2026-10-25-mobile-ux/numbers.mjs (저장 사본 자료)
// 화면에 보이는 숫자가 main과 같은지: 휴대폰 3폭에서 화면별 innerText(숨긴 글자는 빠짐)의 숫자를 모아(여러 번 나오면 그 수까지) 견준다.
import {launch,open,sleep,waitData} from './common.mjs';

const b=await launch();
const SIDES={main:'http://127.0.0.1:8766/',branch:'http://127.0.0.1:8765/'};
const nums=t=>{const m=new Map();for(const x of (t.match(/\d[\d,.]*\d|\d/g)||[]))m.set(x,(m.get(x)||0)+1);return m;};
const diff=(a,b)=>{const out=[];for(const k of new Set([...a.keys(),...b.keys()])){const x=a.get(k)||0,y=b.get(k)||0;if(x!==y)out.push(`${k}:${x}→${y}`);}return out;};
const SCREENS=[
  ['explore','#v=explore&s=836033',"document.querySelector('#explore .species-pane').innerText+'\\n'+document.getElementById('sheet-summary').innerText"],
  ['explore-detail','#v=explore&s=836033',"document.getElementById('detail').innerText"],
  ['compare-matrix','#v=compare&s=836033',"document.querySelector('#compare').innerText"],
  ['compare-table','#v=compare&s=836033',"(document.querySelector('[data-cmp-mode=table]').click(),new Promise(r=>setTimeout(()=>r(document.querySelector('#compare').innerText),1500)))"],
  ['method','#v=method&s=836033',"document.querySelector('#method').innerText"],
];
let total=0;
for(const [w,h] of [[360,780],[390,844],[430,932]]){
  const res={};
  for(const [side,base] of Object.entries(SIDES)){
    const {page,ctx}=await open(b,{w,h,supa:'fixture'});
    await page.addInitScript(()=>{try{localStorage.setItem('bbChatHintSeen','1');}catch{}});
    for(const [name,hash,expr] of SCREENS){
      await page.goto('about:blank');await page.goto(base+hash);await waitData(page);await sleep(2500);
      res[side+name]=await page.evaluate(expr);
    }
    // 바다 탐험 카드 목록(WebGL 없음 → 카드 목록)
    await page.goto(base+'expedition.html?sail=2&view=cards');await sleep(5000);
    res[side+'expedition']=await page.evaluate(()=>document.body.innerText);
    await ctx.close();
  }
  for(const name of [...SCREENS.map(s=>s[0]),'expedition']){
    const d=diff(nums(res['main'+name]),nums(res['branch'+name]));total+=d.length;
    console.log(w,name,d.length?'DIFF '+d.slice(0,30).join(' '):'same numbers');
  }
}
await b.close();
console.log('total differing number tokens:',total);

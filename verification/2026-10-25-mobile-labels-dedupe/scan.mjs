// 2026-10-25 휴대폰 영어 눈썹 글 · 반복 설명: 목록 만들기(A1 · B1).
// 390px 한국어 화면(첫 화면 · 탐색 지도 · 비교와 지표 · 근거와 방법)을 열고
//   A1: 보이는 요소 중 글자가 대문자 영문·숫자·공백·&·'·'·'-'뿐이고 자식 요소가 없는 것
//   B1: 글 덩어리(p · li · dd · td · figcaption · summary · h1~h6)의 textContent를 문장으로 잘라
//       (。 · . · 다. · 줄바꿈), 공백·괄호·가운뎃점을 지운 뒤 같은 문장 · 2-gram 자카드 0.75 이상(20자 이상)을 묶는다.
//   접힌 곳도 모두 연 상태(근거와 방법 01~04, 접는 칸 .mc-more, '읽는 법' 팝업, 지도 범례 · '지도 읽는 법')에서 모으고,
//   처음 상태에서 보이는지는 따로 적는다.
// 사용: dist를 띄운 뒤  BASE=http://127.0.0.1:8765/ node verification/2026-10-25-mobile-labels-dedupe/scan.mjs <out.json>
import fs from 'node:fs';
import {launch,open,sleep,waitData,waitGate} from '../2026-10-25-mobile-ux/common.mjs';
const BASE=process.env.BASE||'http://127.0.0.1:8765/', OUT=process.argv[2]||'tmp/dedupe-scan.json';
const W=+(process.env.W||390), LANG=process.env.LANG_Q||'';
const b=await launch();
const collect=`(()=>{
  const vis=e=>{if(!e.getClientRects().length)return false;for(let n=e;n&&n.nodeType===1;n=n.parentElement){const s=getComputedStyle(n);if(s.visibility==='hidden'||s.display==='none'||+s.opacity===0&&n!==document.documentElement)return false;}return true;};
  const sel=e=>{const p=[];for(let n=e;n&&n.nodeType===1&&p.length<5;n=n.parentElement){let s=n.tagName.toLowerCase();if(n.id){p.unshift(s+'#'+n.id);break;}if(n.classList.length)s+='.'+[...n.classList].slice(0,2).join('.');p.unshift(s);}return p.join('>');};
  return {sel:e=>sel(e),vis:e=>vis(e)};})()`;
async function grab(p,root){
  return p.evaluate(({root})=>{
    const vis=e=>{if(!e.getClientRects().length)return false;for(let n=e;n&&n.nodeType===1;n=n.parentElement){const s=getComputedStyle(n);if(s.visibility==='hidden'||s.display==='none')return false;}return true;};
    const sel=e=>{const p=[];for(let n=e;n&&n.nodeType===1&&p.length<5;n=n.parentElement){let s=n.tagName.toLowerCase();if(n.id){p.unshift(s+'#'+n.id);break;}if(n.classList.length)s+='.'+[...n.classList].slice(0,2).join('.');p.unshift(s);}return p.join('>');};
    const R=document.querySelector(root);
    const caps=[...R.querySelectorAll('*')].filter(e=>e.children.length===0&&/^[A-Z0-9 &·\\-]{3,}$/.test((e.innerText||e.textContent||'').trim())&&!/^(svg|path|text|tspan|script|style)$/i.test(e.tagName))
      .map(e=>{const t=(e.textContent||'').trim();let h=null;for(let n=e;n&&n!==R&&!h;n=n.parentElement){let s=n.nextElementSibling;for(let k=0;s&&k<3&&!h;k++,s=s.nextElementSibling){const q=s.matches('h1,h2,h3,h4,h5,h6')?s:s.querySelector('h1,h2,h3,h4,h5,h6');if(q)h=q.textContent.trim();}}
        return {sel:sel(e),cls:e.className,text:t,visible:vis(e),heading:h};});
    // 글 덩어리: 글자 노드를 가장 가까운 '덩어리' 조상(인라인이 아닌 요소)으로 묶는다. 숨은 칸 안의 요소도 자기 display 값을
    // 돌려주므로(숨긴 요소 자신만 none) 접힌 곳도 같은 방식으로 잘린다.
    const INL=/^(inline|contents)$/, segOf=t=>{for(let n=t.parentElement;n&&n!==R;n=n.parentElement){const d=getComputedStyle(n).display;if(!INL.test(d)||/^(P|LI|DD|DT|TD|TH|SUMMARY|H[1-6]|FIGCAPTION|CAPTION|DIV|SECTION|ARTICLE|ASIDE|UL|OL|DETAILS|LABEL)$/.test(n.tagName))return n;}return R;};
    const blocks=[];let cur=null;
    const tw=document.createTreeWalker(R,NodeFilter.SHOW_TEXT,{acceptNode:t=>t.parentElement.closest('svg,script,style,template,noscript')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
    for(let t;(t=tw.nextNode());){const a=segOf(t);if(!cur||cur.el!==a){cur={el:a,text:''};blocks.push(cur);}cur.text+=t.nodeValue;}
    const out=blocks.map(b=>({sel:sel(b.el),text:b.text.replace(/\s+/g,' ').trim(),visible:vis(b.el)})).filter(x=>x.text.length>=8);
    const blocksOut=out;
    return {caps,blocks:blocksOut};
  },{root});
}
const VIEWS=[['gate','#site-gate'],['explore','#explore'],['compare','#compare'],['method','#method']];
const res={base:BASE,width:W,views:{}};
const {page:p,ctx}=await open(b,{w:W,h:844,dpr:1,phone:W<741,supa:'fixture',reducedMotion:'reduce'});
await ctx.addInitScript(()=>{try{localStorage.setItem('bbChatHintSeen','1');}catch{}});
// 첫 화면
await p.goto(BASE+(LANG?'?lang='+LANG:''));await waitGate(p);await sleep(1500);
res.views.gate={first:await grab(p,'#site-gate')};
for(const [v,root] of VIEWS.slice(1)){
  await p.goto('about:blank');await p.goto(BASE+(LANG?'?lang='+LANG:'')+'#v='+v+'&s=836033');await waitData(p);await p.waitForLoadState('networkidle').catch(()=>{});await sleep(2500);
  const first=await grab(p,root);
  // 모두 열기
  await p.evaluate(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));
    for(const d of document.querySelectorAll('details'))d.open=true;
    const pop=document.getElementById('cmp-read-pop');if(pop)pop.hidden=false;
    document.querySelectorAll('.mc-rest').forEach(s=>s.style.display='inline');
    await wait(500);});
  const opened=await grab(p,root);
  res.views[v]={first,opened};
}
await ctx.close();await b.close();
fs.writeFileSync(OUT,JSON.stringify(res,null,1));
console.log('scan ->',OUT);

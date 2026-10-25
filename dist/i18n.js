'use strict';
// 한국어 / English 화면 전환 (2026-10-24). 번역은 미리 만든 사전(정적 파일)으로만 한다. 화면을 여는 순간 기계 번역을 부르지 않는다.
// <head>에서 intro.js보다 먼저, defer 없이 읽는다(시작 화면이 이 사전을 쓴다). 한국어 화면에서는 이 파일 하나(몇 KB)만 받는다.
// - 언어(LANG): 주소 ?lang= → localStorage 'lang' → 'ko'. en·ko 말고는 무시한다. 브라우저 언어로 자동 전환하지 않는다(심사 화면 보호).
// - 화면 사전(I18N_EN): i18n-en.js. 영어일 때만 문서 파싱 중에 불러온다(document.write라서 app.js보다 먼저 실행된다).
// - 자료 사전(I18N_DATA): i18n-data-en.json(자료 파일 안 한국어 문장 → 영어). 영어일 때만 받고, app.js가 첫 그림 전에 기다린다.
// - T_(ko,vars): 한국어 원문 자체가 키다(앞뒤 공백을 지우고 연속 공백은 하나로). ko면 원문, en이면 I18N_EN[키], 없으면 원문.
//   변수는 {n}·{name} 꼴. 영어 값에는 단수·복수 {n|record|records}를 쓸 수 있다(n이 1이면 앞, 아니면 뒤).
// - TX_(s): 자료 문장. 한글이 든 문장만 자료 사전 → 화면 사전 순으로 찾고, 없으면 원문 그대로 둔다(지어서 채우지 않는다).
// - applyStaticI18n(root): 정적 글자·화면 속성과 링크·강조가 섞인 문장(innerHTML 전체가 키)을 사전으로 바꾼다. 영어 화면에서는
//   문서가 interactive가 될 때 한 번, 그 뒤로는 새로 그려지는 부분마다(MutationObserver) 돈다.
// 결과는 부르는 쪽에서 지금처럼 esc()를 거쳐 innerHTML에 넣는다. 사전 값에는 태그를 넣지 않는다(링크·강조가 섞인 정적 문장만 예외).
const I18N_LANGS=['ko','en'];
const LANG=(()=>{
  let q=null,s=null;
  try{q=new URLSearchParams(location.search).get('lang');}catch{}
  if(I18N_LANGS.includes(q))return q;
  try{s=localStorage.getItem('lang');}catch{}
  return I18N_LANGS.includes(s)?s:'ko';
})();
const I18N_EN={}, I18N_DATA={}, I18N_MISS=new Set();
const I18N_HANGUL=/[ㄱ-ㆎ가-힣]/;
const i18nKey=s=>String(s??'').replace(/\s+/g,' ').trim();
const i18nFill=(s,v)=>v?s.replace(/\{(\w+)(?:\|([^|{}]*)\|([^|{}]*))?\}/g,(m,k,one,many)=>Object.hasOwn(v,k)?(one!==undefined?(Number(String(v[k]).replace(/,/g,''))===1?one:many):String(v[k])):m):s;
// 사전에 없는 문구는 개발용으로 한 번만 남긴다(화면에는 원문이 그대로 나온다).
const i18nMiss=k=>{if(!I18N_MISS.has(k)){I18N_MISS.add(k);try{console.debug('[i18n] 사전에 없음:',k);}catch{}}};
function T_(ko,vars){
  if(LANG!=='en')return i18nFill(ko,vars);
  const k=i18nKey(ko);
  if(Object.hasOwn(I18N_EN,k))return i18nFill(I18N_EN[k],vars);
  if(I18N_HANGUL.test(k))i18nMiss(k);
  return i18nFill(ko,vars);
}
function TX_(s){
  if(LANG!=='en'||typeof s!=='string'||!I18N_HANGUL.test(s))return s;
  const k=i18nKey(s);
  return Object.hasOwn(I18N_DATA,k)?I18N_DATA[k]:Object.hasOwn(I18N_EN,k)?I18N_EN[k]:s;
}
const I18N_ATTRS=['placeholder','aria-label','title','alt','data-short','data-label','data-k','data-mt-more'];
// 정적 글자 바꾸기(표시 없이 사전으로): root 아래 요소마다 ① 링크·강조가 섞인 문장이면 innerHTML 전체를 키로 ② 아니면 바로 아래 글자 마디마다
// (앞뒤 빈칸은 그대로) ③ 화면 속성(placeholder·aria-label·title·alt·data-short·data-label·data-k). 사전에 없는 것은 그대로 둔다.
// 한국어 화면에서는 아무것도 하지 않는다. index.html 등의 마크업은 한국어 그대로(언어 버튼만 더함)라 기존 마크업 검사도 그대로 통과한다.
const I18N_SKIP='script,style,noscript,template,textarea,.lang-switch,[lang="ko"],[data-i18n-keep]';
// 사전 찾기(영어 화면): ① 같은 문장(화면 사전 → 자료 사전) ② 숫자·이름이 들어가는 틀(화면 사전 키의 {0}·{1} 자리; 자리에 든 한국어도
// 같은 방법으로 찾는다) ③ ' · '·괄호 등으로 나눈 조각마다 ①②. 못 찾은 조각은 한국어 그대로 두고 KO 표시가 붙는다.
let I18N_PAT=null;const I18N_CACHE=new Map();
function i18nPats(){
  if(I18N_PAT)return I18N_PAT;
  I18N_PAT=[];
  for(const k of Object.keys(I18N_EN)){
    if(!/\{\d+\}/.test(k))continue;
    const parts=k.split(/\{(\d+)\}/),st=parts.filter((_,i)=>i%2===0),ids=parts.filter((_,i)=>i%2);
    const ko=st.join('').replace(/[^ㄱ-ㆎ가-힣]/g,'').length;if(!ko)continue;
    I18N_PAT.push({k,ids,st,ko,len:st.join('').length,anchor:st.reduce((a,b)=>b.length>a.length?b:a,'')});
  }
  I18N_PAT.sort((a,b)=>b.len-a.len||b.ko-a.ko);return I18N_PAT;
}
const I18N_SEPS=[/( · | \/ | \| |; |, |: | \+ | = | → | — | – | - |\. )/,/(\s*(?<![\w.])[-+−]?\d[\d,.:~–/-]*(?:%|°|‰)?(?![\w])\s*)/,/([()（）［］\[\]]|·|：)/];
// 틀 맞추기: 자리마다 다음 고정 글자가 나오는 곳을 앞에서부터 차례로 시험한다(한국어가 든 자리는 다 옮겨져야 한다). 붙은 자리({3}{4})는 앞 자리를 비운다
function i18nHole(x,d){if(!I18N_HANGUL.test(x))return x;const w=x.match(/^(\s*)[\s\S]*?(\s*)$/),y=i18nTr(i18nKey(x),d+1);return y==null||I18N_HANGUL.test(y)?null:w[1]+y+w[2];}
function i18nMatch(k,st,d){
  if(!k.startsWith(st[0]))return null;
  const n=st.length-1,out=[];let tries=0;
  const go=(i,pos)=>{
    if(i===n)return pos===k.length;
    const L=st[i+1],last=i===n-1;
    if(last&&(!k.endsWith(L)||k.length-L.length<pos))return false;
    for(let j=last?k.length-L.length:L?k.indexOf(L,pos):pos;j>=pos&&tries++<64;j=last||!L?-1:k.indexOf(L,j+1)){
      const x=i18nHole(k.slice(pos,j),d);if(x==null)continue;
      out[i]=x;if(go(i+1,j+L.length))return true;
    }
    return false;
  };
  return go(0,st[0].length)?out:null;
}
function i18nTr(k,d=0){
  if(Object.hasOwn(I18N_EN,k))return I18N_EN[k];
  if(Object.hasOwn(I18N_DATA,k))return I18N_DATA[k];
  if(!I18N_HANGUL.test(k)||d>6)return null;
  const c=I18N_CACHE.get(k);if(c!==undefined)return c;
  let r=null;
  for(const p of i18nPats()){
    if(p.anchor&&!k.includes(p.anchor))continue;
    const m=i18nMatch(k,p.st,d);if(!m)continue;
    const v={};p.ids.forEach((id,i)=>{if(!Object.hasOwn(v,id))v[id]=m[i];});
    r=i18nFill(I18N_EN[p.k],v).replace(/ {2,}/g,' ');break;
  }
  if(r==null){const e=I18N_EN[k+'.']??I18N_DATA[k+'.'];if(typeof e==='string'&&!Object.hasOwn(Object.prototype,k+'.'))r=e.replace(/\.$/,'');}
  if(r==null){const m=k.match(/^([·:;,]\s*)?([\s\S]*?)(\s*[·:;,])?$/);if(m[1]||m[3]){const y=i18nTr(m[2],d+1);if(y!=null&&!I18N_HANGUL.test(y))r=(m[1]||'')+y+(m[3]||'');}}
  if(r==null)r=i18nSeg(k,d);
  I18N_CACHE.set(k,r);return r;
}
// 조각으로 나눠 찾기: ' · '·쉼표 같은 목록 구분이면 옮긴 조각만 바꾸고(나머지는 한국어 그대로 → KO 표시), 숫자 앞뒤나 '·'·괄호로
// 더 잘게 나눌 때는 조각이 모두 옮겨질 때만 쓴다(낱말 몇 개만 영어가 되는 것을 막는다). 하나도 못 옮기면 null
// 문장 이어 찾기: 여러 문장이 한 글자 마디로 이어진 경우(코드에서 문장을 + 로 이은 것) 앞 문장부터 가장 길게 사전에 맞는 묶음을 찾는다
const I18N_SENT=/(?<=[.!?。](?:['’”)])?)(\s+)(?=\S)/;
function i18nSents(k,d){
  const bits=k.split(I18N_SENT);if(bits.length<3||bits.length>41)return null;
  const ss=bits.filter((_,i)=>i%2===0),sp=bits.filter((_,i)=>i%2);
  let out='',hit=false;
  for(let i=0;i<ss.length;){
    let j=Math.min(ss.length,i+6),y=null;
    for(;j>i+1;j--){const t=ss.slice(i,j).map((x,n)=>x+(n<j-i-1?sp[i+n]:'')).join('');y=i18nTr(i18nKey(t),d+1);if(y!=null&&!I18N_HANGUL.test(y))break;y=null;}
    if(y==null){j=i+1;y=I18N_HANGUL.test(ss[i])?i18nTr(ss[i],d+1):null;}
    if(y!=null)hit=true;
    out+=(y??ss[i])+(j<ss.length?sp[j-1]:'');i=j;
  }
  return hit?out:null;
}
function i18nSeg(k,d){
  const r=i18nSents(k,d);if(r!=null)return r;
  for(const [j,sep] of I18N_SEPS.entries()){
    const bits=k.split(sep);if(bits.length<2)continue;
    let hit=false,miss=false;
    const out=bits.map((b,i)=>{if(i%2||!I18N_HANGUL.test(b))return b;const m=b.match(/^(\s*)([\s\S]*?)(\s*)$/),y=i18nTr(m[2],d+1);if(y==null||I18N_HANGUL.test(y)){miss=true;return b;}hit=true;return m[1]+y+m[3];});
    if(hit&&!(miss&&j>0))return out.join('');
  }
  return null;
}
function i18nText(n){
  const v=n.nodeValue;if(!I18N_HANGUL.test(v))return;
  const e=i18nTr(i18nKey(v));if(e!=null){const m=v.match(/^(\s*)[\s\S]*?(\s*)$/);n.nodeValue=m[1]+e+m[2];}
}
function i18nAttr(el,a){const v=el.getAttribute(a);if(v&&I18N_HANGUL.test(v)){const e=i18nTr(i18nKey(v));if(e!=null)el.setAttribute(a,e);}}
function i18nEl(el){
  for(const a of I18N_ATTRS)if(el.hasAttribute(a))i18nAttr(el,a);
  let direct=false,kids=false;
  for(const n of el.childNodes){if(n.nodeType===3){if(I18N_HANGUL.test(n.nodeValue))direct=true;}else if(n.nodeType===1)kids=true;}
  if(direct&&kids){const k=i18nKey(el.innerHTML);if(Object.hasOwn(I18N_EN,k)){el.innerHTML=I18N_EN[k];return true;}}
  if(direct)for(const n of [...el.childNodes])if(n.nodeType===3)i18nText(n);
  return false;
}
function applyStaticI18n(root){
  if(LANG!=='en'||!root)return;
  if(root.nodeType===3){if(!root.parentElement?.closest(I18N_SKIP))i18nText(root);return;}
  if(root.nodeType===9)root=root.documentElement;
  if(root.nodeType!==1||root.closest(I18N_SKIP))return;
  const walk=el=>{if(el.matches(I18N_SKIP)||i18nEl(el))return;for(const c of [...el.children])walk(c);};
  walk(root);
}
// 한글이 남은 자료 문장인지(영어 화면의 KO 표시용)
const i18nKo=s=>LANG==='en'&&typeof s==='string'&&I18N_HANGUL.test(s)&&i18nTr(i18nKey(s))==null;
// 영어 화면에서 사전에 없어 한국어로 남은 글자 옆에 작은 KO 표시를 붙인다(지어서 채우지 않는다). 언어 버튼, lang="ko"로 표시한
// 원어 그대로의 출처 제목, 입력칸·선택지·SVG 글자에는 붙이지 않는다.
const I18N_KO_SKIP='script,style,noscript,template,textarea,option,select,svg,title,.lang-switch,[lang="ko"],[data-i18n-keep],.i18n-ko';
function i18nMarkKo(root){
  if(LANG!=='en'||!root)return;
  const hits=[],want=n=>I18N_HANGUL.test(n.nodeValue)&&!n.parentElement?.closest(I18N_KO_SKIP)&&!n.nextSibling?.classList?.contains('i18n-ko');
  if(root.nodeType===3){if(want(root))hits.push(root);}
  else if(root.nodeType===1){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);for(let n=w.nextNode();n;n=w.nextNode())if(want(n))hits.push(n);}
  for(const n of hits){const m=document.createElement('span');m.className='i18n-ko';m.title='Korean original';m.textContent='KO';n.after(m);}
}
// 숫자 표시: 자릿수·소수점 규칙은 부르는 쪽 그대로, 구분 기호만 언어에 맞춘다(ko는 예전 호출과 같다).
const fmtNum=(v,loc)=>v.toLocaleString(LANG==='en'?'en-US':loc);
// 언어 버튼(.lang-switch): 누르면 localStorage에 저장(ko도 저장)하고, 주소의 lang을 바꿔 다시 불러온다.
// 선택한 종·탭·지도 모드는 주소 #s=&v=&b=&t=에 있어 그대로 살아난다. ko는 주소에 lang을 붙이지 않는다.
function i18nGo(l){
  if(!I18N_LANGS.includes(l)||l===LANG)return;
  try{localStorage.setItem('lang',l);}catch{}
  let q;try{q=new URLSearchParams(location.search);}catch{q=new URLSearchParams();}
  if(l==='en')q.set('lang','en');else q.delete('lang');
  const s=q.toString();location.assign(location.pathname+(s?'?'+s:'')+location.hash);
}
function i18nSwitches(root){
  for(const g of (root||document).querySelectorAll('.lang-switch'))for(const b of g.querySelectorAll('button[data-lang]')){
    b.setAttribute('aria-pressed',String(b.dataset.lang===LANG));
    if(!b.i18nBound){b.i18nBound=true;b.addEventListener('click',()=>i18nGo(b.dataset.lang));}
  }
}
// ---- browser ----
const I18N_DATA_READY=(()=>{
  if(typeof document==='undefined'||!document.documentElement)return Promise.resolve(); // node 검사(가짜 document)에서는 쉰다
  const root=document.documentElement;
  if(LANG==='en'){root.lang='en';root.classList.add('lang-en');}
  // ?lang=ko는 따르되 주소에서는 뺀다(한국어 주소는 예전처럼 깨끗하게). 영어는 저장된 값으로 열렸어도 주소에 lang=en을 붙여, 복사한 링크가 영어로 열린다.
  try{const q=new URLSearchParams(location.search),l=q.get('lang');
    if(l==='ko'||(LANG==='en'&&l!=='en')){if(LANG==='en')q.set('lang','en');else q.delete('lang');const s=q.toString();history.replaceState(history.state,'',location.pathname+(s?'?'+s:'')+location.hash);}}catch{}
  const ready=()=>{
    i18nSwitches(document);
    if(LANG!=='en')return;
    applyStaticI18n(document);
    if(document.title&&I18N_HANGUL.test(document.title))document.title=T_(document.title);
    const d=document.querySelector('meta[name="description"]');if(d)d.setAttribute('content',T_(d.getAttribute('content')));
    i18nMarkKo(document.body);
    // 그 뒤 새로 그려지는 화면(app.js 등의 innerHTML·textContent)도 같은 사전으로 바꾸고, 남은 한국어에 KO 표시를 붙인다.
    // MutationObserver 콜백은 그린 스크립트가 끝난 직후(화면에 그리기 전) 돈다.
    new MutationObserver(recs=>{for(const r of recs){
      if(r.type==='childList')for(const n of r.addedNodes){applyStaticI18n(n);i18nMarkKo(n);}
      else if(r.type==='characterData'){applyStaticI18n(r.target);i18nMarkKo(r.target);}
      else if(r.type==='attributes'&&!r.target.closest(I18N_SKIP))i18nAttr(r.target,r.attributeName);}
    }).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:I18N_ATTRS});
  };
  // 파싱이 끝나 문서가 interactive가 되면(defer 스크립트 app.js·expedition.js보다 먼저) 정적 글자를 바꾼다.
  if(document.readyState==='loading')document.addEventListener('readystatechange',ready,{once:true});else ready();
  if(LANG!=='en')return Promise.resolve();
  if(document.readyState==='loading')document.write('<script src="i18n-en.js?v=ada7f03597"><\/script>');
  return fetch('i18n-data-en.json?v=d0e348880a').then(r=>r.ok?r.json():null).then(d=>{if(d?.schema==='i18n-data-en-1'&&d.by_text){Object.assign(I18N_DATA,d.by_text);I18N_CACHE.clear();}}).catch(()=>{});
})();

// 2026-10-25 휴대폰 글 양 줄이기 (mobile-compact.css와 한 쌍, verification/2026-10-25-mobile-compact-text).
// (1) 접는 칸: HTML에서 열려 있는 <details class="mc-more">와 문단 안 .mc-rest를 휴대폰(740px 이하)에서 처음에 닫고,
//     넓어지면 다시 연다. 같은 폭 안에서 사람이 연 것은 그대로 둔다. 화면 안 찾기(Ctrl+F)는 Chrome이 닫힌 <details>를 스스로 펼친다
//     (문단 안 .mc-rest는 접힌 동안 찾지 못한다: README).
// (2) 탐색 지도 '지도 읽는 법' 시트(#map-guide): 휴대폰에서 '읽는 법 ⓘ'(활용 × 보전) 또는 범례의 'ⓘ 범례'를 누르면
//     지도 설명 네 덩어리(.map-notes · .map-legend-more(그 안의 .map-info) · .legend-why, 활용 × 보전에서는 그것을 품은
//     #value-legend)를 시트에 옮겨 담아 연다. 닫으면(✕ · 뒤 배경 · Esc · 넓은 화면으로 바뀜) 제자리로 돌려놓고 포커스는
//     연 단추로 돌아간다. 닫혀 있을 때 DOM과 글은 전과 같다. 넓은 화면은 손대지 않는다(app.js의 전 동작 그대로).
(()=>{
  const mq=matchMedia('(max-width:740px)'),$=id=>document.getElementById(id),phone=()=>mq.matches;
  // ---- (1) 접는 칸
  const folds=()=>document.querySelectorAll('details.mc-more'),rests=()=>document.querySelectorAll('.mc-more-btn');
  const setRest=(b,open)=>{b.setAttribute('aria-expanded',String(open));$(b.getAttribute('aria-controls'))?.classList.toggle('mc-shut',!open);};
  function syncFolds(){const p=phone();for(const d of folds())d.open=!p;for(const b of rests())setRest(b,!p);}
  document.addEventListener('click',e=>{const b=e.target.closest?.('.mc-more-btn');if(b)setRest(b,b.getAttribute('aria-expanded')!=='true');});

  // ---- (2) 지도 읽는 법 시트
  const sheet=$('map-guide'),body=sheet?.querySelector('.mg-body');
  let moved=[],opener=null;
  const still=()=>{try{if(localStorage.getItem('bbvm-reduce-motion')==='1')return true;}catch{}return matchMedia('(prefers-reduced-motion: reduce)').matches;};
  const valueMode=()=>document.querySelector('[data-map-mode=value]')?.getAttribute('aria-pressed')==='true';
  const focusables=()=>[...sheet.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,summary,[tabindex]')]
    .filter(e=>e.getAttribute('tabindex')!=='-1'&&e.getClientRects().length&&!e.disabled);
  function take(el){
    if(!el)return;
    const mark=document.createComment('map-guide');el.before(mark);
    // 옮긴 접는 칸(#unexplored-outside 같은 목록 칸은 빼고)은 펼친 채 두고, 그 제목(summary)은 Tab으로 가지 않는 작은 제목으로
    const inner=[...(el.tagName==='DETAILS'?[el]:[]),...el.querySelectorAll('details')].filter(d=>!d.id||d.classList.contains('map-notes')).map(d=>[d,d.open]);
    for(const [d] of inner){d.open=true;d.classList.add('mg-in');}
    const tabs=inner.map(([d])=>d.querySelector(':scope>summary')).filter(Boolean).map(s=>[s,s.getAttribute('tabindex')]);
    for(const [s] of tabs)s.setAttribute('tabindex','-1');
    body.append(el);moved.push({el,mark,inner,tabs});
  }
  function openGuide(from){
    if(!sheet||!body||!phone()||!sheet.hidden)return;
    opener=from;moved=[];
    const notes=document.querySelector('.map-notes'),more=document.querySelector('.map-legend-more'),vl=$('value-legend');
    take(notes);
    if(valueMode())take(vl);
    take(more);
    if(!valueMode())take(document.querySelector('.legend-why'));
    sheet.classList.toggle('mg-still',still());
    sheet.hidden=false;document.documentElement.classList.add('mg-lock');
    from?.setAttribute('aria-expanded','true');
    body.scrollTop=0;
    $('map-guide-title')?.focus({preventScroll:true});
  }
  function closeGuide(back=true){
    if(!sheet||sheet.hidden)return;
    for(const {el,mark,inner,tabs} of moved.reverse()){
      mark.replaceWith(el);
      for(const [d,o] of inner){d.open=o;d.classList.remove('mg-in');}
      for(const [s,t] of tabs)t===null?s.removeAttribute('tabindex'):s.setAttribute('tabindex',t);
    }
    moved=[];
    sheet.hidden=true;document.documentElement.classList.remove('mg-lock');
    const o=opener;opener=null;o?.setAttribute('aria-expanded','false');
    if(o?.matches('summary'))o.removeAttribute('aria-expanded');
    if(back&&o?.isConnected)o.focus({preventScroll:true});
  }
  // 여는 단추: 휴대폰에서만 가로챈다(app.js의 '읽는 법 ⓘ' 팝업 열기 · 범례 펼치기는 넓은 화면에서 그대로).
  // 창(window) 단계에서 먼저 받아 멈추므로 app.js의 단추·문서 클릭 처리는 이 누름을 보지 않는다.
  addEventListener('click',e=>{
    if(!phone()||!sheet)return;
    const t=e.target.closest?.('#value-info,.map-legend-more>summary');
    if(t&&!t.closest('#map-guide')){e.preventDefault();e.stopPropagation();openGuide(t);return;}
    if(!sheet.hidden){
      if(e.target.closest('[data-mg-close]')){e.preventDefault();closeGuide();return;}
      if(e.target.closest('.mg-body details.mg-in>summary'))e.preventDefault(); // 시트 안 작은 제목은 접히지 않는다
    }
  },true);
  addEventListener('keydown',e=>{
    if(!sheet||sheet.hidden)return;
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeGuide();return;}
    if(e.key==='Tab'){
      const f=focusables();if(!f.length)return;
      const first=f[0],last=f[f.length-1],a=document.activeElement;
      if(!sheet.contains(a)||!f.includes(a)){e.preventDefault();(e.shiftKey?last:first).focus();}
      else if(e.shiftKey&&a===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&a===last){e.preventDefault();first.focus();}
    }
  },true);
  // 휴대폰 범례 'ⓘ 범례' 단추가 시트를 연다는 것을 화면 낭독기에도(휴대폰에서만 붙이고 넓어지면 뗀다)
  function syncOpeners(){
    const s=document.querySelector('.map-legend-more>summary');if(!s)return;
    if(phone()){s.setAttribute('aria-controls','map-guide');s.setAttribute('aria-haspopup','dialog');}
    else{s.removeAttribute('aria-controls');s.removeAttribute('aria-haspopup');}
  }
  mq.addEventListener?.('change',()=>{if(!phone())closeGuide(false);syncFolds();syncOpeners();});
  syncFolds();syncOpeners();
})();
// 2026-10-29 휴대폰 다시 점검 6·7 (verification/2026-10-29-mobile-recheck). 손가락 기기(pointer:coarse)에서만: 마우스 PC는 그대로다.
// (3) 멍이 비켜 앉기: 스크롤이 멈추면(안쪽 칸 스크롤 포함) 멍이 버튼 밑에 다른 단추·링크·접는 제목이 있는지 보고, 있으면 그것이 드러날
//     만큼 56px씩 위로 비켜 앉는다(단추 가운데를 덮거나 40% 넘게 덮을 때만)(meongi.css의 translate: --bbc-dodge, 머리글 밑으로는 가지 않는다). 대화창이 열렸거나 끄는 중이면
//     그대로 둔다. 데이터 표 카드의 펼침 단추·종 카드·페이지 끝 '의견 보내기'를 덮던 것.
// (4) 지도 지명 정리: 나라·바다 이름(.geo-label·.sea-label)이 버블·셀·지도 위 단추와 겹치거나 지도 가장자리에서 잘리면 그 이름만
//     숨긴다. 지도가 움직이거나 줌할 때마다 다시 잰다('대한민국'이 버블 밑, '일본'이 전체화면 단추 밑에 깔리던 것).
(()=>{
  if(!matchMedia('(pointer:coarse)').matches)return;
  const over=(a,b,m)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>m&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>m;
  const shown=e=>{if(!e.getClientRects().length)return false;const s=getComputedStyle(e);return s.visibility!=='hidden'&&+s.opacity>.05;};
  // ---- (3) 멍이 비켜 앉기
  const CTRL='button,a[href],summary,input,select,textarea,[role=button]';
  let dodgeT=0;
  function dodge(){
    const fab=document.querySelector('.bbc-fab'),root=fab?.closest('.bbc');
    if(!fab||!root||!shown(fab)||root.classList.contains('bbc-dragging')||fab.getAttribute('aria-expanded')==='true')return;
    const cur=parseFloat(root.style.getPropertyValue('--bbc-dodge'))||0,r=fab.getBoundingClientRect();
    const base={left:r.left,right:r.right,top:r.top-cur,bottom:r.bottom-cur};
    const head=document.querySelector('.header,.x-bar')?.getBoundingClientRect().bottom||0;
    const ctrls=[...document.querySelectorAll(CTRL)].filter(e=>!root.contains(e)&&!e.closest('.tabs,#site-gate,.leaflet-control-attribution'))
      .map(e=>e.getBoundingClientRect()).filter(b=>b.width>0&&b.bottom>head&&b.top<innerHeight);
    let pick=0;
    for(let d=0;d>=-224;d-=56){
      const c={left:base.left,right:base.right,top:base.top+d,bottom:base.bottom+d};
      if(c.top<head+8)break;
      // 단추 가운데를 덮거나 단추의 40% 넘게 덮을 때만 비킨다(카드처럼 큰 단추의 가장자리에 걸친 정도로는 움직이지 않는다)
      const blocks=b=>{const cx=(b.left+b.right)/2,cy=(b.top+b.bottom)/2;if(cx>c.left-4&&cx<c.right+4&&cy>c.top-4&&cy<c.bottom+4)return true;
        const w=Math.min(b.right,c.right)-Math.max(b.left,c.left),h=Math.min(b.bottom,c.bottom)-Math.max(b.top,c.top);return w>0&&h>0&&w*h>.4*b.width*b.height;};
      if(!ctrls.some(blocks)){pick=d;break;}
    }
    if(pick!==cur)root.style.setProperty('--bbc-dodge',pick+'px');
  }
  const later=()=>{clearTimeout(dodgeT);dodgeT=setTimeout(dodge,450);};
  addEventListener('scroll',later,{capture:true,passive:true});
  addEventListener('resize',later);
  document.addEventListener('click',()=>setTimeout(later,60),true);
  setTimeout(dodge,2500);
  // ---- (4) 지도 지명 정리
  let tidyT=0,watched=null;
  function tidy(){
    const m=document.getElementById('map');if(!m)return;
    const labs=[...m.querySelectorAll('.geo-label,.sea-label')];if(!labs.length)return;
    for(const l of labs)l.style.visibility='';
    const mr=m.getBoundingClientRect(),area=mr.width*mr.height;
    const stage=m.closest('.map-stage')||m.parentElement;
    const obs=[...m.querySelectorAll('path.leaflet-interactive,.leaflet-marker-icon:not(.geo-label):not(.sea-label)'),
      ...stage.querySelectorAll('button,select,.leaflet-control,.map-chip')].filter(shown)
      .map(e=>e.getBoundingClientRect()).filter(b=>b.width>0&&b.width*b.height<area*.4);
    const kept=[];
    for(const l of labs.sort((a,b)=>a.classList.contains('sea-label')-b.classList.contains('sea-label'))){
      const g=document.createRange();g.selectNodeContents(l);const t=g.getBoundingClientRect();
      if(!t.width)continue;
      const out=t.left<mr.left||t.right>mr.right||t.top<mr.top||t.bottom>mr.bottom;
      if(out||obs.some(b=>over(b,t,2))||kept.some(b=>over(b,t,1)))l.style.visibility='hidden';else kept.push(t);
    }
  }
  const tidyLater=list=>{if(list&&list.every(x=>x.target.classList?.contains('geo-label')||x.target.classList?.contains('sea-label')))return;
    clearTimeout(tidyT);tidyT=setTimeout(tidy,180);};
  const watch=()=>{const m=document.getElementById('map');if(!m||watched===m)return;watched=m;
    new MutationObserver(tidyLater).observe(m,{subtree:true,childList:true,attributes:true,attributeFilter:['style','d','class']});tidyLater();};
  watch();addEventListener('resize',()=>tidyLater());document.addEventListener('click',()=>{watch();tidyLater();},true);
  setTimeout(()=>{watch();tidyLater();},3000);
})();

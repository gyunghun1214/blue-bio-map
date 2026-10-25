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

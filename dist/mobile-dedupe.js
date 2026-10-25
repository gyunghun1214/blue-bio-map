// 2026-10-25 휴대폰 반복 설명 정리 (mobile-dedupe.css와 한 쌍, verification/2026-10-25-mobile-labels-dedupe).
// 휴대폰 한국어 화면에서 숨긴 설명 자리의 '… 자세히 보기 →' 단추(.see-also[data-see])를 누르면 기준 위치로 간다. 새 라우터는 없다:
// - 근거와 방법 대상: app.js의 탭 이동(setView)과 근거와 방법 안 이동(methodGo: 접힌 칸을 열고 그 자리로)을 그대로 쓰고,
//   흐름도 상자처럼 .flash를 붙인다. 대상이 접는 칸(.mc-more · 문단 안 .mc-rest) 안이면 그 칸도 연다.
// - 지도 읽는 법(map-guide): 탐색 지도 탭을 열고 시트를 여는 기존 단추(활용 × 보전 '읽는 법 ⓘ', 출현 기록 'ⓘ 범례')를 누른다
//   (mobile-compact.js가 그 누름을 받아 시트를 연다).
// 다른 탭 이동처럼 주소의 해시는 쓰지 않는다(app.js: 'In-page moves are buttons, not href="#…"').
(()=>{
  const $=id=>document.getElementById(id);
  // 대상마다: 요소, 그리고 기준 문장이 접혀 있으면 펴는 일
  const UNFOLD={
    'mt-types-note':()=>{const b=document.querySelector('.mc-more-btn[aria-controls="mc-rest-types"]');if(b?.getAttribute('aria-expanded')==='false')b.click();},
    // 03 '규칙 고정' BBVI 가중치: 슬라이더가 탐색용이라는 문장이 첫 항목의 접는 칸 안에 있다
    'method-03':()=>{const d=document.querySelector('#method-03 li details.mc-more');if(d)d.open=true;}
  };
  function toMethod(key){
    const t=$(key);if(!t||typeof setView!=='function')return;
    setView('method',false);
    for(let d=t.closest('details');d;d=d.parentElement?.closest('details'))d.open=true;
    UNFOLD[key]?.();
    requestAnimationFrame(()=>{methodGo(t);t.classList.add('flash');setTimeout(()=>t.classList.remove('flash'),1600);});
  }
  function toMapGuide(){
    if(typeof setView!=='function')return;
    setView('explore');
    const value=document.querySelector('[data-map-mode=value]')?.getAttribute('aria-pressed')==='true';
    const opener=value?$('value-info'):document.querySelector('.map-legend-more>summary');
    requestAnimationFrame(()=>opener?.click());
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('.see-also[data-see]');if(!b)return;
    e.preventDefault();
    if(b.dataset.see==='map-guide')toMapGuide();else toMethod(b.dataset.see);
  });
})();

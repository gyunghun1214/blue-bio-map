'use strict';
// Operations file (2026-10-21, LKH 사이트 v4 prompt 01): dist/operations.json holds the feedback channels and the facts
// only people can supply after the contest (how many used the map, how many opinions came in, the measured time saved).
// Nothing here is guessed: a line shows only when every value it needs is filled in, and a missing or empty file leaves
// the page exactly as the markup has it (the GitHub issue link stays the feedback link). The offline demo asks for nothing.
(()=>{
  const str=v=>typeof v==='string'?v.trim():'';
  const count=v=>Number.isInteger(v)&&v>=0?v:null;
  const day=v=>/^\d{4}-\d{2}-\d{2}$/.test(str(v))?str(v):'';
  const https=v=>{try{const u=new URL(str(v));return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
  // Usage line under '지금' on the entry screen: '<날짜> 기준 N명 사용 · 의견 N건 · 의견으로 고친 것: X'. No date or no
  // user yet means no line (never '0명'); the opinion count and the fix are added only when there is one.
  const usageLine=u=>{
    const d=day(u?.as_of),n=count(u?.users),f=count(u?.feedback_count),fixed=str(u?.fixed);
    if(!d||!n)return '';
    return `${d} 기준 ${n.toLocaleString('ko-KR')}명 사용`+(f?` · 의견 ${f.toLocaleString('ko-KR')}건`:'')+(fixed?` · 의견으로 고친 것: ${fixed}`:'');
  };
  // Measured effect under '만든 방법': shown only with a date, the species timed and both times, and only when the map was
  // the faster way (the line exists to report that measurement).
  const effectLine=e=>{
    const d=day(e?.as_of),sp=Array.isArray(e?.species)?e.species.map(str).filter(Boolean):[];
    const by=count(e?.manual_minutes),site=count(e?.site_minutes);
    if(!d||!sp.length||!by||site===null||site>=by)return '';
    return `근거 모으는 시간(${d}, ${sp.join('·')} ${sp.length}종): 원 출처에서 직접 ${by}분 → 이 지도에서 ${site}분`;
  };
  const feedback=f=>({form:https(f?.form_url),issue:https(f?.issue_url)});
  globalThis.BBVM_OPS={usageLine,effectLine,feedback};

  const offline=()=>{
    if(globalThis.BBVM_OFFLINE===true)return true;
    try{if(new URLSearchParams(location.search).get('offline')==='1')return true;}catch{}
    try{return sessionStorage.getItem('bbvm-offline')==='1';}catch{return false;}
  };
  if(offline())return;
  const show=(sel,text)=>{for(const el of document.querySelectorAll(sel)){if(!text)continue;el.textContent=text;el.hidden=false;}};
  fetch('operations.json').then(r=>r.ok?r.json():null).then(ops=>{
    if(!ops||typeof ops!=='object')return;
    const fb=feedback(ops.feedback);
    if(fb.form){
      for(const a of document.querySelectorAll('a[data-feedback]')){a.href=fb.form;if(a.dataset.feedback==='foot')a.textContent='의견 보내기(계정 없이)';}
      for(const el of document.querySelectorAll('[data-feedback-issue]')){
        const a=el.querySelector('a');if(a&&fb.issue)a.href=fb.issue;el.hidden=false;
      }
    }
    show('[data-ops-usage]',usageLine(ops.usage));
    show('[data-ops-effect]',effectLine(ops.effect));
  }).catch(()=>{});
})();

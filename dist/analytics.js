'use strict';
// Visit counting (2026-10-19, LKH): Cloudflare Web Analytics, which sets no cookies. The beacon loads only when
// analytics.json holds a token (README '공개 배포' says how to get one); with the token empty nothing loads and the
// site is as before. The method tab's counting note shows only once the beacon is on. The offline demo (?offline=1,
// kept for the tab) sends nothing outside the computer, so it never loads the beacon.
(()=>{
  const offline=()=>{
    if(globalThis.BBVM_OFFLINE===true)return true;
    try{if(new URLSearchParams(location.search).get('offline')==='1')return true;}catch{}
    try{return sessionStorage.getItem('bbvm-offline')==='1';}catch{return false;}
  };
  if(offline())return;
  fetch('analytics.json').then(r=>r.ok?r.json():null).then(cfg=>{
    const token=typeof cfg?.cf_beacon_token==='string'?cfg.cf_beacon_token.trim():'';
    if(!/^[\w-]+$/.test(token))return;
    const s=document.createElement('script');
    s.defer=true;s.src='https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon',JSON.stringify({token}));
    document.body.appendChild(s);
    for(const el of document.querySelectorAll('[data-analytics-note]'))el.hidden=false;
  }).catch(()=>{});
})();

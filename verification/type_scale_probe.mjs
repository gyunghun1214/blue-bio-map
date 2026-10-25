// In-page probe for the phone type scale (2026-10-25, dist/mobile-type.css), used by uicheck.mjs (T-1): pass it to
// page.evaluate or stringify it into a CDP Runtime.evaluate. Plain function, no closures: it must survive toString().
// Every drawn text element under `root` whose size is under 13px, or under 18px and not 13·14·15·16·17px. The flow
// diagram's SVG text (method, svg.flow) is laid out in SVG coordinates and keeps its sizes, so it is left out.
export function offScale([root]){
  const SCALE=[13,14,15,16,17],out=[];
  const clipped=new Map(),clips=e=>{if(!e||e===document.body)return false;if(clipped.has(e))return clipped.get(e);const r=e.getBoundingClientRect(),cs=getComputedStyle(e);
    const v=((r.width<=1||r.height<=1)&&cs.overflow!=='visible')||clips(e.parentElement);clipped.set(e,v);return v;};
  const visible=el=>{if(!el.getClientRects().length)return false;const r=el.getBoundingClientRect();if(r.width<=1&&r.height<=1)return false;
    const cs=getComputedStyle(el);return cs.visibility!=='hidden'&&cs.display!=='none'&&!clips(el);};
  const sel=el=>{const p=[];for(let e=el;e&&e!==document.body&&p.length<3;e=e.parentElement)p.unshift(e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.classList.length?'.'+[...e.classList].slice(0,2).join('.'):''));return p.join(' > ');};
  const seen=new Set();
  for(const r of document.querySelectorAll(root)){
    const tw=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);
    for(let n=tw.nextNode();n;n=tw.nextNode()){
      const el=n.parentElement;if(!n.nodeValue.trim()||!el||seen.has(el)||['SCRIPT','STYLE','NOSCRIPT','TEMPLATE'].includes(el.tagName))continue;
      seen.add(el);if(!visible(el)||el.closest('svg.flow'))continue;
      let f=parseFloat(getComputedStyle(el).fontSize);
      if(el instanceof SVGElement&&el.getScreenCTM){const m=el.getScreenCTM();if(m)f=+(f*Math.hypot(m.a,m.b)).toFixed(2);}
      if(f<12.99||(f<18&&!SCALE.includes(f)))out.push({sel:sel(el),size:f,text:n.nodeValue.trim().slice(0,40)});
    }
  }
  return out;
}

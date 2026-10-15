// In-page probe shared by readability_check.mjs (full sweep) and uicheck.mjs (CI): pass it to page.evaluate or
// stringify it into a CDP Runtime.evaluate. Plain function, no closures: it must survive toString().
// Every visible text run under `root`, with its drawn size and language.
export function collect([root,MIN]){
  const HANGUL=/[ㄱ-ㆎ가-힣]/;
  const seen=new Map(),small=[],runs=[],abbr={};
  // index abbreviations and the Korean names the site uses for them
  const ABBR=[['MFPI',['식량']],['MBPI',['생리활성','신약']],['BBVI',['활용']],['MCUI',['보전']]];
  // drawn: has a box, is not visibility:hidden, and no ancestor clips it to a 1px box (screen-reader-only text)
  const clipped=new Map(),clips=e=>{if(!e||e===document.body)return false;if(clipped.has(e))return clipped.get(e);const r=e.getBoundingClientRect(),cs=getComputedStyle(e);
    const v=((r.width<=1||r.height<=1)&&cs.overflow!=='visible')||clips(e.parentElement);clipped.set(e,v);return v;};
  const visible=el=>{if(!el.getClientRects().length)return false;const r=el.getBoundingClientRect();if(r.width<=1&&r.height<=1)return false;
    const cs=getComputedStyle(el);return cs.visibility!=='hidden'&&cs.display!=='none'&&!clips(el);};
  const sel=el=>{const p=[];for(let e=el;e&&e!==document.body&&p.length<4;e=e.parentElement)p.unshift(e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.classList.length?'.'+[...e.classList].slice(0,2).join('.'):''));return p.join(' > ');};
  // drawn size: SVG text is scaled by its viewBox, so multiply by the screen matrix
  const drawn=el=>{const fs=parseFloat(getComputedStyle(el).fontSize);if(el instanceof SVGElement&&el.getScreenCTM){const m=el.getScreenCTM();if(m)return fs*Math.hypot(m.a,m.b);}return fs;};
  const block=el=>{for(let e=el;e;e=e.parentElement){const d=getComputedStyle(e).display;if(d!=='inline'&&d!=='contents')return e;}return root;};
  const roots=typeof root==='string'?[...document.querySelectorAll(root)]:[root];
  for(const r of roots){
    const tw=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let cur=null,run=null;
    const flush=()=>{if(run&&run.text.trim())runs.push(run);run=null;};
    for(let n=tw.nextNode();n;n=tw.nextNode()){
      const t=n.nodeValue;if(!t.trim())continue;const el=n.parentElement;if(!el||['SCRIPT','STYLE','NOSCRIPT','TEMPLATE'].includes(el.tagName))continue;
      if(!visible(el))continue;
      for(const [k,names] of ABBR)if(!abbr[k]&&new RegExp('\\b'+k+'\\b').test(t)){
        // its Korean name in the same small block (the element or up to 3 ancestors)
        let e=el,named=false;for(let i=0;i<4&&e&&!named;i++,e=e.parentElement)named=names.some(n=>e.textContent.includes(n));
        abbr[k]={named,sel:sel(el),text:(el.closest('p,li,h1,h2,h3,h4,button,label,summary,article,div')||el).textContent.replace(/\s+/g,' ').trim().slice(0,80)};}
      if(!seen.has(el)){const f=drawn(el);seen.set(el,f);if(f>0&&f<MIN-0.01)small.push({sel:sel(el),size:+f.toFixed(2),text:t.trim().slice(0,60)});}
      const b=block(el);
      // one run = Hangul-free text, continued across inline elements of the same block (italic names etc. do not split a
      // sentence) and cut at every Hangul letter: an English sentence inside a Korean line still counts
      const lang=el.closest('[lang]')?.getAttribute('lang')||'';
      if(b!==cur||(run&&run.lang!==lang))flush();
      cur=b;
      const parts=t.split(/[\u3131-\u318e\uac00-\ud7a3]+/);
      parts.forEach((part,i)=>{if(i>0)flush();if(!run)run={text:'',lang,sel:sel(el)};run.text+=part;});
    }
    flush();
  }
  const eng=[];
  // a word is letters (with ' or -) and has a lower-case letter: DOIs, IDs, numbers and codes (CC BY, LC, MCUI) are not words
  for(const r of runs){const text=r.text.replace(/\s+/g,' ').trim();
    const words=text.split(' ').filter(w=>/^[("'‘“]*[A-Za-z][A-Za-z'’-]*[A-Za-z][.,;:)"'’”]*$/.test(w)&&/[a-z]/.test(w));
    if(words.length>=4)eng.push({text,marked:!!r.lang&&!r.lang.startsWith('ko'),sel:r.sel});}
  return {small,eng,abbr,elements:seen.size};
}

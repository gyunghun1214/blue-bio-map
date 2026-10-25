// Before/after check for the phone type scale (2026-10-25), on two fontsizes.mjs inventories of the same width:
//   node verification/2026-10-25-mobile-type-scale/compare.mjs <before.json> <after.json> [--same]
// Always: every state's text (textContent) is the same, and no text element got smaller (matched by state, selector path,
// its own text and its order). --same (PC widths): every text element's size is the same, in the same order.
// Phones (width ≤740): under 18px only 13·14·15·16·17px, nothing under 13px, except the flow diagram's SVG text
// (SVG coordinates, kept as it was). Exit 1 on any hit.
import fs from 'node:fs';
const [bf,af]=process.argv.slice(2).filter(a=>!a.startsWith('--')),SAME=process.argv.includes('--same');
const B=JSON.parse(fs.readFileSync(bf,'utf8')),A=JSON.parse(fs.readFileSync(af,'utf8'));
const bad=[];const SCALE=[13,14,15,16,17];
const exempt=i=>i.svg&&/svg\.flow/.test(i.sel);
const key=(st,list)=>{const n=new Map();return list.map(i=>{const k=`${st}|${i.sel}|${i.text}`;const c=n.get(k)||0;n.set(k,c+1);return [k+'|'+c,i];});};
for(const sa of A.states){
  const sb=B.states.find(s=>s.state===sa.state);if(!sb){bad.push(`${sa.state}: no such state before`);continue;}
  if(sb.textSha!==sa.textSha)bad.push(`${sa.state}: text changed (${sb.textLength} → ${sa.textLength} letters)`);
  const before=new Map(key(sb.state,sb.items));
  for(const [k,i] of key(sa.state,sa.items)){const o=before.get(k);if(o&&i.fs<o.fs-0.01&&!exempt(i))bad.push(`${sa.state}: smaller ${o.fs} → ${i.fs}px ${i.sel} «${i.text}»`);}
  if(SAME){
    const fb=sb.items.map(i=>`${i.sel} ${i.fs} ${i.text}`),fa=sa.items.map(i=>`${i.sel} ${i.fs} ${i.text}`);
    if(fb.length!==fa.length)bad.push(`${sa.state}: ${fb.length} → ${fa.length} text elements`);
    fa.forEach((x,j)=>{if(x!==fb[j]&&bad.length<200)bad.push(`${sa.state}: #${j} ${fb[j]} → ${x}`);});
  }
  if(A.width<=740)for(const i of sa.items){if(exempt(i))continue;const f=i.svg?i.drawn:i.fs;
    if(f<13-0.01||(f<18&&!SCALE.includes(f)))bad.push(`${sa.state}: ${f}px ${i.sel} «${i.text}»`);}
  if(sa.overflow&&sa.overflow.sw>sa.overflow.cw)bad.push(`${sa.state}: page scrolls sideways (${sa.overflow.sw} > ${sa.overflow.cw})`);
}
const uniq=[...new Set(bad)];
console.log(`${af} vs ${bf}: ${uniq.length?uniq.length+' problems':'OK'}`);uniq.slice(0,40).forEach(x=>console.log('  '+x));
process.exit(uniq.length?1:0);

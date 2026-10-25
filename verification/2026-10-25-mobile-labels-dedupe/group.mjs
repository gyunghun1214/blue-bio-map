// scan.mjs 결과에서 반복 문장 묶음을 찾는다(B1). 같은 문장, 또는 2-gram 자카드 0.75 이상(정규화 뒤 20자 이상).
//   node verification/2026-10-25-mobile-labels-dedupe/group.mjs tmp/scan-390.json > tmp/groups-raw.json
import fs from 'node:fs';
const scan=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const norm=s=>s.replace(/[\s()[\]（）「」‘’“”'"·•∙・]/g,'');
const split=t=>t.split(/(?<=[.。])\s+|(?<=다\.)|\n/).map(s=>s.trim()).filter(Boolean);
const grams=s=>{const g=new Set();for(let i=0;i<s.length-1;i++)g.add(s.slice(i,i+2));return g;};
const jac=(a,b)=>{let n=0;for(const x of a)if(b.has(x))n++;return n/(a.size+b.size-n);};
const items=[];
for(const [view,d] of Object.entries(scan.views)){
  const firstVis=new Map((d.first?.blocks||[]).map(x=>[x.sel+'|'+x.text,x.visible]));
  const seen=new Set();
  for(const blk of (d.opened||d.first).blocks){
    const key=blk.sel+'|'+blk.text;if(seen.has(key))continue;seen.add(key);
    for(const s of split(blk.text)){const n=norm(s);if(n.length<8)continue;
      items.push({view,sel:blk.sel,sentence:s,n,visibleFirst:firstVis.get(key)??false,visibleOpened:blk.visible,g:grams(n)});}
  }
}
const parent=items.map((_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
  const a=items[i],b=items[j];if(a.sel===b.sel&&a.view===b.view&&a.sentence===b.sentence)continue;
  const same=a.n===b.n&&a.n.length>=12, near=a.n.length>=20&&b.n.length>=20&&jac(a.g,b.g)>=0.75;
  if(same||near)parent[find(i)]=find(j);
}
const groups={};items.forEach((x,i)=>{(groups[find(i)]??=[]).push(x);});
const out=Object.values(groups).filter(g=>g.length>1&&new Set(g.map(x=>x.view+x.sel)).size>1)
  .map(g=>g.map(({g:_,n,...x})=>x));
console.log(JSON.stringify(out,null,1));

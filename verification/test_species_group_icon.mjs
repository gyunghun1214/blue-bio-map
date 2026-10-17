// Species pictures (2026-10-17, LKH): 참굴's temporary cut-out of the design is gone, so all 30 species show their taxon
// group icon in the explore map's right panel (#sp-species) and the compare profile (#cmp-profile); SPECIES_ART stays as an
// empty slot for a reviewed original. Offline on dist/live-snapshot.json the way test_mbpi_kind runs it.
// Run: node verification/test_species_group_icon.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const D=new URL('../dist/',import.meta.url), read=f=>fs.readFileSync(new URL(f,D),'utf8');
const app=read('app.js'), cut=app.indexOf('let startHash={};');
assert.ok(cut>0,'page bootstrap marker in app.js');
const nodes=new Map();
const el=()=>({innerHTML:'',textContent:'',value:'',hidden:false,disabled:false,style:{setProperty(){}},dataset:{},classList:{toggle(){},add(){},remove(){},contains(){return false}},
  setAttribute(k,v){this['@'+k]=v},getAttribute(k){return this['@'+k]??null},removeAttribute(){},toggleAttribute(){},addEventListener(){},querySelector(){return null},querySelectorAll(){return []},
  scrollIntoView(){},contains(){return false},focus(){},getBoundingClientRect(){return {height:0}}});
const $=id=>{if(!nodes.has(id))nodes.set(id,el());return nodes.get(id);};
const ctx={AbortSignal,structuredClone,console,URLSearchParams,document:{getElementById:$,querySelector:el,querySelectorAll(){return []},activeElement:null},
  window:{addEventListener(){}},location:{hash:'',pathname:'/'},history:{replaceState(){}},requestAnimationFrame(){},matchMedia:()=>({matches:false}),
  fetch:async u=>{u=String(u);if(u.startsWith('https://'))throw TypeError('offline');
    const f=new URL(u.split('?')[0],D), ok=fs.existsSync(f);return {ok,status:ok?200:404,json:async()=>JSON.parse(fs.readFileSync(f,'utf8'))};}};
vm.createContext(ctx);
vm.runInContext(read('live-data.js')+'\n'+app.slice(0,cut)+';globalThis.T={SPECIES_ART,renderSidePanel,renderCompareProfile,set sel(v){selected=v}};',ctx);
const T=ctx.T;
const data=await vm.runInContext(`(async()=>{const next=await loadPublishedProfiles();next.outdated??=[];await attachPilotAssessments(next);return data=next;})()`,ctx);

// (1) the slot is kept, and empty
assert.equal(JSON.stringify(T.SPECIES_ART),'{}','SPECIES_ART is an empty slot');
assert.equal(data.species.length,30,'30 species');

// (2) every species: its group icon, no picture, in the right panel and the compare profile
for(const s of data.species){
  T.renderSidePanel(s);
  const sp=$('sp-species').innerHTML;
  assert.ok(!/<img\b/.test(sp),`${s.label}: no picture in the right panel`);
  assert.ok(sp.includes(`<span class="sp-art sp-art-icon"><span class="group-icon" data-group="${s.group}">`),`${s.label}: group icon in the right panel`);
  T.sel=s;T.renderCompareProfile();
  const cp=$('cmp-profile').innerHTML;
  assert.ok(!/<img\b/.test(cp),`${s.label}: no picture in the compare profile`);
  assert.ok(cp.includes(`aria-label="${s.group} 아이콘"><span class="cp-tile"><span class="group-icon" data-group="${s.group}"`),`${s.label}: group icon tile in the compare profile`);
}
const oyster=data.species.find(s=>s.aphiaID===836033);
assert.equal(oyster.group,'패류','참굴 shows the 패류 icon');

// (3) the temporary asset and every reference to it are gone from the deployed folder (SOURCE.txt keeps the deletion note)
const root=new URL('.',D).pathname, hits=[];
assert.ok(!fs.existsSync(path.join(root,'vendor/species/magallana-gigas-temp.webp')),'temporary asset deleted');
for(const f of fs.readdirSync(root,{recursive:true})){
  const p=path.join(root,f);if(!fs.statSync(p).isFile()||p.endsWith(path.join('vendor','species','SOURCE.txt')))continue;
  if(!/\.(html|js|mjs|css|json|txt|webmanifest|xml)$|_headers$|_redirects$/.test(p))continue;
  if(fs.readFileSync(p,'utf8').includes('magallana-gigas-temp'))hits.push(f);
}
assert.deepEqual(hits,[],'no reference to the temporary asset under dist/');
assert.ok(read('vendor/species/SOURCE.txt').includes('2026-10-17'),'SOURCE.txt records the deletion');
console.log('species group icon: 30 species · right panel and compare profile · temporary asset gone');

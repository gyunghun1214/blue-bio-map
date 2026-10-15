// Shared links and source notes (team check, 2026-10-15).
// (1) A link's screen state is read after '#' and, the same keys, from a query (?v=compare): the hash wins, the first write
//     moves the keys into the hash and keeps other query keys (?offline=1). (2) A hash changed in an open tab is applied
//     (hashchange), so a 비교와 지표 link opened where the map is already showing does not fall back to the map. (3) The entry
//     screen is skipped for a query link too. (4) dist/source-terms-ko.json: Korean notes keyed by the English record text.
// Run: node verification/test_shared_link.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const D=new URL('../dist/',import.meta.url), read=f=>fs.readFileSync(new URL(f,D),'utf8');
const app=read('app.js');
const from=app.indexOf('const LINK_KEYS='), to=app.indexOf('function applyHash(');
assert.ok(from>0&&to>from,'link reader/writer block in app.js');
let written='';
const ctx={URLSearchParams,location:{search:'',hash:'',pathname:'/'},history:{replaceState(a,b,u){written=u;}},
  data:{},selected:{aphiaID:274849},basemap:'basic',mapMode:'occurrence',periodFilter:'all',activeUses:new Set(),weightOff:()=>false,map:null,currentView:'compare'};
vm.createContext(ctx);
vm.runInContext(app.slice(from,to).replace(/^const |^let /gm,'var ')+';globalThis.T={readHash,writeHash,linkView};',ctx);
const at=(search,hash)=>{ctx.location.search=search;ctx.location.hash=hash;return {...ctx.T.readHash()};};

assert.deepEqual(at('','#s=274849&v=compare'),{s:'274849',v:'compare'},'hash link');
assert.deepEqual(at('?v=compare',''),{v:'compare'},'query link opens the same screen');
assert.deepEqual(at('?v=compare&offline=1','#v=method'),{v:'method'},'the hash wins; offline is not a link key');
assert.deepEqual(at('?offline=1',''),{},'no link keys');
// The tab a link opens (2026-10-15, phone report: a 비교와 지표 link showed the map). Link as written → expected tab.
const M='&b=basic&t=occurrence&m=7/35.50/128.00';
for(const [search,hash,view] of [
  ['','#s=241776&v=explore'+M,'explore'],['','#s=241776&v=compare'+M,'compare'],['','#s=241776&v=method'+M,'method'],
  ['?s=241776&v=compare&m=7/35.50/128.00','','compare'],['?offline=1','#v=method','method'],['?v=compare','#v=method','method'],
  ['','#v=compare','compare'],['','#s=241776'+M,null],['','#v=map',null],['','#v=Compare',null],['','',null]])
  assert.equal(ctx.T.linkView(at(search,hash)),view,`${search}${hash} → ${view}`);
assert.ok(/const v=linkView\(h\);if\(v\)setView\(v\);/.test(app.slice(to,app.indexOf('\n}\n',to))),'applyHash opens the tab linkView names');
at('?offline=1&v=compare&s=1','');ctx.T.writeHash();
assert.equal(written,'/?offline=1#s=274849&v=compare&b=basic&t=occurrence','keys move into the hash, ?offline stays: '+written);
at('?v=compare','');ctx.T.writeHash();
assert.equal(written,'/#s=274849&v=compare&b=basic&t=occurrence','query emptied: '+written);

// (2) an in-tab hash change is applied once data is there, kept for the start otherwise
const hc=app.match(/addEventListener\('hashchange',\(\)=>\{([^\n]*)\}\);/);
assert.ok(hc&&/applyHash\(h\)/.test(hc[1])&&/startHash=h/.test(hc[1]),'hashchange applies the link');

// (3) entry screen: a query link skips it like a hash link
const intro=read('intro.js'), pure=intro.slice(0,intro.indexOf('// ---- browser ----'));
const ictx={URLSearchParams};vm.createContext(ictx);
vm.runInContext(pure.replace(/^const /gm,'var ')+';globalThis.G={shouldShowGate};',ictx);
const fresh={getItem:()=>null};
assert.equal(ictx.G.shouldShowGate('#v=compare&',fresh),false,'hash link skips the entry screen');
assert.equal(ictx.G.shouldShowGate('&v=compare',fresh),false,'query link skips the entry screen');
assert.equal(ictx.G.shouldShowGate('&offline=1',fresh),true,'?offline alone still shows it');
assert.ok(intro.includes("shouldShowGate(location.hash+'&'+location.search.slice(1),store)"),'the page passes hash and query');
// a link opened in a tab that shows the entry screen (no reload) skips it too; app.js then applies the tab underneath
assert.ok(intro.includes("addEventListener('hashchange',()=>{if(!left&&hasAppHash(location.hash))fail();});"),'in-tab link skips the entry screen');

// (4) Korean source notes
const ko=JSON.parse(read('source-terms-ko.json'));
assert.equal(ko.schema,'source-terms-ko-1');
const entries=Object.entries(ko.by_text);
assert.ok(entries.length>0);
for(const [en,k] of entries){
  assert.ok(!/[가-힣]/.test(en),'key is the English record text: '+en);
  assert.ok(/[가-힣]/.test(k)&&k.trim()===k&&k.length>0,'Korean note: '+k);
}
assert.ok(/memoKo\(src\.license\)/.test(app)&&/memoKo\(src\.terms\)/.test(app),'the method tab shows the Korean notes');
const sources=Object.values(JSON.parse(read('assessments.json')).sources||{});
const english=new Set(sources.flatMap(s=>[s.terms,s.license]).filter(t=>t&&!/[가-힣]/.test(t)&&!/^(CC0( 1\.0)?|CC BY(-[A-Z]{2})*( \d\.\d)?( [A-Z]{2})?)$/.test(t)));
const missing=[...english].filter(t=>!ko.by_text[t]);
// A note added later shows as written until it is translated here; it is listed, not failed, so other releases are not blocked.
if(missing.length)console.log(`NOTE: ${missing.length} English source note(s) have no Korean text yet:\n- `+missing.join('\n- '));
console.log(`PASS: query and hash links, link → tab, in-tab hash change, entry screen (also in-tab), ${entries.length} Korean source notes (${english.size-missing.length}/${english.size} covered)`);

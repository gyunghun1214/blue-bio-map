// Visit counting (2026-10-19, LKH, prompt 5/10): analytics.js loads the Cloudflare Web Analytics beacon (no cookies) only
// when dist/analytics.json holds a token, never in the offline demo, and shows the method tab's counting note only then.
// With the token empty, as committed, the site loads nothing more than before.
// Run: node verification/test_analytics_beacon.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const D=new URL('../dist/',import.meta.url), read=f=>fs.readFileSync(new URL(f,D),'utf8');
assert.deepEqual(JSON.parse(read('analytics.json')),{cf_beacon_token:''},'committed with an empty token: nothing loads until the team adds one');
const code=read('analytics.js');

async function run({token,search='',session=null,offline}={}){
  const appended=[],note={hidden:true},fetched=[];
  const ctx={
    location:{search},URLSearchParams,JSON,
    sessionStorage:{getItem:k=>k==='bbvm-offline'?session:null},
    fetch:async u=>{fetched.push(u);return {ok:true,json:async()=>({cf_beacon_token:token})};},
    document:{createElement:tag=>({tag,attrs:{},setAttribute(k,v){this.attrs[k]=v;}}),body:{appendChild:n=>appended.push(n)},
      querySelectorAll:s=>s==='[data-analytics-note]'?[note]:[]},
  };
  ctx.globalThis=ctx;
  if(offline!==undefined)ctx.BBVM_OFFLINE=offline;
  vm.createContext(ctx);vm.runInContext(code,ctx);
  await new Promise(r=>setTimeout(r,20));
  return {appended,note,fetched};
}

// (1) no token (empty or blank), a pasted snippet or a placeholder: nothing loads and the note stays hidden
for(const token of ['','   ',"<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{\"token\": \"x\"}'></script>",'토큰',null]){
  const r=await run({token});
  assert.deepEqual(r.fetched,['analytics.json']);
  assert.equal(r.appended.length,0,`no beacon for ${JSON.stringify(token)}`);
  assert.equal(r.note.hidden,true);
}
// (2) a token: one deferred beacon with the token in data-cf-beacon, and the counting note shows
{
  const r=await run({token:' 0123456789abcdef0123456789abcdef '});
  assert.equal(r.appended.length,1);
  const [s]=r.appended;
  assert.equal(s.tag,'script');assert.equal(s.defer,true);
  assert.equal(s.src,'https://static.cloudflareinsights.com/beacon.min.js');
  assert.deepEqual(JSON.parse(s.attrs['data-cf-beacon']),{token:'0123456789abcdef0123456789abcdef'});
  assert.equal(r.note.hidden,false);
}
// (3) the offline demo (flag set by live-data.js, ?offline=1, or kept for the tab) asks for nothing, not even the token file
for(const o of [{offline:true},{search:'?offline=1'},{session:'1'}]){
  const r=await run({token:'0123456789abcdef0123456789abcdef',...o});
  assert.deepEqual([r.fetched.length,r.appended.length,r.note.hidden],[0,0,true],JSON.stringify(o));
}

// (4) both pages load it deferred at the end of the body, stamped with its hash; the note is hidden in the markup and is
// the last line of the method tab
const html=read('index.html'),exp=read('expedition.html');
const v=crypto.createHash('sha256').update(code.replace(/\r\n/g,'\n')).digest('hex').slice(0,10);
for(const [name,page] of [['index.html',html],['expedition.html',exp]]){
  assert.equal(page.match(/<script defer src="analytics\.js\?v=([0-9a-f]{10})"><\/script>/)?.[1],v,`${name}: analytics.js?v= is its hash`);
  assert.match(page,/<script defer src="analytics\.js\?v=[0-9a-f]{10}"><\/script>\n?<\/body>/,`${name}: the last thing in the body`);
  assert.ok(!page.includes('cloudflareinsights'),`${name}: no beacon tag in the markup`);
}
assert.match(html,/<p class="fine mt-visits" data-analytics-note hidden>방문 수만 셉니다\. 쿠키와 개인정보는 모으지 않습니다\(<span lang="en">Cloudflare Web Analytics<\/span>\)\.<\/p><\/div>\n<\/section>/);
// (5) dist/_headers sets no Content-Security-Policy, so there is nothing to widen for the beacon
assert.ok(!/Content-Security-Policy/i.test(read('_headers')));

console.log('PASS: visit counting loads the beacon only with a token, never offline; the note shows only then; both pages load it deferred');

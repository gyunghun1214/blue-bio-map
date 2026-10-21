// Operations file (2026-10-21, LKH 사이트 v4 prompt 01): dist/operations.json holds the feedback channels and the facts
// only people can supply. operations.js shows a line only when every value it needs is filled, so an empty value never
// reads as '0명' or '아직'; with the file as committed (empty facts, no form) the page is what the markup says.
// Run: node verification/test_operations.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const D=new URL('../dist/',import.meta.url), read=f=>fs.readFileSync(new URL(f,D),'utf8').replace(/\r\n/g,'\n');
const code=read('operations.js'), committed=JSON.parse(read('operations.json'));

// (1) committed file: the schema, the GitHub issue link, and every human-supplied fact empty (nothing made up)
assert.equal(committed.schema_version,'operations-1');
assert.equal(committed.feedback.issue_url,'https://github.com/gyunghun1214/blue-bio-map/issues/new?template=feedback.md');
for(const [k,v] of Object.entries(committed.usage))assert.ok(v===''||v===null,`usage.${k} is filled only by people`);
for(const [k,v] of Object.entries(committed.effect))assert.ok(v===''||v===null||(Array.isArray(v)&&!v.length),`effect.${k} is filled only by people`);

function el(attrs={}){return {hidden:true,textContent:'',href:'',dataset:{},...attrs,querySelector(){return this.child||null;}};}
async function run(ops,{search='',offline}={}){
  const foot=el({href:'ISSUE',textContent:'의견 보내기',dataset:{feedback:'foot'}}),coord=el({href:'ISSUE',textContent:'의견 보내기',dataset:{feedback:'coord'}});
  const issueWrap=el({child:el({href:'ISSUE'})}),usage=el(),effect=el(),fetched=[];
  const sel={'a[data-feedback]':[foot,coord],'[data-feedback-issue]':[issueWrap],'[data-ops-usage]':[usage],'[data-ops-effect]':[effect]};
  const ctx={location:{search},URLSearchParams,URL,JSON,Number,Array,sessionStorage:{getItem:()=>null},
    fetch:async u=>{fetched.push(u);return {ok:true,json:async()=>structuredClone(ops)};},
    document:{querySelectorAll:s=>sel[s]||[]}};
  ctx.globalThis=ctx;if(offline!==undefined)ctx.BBVM_OFFLINE=offline;
  vm.createContext(ctx);vm.runInContext(code,ctx);
  await new Promise(r=>setTimeout(r,20));
  return {foot,coord,issueWrap,usage,effect,fetched,ops:ctx.BBVM_OPS};
}

// (2) as committed: one fetch, nothing changes or shows
{
  const r=await run(committed);
  assert.deepEqual(r.fetched,['operations.json']);
  assert.deepEqual([r.foot.href,r.foot.textContent,r.coord.href,r.issueWrap.hidden,r.usage.hidden,r.effect.hidden],['ISSUE','의견 보내기','ISSUE',true,true,true]);
}
// (3) a form address: both feedback links go to the form, the footer names it and shows the GitHub issue beside it.
// A non-https or credentialed address is ignored.
{
  const ops={...structuredClone(committed),feedback:{...committed.feedback,form_url:' https://forms.gle/abc123 '}};
  const r=await run(ops);
  assert.deepEqual([r.foot.href,r.foot.textContent,r.coord.href,r.coord.textContent],['https://forms.gle/abc123','의견 보내기(계정 없이)','https://forms.gle/abc123','의견 보내기']);
  assert.equal(r.issueWrap.hidden,false);assert.equal(r.issueWrap.child.href,committed.feedback.issue_url);
  for(const bad of ['http://forms.gle/x','javascript:alert(1)','https://u:p@forms.gle/x','forms.gle/x']){
    const q=await run({...committed,feedback:{...committed.feedback,form_url:bad}});
    assert.deepEqual([q.foot.href,q.issueWrap.hidden],['ISSUE',true],bad);
  }
}
// (4) usage line: needs a date and at least one user; the opinion count and the fix join only when there is one
{
  const {usageLine}=(await run(committed)).ops;
  assert.equal(usageLine({as_of:'2026-11-10',users:7,feedback_count:3,fixed:'전복 양식 표시 문장'}),'2026-11-10 기준 7명 사용 · 의견 3건 · 의견으로 고친 것: 전복 양식 표시 문장');
  assert.equal(usageLine({as_of:'2026-11-10',users:7,feedback_count:0,fixed:''}),'2026-11-10 기준 7명 사용');
  for(const u of [{},{as_of:'',users:7},{as_of:'2026-11-10',users:0},{as_of:'2026-11-10',users:null},{as_of:'11월',users:5},{as_of:'2026-11-10',users:2.5},{as_of:'2026-11-10',users:-1}])
    assert.equal(usageLine(u),'',JSON.stringify(u));
  const r=await run({...committed,usage:{as_of:'2026-11-10',users:7,feedback_count:3,fixed:''}});
  assert.deepEqual([r.usage.hidden,r.usage.textContent],[false,'2026-11-10 기준 7명 사용 · 의견 3건']);
}
// (5) effect line: date, species, both times, and the map faster; otherwise hidden
{
  const {effectLine}=(await run(committed)).ops;
  assert.equal(effectLine({as_of:'2026-11-01',species:['전복','감태'],manual_minutes:95,site_minutes:6}),'근거 모으는 시간(2026-11-01, 전복·감태 2종): 원 출처에서 직접 95분 → 이 지도에서 6분');
  for(const e of [{},{as_of:'2026-11-01',species:[],manual_minutes:95,site_minutes:6},{as_of:'2026-11-01',species:['전복'],manual_minutes:null,site_minutes:6},
    {as_of:'2026-11-01',species:['전복'],manual_minutes:10,site_minutes:12},{as_of:'2026-11-01',species:['전복'],manual_minutes:10,site_minutes:null}])
    assert.equal(effectLine(e),'',JSON.stringify(e));
}
// (6) the offline demo asks for nothing; a missing file or a failed fetch leaves the page as is
{
  for(const o of [{offline:true},{search:'?offline=1'}]){const r=await run(committed,o);assert.equal(r.fetched.length,0);}
  const r=await run(null);assert.deepEqual([r.foot.href,r.usage.hidden],['ISSUE',true]);
}
// (7) markup: the hidden slots, the issue link kept as the default, and the script stamped with its hash before analytics.js
const html=read('index.html');
const issue=committed.feedback.issue_url.replace(/[?.]/g,'\\$&');
assert.match(html,new RegExp(`<a class="foot-link" data-feedback="foot" href="${issue}" target="_blank" rel="noopener">의견 보내기</a><span data-feedback-issue hidden> · <a class="foot-link" href="${issue}" target="_blank" rel="noopener">GitHub 이슈</a></span>`));
assert.match(html,new RegExp(`<a class="coord-link" data-feedback="coord" href="${issue}"`));
assert.match(html,/<li class="is-now"><p class="gate-next-k">지금<\/p><p class="gate-next-t">[^]*?<\/p><p class="gate-next-use" data-ops-usage hidden><\/p><\/li>/);
assert.match(html,/<p class="mt-made-note mt-effect" data-ops-effect hidden><\/p><\/section>/);
const v=crypto.createHash('sha256').update(code).digest('hex').slice(0,10);
assert.match(html,new RegExp(`<script defer src="operations\\.js\\?v=${v}"></script><script defer src="analytics\\.js`));
assert.match(read('intro.css'),/\.gate-next-use\{font-size:13px;/);

console.log('PASS: operations.json shows only filled lines, the form joins the issue link, nothing offline, markup stamped');

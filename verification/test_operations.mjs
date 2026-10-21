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
// the operations plan (team decision 2026-10-21, prompt 02): the team runs it from 2026-11-06; four steps in the order of
// the entry screen, each with roles (never a person's name), a cost and who pays it
assert.deepEqual(committed.operator,{name:'alt F4 팀',from:'2026-11-06',note:'OCEAN 20 해커톤 출품'});
assert.deepEqual(committed.stages.map(s=>[s.key,s.when,s.cost,s.payer]),[
  ['now','2026-10','월 0원','alt F4 팀'],['expand','2027 상반기','월 0원','alt F4 팀'],['link','2027 하반기','월 0원','alt F4 팀'],
  ['service','2028','맞춤 분석 이용료로 충당(계획)','이용 기관']]);
const ROLES=new Set(['alt F4 팀','데이터·지도','지표·검증','활용·운영','근거 계보']);
for(const s of committed.stages)for(const r of s.roles)assert.ok(ROLES.has(r),`stage ${s.key}: '${r}' is a role name`);
assert.ok(!/연락|협력|아직|미정|연계 목표/.test(JSON.stringify(committed.stages)),'no contact, partnership or not-yet wording');
for(const [k,v] of Object.entries(committed.usage))assert.ok(v===''||v===null,`usage.${k} is filled only by people`);
for(const [k,v] of Object.entries(committed.effect))assert.ok(v===''||v===null||(Array.isArray(v)&&!v.length),`effect.${k} is filled only by people`);

function el(attrs={}){return {hidden:true,textContent:'',href:'',dataset:{},...attrs,querySelector(){return this.child||null;}};}
async function run(ops,{search='',offline}={}){
  const foot=el({href:'ISSUE',textContent:'의견 보내기',dataset:{feedback:'foot'}}),coord=el({href:'ISSUE',textContent:'의견 보내기',dataset:{feedback:'coord'}});
  const issueWrap=el({child:el({href:'ISSUE'})}),usage=el(),effect=el(),operator=el({hidden:false,textContent:'운영: alt F4 팀(OCEAN 20 해커톤 출품)'}),fetched=[];
  const sel={'a[data-feedback]':[foot,coord],'[data-feedback-issue]':[issueWrap],'[data-ops-usage]':[usage],'[data-ops-effect]':[effect],'[data-ops-operator]':[operator]};
  // the four steps of '다음 단계': children in order; tag = '목표 …' pill (not on '지금', which has the usage line instead)
  const stages={};
  for(const k of ['now','expand','link','service']){
    const tag={cls:'gate-next-tag'},kids=k==='now'?[{cls:'gate-next-k'},{cls:'gate-next-t'},usage]:[{cls:'gate-next-k'},{cls:'gate-next-t'},tag];
    stages[k]={kids,querySelector:q=>q==='.gate-next-tag'?(k==='now'?null:tag):q==='[data-ops-usage]'?(k==='now'?usage:null):null,
      insertBefore(n,ref){const i=ref?kids.indexOf(ref):kids.length;kids.splice(i<0?kids.length:i,0,{cls:n.className,text:n.textContent});}};
  }
  const ctx={location:{search},URLSearchParams,URL,JSON,Number,Array,sessionStorage:{getItem:()=>null},
    fetch:async u=>{fetched.push(u);return {ok:true,json:async()=>structuredClone(ops)};},
    document:{querySelectorAll:s=>sel[s]||[],querySelector:q=>stages[/data-stage="([a-z]*)"/.exec(q)?.[1]]||null,
      createElement:()=>({className:'',textContent:''})}};
  ctx.globalThis=ctx;if(offline!==undefined)ctx.BBVM_OFFLINE=offline;
  vm.createContext(ctx);vm.runInContext(code,ctx);
  await new Promise(r=>setTimeout(r,20));
  return {foot,coord,issueWrap,usage,effect,operator,stages,fetched,ops:ctx.BBVM_OPS};
}

// (2) as committed: one fetch, nothing changes or shows
{
  const r=await run(committed);
  assert.deepEqual(r.fetched,['operations.json']);
  assert.deepEqual([r.foot.href,r.foot.textContent,r.coord.href,r.issueWrap.hidden,r.usage.hidden,r.effect.hidden],['ISSUE','의견 보내기','ISSUE',true,true,true]);
  // the plan shows: footer operator line, and for each step the roles and the cost, before the target pill / usage line
  assert.equal(r.operator.textContent,'운영: alt F4 팀(OCEAN 20 해커톤 출품) · 대회 뒤 2026-11-06부터도 계속 운영');
  const rows=Object.fromEntries(Object.entries(r.stages).map(([k,v])=>[k,v.kids.map(x=>x.text?`${x.cls}: ${x.text}`:x.cls||'usage')]));
  assert.deepEqual(rows,{
    now:['gate-next-k','gate-next-t','gate-next-who: 담당 · alt F4 팀','gate-next-cost: 운영비 · 월 0원 · alt F4 팀 부담',
      'gate-next-basis: Cloudflare 무료 요금제(정적 파일만 제공) · Supabase 무료 요금제 · GitHub 공개 저장소','usage'],
    expand:['gate-next-k','gate-next-t','gate-next-who: 담당 · 데이터·지도, 지표·검증 담당','gate-next-cost: 운영비 · 월 0원 · alt F4 팀 부담','gate-next-tag'],
    link:['gate-next-k','gate-next-t','gate-next-who: 담당 · 근거 계보, 활용·운영 담당','gate-next-cost: 운영비 · 월 0원 · alt F4 팀 부담','gate-next-tag'],
    service:['gate-next-k','gate-next-t','gate-next-who: 담당 · 활용·운영 담당','gate-next-cost: 운영비 · 맞춤 분석 이용료로 충당(계획) · 이용 기관 부담','gate-next-tag']});
  // a plan line with a value missing is left out; a missing operator date keeps the markup's footer line
  const {stageLines,operatorLine}=r.ops;
  assert.deepEqual(JSON.parse(JSON.stringify(stageLines({roles:[],cost:'월 0원',payer:''}))),{who:'',cost:'',basis:''});
  assert.equal(operatorLine({name:'alt F4 팀',from:''}),'');
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
assert.match(html,/<li class="is-now" data-stage="now"><p class="gate-next-k">지금<\/p><p class="gate-next-t">[^]*?<\/p><p class="gate-next-use" data-ops-usage hidden><\/p><\/li>/);
assert.match(html,/<p class="mt-made-note mt-effect" data-ops-effect hidden><\/p><\/section>/);
const v=crypto.createHash('sha256').update(code).digest('hex').slice(0,10);
assert.match(html,new RegExp(`<script defer src="operations\\.js\\?v=${v}"></script><script defer src="analytics\\.js`));
assert.match(read('intro.css'),/\.gate-next-use\{font-size:13px;/);
for(const k of ['now','expand','link','service'])assert.ok(html.includes(`data-stage="${k}"`),k);
assert.ok(html.includes('<p class="foot-ops"><span data-ops-operator>운영: alt F4 팀(OCEAN 20 해커톤 출품)</span> · '));
for(const m of read('intro.css').matchAll(/\.gate-next-(?:who|cost|basis)[^{]*\{[^}]*font-size:(\d+)px/g))assert.ok(Number(m[1])>=12,'new CSS text 12px or more');

console.log('PASS: operations.json: plan lines by role with cost and payer, only filled facts show, the form joins the issue link, nothing offline, markup stamped');

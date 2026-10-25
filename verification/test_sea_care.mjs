// '이 생물이 사는 바다 지키기' (2026-10-25): 종 상세에서 그 종이 사는 바다를 돌보는 활동으로 잇는다. (1) 보호 기준(SEA_RULES)은 30종 안의
// 종만, 기간이나 크기 하나는 있다 (2) 칸은 세 상세 화면 모두 '활용 전 확인할 제도' 다음에 있고, 보호 기준이 없는 종은 그 단락을 아예
// 그리지 않는다 (3) 바깥 활동 링크는 새 창·noopener이고 CSP를 바꾸지 않는다(링크만) (4) 약점·효과 단정 문구가 없다 (5) 바다 탐험은 항로
// 마지막 지점과 카드 모아 보기 끝에만 한 줄 (6) 화면 글자가 영어 사전에 있다. Run: node verification/test_sea_care.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const D=new URL('../dist/',import.meta.url), read=f=>fs.readFileSync(new URL(f,D),'utf8').replace(/\r\n/g,'\n');
const app=read('app.js'), exp=read('expedition.js');
const block=app.slice(app.indexOf('const SEA_RULES_URL='),app.indexOf('function institutionChecks(s){'));
assert.ok(block.length>200,'the sea-care block sits right before institutionChecks');

// (1) rules: only our 30 species, each with a season or a size
const ctx={esc:x=>String(x??''),row:(l,v)=>`<div class="evidence-item"><span>${l}</span><b>${v}</b></div>`,sourceLink:(u,l)=>`<a href="${u}" target="_blank" rel="noopener">${l}</a>`};
vm.createContext(ctx);vm.runInContext(block+';globalThis.X={SEA_RULES,SEA_CARE_LINKS,seaCare,SEA_RULES_URL,SEA_RULES_CHECKED};',ctx);
const {X}=ctx;
const a=JSON.parse(read('assessments.json')), ours=new Map([...a.species,...a.candidate_species].map(s=>[s.aphia_id,s.korean_name]));
assert.equal(ours.size,30);
const ids=Object.keys(X.SEA_RULES).map(Number);
assert.equal(ids.length,13,'13 species have closed seasons or size limits in the decree annexes');
for(const id of ids){
  assert.ok(ours.has(id),`rule for ${id}, which is not one of the 30 species`);
  const [season,size]=X.SEA_RULES[id];
  assert.ok(season||size,`${ours.get(id)}: a season or a size`);
}
assert.ok(!ids.includes(145721)&&!ids.includes(377084),'미역·다시마: the annexes name 넓미역·개다시마, other species');
assert.match(X.SEA_RULES_URL,/^https:\/\/www\.mof\.go\.kr\//);assert.match(X.SEA_RULES_CHECKED,/^\d{4}-\d{2}-\d{2}$/);

// (2) the fold on all three detail screens; rules only where they exist
assert.equal((app.match(/more\('활용 전 확인할 제도',institutionChecks\(s\)\)\+\n\s+seaCareFold\(more,s\)\+/g)||[]).length,3,'fold right after 활용 전 확인할 제도 on the three detail screens');
for(const [id,name] of ours){
  const h=X.seaCare({aphiaID:id});
  assert.match(h,/이 생물이 사는 바다를 돌보는 활동/,name);
  assert.equal(h.includes('이 종의 보호 기준'),ids.includes(id),`${name}: rules paragraph only with rules`);
  if(ids.includes(id))assert.ok(h.includes(X.SEA_RULES_URL),`${name}: source link`);
  // (4) no weakness words, no claims of effect
  for(const w of ['없음','없습니다','준비 중','미연결','연결하지','보호 기준 없','지킵니다','늘어','효과'])assert.ok(!h.includes(w),`${name}: '${w}' on screen`);
}

// (3) outside links: new tab, noopener, links only (no outside fetch/img, so dist/_headers stays as it is)
const hosts=X.SEA_CARE_LINKS.map(([u])=>new URL(u).origin);
assert.equal(hosts.join(' '),'https://www.caresea.kr https://www.1365.go.kr');
const h=X.seaCare({aphiaID:1061762});
for(const o of hosts)assert.match(h,new RegExp(`<a href="${o}/" target="_blank" rel="noopener">`));
assert.ok(!read('_headers').includes('caresea')&&!read('_headers').includes('1365'),'links only: the CSP needs no new host');
assert.ok(!/fetch\([^)]*(caresea|1365)/.test(app+exp),'nothing is fetched from the outside sites');
assert.match(app,/class="detail-act" data-sea-care>/,'the 바다 지키기 button');
assert.match(app,/closest\('\[data-sea-care\]'\)[^\n]*f\.open=true;openDrawer\('\.sea-care-fold > summary',b\)/,'the button opens the fold, never an outside page');

// (5) expedition: last route stop and the end of the card list only
const care=exp.match(/const careLine=\(\)=>`([^`]+)`/)?.[1];
assert.ok(care&&care.includes('https://www.caresea.kr/')&&care.includes('https://www.1365.go.kr/'),'careLine links');
assert.equal((care.match(/target="_blank" rel="noopener"/g)||[]).length,2);
assert.equal((exp.match(/careLine\(\)/g)||[]).length,2,'two places');
assert.match(exp,/mode!=='cards'&&i===STATE\.n-1\?careLine\(\):''/,'card: last route stop only');
assert.match(exp,/\.join\(''\)\+careLine\(\);/,'card list: once at the end');

// (6) English dictionary
const en=read('i18n-en.js');
const texts=[...new Set([...h.replace(/<[^>]+>/g,'\n').split('\n'),...care.replace(/<[^>]+>/g,'\n').split('\n'),
  ...Object.values(X.SEA_RULES).flat(),'이 생물이 사는 바다 지키기','바다 지키기','반려해변 ↗','1365 자원봉사포털 ↗'].map(t=>t.replace(/^[\s·]+|[\s·]+$/g,'').trim()).filter(t=>/[가-힣]/.test(t)))];
for(const t of texts)assert.ok(en.includes(JSON.stringify(t)+':'),`English dictionary lacks ${t}`);
console.log(`PASS: sea care · ${ids.length} species with protection rules, fold on 3 detail screens, ${hosts.length} outside links, expedition line 2 places, ${texts.length} texts in the English dictionary`);

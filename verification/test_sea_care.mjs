// '이 생물이 사는 바다 지키기' (2026-10-25, 2026-10-26 고침: 오늘 날짜로 '지금 금어기', iNaturalist 관찰 → GBIF → 이 지도, 바깥 활동은 한 줄). (1) 보호 기준(SEA_RULES)은 30종 안의
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
vm.createContext(ctx);vm.runInContext(block+';globalThis.X={SEA_RULES,SEA_WINDOWS,seaCare,seaSeasonNow,seaSeasonBadge,seaSeasonTag,mdText,INAT_UPLOAD,SEA_RULES_URL,SEA_RULES_CHECKED};',ctx);
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

// (2) '지금 금어기': every window is the season written in its row; 고등어 (a 1-month window set by notice) has none
for(const [id,wins] of Object.entries(X.SEA_WINDOWS)){
  const season=X.SEA_RULES[id]?.[0];assert.ok(season,`window for ${id} without a season row`);
  for(const [from,to,where,note] of wins){
    assert.match(from+to,/^\d\d-\d\d\d\d-\d\d$/);
    const text=`${X.mdText(from)}~${to<from?'이듬해 ':''}${X.mdText(to)}`;
    assert.ok(season.includes(where?`${where} ${text}`:text),`${ours.get(+id)}: '${text}' is in '${season}'`);
    if(note)assert.ok(season.includes(note.slice(0,2)),`${ours.get(+id)}: note '${note}' matches the row`);
  }
}
assert.ok(!X.SEA_WINDOWS[127022],'고등어: the month is set by notice, no window');
const at=(iso,id)=>X.seaSeasonNow({aphiaID:id},new Date(iso)).map(w=>w[1]).join();
const now=iso=>ids.filter(id=>at(iso,id)).map(id=>ours.get(id)).join();
assert.equal(now('2026-10-26T03:00:00Z'),'전복(종 수준),톳');
assert.equal(at('2026-10-26T03:00:00Z',397082),'10-31,12-31','전복: main and 제주 windows both open');
assert.equal(now('2026-11-05T01:00:00Z'),'우뭇가사리,전복(종 수준),톳','presentation day');
assert.equal(at('2026-11-05T01:00:00Z',397082),'12-31','전복: only 제주 after 10/31');
assert.equal(now('2026-10-31T14:59:00Z'),'전복(종 수준),톳');
assert.equal(at('2026-10-31T15:00:00Z',397082),'12-31','Korean time: 11/1 00:00 KST closes the main window');
assert.equal(now('2027-02-01T03:00:00Z'),'대구,우뭇가사리','windows across the new year wrap');
assert.equal(now('2027-07-15T03:00:00Z'),'해삼,참조기,꽃게');
const badge=X.seaSeasonBadge({aphiaID:397082},new Date('2026-10-26T03:00:00Z'));
assert.equal(badge.replace(/<[^>]+>/g,''),'지금 금어기 · 10월 31일까지 · 제주 12월 31일까지');
assert.equal(X.seaSeasonBadge({aphiaID:1061762},new Date('2026-07-01T03:00:00Z')).replace(/<[^>]+>/g,''),'지금 금어기 · 8월 20일까지 · 해역마다 다름');
assert.equal(X.seaSeasonBadge({aphiaID:1061762},new Date('2026-10-26T03:00:00Z')),'','no badge outside the season');
assert.match(app,/<\/svg>바다 지키기\$\{seaSeasonTag\(s\)\}<\/button>/,'the 지금 금어기 tag on the 바다 지키기 button');
assert.ok(!/seaSeason\w*\(s\)/.test(app.slice(app.indexOf('function cardLine(s){'),app.indexOf('function renderList()'))),'the 탐색 후보 cards keep one height: no tag on the card');

// (3) the fold on all three detail screens; rules only where they exist; observation only for 1° species
assert.equal((app.match(/more\('활용 전 확인할 제도',institutionChecks\(s\)\)\+\n\s+seaCareFold\(more,s\)\+/g)||[]).length,3,'fold right after 활용 전 확인할 제도 on the three detail screens');
const wide=new Set([241776,397082,504357]); // 해삼·전복·피조개: published as 4° cells (sensitive)
for(const [id,name] of ours){
  const h=X.seaCare({aphiaID:id,cells:[{sizeDeg:wide.has(id)?4:1}]},new Date('2026-10-26T03:00:00Z'));
  assert.equal(h.includes('이 종의 보호 기준'),ids.includes(id),`${name}: rules paragraph only with rules`);
  if(ids.includes(id))assert.ok(h.includes(X.SEA_RULES_URL),`${name}: source link`);
  assert.equal(h.includes(X.INAT_UPLOAD),!wide.has(id),`${name}: observation link only for species published at 1°`);
  // 2026-10-30 (LKH 휴대폰 점검 5): the clean-up activities are a highlighted card with two buttons right under '지금 금어기', not a last line
  assert.match(h,/^<div class="sea-care">(<p class="sea-now">.*?<\/p>)?<section class="sea-clean"><h3>바다 정화 활동에 함께하기<\/h3><p>[^<]+<\/p><div class="sea-clean-acts"><a class="sea-clean-btn" href="https:\/\/www\.caresea\.kr\/" target="_blank" rel="noopener"><b>반려해변 ↗<\/b><span>[^<]+<\/span><\/a><a class="sea-clean-btn" href="https:\/\/www\.1365\.go\.kr\/" target="_blank" rel="noopener"><b>1365 자원봉사포털 ↗<\/b><span>[^<]+<\/span><\/a><\/div><\/section>/,`${name}: the clean-up card first (after 지금 금어기)`);
  // no weakness words, no claims of effect or of a tie-in that does not exist
  for(const w of ['없음','없습니다','준비 중','미연결','연결하지','보호 기준 없','지킵니다','늘어','효과','바로 신청','연계'])assert.ok(!h.includes(w),`${name}: '${w}' on screen`);
}
assert.ok(!X.seaCare({aphiaID:836033,cells:[{sizeDeg:1}],info:{map:{status:'held_sensitivity_review'}}}).includes(X.INAT_UPLOAD),'no observation link while the map is held');

// (4) outside links: new tab, noopener, links only (no outside fetch/img, so dist/_headers stays as it is)
const h=X.seaCare({aphiaID:1061762,cells:[{sizeDeg:1}]},new Date('2026-07-01T03:00:00Z'));
const hosts=[...h.matchAll(/<a (?:class="[^"]+" )?href="(https:[^"]+)" target="_blank" rel="noopener">/g)].map(m=>new URL(m[1]).origin);
assert.equal(hosts.join(' '),'https://www.caresea.kr https://www.1365.go.kr https://www.mof.go.kr https://www.inaturalist.org');
assert.equal((h.match(/<a /g)||[]).length,4,'every link opens in a new tab with noopener');
for(const o of ['caresea','1365','inaturalist'])assert.ok(!read('_headers').includes(o),'links only: the CSP needs no new host');
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
const all=[h,X.seaCare({aphiaID:397082,cells:[{sizeDeg:1}]},new Date('2026-10-26T03:00:00Z')),X.seaCare({aphiaID:534443,cells:[{sizeDeg:1}]},new Date('2026-06-01T03:00:00Z')),care,X.seaSeasonTag({aphiaID:494972})||'<b>지금 금어기</b>'];
for(const [id,wins] of Object.entries(X.SEA_WINDOWS))for(const [,to,where,note] of wins)all.push(`<span>${(where?where+' ':'')+X.mdText(to)}까지</span><span>${note||''}</span>`);
const texts=[...new Set([...all.flatMap(x=>x.replace(/<[^>]+>/g,'\n').split('\n')),
  ...Object.values(X.SEA_RULES).flat(),'이 생물이 사는 바다 지키기','바다 지키기'].map(t=>t.replace(/^[\s·]+|[\s·]+$/g,'').trim()).filter(t=>/[가-힣]/.test(t)))];
for(const t of texts)assert.ok(en.includes(JSON.stringify(t)+':'),`English dictionary lacks ${t}`);
console.log(`PASS: sea care · ${ids.length} species with protection rules, ${Object.keys(X.SEA_WINDOWS).length} with dated seasons (지금 금어기), fold on 3 detail screens, observation link for 1° species, ${texts.length} texts in the English dictionary`);

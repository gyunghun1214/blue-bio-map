'use strict';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const colors = ['#07867d','#267bab','#a16928'];
let data, selected, map, overlay, simulated = false, currentView = 'explore';
const years = item => item.yearStart ? `${item.yearStart}–${item.yearEnd}` : '연도 미기재';
const sourceLink = (url,label) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`;

function setView(view) {
  if (!['explore','compare','method'].includes(view)) throw new Error('지원하지 않는 화면입니다.');
  currentView=view;
  document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id===view));
  document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);if(el.dataset.view===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  if(view==='explore' && map) requestAnimationFrame(()=>map.invalidateSize());
}

function renderList() {
  const query=$('search').value.trim().toLowerCase();
  const matches=data.species.filter(s=>[s.label,s.name,s.group,String(s.aphiaID)].some(v=>v.toLowerCase().includes(query)));
  $('species-count').textContent=`${matches.length}종`;
  $('species-list').innerHTML=matches.length?matches.map(s=>`<button class="species-card ${selected.aphiaID===s.aphiaID?'selected':''}" data-species="${s.aphiaID}" aria-pressed="${selected.aphiaID===s.aphiaID}"><span class="group">${esc(s.group)}</span><b>${esc(s.label)}</b><em>${esc(s.name)}</em><span class="count"><span>표시 대상 기록</span><strong>${s.recordCount.toLocaleString()}건</strong></span></button>`).join(''):'<p class="empty">일치하는 후보가 없습니다.<br>다른 이름으로 검색해 보세요.</p>';
  $('species-list').querySelectorAll('[data-species]').forEach(button=>button.addEventListener('click',()=>selectSpecies(Number(button.dataset.species))));
}

function selectSpecies(id) {
  const item=data.species.find(s=>s.aphiaID===id);
  if(!item)throw new Error('목록에 없는 종입니다.');
  selected=item;renderList();renderDetail();renderMap();
}

function renderDetail() {
  const s=selected;
  const evidence=[['학명·식별자','WoRMS 연결','done'],['출현기록','OBIS 연결','done'],['식량 근거 · MFPI','자료 미확인',''],['생리활성 · MBPI','자료 미확인',''],['보전 평가 · MCUI','평가 미조회','']];
  $('detail').innerHTML=`<div class="detail-head"><div class="detail-top"><span>SPECIES EVIDENCE</span><span class="verified">정명 확인</span></div><h2>${esc(s.label)}</h2><p class="latin">${esc(s.name)}</p><div class="identity"><span>AphiaID</span><strong>${s.aphiaID}</strong></div><p class="fine">국명은 탐색용 표시명입니다. 자료 연결은 학명과 식별번호를 기준으로 합니다.</p></div><div><h3>연결된 근거 <span class="fine">2 / 5 항목 · 품질 점수 아님</span></h3>${evidence.map(e=>`<div class="evidence-item"><span>${e[0]}</span><span class="${e[2]}">${e[1]}</span></div>`).join('')}<div class="withheld"><b>통합점수 산출 보류</b>활용·보전 자료를 검수한 뒤 점수 계산 여부를 결정합니다. 미확인 자료를 0점으로 처리하지 않습니다.</div></div><div class="source-area"><h3>출처와 범위</h3><a class="source-link" href="${esc(s.wormsUrl)}" target="_blank" rel="noopener"><span>WoRMS · 학명 확인</span><span>↗</span></a><a class="source-link" href="${esc(s.queryUrl)}" target="_blank" rel="noopener"><span>OBIS · 조회 조건과 응답</span><span>↗</span></a><p class="fine">조회 응답 ${s.reportedTotal.toLocaleString()}건 중 ${s.retrievedCount.toLocaleString()}건 취득, 선별 후 ${s.recordCount.toLocaleString()}건 표시. 연도 미기재 ${s.undated}건. 기록 간 중복·동정 정확성은 추가 검수 대상입니다.</p><button class="text-button" id="detail-sources">데이터셋 ${s.sources.length}개와 이용 조건 보기 →</button></div>`;
  $('detail-sources').addEventListener('click',()=>{setView('method');document.querySelector('.source-section').scrollIntoView({behavior:'smooth',block:'start'});});
}

function renderMap() {
  if(!map)return;
  overlay.clearLayers();
  const s=selected,color=colors[data.species.indexOf(s)];
  for(const cell of s.cells){
    L.rectangle([[cell.lat-.5,cell.lon-.5],[cell.lat+.5,cell.lon+.5]],{color,weight:1.3,fillColor:color,fillOpacity:.23}).addTo(overlay)
      .bindPopup(`<strong>${esc(s.label)}</strong><br>1° 격자 내 기록 ${cell.count}건<br>기록 연도: ${years(cell)}<br><small>격자 중심 ${cell.lat}°N, ${cell.lon}°E<br>원좌표·개체수·서식 범위가 아닙니다.</small>`);
  }
  $('map-count').textContent=s.recordCount.toLocaleString();$('map-cells').textContent=s.cells.length;$('map-years').textContent=years(s);
}

function fitMap(){if(map)map.fitBounds([[30,122],[43,136]],{padding:[8,8]});}

function initMap(geography){
  map=L.map('map',{zoomControl:true,minZoom:3,maxZoom:8,scrollWheelZoom:false,maxBounds:[[20,105],[53,150]],maxBoundsViscosity:.7});fitMap();
  L.geoJSON(geography,{style:{fillColor:'#f3f7f6',color:'#acc1ca',weight:1,fillOpacity:1},interactive:false}).addTo(map);
  for(let lat=25;lat<=50;lat+=5)L.polyline([[lat,110],[lat,150]],{color:'#adc9d6',weight:.5,opacity:.55,interactive:false}).addTo(map);
  for(let lon=115;lon<=145;lon+=5)L.polyline([[22,lon],[52,lon]],{color:'#adc9d6',weight:.5,opacity:.55,interactive:false}).addTo(map);
  const labels=[['대한민국',36.4,127.4],['북한',40.1,126.6],['일본',35.5,136.8],['중국',39,119.5]];
  for(const [name,lat,lon] of labels)L.marker([lat,lon],{interactive:false,icon:L.divIcon({className:'geo-label',html:name,iconSize:[70,20],iconAnchor:[25,10]})}).addTo(map);
  for(const [name,lat,lon] of [['서해',35.3,123],['동해',39,132],['남해',32.5,128]])L.marker([lat,lon],{interactive:false,icon:L.divIcon({className:'sea-label',html:name,iconSize:[60,20]})}).addTo(map);
  overlay=L.layerGroup().addTo(map);
  map.attributionControl.setPrefix('Leaflet');map.attributionControl.addAttribution('Natural Earth · 개요용 경계 | OBIS');fitMap();renderMap();
}

function renderComparison(){
  const entries=[['학명·식별자',s=>`WoRMS 확인<small>AphiaID ${s.aphiaID}</small>`],['출현기록',s=>`${s.recordCount.toLocaleString()}건 · ${s.cells.length}격자<small>${years(s)} · 조회·선별된 자료</small>`],['식량 근거 · MFPI',()=>'<span class="pending">자료 미확인</span>'],['생리활성 · MBPI',()=>'<span class="pending">자료 미확인</span>'],['보전 평가 · MCUI',()=>'<span class="pending">평가 미조회</span>'],['통합점수 · BBVI',()=>'<strong>산출 보류</strong>']];
  $('comparison').innerHTML=`<table><caption class="sr-only">탐색 후보 3종의 자료 연결 현황</caption><thead><tr><th scope="col">확인 항목</th>${data.species.map(s=>`<th scope="col">${esc(s.label)}<small>${esc(s.name)}</small></th>`).join('')}</tr></thead><tbody>${entries.map(([title,cell])=>`<tr><th scope="row">${title}</th>${data.species.map(s=>`<td>${cell(s)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function toggleSimulation(value){
  simulated=value;$('simulate').setAttribute('aria-pressed',String(value));$('simulate').textContent=value?'가상 예시 닫기':'가상 작동 예시 보기';$('matrix-note').classList.toggle('simulating',value);
  $('matrix-note').textContent=value?'가상 수치 · 실제 종과 무관한 A–D 사례입니다. 0–100의 임의 수치로 화면 동작만 설명합니다.':'실제 종의 점수가 준비되면 이곳에 표시됩니다. 지금은 점수를 산출하지 않아 배치하지 않습니다.';
  const points=[['A',24,74,'보전 우선 검토'],['B',77,76,'대체생산 연구 검토'],['C',25,25,'기초조사 검토'],['D',77,25,'활용 연구 검토']];
  $('matrix-points').innerHTML=value?points.map(([label,x,y,meaning])=>`<button class="matrix-point" style="left:${x}%;bottom:${y}%" title="가상 ${label}: 활용 ${x}, 보전 ${y} / ${meaning}" aria-label="가상 ${label}: 활용 ${x}, 보전 ${y}. ${meaning}">${label}</button>`).join(''):'';
  $('matrix-points').querySelectorAll('button').forEach((b,i)=>b.addEventListener('click',()=>{const [label,x,y,meaning]=points[i];$('matrix-note').textContent=`가상 ${label} · 활용 ${x} / 보전 ${y} → ${meaning}. 실제 종의 평가 결과가 아니며, 분류 기준 역시 예시입니다.`;}));
}

function renderSources(){
  $('snapshot-date').textContent=`자료 수집 ${data.collectedAt}`;$('collection-note').textContent=data.notes;
  const all=new Map();data.species.forEach(s=>s.sources.forEach(src=>all.set(src.id,src)));
  $('all-sources').innerHTML=data.species.map(s=>`<div class="citation"><strong>${esc(s.label)} · 학명</strong><span>${esc(s.wormsCitation)}</span><br>${sourceLink(s.wormsUrl,'WoRMS 원문 ↗')}</div>`).join('')+Array.from(all.values()).map(s=>`<div class="citation"><strong>${esc(s.title)}</strong><span>${esc(s.citation)}</span><br>${sourceLink(s.url,'OBIS 데이터셋 ↗')} · ${sourceLink(s.licenseUrl,s.license)}<br><span>변경: 대상 종·해역 필터, 레코드 ID 중복 제거, 1° 격자 집계. ${data.collectedAt} 접근.</span></div>`).join('');
}

function registerTools(){
  const ctx=document.modelContext;if(!ctx?.registerTool)return;
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const options={signal:lifecycle.signal};
  for(const tool of [
    {name:'read_biobio_evidence',title:'후보종 근거 현황 읽기',description:'실제 표시된 종별 근거 연결 현황과 미산출 상태를 읽습니다.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||Object.keys(input).length)throw new Error('인자가 없어야 합니다.');return {view:currentView,selectedAphiaID:selected.aphiaID,simulated,species:data.species.map(s=>({label:s.label,aphiaID:s.aphiaID,records:s.recordCount,status:s.status,scores:s.scores}))};}},
    {name:'select_biobio_species',title:'탐색할 종 선택',description:'AphiaID로 후보를 선택하고 실제 지도와 근거 카드를 표시합니다.',inputSchema:{type:'object',properties:{aphiaID:{type:'integer'}},required:['aphiaID'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||!Number.isInteger(input.aphiaID)||Object.keys(input).some(k=>k!=='aphiaID'))throw new Error('정수 AphiaID를 입력하세요.');selectSpecies(input.aphiaID);$('search').value='';renderList();setView('explore');return {selected:selected.label,aphiaID:selected.aphiaID,status:selected.status};}}
  ])try{Promise.resolve(ctx.registerTool(tool,options)).catch(()=>{});}catch{}
}

async function start(){
  try{
    const responses=await Promise.all([fetch('data.json'),fetch('countries.json')]);
    if(responses.some(r=>!r.ok))throw new Error('자료 파일을 불러오지 못했습니다.');
    const [snapshot,geography]=await Promise.all(responses.map(r=>r.json()));data=snapshot;
    if(!data.species?.length)throw new Error('표시할 후보 자료가 없습니다.');
    selected=data.species[0];renderList();renderDetail();renderComparison();renderSources();
    if(typeof L!=='undefined')initMap(geography);else $('map').innerHTML='<p class="empty">지도 도구를 불러오지 못했습니다. 종별 근거와 비교 화면은 계속 사용할 수 있습니다.</p>';
    registerTools();
  }catch(error){console.error(error.stack);$('error').hidden=false;$('error').textContent=`${error.message} 페이지를 새로고침해 주세요.`;$('species-list').textContent='자료를 불러오지 못했습니다.';$('detail').textContent='자료를 불러오지 못했습니다.';}
}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
$('search').addEventListener('input',()=>{if(data)renderList();});$('reset-map').addEventListener('click',fitMap);$('go-compare').addEventListener('click',()=>setView('compare'));$('simulate').addEventListener('click',()=>toggleSimulation(!simulated));
start();

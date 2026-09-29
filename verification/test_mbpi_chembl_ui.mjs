// verified-pilot-3.1 ChEMBL stratum on screen: the browser re-check accepts the published trace and
// rejects each broken link of the rule; the trace shows the label, the cohort and the ChEMBL record.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const original=JSON.parse(fs.readFileSync(new URL('../dist/assessments.json',import.meta.url),'utf8'));
const ctx={};
vm.createContext(ctx);
vm.runInContext(app.split('function setView')[0]+`;
  globalThis.valid=verifiedBioValid;
  globalThis.trace=verifiedBioTrace;
  globalThis.detail=verifiedBioDetail;`,ctx);
ctx.info={method:original.method,sources:original.sources,chemblCommonLimit:original.chembl_common_taxon_limit};
vm.runInContext('data={assessmentInfo:globalThis.info}',ctx);

const rule=original.method.chembl_bioactivity;
const rows=[...original.species,...original.candidate_species];
const kind=(a,k)=>(a.bioactivity_trace||[]).some(x=>(x.stratum_kind||'compound')===k);
const top=a=>[...a.bioactivity_trace].sort((x,y)=>y.adjusted-x.adjusted)[0];
for(const a of rows)assert.ok(ctx.valid(a,original),`${a.korean_name} passes the browser re-check`);

const withChembl=rows.filter(a=>kind(a,'chembl'));
assert.ok(withChembl.length>0,'at least one species has a ChEMBL stratum');
const a0=withChembl.find(a=>top(a).stratum_kind==='chembl')||withChembl[0];
const i0=a0.bioactivity_trace.findIndex(x=>x.stratum_kind==='chembl');
const broken=(change,report=original)=>{const a=structuredClone(a0);change(a,a.bioactivity_trace[i0]);return ctx.valid(a,report);};
assert.ok(broken(()=>{}),'unchanged copy passes');
assert.equal(broken((a,x)=>{x.label='종 추출물 효능';}),false,'label must be the fixed 3.1 label');
assert.equal(broken((a,x)=>{x.link_factor=x.link_factor===1?.75:1;}),false,'link factor follows the link DOI count');
assert.equal(broken((a,x)=>{x.activity_factor=x.activity_factor===1?.75:1;}),false,'activity factor follows the ChEMBL document count');
assert.equal(broken((a,x)=>{x.independent_sources+=1;}),false,'independence is the weaker of the two counts');
assert.equal(broken((a,x)=>{x.cohort_records=rule.minimum_cohort_records-1;}),false,'cohort below the minimum');
assert.equal(broken((a,x)=>{x.chembl_stratum='admet';}),false,'unknown stratum');
assert.equal(broken((a,x)=>{x.activity_ids=[];}),false,'no activity rows');
assert.equal(broken((a,x)=>{x.document_chembl_ids=[];}),false,'no ChEMBL document');
assert.equal(broken(a=>{a.source_ids=a.source_ids.filter(id=>id!==rule.source_ids[0]);}),false,'ChEMBL source missing from the species');
const noRule=structuredClone(original);delete noRule.method.chembl_bioactivity;
assert.equal(broken(()=>{},noRule),false,'a ChEMBL row without the published rule');

// Peptides and reviewed compounds still never share a trace; the ChEMBL stratum may sit beside either.
const pep=rows.find(a=>kind(a,'peptide'));
if(pep){
  const mixed=structuredClone(pep);
  mixed.bioactivity_trace.push({...structuredClone(a0.bioactivity_trace[i0]),stratum_kind:undefined,peer_compounds:99,adjusted:0,percentile:0});
  assert.equal(ctx.valid(mixed,original),false,'peptide + compound mix');
  const beside=structuredClone(pep), low=structuredClone(a0.bioactivity_trace[i0]);
  low.percentile=0;low.adjusted=0;
  beside.bioactivity_trace.push(low);beside.source_ids=[...new Set([...beside.source_ids,...rule.source_ids])];
  assert.ok(ctx.valid(beside,original),'peptide + ChEMBL stratum');
}

// Screen: the label, the cohort and a link to the ChEMBL record of the value that sets MBPI.
const best=top(a0);
if(best.stratum_kind==='chembl'){
  const html=ctx.trace({assessment:a0});
  for(const text of [rule.label,best.stratum_id,`https://www.ebi.ac.uk/chembl/explore/compound/${best.compound_id}`,'ChEMBL'])
    assert.ok(html.includes(text),`trace shows ${text}`);
  assert.ok(!/undefined|NaN/.test(html),'no empty field on screen');
}
// A species with no ChEMBL item shows what the automated chain and the paper search found.
const empty=rows.find(a=>a.chembl_links&&!(a.bioactivity_trace||[]).length&&a.chembl_links.paper_search);
if(empty){
  const html=ctx.detail({assessment:empty});
  assert.ok(html.includes('Europe PMC')&&html.includes(`인정 연결 ${empty.chembl_links.paper_search.accepted_links}건`),'paper search shown');
  assert.ok(!/undefined|NaN/.test(html),'no empty field on screen');
}
console.log(`ok ChEMBL stratum UI (${withChembl.length} species)`);

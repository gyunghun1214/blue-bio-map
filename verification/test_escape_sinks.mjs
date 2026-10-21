// Five places in app.js that put data into innerHTML or a tooltip (2026-10-21 audit): species names from Supabase or
// the catalog, the map-source line and the aquaculture link. escRaw, not esc: esc also swaps words and would change
// the screen text. Run: node verification/test_escape_sinks.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
for(const [what,code] of [
  ['selected-cell panel colour rule (species names)',"'+escRaw(cellTypeLine(group))+'"],
  ['next-survey tooltip (species names)',"list.map(escRaw).join(', ')"],
  ['pending cell text','const pending=t=>`<span class="pending">${escRaw(t)}</span>`'],
  ['data-table map source (Supabase evidence_summary)',"${escRaw(s.info?.map?.source||"],
  ['aquaculture source link','href="${esc(safeUrl(link.url))}"'],
])assert.ok(app.includes(code),`${what}: expected ${code}`);
console.log('PASS: the five data-to-HTML places escape their values');

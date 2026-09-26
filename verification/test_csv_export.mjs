import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const csvSource=app.slice(app.indexOf('function cellCsv(s){'),app.indexOf('// Shareable view:',app.indexOf('function cellCsv(s){')));
assert.ok(csvSource.startsWith('function cellCsv(s){'));
const context={};
vm.createContext(context);
vm.runInContext(csvSource+';globalThis.exportCsv=cellCsv',context);

const csv=context.exportCsv({live:true,label:'=1+1',name:'Undaria pinnatifida',aphiaID:145721,
  cells:[{lat0:-1,lon0:126,sizeDeg:1,period:'2016–2026',yearStart:2016,yearEnd:2026,records:2,sites:1,
    citations:[{title:'=HYPERLINK("https://example.org","open")',licenses:['CC0 1.0']}]}]});
assert.ok(csv.startsWith('\ufeff'));
assert.ok(csv.includes('"\t=1+1"'),'formula-like species label must be text');
assert.ok(csv.includes('"\t=HYPERLINK(""https://example.org"",""open"")"'),'formula-like citation must be text');
assert.ok(csv.includes('"-1"'),'negative numeric coordinate must remain numeric');
assert.ok(csv.includes('"CC0 1.0"'));
console.log('PASS: CSV export treats formula-like text as text and preserves numeric coordinates');

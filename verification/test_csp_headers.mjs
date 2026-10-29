// Content-Security-Policy in dist/_headers (2026-10-21): it must keep matching the pages and the code, or the site breaks
// only where the header is served (Cloudflare), never on the local python server. (1) every inline event handler in the
// pages is allowed by its hash, none is written into markup from the JS, and there is no inline <script>; (2) the Supabase
// API, the two map tile servers and the visit-count beacon are allowed in the directive that governs each; (3) the browser
// features the Permissions-Policy turns off are used nowhere. Run: node verification/test_csp_headers.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const D=new URL('../dist/',import.meta.url), read=f=>fs.readFileSync(new URL(f,D),'utf8').replace(/\r\n/g,'\n');
const headers=read('_headers'), block=headers.slice(headers.indexOf('\n/*\n')+1).split('\n\n')[0];
const csp=/^\s+Content-Security-Policy:\s*(.+)$/m.exec(block)?.[1];
assert.ok(csp,'the /* block sets a Content-Security-Policy');
assert.equal((headers.match(/Content-Security-Policy:/g)||[]).length,1,'one policy (Cloudflare joins a repeated header with commas)');
const dir=Object.fromEntries(csp.split(';').map(d=>d.trim().split(/\s+/)).filter(([k])=>k).map(([k,...v])=>[k,v]));

// (1) inline code in the pages
const pages=fs.readdirSync(D).filter(f=>f.endsWith('.html'));
const handlers=pages.flatMap(f=>[...read(f).matchAll(/\son[a-z]+=(["'])(.*?)\1/g)].map(m=>[f,m[2]]));
assert.ok(handlers.length>0,'index.html loads its late stylesheets with onload handlers');
assert.ok(dir['script-src-attr']?.includes("'unsafe-hashes'"),'script-src-attr allows hashed handlers');
for(const [f,code] of handlers){
  const h=`'sha256-${crypto.createHash('sha256').update(code).digest('base64')}'`;
  assert.ok(dir['script-src-attr'].includes(h),`${f}: handler ${code} needs ${h} in script-src-attr`);
}
for(const f of pages){
  assert.doesNotMatch(read(f),/<script\b(?![^>]*\bsrc=)[^>]*>/,`${f}: an inline <script> would be blocked`);
  assert.doesNotMatch(read(f),/javascript:/i,`${f}: a javascript: URL would be blocked`);
}
const scripts=fs.readdirSync(D).filter(f=>f.endsWith('.js'));
for(const f of scripts){
  assert.doesNotMatch(read(f),/<[a-z][^<>]*\son[a-z]+=/i,`${f}: markup with an inline handler would be blocked`);
  assert.doesNotMatch(read(f),/setAttribute\(\s*['"]on/,`${f}: an inline handler set as an attribute would be blocked`);
}
assert.ok(!dir['script-src-elem'].includes("'unsafe-inline'")&&!dir['script-src-attr'].includes("'unsafe-inline'"),
  "'unsafe-inline' only in script-src, the fallback for browsers without script-src-elem/-attr");

// (2) outside origins in the code
const origin=u=>new URL(u).origin;
const api=/url:\s*'(https:\/\/[^']+)'/.exec(read('live-data.js'))?.[1];
assert.ok(api&&dir['connect-src'].includes(origin(api)),`connect-src allows the Supabase API ${api}`);
const tiles=[...read('app.js').matchAll(/tileLayer(?:\.wms)?\([^)]*?'(https:\/\/[^']+)'/g)].map(m=>origin(m[1]));
assert.ok(tiles.length>=2,'the satellite and depth tile servers are found in app.js');
for(const o of tiles)assert.ok(dir['img-src'].includes(o),`img-src allows map tiles from ${o}`);
// the beacon script (analytics.js, only with a token) and the host it sends its counts to (the beacon's own default)
const beacon=/\.src='(https:\/\/[^']+)'/.exec(read('analytics.js'))?.[1];
for(const d of ['script-src','script-src-elem'])assert.ok(beacon&&dir[d].includes(origin(beacon)),`${d} allows the beacon ${beacon}`);
assert.ok(dir['connect-src'].includes('https://cloudflareinsights.com'),'connect-src lets the beacon send');
// the guide helper's AI answer (chatbot.js → worker/index.mjs): a relative same-origin path, so connect-src 'self' covers it
const ask=[...read('chatbot.js').matchAll(/fetch\('([^']+)'/g)].map(m=>m[1]);
assert.ok(ask.length&&ask.every(u=>u==='api/ask')&&dir['connect-src'].includes("'self'"),`chatbot.js asks only the same-origin api/ask (${ask})`);
for(const [k,v] of Object.entries({'object-src':["'none'"],'frame-ancestors':["'none'"],'base-uri':["'self'"]}))assert.deepEqual(dir[k],v,k);

// (3) the features turned off
assert.match(block,/^\s+Permissions-Policy: camera=\(\), microphone=\(\), geolocation=\(\)$/m);
for(const f of scripts)
  assert.doesNotMatch(read(f),/getUserMedia|mediaDevices|geolocation/,`${f} uses a feature the Permissions-Policy turns off`);
console.log(`PASS: CSP allows the ${handlers.length} inline handlers by hash, none in the JS, no inline script; Supabase in connect-src, ${tiles.length} tile servers in img-src, the beacon in script-src/connect-src; camera, microphone and geolocation unused`);

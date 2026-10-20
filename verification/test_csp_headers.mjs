// Content-Security-Policy in dist/_headers (2026-10-21): it must keep matching the pages and the code, or the site breaks
// only where the header is served (Cloudflare), never on the local python server. (1) every inline event handler in the
// pages is allowed by its hash and there is no inline <script>; (2) the outside origins the code loads from are allowed in
// the directive that governs them; (3) the browser features the Permissions-Policy turns off are used nowhere.
// The beacon's origins are checked in test_analytics_beacon.mjs. Run: node verification/test_csp_headers.mjs
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
const handlers=pages.flatMap(f=>[...read(f).matchAll(/\son[a-z]+="([^"]*)"/g)].map(m=>[f,m[1]]));
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
assert.ok(!dir['script-src-elem'].includes("'unsafe-inline'")&&!dir['script-src-attr'].includes("'unsafe-inline'"),
  "'unsafe-inline' only in script-src, the fallback for browsers without script-src-elem/-attr");

// (2) outside origins in the code
const origin=u=>new URL(u).origin;
const api=/url:\s*'(https:\/\/[^']+)'/.exec(read('live-data.js'))?.[1];
assert.ok(api&&dir['connect-src'].includes(origin(api)),`connect-src allows the Supabase API ${api}`);
const tiles=[...read('app.js').matchAll(/tileLayer(?:\.wms)?\([^)]*?'(https:\/\/[^']+)'/g)].map(m=>origin(m[1]));
assert.ok(tiles.length>=2,'the satellite and depth tile servers are found in app.js');
for(const o of tiles)assert.ok(dir['img-src'].includes(o),`img-src allows map tiles from ${o}`);
for(const [k,v] of Object.entries({'object-src':["'none'"],'frame-ancestors':["'none'"],'base-uri':["'self'"]}))assert.deepEqual(dir[k],v,k);

// (3) the features turned off
assert.match(block,/^\s+Permissions-Policy: camera=\(\), microphone=\(\), geolocation=\(\)$/m);
for(const f of fs.readdirSync(D).filter(f=>f.endsWith('.js')))
  assert.doesNotMatch(read(f),/getUserMedia|mediaDevices|geolocation/,`${f} uses a feature the Permissions-Policy turns off`);
console.log(`PASS: CSP allows the ${handlers.length} inline handlers by hash, no inline script; Supabase in connect-src, ${tiles.length} tile servers in img-src; camera, microphone and geolocation unused`);

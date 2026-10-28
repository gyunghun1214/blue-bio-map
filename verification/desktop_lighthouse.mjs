// Comparable local lab runs, never an INP/field-data claim. Dependencies are CI-only (already used by live-check.yml).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import lighthouse from 'lighthouse';
import {launch} from 'chrome-launcher';
import {chromium} from 'playwright';
const OUT=process.argv[2];if(!OUT)throw Error('Pass an output directory');
fs.mkdirSync(OUT,{recursive:true});
const roots={before:path.resolve('.audit-base/dist'),after:path.resolve('dist')};
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer((q,r)=>{
  const parts=new URL(q.url,'http://localhost').pathname.split('/').filter(Boolean),root=roots[parts.shift()];
  if(!root){r.writeHead(404).end();return;}
  let file=path.resolve(root,parts.join('/')||'index.html');
  if(!file.startsWith(root+path.sep)){r.writeHead(403).end();return;}
  fs.readFile(file,(err,b)=>err?r.writeHead(404).end():r.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'}).end(b));
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const summary=[];
try{
  for(const page of ['index.html','expedition.html'])for(let run=1;run<=3;run++)for(const version of ['before','after']){
    const chrome=await launch({chromePath:chromium.executablePath(),chromeFlags:['--headless','--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    try{
      const {lhr}=await lighthouse(`http://127.0.0.1:${server.address().port}/${version}/${page}`,{port:chrome.port,logLevel:'error',onlyCategories:['performance'],output:'json',blockedUrlPatterns:['*supabase.co*','*gibs.earthdata.nasa.gov*']});
      fs.writeFileSync(path.join(OUT,`${version}-${page}-${run}.json`),JSON.stringify(lhr));
      const row={version,page,run,score:lhr.categories.performance.score,LCP:lhr.audits['largest-contentful-paint'].numericValue,CLS:lhr.audits['cumulative-layout-shift'].numericValue,TBT:lhr.audits['total-blocking-time'].numericValue,errors:lhr.runtimeError||null};
      summary.push(row);console.log(JSON.stringify(row));
    }finally{await chrome.kill();}
  }
}finally{server.close();fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(summary,null,2));}

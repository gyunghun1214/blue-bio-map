// 챗봇 AI 답변 Worker(worker/index.mjs): 경로·메서드·출처·질문 검사, IP/전체 호출 제한, AI 실패 처리, 프롬프트 근거.
// Workers AI와 제한 바인딩은 가짜로 바꿔 끼운다(실제 AI 호출 없음).
// Run: node verification/test_ask_worker.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../worker/index.mjs';
import {systemPrompt} from '../worker/prompt.mjs';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const html=read('index.html'),js=read('chatbot.js');
const site='https://blue-bio-map.example';
let calls=[];
const env=({ip=true,all=true,ai=async()=>({choices:[{message:{content:' 답이에요. '}}]})}={})=>({
  ASSETS:{fetch:async req=>new Response(read(new URL(req.url).pathname.slice(1)))},
  ASK_IP_LIMIT:{limit:async o=>(calls.push(['ip',o.key]),{success:ip})},
  ASK_ALL_LIMIT:{limit:async o=>(calls.push(['all',o.key]),{success:all})},
  AI:{run:async(model,body)=>(calls.push(['ai',model,body]),ai())}
});
const ask=(body,{method='POST',path='/api/ask',headers={}}={})=>new Request(site+path,{method,headers:{'Content-Type':'application/json','CF-Connecting-IP':'203.0.113.7',...headers},body:method==='POST'?JSON.stringify(body):undefined});
const status=async(req,e=env())=>(await worker.fetch(req,e)).status;

// (1) 경로·메서드·다른 사이트 출처·질문 형식
assert.equal(await status(ask({q:'x'},{path:'/api/other'})),404);
assert.equal(await status(ask(null,{method:'GET'})),405);
assert.equal(await status(ask({q:'질문'},{headers:{Origin:'https://evil.example'}})),403);
for(const q of [undefined,'',' ',42,'가'.repeat(201)])assert.equal(await status(ask({q})),400,`q=${String(q).slice(0,10)}`);

// (2) IP당 제한(키 = 접속 IP), 전체 제한(키 = all): 어느 쪽이든 넘으면 429이고 AI를 부르지 않는다
calls=[];assert.equal(await status(ask({q:'질문'}),env({ip:false})),429);
assert.deepEqual(calls,[['ip','203.0.113.7']]);
calls=[];assert.equal(await status(ask({q:'질문'}),env({all:false})),429);
assert.ok(!calls.some(c=>c[0]==='ai'));

// (3) AI 오류·빈 답은 502(화면은 FAQ 안내로 돌아감)
assert.equal(await status(ask({q:'질문'}),env({ai:async()=>{throw new Error('down');}})),502);
assert.equal(await status(ask({q:'질문'}),env({ai:async()=>({choices:[{message:{content:''},finish_reason:'length'}]})})),502);

// (4) 성공: 같은 출처면 통과, 답은 다듬어 돌려주고, 생각 모드는 끈다(켜면 답이 빈다)
calls=[];
const res=await worker.fetch(ask({q:' 휴대폰에서도 돼요? '},{headers:{Origin:site}}),env());
assert.equal(res.status,200);
assert.equal((await res.json()).answer,'답이에요.');
const [,model,body]=calls.find(c=>c[0]==='ai');
assert.match(model,/^@cf\//);
assert.deepEqual(body.chat_template_kwargs,{enable_thinking:false});
assert.equal(body.messages[1].content,'휴대폰에서도 돼요?');

// (5) 프롬프트 근거 = 배포된 화면 글 + FAQ 답변 23개, 자리표시는 화면 글자로 바뀜
const p=systemPrompt(html,js);
assert.equal(body.messages[0].content,p);
assert.ok(!/\{(tab|type):|\{rule\}|<\w/.test(p),'자리표시나 태그가 남음');
assert.equal((p.slice(p.lastIndexOf('[FAQ]')).match(/^- /gm)||[]).length,(js.match(/\ba:'/g)||[]).length);
for(const name of [...html.matchAll(/<button data-view="\w+"[^>]*>([^<]+)</g),...html.matchAll(/data-key="\w+"><b>([^<]+)</g)].map(m=>m[1]))
  assert.ok(p.includes(`‘${name}’`),`FAQ 자리표시가 화면 글자 ‘${name}’로 바뀌어야 함`);
console.log('PASS: /api/ask 경로·메서드·출처·질문 검사, IP·전체 호출 제한, AI 실패 502, 생각 모드 끔, 프롬프트 근거');

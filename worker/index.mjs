// 사용법 안내 챗봇의 AI 답변(POST /api/ask). FAQ(dist/chatbot.js)가 못 찾은 질문만 온다.
// 정적 파일은 이 Worker를 거치지 않는다(wrangler.jsonc assets.run_worker_first = /api/*).
// 근거는 배포된 index.html 화면 글과 chatbot.js FAQ 답변뿐이라, 사이트 문구가 바뀌면 다음 배포부터 함께 바뀐다.
// 키가 필요 없는 Workers AI 바인딩을 쓴다. 실패·한도 초과는 모두 오류 코드로 돌려주고, 화면은 FAQ 안내로 돌아간다.
import {systemPrompt} from './prompt.mjs';

const MODEL='@cf/google/gemma-4-26b-a4b-it';
const MAX_QUESTION=200;
const MAX_ANSWER=1200;

let cachedPrompt=null; // isolate마다 한 번만 읽는다. 새 배포는 새 isolate라 새 글을 읽는다.
async function prompt(env,origin){
  if(!cachedPrompt){
    const [html,js]=await Promise.all(['/index.html','/chatbot.js'].map(p=>env.ASSETS.fetch(new Request(origin+p)).then(r=>r.text())));
    cachedPrompt=systemPrompt(html,js);
  }
  return cachedPrompt;
}
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname!=='/api/ask')return json({error:'not_found'},404);
    if(request.method!=='POST')return json({error:'method_not_allowed'},405,{Allow:'POST'});
    const origin=request.headers.get('Origin');
    if(origin&&origin!==url.origin)return json({error:'forbidden'},403); // 다른 사이트의 페이지에서 부르는 것 차단
    // IP당 분당 5회, 그리고 전체 분당 30회(여러 IP로 몰려도 비용 상한).
    const ip=request.headers.get('CF-Connecting-IP')||'unknown';
    if(!(await env.ASK_IP_LIMIT.limit({key:ip})).success||!(await env.ASK_ALL_LIMIT.limit({key:'all'})).success)
      return json({error:'rate_limited'},429,{'Retry-After':'60'});
    let q;
    try{q=(await request.json())?.q;}catch{}
    if(typeof q!=='string'||!(q=q.trim())||q.length>MAX_QUESTION)return json({error:'bad_question'},400);
    try{
      const r=await env.AI.run(MODEL,{messages:[{role:'system',content:await prompt(env,url.origin)},{role:'user',content:q}],max_tokens:400,temperature:.2,
        chat_template_kwargs:{enable_thinking:false}}); // 생각 모드를 켜면 출력 한도를 다 써서 답이 비어 온다
      const answer=String(r?.response??r?.choices?.[0]?.message?.content??'').trim();
      if(!answer)throw new Error('empty answer');
      return json({answer:answer.slice(0,MAX_ANSWER),model:MODEL});
    }catch(error){
      console.error('ask failed:',String(error).slice(0,200)); // 질문 내용은 남기지 않는다
      return json({error:'ai_failed'},502);
    }
  }
};

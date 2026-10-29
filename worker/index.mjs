// 사용법 안내 도우미의 AI 답변(/api/ask). FAQ(dist/chatbot.js)가 못 찾은 질문만 온다.
// 정적 파일은 이 Worker를 거치지 않는다(wrangler.jsonc assets.run_worker_first = /api/*).
// 모델은 Claude Haiku 5.5(Anthropic API). 키는 Worker 비밀값 ANTHROPIC_API_KEY에만 있고 저장소·화면 코드에는 없다.
// GET은 AI를 쓸 수 있는지만 알려 준다(비밀값이 없으면 ai:false, 모델 호출 없음). 실패·한도 초과·검사 탈락은 모두 오류나 no_answer로
// 돌려주고, 화면은 정해진 안내(세 탭 바로가기)로 돌아간다.
import {systemPrompt,checkAnswer,numbers,pageText,faqText} from './prompt.mjs';

export const MODEL='claude-haiku-5-5';
const API='https://api.anthropic.com/v1/messages';
const MAX_QUESTION=200;

let cached=null; // isolate마다 한 번만 읽는다. 새 배포는 새 isolate라 새 글을 읽는다.
async function grounding(env,origin){
  if(!cached){
    const [html,js]=await Promise.all(['/index.html','/chatbot.js'].map(p=>env.ASSETS.fetch(new Request(origin+p)).then(r=>r.text())));
    cached={prompt:systemPrompt(html,js),known:numbers(pageText(html)+'\n'+faqText(js,html))};
  }
  return cached;
}
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname!=='/api/ask')return json({error:'not_found'},404);
    const on=typeof env.ANTHROPIC_API_KEY==='string'&&env.ANTHROPIC_API_KEY.length>0;
    if(request.method==='GET')return json({ai:on});
    if(request.method!=='POST')return json({error:'method_not_allowed'},405,{Allow:'GET, POST'});
    if(request.headers.get('Origin')!==url.origin)return json({error:'forbidden'},403); // 우리 사이트 페이지에서 보낸 질문만
    if(!on)return json({error:'ai_off'},503);
    // 접속(IP)당 분당 5회, 그리고 전체 분당 30회(여러 IP로 몰려도 비용 상한).
    const ip=request.headers.get('CF-Connecting-IP')||'unknown';
    if(!(await env.ASK_IP_LIMIT.limit({key:ip})).success||!(await env.ASK_ALL_LIMIT.limit({key:'all'})).success)
      return json({error:'rate_limited'},429,{'Retry-After':'60'});
    let q,lang;
    try{({q,lang}=await request.json()??{});}catch{}
    if(typeof q!=='string'||!(q=q.trim())||q.length>MAX_QUESTION)return json({error:'bad_question'},400);
    lang=lang==='en'?'en':'ko';
    try{
      const g=await grounding(env,url.origin);
      const r=await fetch(API,{method:'POST',signal:AbortSignal.timeout(12000),
        headers:{'Content-Type':'application/json','x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2026-10-21'},
        body:JSON.stringify({model:MODEL,max_tokens:600,thinking:{type:'disabled'},output_config:{effort:'low'},
          system:[{type:'text',text:g.prompt,cache_control:{type:'ephemeral'}}],
          messages:[{role:'user',content:`<question lang="${lang}">${q.replace(/[<>]/g,'')}</question>`}]})});
      if(!r.ok)throw new Error('status '+r.status);
      const m=await r.json();
      if(m.stop_reason!=='end_turn')throw new Error('stop '+m.stop_reason); // refusal·max_tokens(잘린 답)는 내보내지 않는다
      const answer=checkAnswer((m.content||[]).filter(b=>b.type==='text').map(b=>b.text).join(''),g.known);
      return answer?json({answer,model:MODEL}):json({answer:null,reason:'no_answer'});
    }catch(error){
      console.error('ask failed:',String(error).slice(0,200)); // 질문 내용과 키는 남기지 않는다
      return json({error:'ai_failed'},502);
    }
  }
};

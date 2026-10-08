import { verifySession } from "./portal.js";
import { edgeSynthesize } from "./edge-tts.js";
import { dotPage } from "./dot-ui.js";
import { mainPcId, rosterFor, getAuthorizedAgent, createAgents, runAgentsInParallel, updateAgentReports, MAX_AGENTS } from "./dot-agents.js";
import { getRoster, saveRoster } from "./threadhub.js";
import { createThread, getThread, putThread, listThreads, deleteThread, readPcState, ensurePc, stopPc } from "./threadhub.js";

const AGENT_ID = "metodbox-dot";
const DEFAULT_MODEL = "gpt-5.1";
function reply(value, status = 200) {
  return Response.json(value, {status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
function errorText(error) { return error instanceof Error ? error.message : String(error); }
function properThread(id) { return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(String(id||"")); }
async function authorized(request, env) {
  return Boolean(env.PORTAL_SESSION_SECRET && env.PORTAL_PASSWORD && await verifySession(request, env));
}
function correctOrigin(request, url) {
  const origin = request.headers.get("Origin");
  return origin === url.origin;
}
async function pcState(env,agentId) {
  return readPcState(env,agentId);
}
function pcUrl(state) {
  if (state.status !== "running" || !state.url) throw Error("Dot PC kapalı veya henüz hazırlanıyor. Önce PC Başlat.");
  const base = new URL(state.url);
  if (base.protocol !== "https:" || !/^[a-z0-9-]+\.trycloudflare\.com$/i.test(base.hostname) || base.port || base.username || base.password)
    throw Error("Beklenmeyen PC ağ adresi. İşlem güvenlik nedeniyle durduruldu.");
  return base.origin;
}
async function computerToken(env,agentId) {
  const secret=String(env.API_KEY||"");
  if(!secret)throw Error("API_KEY eksik");
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const data=new TextEncoder().encode("opendots-computer:"+agentId);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC",key,data))].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function computerCall(env, kind, body,agentId) {
  const current=await pcState(env,agentId);
  const target=pcUrl(current);
  const allowed = { screenshot:["GET","/screenshot"], navigate:["POST","/navigate"], exec:["POST","/exec"], snapshot:["POST","/snapshot"] };
  const route=allowed[kind];
  if(!route) throw Error("Computer action not allowed");
  const [method,path]=route;
  const response=await fetch(target+path,{
    method,
    headers:{Authorization:"Bearer "+await computerToken(env,agentId),"x-openbot-bot-id":agentId,"Content-Type":"application/json"},
    ...(method==="POST"?{body:JSON.stringify(body||{})}:{}),
    // Cloudflare Workers supports follow/manual, not redirect:error.
    // Manual still refuses any 3xx redirect because response.ok is false.
    redirect:"manual",
    signal:AbortSignal.timeout(30000),
  });
  if(!response.ok)throw Error("PC "+kind+" HTTP "+response.status);
  const content=await response.text();
  if(content.length>4_000_000)throw Error("PC response too large");
  const result=JSON.parse(content);
  if(result?.error)throw Error(String(result.error).slice(0,300));
  return result;
}
function validatePublicUrl(value){
  const url=new URL(String(value));
  if(url.protocol!=="https:" && url.protocol!=="http:")throw Error("Yalnızca HTTP(S) siteleri.");
  if(url.username||url.password||url.port&&!["80","443"].includes(url.port))throw Error("Yetkisiz URL.");
  const host=url.hostname.toLowerCase();
  if(host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host.endsWith(".internal")||/^(0|10|127|169\.254|172\.(1[6-9]|2\d|3[01])|192\.168)\./.test(host) || host==="::1"||host.startsWith("["))
    throw Error("Yerel/özel ağ adreslerine izin verilmez.");
  if(url.toString().length>2000)throw Error("URL çok uzun.");
  return url.href;
}
// Tool definitions are dynamically scoped: every chat owns one parent PC and
// every child owns a completely separate GitHub Actions computer.
function modelTools(isMain, allowExec) {
  const common=[
    {type:"function",function:{name:"dot_pc_status",description:"Check this agent's personal GitHub PC status.",parameters:{type:"object",properties:{}}}},
    {type:"function",function:{name:"dot_pc_start",description:"Start or resume this agent's own isolated PC.",parameters:{type:"object",properties:{}}}},
    {type:"function",function:{name:"dot_pc_navigate",description:"Read a publicly accessible website in this agent's PC browser.",parameters:{type:"object",properties:{url:{type:"string"}},required:["url"]}}},
    {type:"function",function:{name:"dot_web_search",description:"Search the public web using your own Chromium browser. The PC must be ready.",parameters:{type:"object",properties:{query:{type:"string"}},required:["query"]}}},
  ];
  if(allowExec)common.push({type:"function",function:{name:"dot_pc_exec",description:"Run an authorized shell command in this agent's isolated PC. Only when directly relevant to the user's task; never retrieve/exfiltrate credentials.",parameters:{type:"object",properties:{command:{type:"string"}},required:["command"]}}});
  if(isMain)common.push({type:"function",function:{name:"dot_spawn_agents",description:"Create 1-3 child agents, each with separate persistent PC and independent simultaneous GPT+ model request. Delegate separate concrete subtasks and summarize their results.",parameters:{type:"object",properties:{agents:{type:"array",minItems:1,maxItems:3,items:{type:"object",properties:{name:{type:"string"},task:{type:"string"}},required:["task"]}}},required:["agents"]}}});
  return common;
}
function modelText(item) {
  return typeof item?.content==="string"?item.content:
    Array.isArray(item?.content)?item.content.map(i=>i.text||"").join(""):"";
}
async function executeAgentTool(name,args,context) {
  const {env,chatId,agentId,callModel,allowSpawn,allowExec}=context;
  if(name==="dot_pc_status")return pcState(env,agentId);
  if(name==="dot_pc_start")return ensurePc(env,agentId);
  if(name==="dot_pc_navigate"){
    const d=await computerCall(env,"navigate",{url:validatePublicUrl(args?.url)},agentId);
    return {url:d.url,title:d.title,text:String(d.text||"").slice(0,8500)};
  }
  if(name==="dot_web_search"){
    const query=String(args?.query||"").trim().slice(0,200);
    if(!query)throw Error("Search query is required");
    const d=await computerCall(env,"navigate",{url:"https://www.google.com/search?q="+encodeURIComponent(query)},agentId);
    return {query,title:d.title,url:d.url,text:String(d.text||"").slice(0,8500)};
  }
  if(name==="dot_pc_exec" && allowExec){
    const command=String(args?.command||"");
    if(!command.trim()||command.length>1200)throw Error("Command length exceeds limit");
    const result=await computerCall(env,"exec",{command,timeoutMs:20000},agentId);
    return {exitCode:result.exitCode,stdout:String(result.stdout||"").slice(0,8500),stderr:String(result.stderr||"").slice(0,2000)};
  }
  if(name==="dot_spawn_agents" && allowSpawn){
    const specs=args?.agents;
    const res=await runAgentsInParallel(env,chatId,specs, async child=>runAgentTask(env,callModel,chatId,child,allowExec));
    return {agents:res,parallel:true};
  }
  throw Error("Unknown or unauthorized tool: "+name);
}
async function modelLoop(env,callModel,messages,context) {
  const available=modelTools(context.allowSpawn,context.allowExec);
  for(let round=0;round<4;round++){
    const output=await callModel({
      model:DEFAULT_MODEL,stream:false,max_completion_tokens:1600,
      messages,tools:available,tool_choice:"auto",parallel_tool_calls:true
    });
    const assistant=output?.choices?.[0]?.message;
    if(!assistant)throw Error("Model assistant reply is missing");
    if(!Array.isArray(assistant.tool_calls)||!assistant.tool_calls.length){
      const content=modelText(assistant);
      if(!content.trim())throw Error("Model boş cevap döndürdü.");
      return content;
    }
    // Calls within one agent run in order; multiple child agents are concurrent.
    const toolcalls=assistant.tool_calls.slice(0,3);
    messages.push({role:"assistant",content:modelText(assistant),tool_calls:toolcalls});
    for(const call of toolcalls){
      let value;
      try{
        value=await executeAgentTool(call.function?.name,JSON.parse(call.function?.arguments||"{}"),context);
      }catch(e){value={error:errorText(e)}}
      messages.push({role:"tool",tool_call_id:call.id,content:JSON.stringify(value).slice(0,14500)});
    }
  }
  // Do not pretend success after exhausting tool rounds.
  const last=messages.filter(m=>m.role==="tool").slice(-2);
  return "Alt işlemlerin sonucu: "+last.map(m=>m.content.slice(0,1800)).join("\n");
}
async function runAgentTask(env,callModel,chatId,child,allowExec) {
  const messages=[
    {role:"system",content:"Sen Metodbox Dot'un bağımsız alt agentısın. Agent adı: "+child.name+
      ". PC kimliğin: "+child.id+". Ana sohbete rapor vereceksin. Bilgisayar henüz başlatılıyorsa açıkça belirt; uydurma çıktı verme. Sadece verilen görevi tamamla. Kullanıcı parolalarını/sırlarını isteme veya paylaşma."},
    {role:"user",content:child.task}
  ];
  return modelLoop(env,callModel,messages,{env,callModel,chatId,agentId:child.id,allowSpawn:false,allowExec});
}
async function answerFromModel(env,callModel,history,text,chatId) {
  const roster=await getRoster(env,chatId);
  const messages=[
    {role:"system",content:"Sen Metodbox Dot ana agentsın. Bu sohbetin kendi ana PC kimliği "+mainPcId(chatId)+
      ". Her yeni sohbet farklı PC açar, bu sohbetin tüm alt agentları ayrı PC/workspace kullanır. Gerekirse dot_spawn_agents aracıyla en çok 3 alt agentı aynı anda farklı görevlere yönlendir ve sonuçları birleştir. Mevcut "+roster.agents.length+" alt agent bulunuyor (üst sınır 6). Kendi bilgisayarın yalnızca GitHub Actions izole PC'dir; PC hazır değilken işlem yaptığını iddia etme. Terminal yetkisi "+(roster.allowExec?"kullanıcı tarafından onaylıdır.":"onaylanmamıştır.")+" Yanıtları Türkçe, anlaşılır ve dürüst ver."},
    ...history.filter(m=>m&&["user","assistant"].includes(m.role)&&typeof m.content==="string").slice(-20).map(m=>({role:m.role,content:m.content.slice(0,5000)})),
    {role:"user",content:text}
  ];
  return modelLoop(env,callModel,messages,{env,callModel,chatId,agentId:mainPcId(chatId),allowSpawn:roster.agents.length<MAX_AGENTS,allowExec:roster.allowExec&&String(env.PORTAL_PASSWORD||"").length>=12});
}
async function parseBody(request, max=9000) {
  const text=await request.text();
  if(text.length>max)throw Error("İstek çok büyük");
  return JSON.parse(text||"{}");
}
export async function handleDotRequest(request,env,url,callModel) {
  if(!(url.pathname==="/dot"||url.pathname==="/dot/"||url.pathname.startsWith("/dot/api/")))return null;
  if(!await authorized(request,env)){
    if(url.pathname.startsWith("/dot/api/"))return reply({error:"Oturum gerekli. /apps adresinden giriş yap."},401);
    return Response.redirect(url.origin+"/apps",302);
  }
  if((url.pathname==="/dot"||url.pathname==="/dot/")&&request.method==="GET")return dotPage();
  if(!url.pathname.startsWith("/dot/api/"))return reply({error:"Not found"},404);
  if(request.method!=="GET"&&!correctOrigin(request,url))return reply({error:"Cross-origin request denied"},403);
  try {
    const path=url.pathname.slice("/dot/api/".length);
    if(path==="threads"&&request.method==="GET"){
      const threads=await listThreads(env,AGENT_ID);
      return reply({threads});
    }
    if(path==="threads"&&request.method==="POST"){
      const data=await parseBody(request);
      const thread=await createThread(env,{agentId:AGENT_ID,title:String(data.title||"Yeni konuşma").slice(0,70)});
      return reply(thread,201);
    }
    const threadMatch=path.match(/^threads\/([A-Za-z0-9._-]+)$/);
    if(threadMatch&&request.method==="GET"){
      const thread=await getThread(env,threadMatch[1]);
      if(!thread||thread.agentId!==AGENT_ID)return reply({error:"Konuşma bulunamadı"},404);
      return reply(thread);
    }
    if(threadMatch&&request.method==="DELETE"){
      const thread=await getThread(env,threadMatch[1]);
      if(!thread||thread.agentId!==AGENT_ID)return reply({error:"Konuşma bulunamadı"},404);
      return reply({ok:await deleteThread(env,threadMatch[1])});
    }
    if(path==="message"&&request.method==="POST"){
      const data=await parseBody(request);
      const id=data.threadId, text=String(data.text||"").trim();
      if(!properThread(id)||!text||text.length>4000)return reply({error:"Geçersiz konuşma veya mesaj"},400);
      const thread=await getThread(env,id);
      if(!thread||thread.agentId!==AGENT_ID)return reply({error:"Konuşma bulunamadı"},404);
      const prev=thread.messages||[];
      const result=await answerFromModel(env,callModel,prev,text);
      const appended=[...prev,{id:crypto.randomUUID(),role:"user",content:text},{id:crypto.randomUUID(),role:"assistant",content:result}];
      let saved=true;
      try{await putThread(env,id,{agentId:AGENT_ID,messages:appended,title:thread.title==="Yeni konuşma"?text.slice(0,70):thread.title});}
      catch(e){saved=false;console.error("Dot history save failed",errorText(e));}
      return reply({content:result,saved});
    }
    if(path==="tts"&&request.method==="POST"){
      const data=await parseBody(request,2200);
      if(typeof data.text!=="string"||!data.text.trim()||data.text.length>1200)
        return reply({error:"Invalid speech text"},400);
      const audio=await edgeSynthesize(data.text,String(data.voice||"tr-TR-EmelNeural"));
      return new Response(audio,{status:200,headers:{"Content-Type":"audio/mpeg","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
    }
    if(path==="pc/status"&&request.method==="GET")return reply(await pcState(env));
    if(path==="pc/start"&&request.method==="POST")return reply(await ensurePc(env,AGENT_ID));
    if(path==="pc/stop"&&request.method==="POST")return reply(await stopPc(env,AGENT_ID));
    if(path==="pc/navigate"&&request.method==="POST"){
      const body=await parseBody(request);
      return reply(await computerCall(env,"navigate",{url:validatePublicUrl(body.url)}));
    }
    if(path==="pc/screenshot"&&request.method==="POST")return reply(await computerCall(env,"screenshot"));
    if(path==="pc/exec"&&request.method==="POST"){
      // A short demo/admin password must never grant remote shell powers.
      if(String(env.PORTAL_PASSWORD||"").length<12)
        return reply({error:"Terminal için önce portal şifresini güçlü (12+ karakter) yapmalısın."},403);
      const data=await parseBody(request);
      if(typeof data.command!=="string"||!data.command.trim()||data.command.length>1500)return reply({error:"Geçersiz komut"},400);
      return reply(await computerCall(env,"exec",{command:data.command,timeoutMs:Math.min(25000,Math.max(1000,Number(data.timeoutMs)||15000))}));
    }
    return reply({error:"Route not found"},404);
  }catch(e){return reply({error:errorText(e)},503);}
}

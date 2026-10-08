import { verifySession } from "./portal.js";
import { edgeSynthesize } from "./edge-tts.js";
import { dotPage } from "./dot-ui.js";
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
async function pcState(env) {
  return readPcState(env, AGENT_ID);
}
function pcUrl(state) {
  if (state.status !== "running" || !state.url) throw Error("Dot PC kapalı veya henüz hazırlanıyor. Önce PC Başlat.");
  const base = new URL(state.url);
  if (base.protocol !== "https:" || !/^[a-z0-9-]+\.trycloudflare\.com$/i.test(base.hostname) || base.port || base.username || base.password)
    throw Error("Beklenmeyen PC ağ adresi. İşlem güvenlik nedeniyle durduruldu.");
  return base.origin;
}
async function computerToken(env) {
  const secret=String(env.API_KEY||"");
  if(!secret)throw Error("API_KEY eksik");
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const data=new TextEncoder().encode("opendots-computer:"+AGENT_ID);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC",key,data))].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function computerCall(env, kind, body) {
  const current=await pcState(env);
  const target=pcUrl(current);
  const allowed = { screenshot:["GET","/screenshot"], navigate:["POST","/navigate"], exec:["POST","/exec"], snapshot:["POST","/snapshot"] };
  const route=allowed[kind];
  if(!route) throw Error("Computer action not allowed");
  const [method,path]=route;
  const response=await fetch(target+path,{
    method,
    headers:{Authorization:"Bearer "+await computerToken(env),"x-openbot-bot-id":AGENT_ID,"Content-Type":"application/json"},
    ...(method==="POST"?{body:JSON.stringify(body||{})}:{}),
    redirect:"error",
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
function tools() {
  return [
    {type:"function",function:{name:"dot_pc_status",description:"Check the status of the user's isolated Dot PC on GitHub Actions.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"dot_pc_start",description:"Start the user's isolated Dot PC on GitHub Actions if they asked for computer help.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"dot_pc_navigate",description:"Open a public webpage in the running Dot PC Chromium and return extracted page text. Only for the user's requested interactive computer/browser task.",parameters:{type:"object",properties:{url:{type:"string",description:"Full public http/https URL"}},required:["url"],additionalProperties:false}}},
  ];
}
async function executeTool(name,args,env){
  if(name==="dot_pc_status")return pcState(env);
  if(name==="dot_pc_start")return ensurePc(env,AGENT_ID);
  if(name==="dot_pc_navigate"){
    if(typeof args?.url!=="string")throw Error("URL gerekiyor");
    const data=await computerCall(env,"navigate",{url:validatePublicUrl(args.url)});
    return {url:data.url,title:data.title,text:String(data.text||"").slice(0,7000)};
  }
  throw Error("Unknown Dot tool");
}
async function answerFromModel(env, callModel, history, text) {
  const messages=[
    {role:"system",content:"Sen Metodbox Dot'sun. Türkçe ve doğal konuş. Kullanıcının kendi sanal Dot bilgisayarı yalnızca izin verilmiş izole GitHub Actions PC'dir. Kullanıcı isterse dot_pc_start ve dot_pc_navigate araçlarını kullan. Sonuç gelmeden bilgisayara eriştiğini iddia etme. Kullanıcıdan sır, token, parola isteme. Telefonla görüşme metin olarak iletilir. Kısa, anlaşılır ve yardımcı yanıtlar ver."},
    ...history.filter(m=>m&&["user","assistant"].includes(m.role)&&typeof m.content==="string").slice(-16).map(m=>({role:m.role,content:m.content.slice(0,5000)})),
    {role:"user",content:text}
  ];
  const calls=tools();
  for(let round=0;round<3;round++){
    const data=await callModel({model:DEFAULT_MODEL,stream:false,max_completion_tokens:1100,messages,tools:calls,tool_choice:"auto"});
    const item=data?.choices?.[0]?.message;
    if(!item)throw Error("Model cevap formatı boş.");
    if(!Array.isArray(item.tool_calls)||item.tool_calls.length===0){
      const content=typeof item.content==="string"?item.content:Array.isArray(item.content)?item.content.map(i=>i.text||"").join(""):"";
      if(!content.trim())throw Error("Model boş cevap döndürdü.");
      return content;
    }
    messages.push({role:"assistant",content:typeof item.content==="string"?item.content:"",tool_calls:item.tool_calls});
    for(const call of item.tool_calls.slice(0,3)){
      let result;
      try{
        const args=JSON.parse(call.function?.arguments||"{}");
        result=await executeTool(call.function?.name,args,env);
      }catch(error){result={error:errorText(error)};}
      messages.push({role:"tool",tool_call_id:call.id,content:JSON.stringify(result).slice(0,8500)});
    }
  }
  return "İşlemleri kontrol ettim. Devam etmek için isteğini biraz daha ayrıntılı yazabilirsin.";
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

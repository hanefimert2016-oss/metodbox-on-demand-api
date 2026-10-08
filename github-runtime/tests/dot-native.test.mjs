import assert from "node:assert/strict";
import { test } from "node:test";
import { handlePortalRequest } from "../../cloudflare-direct/src/portal.js";
import { handleDotRequest } from "../../cloudflare-direct/src/dot.js";

const base = "https://worker.example";
function env(){
  const kv = new Map();
  return {
    PORTAL_USERNAME:"admin",
    PORTAL_PASSWORD:"test-strong-password-123",
    PORTAL_SESSION_SECRET:"test-session-secret-only-not-production",
    STORAGE_ENCRYPTION_KEY:"testing-data-key-not-production",
    API_KEY:"test-model-key",
    GITHUB_STORAGE_TOKEN:"storage-private-test-token",
    GITHUB_TRIGGER_TOKEN:"dispatch-test-token",
    GITHUB_STORAGE_REPO:"hanefimert2016-oss/Metodbox-secret-system",
    AUTH_KV:{
      get:async k=>kv.get(k)??null,
      put:async (k,v)=>{kv.set(k,v)},
      delete:async k=>kv.delete(k),
    }
  };
}
const url = path => new URL(base + path);
function req(method,path,body,cookie){
  const headers={Origin:base};
  if(cookie)headers.Cookie=cookie;
  if(body)headers["Content-Type"]="application/json";
  return new Request(base+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
}
async function login(environment) {
  const form=new URLSearchParams({username:"admin",password:environment.PORTAL_PASSWORD});
  const res=await handlePortalRequest(new Request(base+"/apps/login",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Origin:base},body:form.toString()}),environment,url("/apps/login"));
  assert.equal(res.status,303);
  const set=res.headers.get("set-cookie");
  assert.ok(set.includes("Path=/;"));
  return set.split(";")[0];
}
function githubStub(){
  const files=new Map();
  const calls=[];
  return {calls,fetch:async (uri, init={})=>{
    const u=new URL(String(uri));
    const method=init.method||"GET";
    calls.push({uri:u.href,method});
    if(u.pathname==="/repos/hanefimert2016-oss/Metodbox-secret-system")
      return Response.json({private:true});
    if(u.pathname.endsWith("/dispatches"))
      return new Response(null,{status:204});
    if(u.pathname.includes("/contents/")){
      const path=u.pathname.split("/contents/")[1];
      if(method==="GET"){
        const found=files.get(path);
        return found?Response.json(found):Response.json({message:"not found"},{status:404});
      }
      if(method==="PUT"){
        const body=JSON.parse(init.body);
        const sha="sha"+(files.size+1);
        files.set(path,{sha,content:body.content});
        return Response.json({content:{sha}},{status:201});
      }
      if(method==="DELETE"){
        files.delete(path);
        return Response.json({});
      }
    }
    return Response.json({message:"unexpected route: "+u.pathname},{status:500});
  }};
}
test("native Dot rejects unauthorized requests", async()=>{
  const e=env();
  const res=await handleDotRequest(req("GET","/dot"),e,url("/dot"),async()=>{throw Error("model must not be called")});
  assert.equal(res.status,200);
  assert.match(await res.text(),/return_to/);
  const data=await handleDotRequest(req("POST","/dot/api/message",{text:"hello"}),e,url("/dot/api/message"),async()=>{throw Error("model must not be called")});
  assert.equal(data.status,401);
});
test("new Dot UI loads instantly from Worker, cookie covers /dot",async()=>{
  const e=env();const cookie=await login(e);
  const res=await handleDotRequest(req("GET","/dot",null,cookie),e,url("/dot"),async()=>{throw Error("unexpected call")});
  assert.equal(res.status,200);
  const html=await res.text();
  assert.ok(html.includes("Metodbox Dot"));
  assert.ok(html.includes("voiceButton"));
  assert.ok(html.includes("pcStart"));
  assert.ok(html.includes("Edge neural"));
  assert.ok(!html.includes("test-model-key"));
  assert.ok(!html.includes("OPENAI_API_KEY"));
});
test("native Dot stores and retrieves encrypted conversation without CopilotKit",async()=>{
  const stub=githubStub(),old=globalThis.fetch;
  globalThis.fetch=stub.fetch;
  try{
    const e=env();const cookie=await login(e);
    const make=await handleDotRequest(req("POST","/dot/api/threads",{title:"Deneme"},cookie),e,url("/dot/api/threads"),async()=>{throw Error("unexpected")});
    assert.equal(make.status,201);
    const t=await make.json();assert.equal(t.agentId,"metodbox-dot");
    const sendPath="/dot/api/message";
    const message=await handleDotRequest(req("POST",sendPath,{threadId:t.id,text:"Merhaba"},cookie),e,url(sendPath),async b=>{
      assert.equal(b.model,"gpt-5.1");
      assert.equal(b.messages.at(-1).content,"Merhaba");
      return {choices:[{message:{role:"assistant",content:"Selam! Hemen yardımcı olayım."}}]};
    });
    assert.equal(message.status,200);
    const answered=await message.json();
    assert.equal(answered.saved,true);
    assert.ok(answered.content.includes("Selam"));
    const readPath="/dot/api/threads/"+t.id;
    const read=await handleDotRequest(req("GET",readPath,null,cookie),e,url(readPath),async()=>{});
    assert.equal(read.status,200);
    const restored=await read.json();
    assert.equal(restored.messages.length,2);
    assert.equal(restored.messages[0].role,"user");
    assert.equal(restored.messages[1].role,"assistant");
    assert.ok(stub.calls.some(x=>x.uri.includes("/repos/hanefimert2016-oss/Metodbox-secret-system/contents/")));
    assert.ok(!stub.calls.some(x=>x.uri.includes("/repos/hanefimert2016-oss/metodbox-on-demand-api/contents/")));
  }finally{globalThis.fetch=old}
});
test("native Dot refuses cross-origin authenticated POST",async()=>{
  const e=env(),cookie=await login(e);
  const r=new Request(base+"/dot/api/pc/start",{method:"POST",headers:{Cookie:cookie,Origin:"https://attacker.example"}});
  const res=await handleDotRequest(r,e,url("/dot/api/pc/start"),async()=>{});
  assert.equal(res.status,403);
});
test("weak password cannot grant remote terminal, even for its own chat",async()=>{
  const stub=githubStub(),old=globalThis.fetch;
  globalThis.fetch=stub.fetch;
  try{
    const e=env();e.PORTAL_PASSWORD="2026";const cookie=await login(e);
    const path="/dot/api/threads";
    const created=await handleDotRequest(req("POST",path,{title:"Weak pass test"},cookie),e,url(path),async()=>{});
    assert.equal(created.status,201);
    const t=await created.json();
    const execPath="/dot/api/pc/exec";
    const res=await handleDotRequest(req("POST",execPath,{chatId:t.id,command:"pwd"},cookie),e,url(execPath),async()=>{});
    assert.equal(res.status,403);
    assert.match((await res.json()).error,/12/);
  }finally{globalThis.fetch=old}
});

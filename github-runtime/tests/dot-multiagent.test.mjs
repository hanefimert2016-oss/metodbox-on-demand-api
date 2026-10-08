import assert from "node:assert/strict";
import {test} from "node:test";
import vm from "node:vm";
import {dotPage} from "../../cloudflare-direct/src/dot-ui.js";
import {teamPage} from "../../cloudflare-direct/src/dot-team-ui.js";
import {handlePortalRequest} from "../../cloudflare-direct/src/portal.js";
import {handleDotRequest} from "../../cloudflare-direct/src/dot.js";

const origin="https://worker.example";
function environment(){
  const cache=new Map();
  return {
    PORTAL_USERNAME:"admin",PORTAL_PASSWORD:"a-strong-test-password-999",
    PORTAL_SESSION_SECRET:"test-session-secret",
    STORAGE_ENCRYPTION_KEY:"test-encryption-secret",
    API_KEY:"model-test-secret",GITHUB_STORAGE_TOKEN:"private-storage-test",
    GITHUB_TRIGGER_TOKEN:"public-dispatch-test",
    GITHUB_STORAGE_REPO:"hanefimert2016-oss/Metodbox-secret-system",
    AUTH_KV:{get:async k=>cache.get(k)||null,
      put:async(k,v)=>{cache.set(k,v)},delete:async k=>cache.delete(k)}
  };
}
function apiReq(method,path,body,cookie){
  return new Request(origin+path,{method,headers:{Origin:origin,
    ...(cookie?{Cookie:cookie}:{}),...(body?{"Content-Type":"application/json"}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
}
async function login(env){
  const response=await handlePortalRequest(new Request(origin+"/apps/login",{
    method:"POST",headers:{Origin:origin,"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({username:"admin",password:env.PORTAL_PASSWORD,return_to:"/dot"})
  }),env,new URL(origin+"/apps/login"));
  assert.equal(response.status,303);assert.equal(response.headers.get("Location"),"/dot");
  return response.headers.get("set-cookie").split(";")[0];
}
function stubGithub(){
  const saved=new Map(),calls=[];
  return{calls,fetch:async(url,options={})=>{
    const u=new URL(String(url));const method=options.method||"GET";calls.push({url:u.href,method,body:options.body});
    if(u.pathname==="/repos/hanefimert2016-oss/Metodbox-secret-system")return Response.json({private:true});
    if(u.pathname.endsWith("/dispatches"))return new Response(null,{status:204});
    if(u.pathname.includes("/contents/")){
      const name=u.pathname.slice(u.pathname.indexOf("/contents/")+10);
      if(method==="GET")return saved.has(name)?Response.json(saved.get(name)):Response.json({message:"Not Found"},{status:404});
      if(method==="PUT"){const d=JSON.parse(options.body);const sha="sha-"+crypto.randomUUID();saved.set(name,{sha,content:d.content});return Response.json({content:{sha}},{status:201})}
      if(method==="DELETE"){saved.delete(name);return Response.json({})}
    }
    return Response.json({message:"Mock endpoint not implemented"},{status:500});
  }};
}
async function invoke(env,cookie,method,path,body,callModel){
  const response=await handleDotRequest(apiReq(method,path,body,cookie),env,new URL(origin+path),callModel||(()=>{throw Error("unexpected model call")}));
  const data=await response.json().catch(()=>({}));
  return {response,data};
}
test("Dot and team HTML contain syntactically valid mobile JS",async()=>{
  for(const response of [dotPage(),teamPage()]){
    const html=await response.text();
    const source=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(source?.length>100);
    assert.doesNotThrow(()=>new vm.Script(source));
    assert.ok(html.includes("viewport"));
  }
});
test("each chat gets its own main PC; children are isolated; two model requests overlap",async()=>{
  const stub=stubGithub(),original=globalThis.fetch;
  globalThis.fetch=stub.fetch;
  try{
    const env=environment(),cookie=await login(env);
    const a=await invoke(env,cookie,"POST","/dot/api/threads",{title:"Alpha"});
    const b=await invoke(env,cookie,"POST","/dot/api/threads",{title:"Beta"});
    assert.equal(a.response.status,201);assert.equal(b.response.status,201);
    assert.notEqual(a.data.id,b.data.id);
    const launches=stub.calls.filter(v=>v.url.endsWith("/dispatches")).map(v=>JSON.parse(v.body).client_payload.agent_id);
    assert.ok(launches.includes("ch-"+a.data.id));
    assert.ok(launches.includes("ch-"+b.data.id));
    assert.notEqual(launches[0],launches[1]);
    const route="/dot/api/chats/"+a.data.id+"/agents";
    const created=await invoke(env,cookie,"POST",route,{agents:[
      {name:"Araştırmacı",task:"Kütüphane araştırması"},
      {name:"Kodlayıcı",task:"Örnek kod yaz"}
    ]});
    assert.equal(created.response.status,201);
    assert.equal(created.data.agents.length,2);
    const ids=created.data.agents.map(x=>x.id);
    assert.ok(ids.every(id=>id.startsWith("ch-"+a.data.id+"-a")));
    assert.notEqual(ids[0],ids[1]);
    const cross=await invoke(env,cookie,"POST","/dot/api/pc/start",{chatId:b.data.id,agentId:ids[0]});
    assert.notEqual(cross.response.status,200);
    let active=0,max=0,count=0;
    const run=await invoke(env,cookie,"POST",route+"/run",{agentIds:ids},async request=>{
      active++;max=Math.max(max,active);count++;
      await new Promise(resolve=>setTimeout(resolve,65));
      active--;
      return {choices:[{message:{role:"assistant",content:"Rapor: "+request.messages.at(-1).content}}]};
    });
    assert.equal(run.response.status,200,JSON.stringify(run.data));
    assert.equal(run.data.reports.length,2);
    assert.equal(count,2);assert.ok(max>=2,"two independent model requests must overlap");
    assert.ok(run.data.reports.every(x=>x.report?.startsWith("Rapor:")));
    const roster=await invoke(env,cookie,"GET",route);
    assert.equal(roster.data.agents.length,2);
    assert.ok(roster.data.agents.every(x=>x.status==="done"));
    const states=await invoke(env,cookie,"GET","/dot/api/pc/status?chatId="+a.data.id);
    assert.equal(states.response.status,200);
  }finally{globalThis.fetch=original}
});

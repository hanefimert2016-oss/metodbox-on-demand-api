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
      if(method==="PUT"){
        const d=JSON.parse(options.body);
        // Simulate GitHub Contents API optimistic SHA requirements and create
        // a race window where two agent creation requests read the same roster.
        if(name.includes("/rosters/")||name.includes("/threads/"))await new Promise(r=>setTimeout(r,12));
        const previous=saved.get(name);
        if((previous&&d.sha!==previous.sha)||(!previous&&d.sha))
          return Response.json({message:"SHA mismatch"},{status:409});
        const sha="sha-"+crypto.randomUUID();
        saved.set(name,{sha,content:d.content});
        return Response.json({content:{sha}},{status:201});
      }
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

// Concurrent sessions must not choose the same a1 ID or overwrite prior agent
// entries. GitHub 409 retries need to reread and recalculate the roster.
test("simultaneous child creation retries real GitHub SHA conflicts without losing an agent",async()=>{
  const stub=stubGithub(),old=globalThis.fetch;
  globalThis.fetch=stub.fetch;
  try{
    const env=environment(),cookie=await login(env);
    const made=await invoke(env,cookie,"POST","/dot/api/threads",{title:"Çakışma testi"});
    assert.equal(made.response.status,201);
    const path="/dot/api/chats/"+made.data.id+"/agents";
    const [a,b]=await Promise.all([
      invoke(env,cookie,"POST",path,{name:"Birinci",task:"A görevini yap"}),
      invoke(env,cookie,"POST",path,{name:"İkinci",task:"B görevini yap"})
    ]);
    assert.equal(a.response.status,201,JSON.stringify(a.data));
    assert.equal(b.response.status,201,JSON.stringify(b.data));
    const ids=[a.data.agents[0].id,b.data.agents[0].id];
    assert.notEqual(ids[0],ids[1]);
    const read=await invoke(env,cookie,"GET",path);
    assert.equal(read.response.status,200);
    assert.equal(read.data.agents.length,2);
    assert.deepEqual(new Set(read.data.agents.map(v=>v.name)),new Set(["Birinci","İkinci"]));
  }finally{globalThis.fetch=old}
});

test("stale PC tunnel can be restarted and receives a fresh dispatch",async()=>{
  const stub=stubGithub(),old=globalThis.fetch;
  globalThis.fetch=stub.fetch;
  try{
    const env=environment(),cookie=await login(env);
    const made=await invoke(env,cookie,"POST","/dot/api/threads",{title:"Eski PC"});
    assert.equal(made.response.status,201);
    const pcid="ch-"+made.data.id;
    await env.AUTH_KV.put("agent_pc:"+pcid,JSON.stringify({
      agentId:pcid,status:"running",heartbeat:true,url:"https://old.trycloudflare.com",
      updated_at:Date.now()-20*60*1000
    }));
    const status=await invoke(env,cookie,"GET","/dot/api/pc/status?chatId="+made.data.id);
    assert.equal(status.data.status,"stale");
    const previous=stub.calls.filter(c=>c.url.endsWith("/dispatches")).length;
    const restarted=await invoke(env,cookie,"POST","/dot/api/pc/start",{chatId:made.data.id,agentId:"main"});
    assert.equal(restarted.response.status,200,JSON.stringify(restarted.data));
    const current=stub.calls.filter(c=>c.url.endsWith("/dispatches"));
    assert.equal(current.length,previous+1);
    assert.equal(JSON.parse(current.at(-1).body).client_payload.agent_id,pcid);
    // Existing runners launched before the heartbeat patch must not suddenly
    // be marked stale after 10 minutes while they are still actually running.
    await env.AUTH_KV.put("agent_pc:"+pcid,JSON.stringify({
      agentId:pcid,status:"running",url:"https://legacy.trycloudflare.com",
      updated_at:Date.now()-20*60*1000
    }));
    const legacy=await invoke(env,cookie,"GET","/dot/api/pc/status?chatId="+made.data.id);
    assert.equal(legacy.data.status,"running");
  }finally{globalThis.fetch=old}
});

test("simultaneous replies in one chat preserve BOTH user messages and answers",async()=>{
  const stub=stubGithub(),old=globalThis.fetch;
  globalThis.fetch=stub.fetch;
  try{
    const env=environment(),cookie=await login(env);
    const created=await invoke(env,cookie,"POST","/dot/api/threads",{title:"İki istek"});
    assert.equal(created.response.status,201);
    const path="/dot/api/message";
    const responses=await Promise.all([
      invoke(env,cookie,"POST",path,{threadId:created.data.id,text:"İlk soru"},async data=>{
        await new Promise(r=>setTimeout(r,30));
        return {choices:[{message:{role:"assistant",content:"Yanıt A"}}]};
      }),
      invoke(env,cookie,"POST",path,{threadId:created.data.id,text:"İkinci soru"},async data=>{
        await new Promise(r=>setTimeout(r,30));
        return {choices:[{message:{role:"assistant",content:"Yanıt B"}}]};
      })
    ]);
    assert.ok(responses.every(r=>r.response.status===200&&r.data.saved===true),
      JSON.stringify(responses.map(r=>({status:r.response.status,data:r.data}))));
    const read=await invoke(env,cookie,"GET","/dot/api/threads/"+created.data.id);
    assert.equal(read.response.status,200);
    assert.equal(read.data.messages.length,4);
    const content=read.data.messages.map(m=>m.content);
    for(const value of ["İlk soru","İkinci soru","Yanıt A","Yanıt B"])assert.ok(content.includes(value));
    assert.equal(new Set(read.data.messages.map(m=>m.id)).size,4);
  }finally{globalThis.fetch=old}
});

test("autonomous desktop control is opt-in per chat and old short passwords cannot enable it",async()=>{
  const stub=stubGithub(),old=globalThis.fetch;
  globalThis.fetch=stub.fetch;
  try{
    const env=environment(),cookie=await login(env);
    const made=await invoke(env,cookie,"POST","/dot/api/threads",{title:"GUI permissions"});
    assert.equal(made.response.status,201);
    const route="/dot/api/chats/"+made.data.id+"/agents/permissions";
    const before=await invoke(env,cookie,"GET","/dot/api/chats/"+made.data.id+"/agents");
    assert.equal(before.data.allowDesktopAI,undefined);
    const granted=await invoke(env,cookie,"POST",route,{allowDesktopAI:true});
    assert.equal(granted.response.status,200,JSON.stringify(granted.data));
    assert.equal(granted.data.allowDesktopAI,true);
    const verified=await invoke(env,cookie,"GET","/dot/api/chats/"+made.data.id+"/agents");
    assert.equal(verified.data.allowDesktopAI,true);
    const revoked=await invoke(env,cookie,"POST",route,{allowDesktopAI:false});
    assert.equal(revoked.response.status,200);
    assert.equal(revoked.data.allowDesktopAI,false);
    env.PORTAL_PASSWORD="2026";
    const shortCookie=await login(env);
    const invalid=await invoke(env,shortCookie,"POST",route,{allowDesktopAI:true});
    assert.equal(invalid.response.status,403);
    const mouse=await invoke(env,shortCookie,"POST","/dot/api/pc/desktop/action",
      {chatId:made.data.id,agentId:"main",action:"click",x:100,y:100});
    assert.equal(mouse.response.status,403);
  }finally{globalThis.fetch=old}
});

test("consented main AI can observe a screenshot then send real desktop click via authenticated PC proxy",async()=>{
  const github=stubGithub(),old=globalThis.fetch;
  let clicked=false,seenImage=false,round=0;
  globalThis.fetch=async(url,options={})=>{
    if(String(url).startsWith("https://unit-gui.trycloudflare.com/desktop/")){
      if(String(url).endsWith("/desktop/screenshot"))return Response.json({
        surface:"desktop",base64:"iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",width:1280,height:800
      });
      if(String(url).endsWith("/desktop/click")){
        const body=JSON.parse(options.body);
        clicked=body.x===120&&body.y===200;
        return Response.json({ok:true,action:"click",x:body.x,y:body.y});
      }
    }
    return github.fetch(url,options);
  };
  try{
    const env=environment(),cookie=await login(env);
    const create=await invoke(env,cookie,"POST","/dot/api/threads",{title:"GUI AI testi"});
    assert.equal(create.response.status,201);
    const id=create.data.id,agentId="ch-"+id;
    await env.AUTH_KV.put("agent_pc:"+agentId,JSON.stringify({
      status:"running",url:"https://unit-gui.trycloudflare.com",
      heartbeat:true,updated_at:Date.now()
    }));
    const grant=await invoke(env,cookie,"POST","/dot/api/chats/"+id+"/agents/permissions",{allowDesktopAI:true});
    assert.equal(grant.response.status,200);
    const result=await invoke(env,cookie,"POST","/dot/api/message",
      {threadId:id,text:"Ekranı analiz et ve belirtilen konuma tıkla."},async request=>{
        round++;
        if(round===1){
          assert.ok(request.tools.some(t=>t.function.name==="dot_desktop_see"));
          return {choices:[{message:{role:"assistant",content:"",tool_calls:[{
            id:"call_see",type:"function",function:{name:"dot_desktop_see",arguments:"{}"}
          }]}}]};
        }
        if(round===2){
          seenImage=request.messages.some(m=>Array.isArray(m.content)
            &&m.content.some(c=>c.type==="image_url"&&String(c.image_url?.url).startsWith("data:image/png;base64,")));
          return {choices:[{message:{role:"assistant",content:"",tool_calls:[{
            id:"call_click",type:"function",
            function:{name:"dot_desktop_click",arguments:JSON.stringify({x:120,y:200})}
          }]}}]};
        }
        return {choices:[{message:{role:"assistant",content:"Masaüstünü inceledim ve tıkladım."}}]};
      });
    assert.equal(result.response.status,200,JSON.stringify(result.data));
    assert.equal(seenImage,true);
    assert.equal(clicked,true);
    assert.match(result.data.content,/tıkladım/);
  }finally{globalThis.fetch=old}
});

test("streamed Dot tools execute before final answer and persist completed text",async()=>{
  const github=stubGithub(),old=globalThis.fetch;
  globalThis.fetch=github.fetch;
  try{
    const env=environment(),cookie=await login(env);
    const created=await invoke(env,cookie,"POST","/dot/api/threads",{title:"Stream tools"});
    assert.equal(created.response.status,201);
    let count=0;
    function events(choices){
      return new Response(choices.map(c=>"data: "+JSON.stringify({choices:[{delta:c}]})+"\n\n").join("")+"data: [DONE]\n\n",
        {headers:{"Content-Type":"text/event-stream"}});
    }
    const path="/dot/api/message/stream";
    const stream=await handleDotRequest(apiReq("POST",path,
      {threadId:created.data.id,text:"PC durumunu kontrol et."},cookie),env,
      new URL(origin+path),async body=>{
        assert.equal(body.stream,true);
        count++;
        if(count===1){
          return events([{tool_calls:[{index:0,id:"call_pc",type:"function",function:{name:"dot_pc_status",arguments:"{}"}}]}]);
        }
        assert.ok(body.messages.some(x=>x.role==="tool"&&x.tool_call_id==="call_pc"));
        return events([{content:"Bilgisayar "},{content:"durumu kontrol edildi."}]);
      });
    assert.equal(stream.status,200);
    assert.match(stream.headers.get("content-type"),/text\/event-stream/);
    const out=await stream.text();
    assert.ok(out.includes("event: token"));
    assert.ok(out.includes("event: done"));
    assert.ok(out.includes("Bilgisayar "));
    assert.equal(count,2);
    const state=await invoke(env,cookie,"GET","/dot/api/threads/"+created.data.id);
    assert.equal(state.data.messages.length,2);
    assert.equal(state.data.messages[1].content,"Bilgisayar durumu kontrol edildi.");
  }finally{globalThis.fetch=old}
});

test("chat creation does not wait for GitHub PC dispatch when Worker context exists",async()=>{
  const stub=stubGithub(),old=globalThis.fetch;
  let dispatchCompleted=false, pending=null;
  globalThis.fetch=async(url,opts={})=>{
    if(String(url).endsWith("/dispatches")){
      await new Promise(resolve=>setTimeout(resolve,140));
      dispatchCompleted=true;
    }
    return stub.fetch(url,opts);
  };
  try{
    const env=environment(),cookie=await login(env);
    const path="/dot/api/threads";
    const started=Date.now();
    const result=await handleDotRequest(apiReq("POST",path,{title:"Fast chat"},cookie),
      env,new URL(origin+path),async()=>{},{
        waitUntil(task){pending=task;}
      });
    assert.equal(result.status,201);
    const data=await result.json();
    assert.equal(data.pc.status,"requested");
    assert.ok(Date.now()-started<140,"new chat must not wait for GitHub dispatch");
    assert.equal(dispatchCompleted,false);
    assert.ok(pending);
    await pending;
    assert.equal(dispatchCompleted,true);
  }finally{globalThis.fetch=old}
});

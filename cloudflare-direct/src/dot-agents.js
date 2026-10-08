import { getRoster, updateRoster, ensurePc, readPcState } from "./threadhub.js";

export const MAX_AGENTS = 6;
export const PARALLEL_AGENTS = 3;
export function mainPcId(chatId) {
  if(!/^[a-f0-9-]{36}$/i.test(String(chatId||""))) throw Error("Invalid chat ID");
  return "ch-"+chatId;
}
function validChild(id,chatId){return /^ch-[a-f0-9-]{36}-a[1-6]$/i.test(id)&&id.startsWith(mainPcId(chatId)+"-")}
export async function rosterFor(env,chatId){
  const roster=await getRoster(env,chatId);
  return {...roster,mainPc:await readPcState(env,mainPcId(chatId)),agents:await Promise.all(roster.agents.map(async a=>({...a,pc:await readPcState(env,a.id)})))};
}
export async function createAgents(env,chatId,specs){
  if(!Array.isArray(specs)||!specs.length||specs.length>PARALLEL_AGENTS)throw Error("1-3 alt agent aynı anda oluşturulabilir.");
  const agents=[];
  const updated=await updateRoster(env,chatId,roster=>{
    if(roster.agents.length+specs.length>MAX_AGENTS)
      throw Error("Bir sohbette en fazla 6 alt agent açılabilir.");
    const existing=new Set(roster.agents.map(a=>a.id));
    const now=Date.now();
    // Each retry must reallocate slots from the latest encrypted roster.
    const allocated=specs.map((p,i)=>{
      if(typeof p?.task!=="string"||!p.task.trim()||p.task.length>2000)
        throw Error("Agent görevi 1-2000 karakter olmalı.");
      const id=Array.from({length:MAX_AGENTS},(_,n)=>mainPcId(chatId)+"-a"+(n+1)).find(n=>!existing.has(n));
      if(!id)throw Error("Agent slot unavailable");
      existing.add(id);
      return {id,name:String(p.name||"Alt Agent "+(roster.agents.length+i+1)).slice(0,80),
        task:p.task.trim(),status:"starting",report:"",createdAt:now,updatedAt:now};
    });
    agents.splice(0,agents.length,...allocated);
    return {...roster,agents:[...roster.agents,...allocated]};
  });
  const pc=await Promise.allSettled(agents.map(a=>ensurePc(env,a.id)));
  for(let i=0;i<agents.length;i++){
    agents[i].pc=pc[i].status==="fulfilled"?pc[i].value:{status:"error",message:String(pc[i].reason)};
  }
  return {agents,roster:updated};
}
export async function updateAgentReports(env,chatId,reports){
  const map=new Map(reports.map(r=>[r.id,r]));
  return updateRoster(env,chatId,current=>({
    ...current,
    agents:current.agents.map(a=>map.has(a.id)?{
      ...a,status:map.get(a.id).error?"error":"done",
      report:String(map.get(a.id).report||map.get(a.id).error||"").slice(0,8000),
      updatedAt:Date.now()
    }:a)
  }));
}

export async function getAuthorizedAgent(env,chatId,agentId){
  if(agentId==="main"||agentId===mainPcId(chatId))return mainPcId(chatId);
  if(!validChild(String(agentId),chatId))throw Error("This agent PC does not belong to the selected chat");
  const roster=await getRoster(env,chatId);
  if(!roster.agents.some(a=>a.id===agentId))throw Error("Agent does not belong to this chat");
  return agentId;
}
export async function runAgentsInParallel(env,chatId,specs,run){
  const created=await createAgents(env,chatId,specs);
  // Child requests use the same GPT+ gateway but separate agent memory and PCs.
  // Promise.allSettled guarantees one failed agent won't cancel sibling requests.
  const outcomes=await Promise.allSettled(created.agents.map(async agent=>({
    id:agent.id,name:agent.name,report:await run(agent)
  })));
  const reports=outcomes.map((o,i)=>o.status==="fulfilled"?o.value:
    {id:created.agents[i].id,name:created.agents[i].name,error:String(o.reason)});
  await updateAgentReports(env,chatId,reports);
  return reports;
}

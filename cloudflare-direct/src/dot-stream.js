// True GPT+ OpenAI-compatible streaming completion collector.
// Emits deltas as the upstream SSE produces them; reconstructs fragmented
// tool calls for later execution by the existing secure Dot tool router.
function contentOf(v) {
  if(typeof v==="string")return v;
  if(Array.isArray(v))return v.map(p=>typeof p==="string"?p:p?.text||"").join("");
  return "";
}

export async function collectStreamCompletion(response,onToken=()=>{}) {
  if(!(response instanceof Response)) {
    // Test and older integrations may provide an already parsed completion.
    const c=response?.choices?.[0];
    const message=c?.message||{};
    const text=contentOf(message.content);
    if(text)await onToken(text);
    return {message:{role:"assistant",content:text,tool_calls:message.tool_calls||[]},
      finish_reason:c?.finish_reason||"stop"};
  }
  if(!response.ok)throw Error("Streaming model HTTP "+response.status+": "+(await response.text()).slice(0,220));
  const contentType=response.headers.get("content-type")||"";
  if(!contentType.includes("text/event-stream")) {
    const data=await response.json();
    return collectStreamCompletion(data,onToken);
  }
  if(!response.body)throw Error("GPT+ stream has no body.");
  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  const toolCalls=new Map();
  let text="",buffer="",finish_reason=null,events=0,totalBytes=0;
  async function parseBlock(block) {
    const data=block.split("\n").filter(line=>line.startsWith("data:"))
      .map(line=>line.slice(5).trimStart()).join("\n").trim();
    if(!data||data==="[DONE]")return;
    let evt;
    try{evt=JSON.parse(data)}catch{return}
    if(evt?.error)throw Error("GPT+ stream: "+JSON.stringify(evt.error).slice(0,220));
    const choice=evt?.choices?.[0];
    if(!choice)return;
    if(choice.finish_reason)finish_reason=choice.finish_reason;
    const delta=choice.delta||choice.message||{};
    const part=contentOf(delta.content);
    if(part){
      text+=part;
      if(text.length>160000)throw Error("Model streaming output exceeded limit");
      await onToken(part);
    }
    for(const call of delta.tool_calls||[]) {
      const index=Number.isInteger(call.index)?call.index:toolCalls.size;
      if(!toolCalls.has(index))toolCalls.set(index,{id:"",type:"function",function:{name:"",arguments:""}});
      const target=toolCalls.get(index);
      if(call.id)target.id=call.id;
      if(call.function?.name)target.function.name+=call.function.name;
      if(call.function?.arguments)target.function.arguments+=call.function.arguments;
      if(target.function.arguments.length>20000)throw Error("Tool arguments exceed limit");
    }
    events++;
    if(events>25000)throw Error("GPT+ stream exceeds event limit");
  }
  try{
    for(;;) {
      const {done,value}=await reader.read();
      if(done)break;
      totalBytes+=value.byteLength;
      if(totalBytes>900000)throw Error("Model stream is too large");
      buffer+=decoder.decode(value,{stream:true});
      buffer=buffer.replace(/\r\n/g,"\n");
      let stop;
      while((stop=buffer.indexOf("\n\n"))>=0) {
        await parseBlock(buffer.slice(0,stop));
        buffer=buffer.slice(stop+2);
      }
    }
    buffer+=decoder.decode();
    if(buffer.trim())await parseBlock(buffer);
  }finally{reader.releaseLock()}
  const calls=[...toolCalls.entries()].sort((a,b)=>a[0]-b[0]).map(([,v],i)=>({
    id:v.id||"call_"+i,type:"function",function:{
      name:v.function.name,arguments:v.function.arguments||"{}"
    }
  }));
  return {message:{role:"assistant",content:text,tool_calls:calls},finish_reason:finish_reason||"stop"};
}

import {test} from "node:test";
import assert from "node:assert/strict";
import {collectStreamCompletion} from "../../cloudflare-direct/src/dot-stream.js";

function chunks(text,sizes){
  const encoder=new TextEncoder(),bytes=encoder.encode(text);
  return new ReadableStream({start(controller){
    let i=0,n=0;
    while(i<bytes.length){const cut=sizes[n++%sizes.length];controller.enqueue(bytes.slice(i,i+cut));i+=cut}
    controller.close();
  }});
}
function sse(events){
 return events.map(e=>"data: "+JSON.stringify(e)+"\r\n\r\n").join("")+"data: [DONE]\r\n\r\n";
}
test("real upstream streamed content reaches client in multiple chunks, not fake typing",async()=>{
 const data=sse([
  {choices:[{delta:{role:"assistant",content:"Mer"}}]},
  {choices:[{delta:{content:"haba"}}]},
  {choices:[{delta:{content:" dünya."},finish_reason:"stop"}]}
 ]);
 const received=[];
 const response=new Response(chunks(data,[1,2,3,5,7]),{headers:{"Content-Type":"text/event-stream"}});
 const result=await collectStreamCompletion(response,async part=>received.push(part));
 assert.deepEqual(received,["Mer","haba"," dünya."]);
 assert.equal(result.message.content,"Merhaba dünya.");
 assert.equal(result.message.tool_calls.length,0);
});
test("fragmented upstream tool_calls are reconstructed with valid JSON",async()=>{
 const payload=sse([
 {choices:[{delta:{tool_calls:[{index:0,id:"call_abc",type:"function",function:{name:"dot_pc_",arguments:'{"url":"https://'}}]}}]},
 {choices:[{delta:{tool_calls:[{index:0,function:{name:"navigate",arguments:'example.org"}'}}]},finish_reason:"tool_calls"}]}
 ]);
 const response=new Response(chunks(payload,[2,1,5,4,3]),{headers:{"Content-Type":"text/event-stream"}});
 const {message}=await collectStreamCompletion(response);
 assert.equal(message.tool_calls[0].function.name,"dot_pc_navigate");
 assert.deepEqual(JSON.parse(message.tool_calls[0].function.arguments),{url:"https://example.org"});
});
test("JSON-only upstream gracefully falls back to a single direct completion",async()=>{
 const result=await collectStreamCompletion(Response.json({choices:[{message:{content:"Yanıt"}}]}));
 assert.equal(result.message.content,"Yanıt");
});

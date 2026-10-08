const TOKEN="6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const TIMEOUT_MS=16000;
const ALLOWED=new Set(["tr-TR-EmelNeural","tr-TR-AhmetNeural","en-US-AriaNeural","en-US-GuyNeural"]);
const escape=(v)=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
async function msGec(){
  const unix=Math.floor(Date.now()/300000)*300000;
  const ticks=String((BigInt(Math.floor(unix/1000)+11644473600)*10000000n));
  const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ticks+TOKEN));
  return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,"0")).join("").toUpperCase();
}
function header(){return new Date().toUTCString().replace("GMT","+0000")}
function frameText(payload){
  return "X-RequestId:"+crypto.randomUUID().replace(/-/g,"")+"\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:"+header()+"\r\nPath:ssml\r\n\r\n"+payload;
}
// Unofficial Edge Read Aloud endpoint, not an SLA or stable API.
// No local inference. Browser voice is the fallback on upstream failure.
export async function edgeSynthesize(input, requestedVoice="tr-TR-EmelNeural"){
  const text=String(input||"").trim();
  if(!text||text.length>1200)throw Error("Edge TTS text length must be 1..1200.");
  const voice=ALLOWED.has(requestedVoice)?requestedVoice:"tr-TR-EmelNeural";
  const id=crypto.randomUUID().replace(/-/g,"");
  const url="https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1"+
    "?TrustedClientToken="+TOKEN+"&Sec-MS-GEC="+await msGec()+
    "&Sec-MS-GEC-Version=1-143.0.3650.75&ConnectionId="+id;
  const result=await fetch(url,{headers:{
    Upgrade:"websocket",
    Origin:"chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
    Cookie:"muid="+crypto.randomUUID().replace(/-/g,"").toUpperCase()+";",
    "Cache-Control":"no-cache",
    Pragma:"no-cache",
    "Accept-Language":"tr-TR,tr;q=0.9,en-US;q=0.8",
    "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
  }});
  if(result.status!==101||!result.webSocket)throw Error("Edge TTS handshake HTTP "+result.status);
  const ws=result.webSocket;
  ws.accept();
  return await new Promise((resolve,reject)=>{
    const chunks=[];let total=0,done=false;
    const finish=(error)=>{
      if(done)return;done=true;clearTimeout(timer);try{ws.close(1000,"done")}catch(_){}
      if(error){reject(error);return}
      if(!total){reject(Error("Edge TTS returned no audio"));return}
      const output=new Uint8Array(total);let offset=0;
      for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length}
      resolve(output);
    };
    const timer=setTimeout(()=>finish(Error("Edge TTS timed out")),TIMEOUT_MS);
    ws.addEventListener("message",async e=>{
      try{
        if(typeof e.data==="string"){
          if(e.data.includes("Path:turn.end"))finish();
          return;
        }
        const data=e.data instanceof ArrayBuffer?new Uint8Array(e.data):new Uint8Array(await e.data.arrayBuffer());
        if(data.length<3)return;
        const head=(data[0]<<8)|data[1];
        if(head+2>data.length)return;
        const chunk=data.slice(head+2);total+=chunk.length;
        if(total>2_000_000){finish(Error("Audio exceeds limit"));return}
        chunks.push(chunk);
      }catch(err){finish(err)}
    });
    ws.addEventListener("error",()=>finish(Error("Edge TTS connection error")));
    ws.addEventListener("close",()=>{if(!done)finish(Error("Edge TTS ended early"))});
    const config={context:{synthesis:{audio:{metadataoptions:{sentenceBoundaryEnabled:"false",wordBoundaryEnabled:"false"},outputFormat:"audio-24khz-48kbitrate-mono-mp3"}}}};
    ws.send("X-Timestamp:"+header()+"\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n"+JSON.stringify(config));
    const ssml="<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='tr-TR'><voice name='"+voice+"'><prosody pitch='+0Hz' rate='+0%'>"+escape(text)+"</prosody></voice></speak>";
    ws.send(frameText(ssml));
  });
}
